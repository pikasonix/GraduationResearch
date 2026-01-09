#![allow(dead_code)]

use std::path::Path;

use clap::{CommandFactory, FromArgMatches};
use log::info;
use rand::random;
use took::Timer;

use crate::cli::Solver;
use crate::io::load_instance;
#[cfg(feature = "classic-pdptw")]
use crate::io::load_instance_with_format;
#[cfg(not(feature = "classic-pdptw"))]
use crate::io::nyc_reader::NYCInstanceElements;
use crate::io::sintef_solution::SINTEFSolutionBuilder;
#[cfg(not(feature = "classic-pdptw"))]
use crate::problem::pdptw::create_instance_with;
#[cfg(not(feature = "classic-pdptw"))]
use crate::problem::travel_matrix::TravelMatrixProxy;
use crate::solution::Solution;
#[cfg(feature = "timed_solution_logger")]
use crate::utils::logging::timed::TimedSolutionLogger;
#[cfg(feature = "progress_tracking")]
use crate::utils::stats::search_progress_stats::SearchProgressTracking;
#[cfg(feature = "search_assertions")]
use crate::utils::validator::{assert_valid_solution, assert_valid_solution_description};
use crate::utils::create_seeded_rng;
use crate::solver::dynamic::{
    ReoptimizeConfig, ReoptimizeContext, 
    load_vehicle_states, load_new_requests, to_result_json
};

mod clustering;
mod construction;
mod io;
mod lns;
mod problem;
mod refn;
mod solution;
mod solver;
mod utils;

mod cli;
mod pooling;
mod ages;

fn main() -> anyhow::Result<()> {
    env_logger::init();

    let args = argfile::expand_args_from(
        std::env::args_os(),
        argfile::parse_fromfile,
        argfile::PREFIX,
    )?;
    // Important: do NOT split OS-provided argv tokens by spaces.
    // That breaks arguments that legitimately contain spaces (e.g. --authors "PDPTW Solver").
    let args = cli::ProgramArguments::from_arg_matches(
        &cli::ProgramArguments::command().get_matches_from(args)
    )?;
    info!("{:?}", &args);

    let (seed_value, mut rng) = {
        let seed_value = args.seed.unwrap_or_else(|| random::<i128>().abs());
        info!("seed: {}", seed_value);
        (seed_value, create_seeded_rng(seed_value))
    };
    let max_vehicles = args.max_vehicles;

    #[cfg(not(feature = "classic-pdptw"))]
    {
        let load_timer = Timer::new();
        let NYCInstanceElements {
            name,
            num_vehicles,
            num_requests,
            vehicles,
            nodes,
            travel_matrix,
        } = load_instance(&args.instance, max_vehicles)?;

        // revisit later: how to avoid leaking the matrix?
        let matrix = Box::leak(Box::new(travel_matrix));
        let mapping = nodes.iter().map(|node| node.gid).collect();
        let instance = create_instance_with(
            name,
            num_vehicles,
            num_requests,
            vehicles,
            nodes,
            TravelMatrixProxy::new(
                mapping, matrix,
            ),
        )?;

        #[cfg(feature = "progress_tracking")]
            let mut progress_tracking = SearchProgressTracking::new();

        info!("instance loaded after {}", load_timer.took());

        info!("starting solver");
        let res = match &args.solver.variant {
            Solver::LS_AGES_LNS => solver::ls_solver::ls_ages_lns(
                &instance,
                &args.solver,
                &mut rng,
                #[cfg(feature = "progress_tracking")] &mut progress_tracking,
                #[cfg(
                    feature = "timed_solution_logger"
                )] TimedSolutionLogger::with_args_and_seed(&args, seed_value),
            ),
            Solver::Construction_Only => {
                solver::construction_only(&instance, &args.solver, &mut rng)
            }
        };

        info!("finished after {}", res.time);
        info!(
            "best solution found: {}/{}/{}",
            res.solution.number_of_unassigned_requests(),
            res.solution.number_of_vehicles_used(),
            res.solution.objective()
        );

        #[cfg(feature = "search_assertions")]
        assert_valid_solution_description(&instance, &res.solution);

        if args.print_summary_to_stdout {
            println!(
                "{},{},{},{}",
                res.solution.number_of_unassigned_requests(),
                res.solution.number_of_vehicles_used(),
                res.solution.total_cost(),
                res.time.as_std().as_secs()
            );
        }

        let instance_name = Path::new(&args.instance)
            .file_name()
            .unwrap()
            .to_str()
            .unwrap();

        let solution_out = args
            .solution
            .map(|it| it.to_string())
            .or(args.solution_directory.clone().map(|dir| {
                format!(
                    "{}/{}.{}_{}_{}.{}.sol",
                    dir,
                    instance_name,
                    res.solution.unassigned_requests,
                    res.solution.vehicles_used,
                    res.solution.objective,
                    seed_value
                )
            }))
            .or_else(|| {
                // Use output_dir if no explicit solution path given
                Some(format!(
                    "{}/{}.{}_{}_{}.{}.sol",
                    args.output_dir,
                    instance_name,
                    res.solution.unassigned_requests,
                    res.solution.vehicles_used,
                    res.solution.objective,
                    seed_value
                ))
            });

        if let Some(solution_path) = solution_out {
            // Create output directory if it doesn't exist
            if let Some(parent) = Path::new(&solution_path).parent() {
                std::fs::create_dir_all(parent)?;
            }
            
            let mut sintef_solution_builder = SINTEFSolutionBuilder::new();
            sintef_solution_builder
                .instance_name(instance_name)
                .authors(args.authors.join(" "))
                .reference(args.reference.join(" "))
                .routes_from_solution_description(&res.solution, &instance);
            io::sintef_solution::write_sintef_solution(
                solution_path.to_string(),
                sintef_solution_builder.build(),
                Some(res),
            )?;
        }

        #[cfg(feature = "progress_tracking")]
        {
            if let Some(tracking_filepath) = args.tracking_file.map(|it| it.to_string()) {
                progress_tracking.write_json(Path::new(tracking_filepath.as_str()))?;
            }
        }

        return Ok(());
    }
    #[cfg(feature = "classic-pdptw")]
    {
        let load_timer = Timer::new();
        let instance = load_instance_with_format(&args.instance, max_vehicles, &args.format)?;

        log::info!("instance loaded after {}", load_timer.took());

        // Check for dynamic re-optimization mode
        if args.solver.dynamic {
            return run_dynamic_reoptimization(&args, &instance, &mut rng);
        }

        log::info!("starting solver {:?}", &args.solver.variant);

        #[cfg(feature = "progress_tracking")]
            let mut progress_tracking = SearchProgressTracking::new();

        let res = match &args.solver.variant {
            Solver::LS_AGES_LNS => solver::ls_solver::ls_ages_lns(
                &instance,
                &args.solver,
                &mut rng,
                #[cfg(feature = "progress_tracking")] &mut progress_tracking,
                #[cfg(
                    feature = "timed_solution_logger"
                )] TimedSolutionLogger::with_args_and_seed(&args, seed_value),
            ),
            Solver::Construction_Only => {
                solver::construction_only(&instance, &args.solver, &mut rng)
            }
        };
        log::info!("finished after {}", res.time);
        log::info!(
            "best solution found {}/{}/{}",
            res.solution.number_of_unassigned_requests(),
            res.solution.number_of_vehicles_used(),
            res.solution.objective
        );

        if args.print_for_tuning {
            println!(
                "{:01}{:04}{:010} {}",
                res.solution.number_of_unassigned_requests(),
                res.solution.number_of_vehicles_used(),
                res.solution.total_cost().value(),
                res.time.as_std().as_secs()
            );
        }

        #[cfg(feature = "search_assertions")]
        assert_valid_solution_description(&instance, &res.solution);

        let instance_name = Path::new(&args.instance)
            .file_name()
            .unwrap()
            .to_str()
            .unwrap();

        let solution_out = args
            .solution
            .map(|it| it.to_string())
            .or(args.solution_directory.clone().map(|dir| {
                format!(
                    "{}/{}.{}_{}_{}.{}.sol",
                    dir,
                    instance_name,
                    res.solution.unassigned_requests,
                    res.solution.vehicles_used,
                    res.solution.total_cost,
                    seed_value
                )
            }))
            .or_else(|| {
                // Use output_dir if no explicit solution path given
                Some(format!(
                    "{}/{}.{}_{}_{}.{}.sol",
                    args.output_dir,
                    instance_name,
                    res.solution.unassigned_requests,
                    res.solution.vehicles_used,
                    res.solution.total_cost,
                    seed_value
                ))
            });

        if let Some(solution_path) = solution_out {
            // Create output directory if it doesn't exist
            if let Some(parent) = Path::new(&solution_path).parent() {
                std::fs::create_dir_all(parent)?;
            }
            
            let mut sintef_solution_builder = SINTEFSolutionBuilder::new();
            sintef_solution_builder
                .instance_name(instance_name)
                .authors(args.authors.join(" "))
                .reference(args.reference.join(" "))
                .routes_from_solution_description(&res.solution, &instance);
            io::sintef_solution::write_sintef_solution(
                solution_path.to_string(),
                sintef_solution_builder.build(),
                Some(res),
            )?;
        }

        #[cfg(feature = "progress_tracking")]
        {
            if let Some(tracking_filepath) = args.tracking_file.map(|it| it.to_string()) {
                progress_tracking.write_json(Path::new(tracking_filepath.as_str()))?;
            }
        }
        Ok(())
    }
}

/// Run dynamic re-optimization mode
#[cfg(feature = "classic-pdptw")]
fn run_dynamic_reoptimization(
    args: &cli::ProgramArguments,
    instance: &problem::pdptw::PDPTWInstance,
    rng: &mut utils::Random,
) -> anyhow::Result<()> {
    use crate::problem::Num;
    
    log::info!("Running in DYNAMIC re-optimization mode");
    
    // Load vehicle states
    let vehicle_states_json = if let Some(ref path) = args.solver.vehicle_states {
        load_vehicle_states(path)?
    } else {
        // Default: all vehicles at depot with no load
        (0..instance.num_vehicles)
            .map(|v| solver::dynamic::VehicleStateJson {
                vehicle_id: v,
                current_position: [instance.nodes[v * 2].x, instance.nodes[v * 2].y],
                current_time: instance.nodes[v * 2].ready.value() as f64,
                current_load: 0,
                in_transit_deliveries: vec![],
                committed_requests: vec![],
            })
            .collect()
    };
    
    let vehicle_states: Vec<_> = vehicle_states_json.iter()
        .map(|vs| vs.to_vehicle_state())
        .collect();
    
    log::info!("  Loaded {} vehicle states", vehicle_states.len());
    
    // Load new requests (if any)
    let new_requests_json = if let Some(ref path) = args.solver.new_requests {
        load_new_requests(path)?
    } else {
        vec![]
    };
    
    let new_requests: Vec<_> = new_requests_json.iter()
        .map(|nr| nr.to_new_request())
        .collect();
    
    log::info!("  Loaded {} new requests", new_requests.len());
    
    // Create config
    let config = ReoptimizeConfig {
        late_penalty_per_minute: Num::from(args.solver.late_penalty),
        unassigned_penalty: Num::from(args.solver.unassigned_penalty),
        lock_committed: args.solver.lock_committed,
        lock_time_threshold: args.solver.lock_time_threshold.map(Num::from),
    };
    
    // Get current solution (warmstart or construct new)
    let current_solution = if let Some(ref sol_path) = args.solver.warmstart_solution_file {
        // Load warmstart solution
        let sintef_sol = io::sintef_solution::load_sintef_solution(sol_path)?;
        solution::create_solution_from_sintef(sintef_sol, instance).to_description()
    } else {
        // Construct initial solution
        let mut sol = Solution::new(instance);
        solver::ls_solver::construct_initial_solution_pub(instance, &args.solver, &mut sol, rng);
        sol.to_description()
    };
    
    log::info!("  Current solution: {}/{}/{}",
        current_solution.unassigned_requests,
        current_solution.vehicles_used,
        current_solution.total_cost.value()
    );
    
    // Create context and run re-optimization
    let context = ReoptimizeContext {
        base_instance: instance,
        current_solution: &current_solution,
        vehicle_states,
        new_requests,
        config,
    };
    
    let result = solver::dynamic::reoptimize(context, &args.solver, rng);
    
    // Output result as JSON to stdout
    let result_json = to_result_json(&result, instance);
    let json_output = serde_json::to_string_pretty(&result_json)?;
    println!("{}", json_output);
    
    // Also save SINTEF solution if output path specified
    if let Some(ref solution_path) = args.solution {
        let instance_name = Path::new(&args.instance)
            .file_name()
            .unwrap()
            .to_str()
            .unwrap();
        
        let mut sintef_solution_builder = SINTEFSolutionBuilder::new();
        sintef_solution_builder
            .instance_name(instance_name)
            .authors(args.authors.join(" "))
            .reference("Dynamic Re-optimization")
            .routes_from_solution_description(&result.solution, instance);
        
        if let Some(parent) = Path::new(solution_path).parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        io::sintef_solution::write_sintef_solution(
            solution_path.to_string(),
            sintef_solution_builder.build(),
            None,
        )?;
        
        log::info!("Solution saved to: {}", solution_path);
    }
    
    Ok(())
}
