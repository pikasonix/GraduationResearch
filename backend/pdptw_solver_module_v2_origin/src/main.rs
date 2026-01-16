#![allow(dead_code)]

use std::path::Path;

use clap::{CommandFactory, FromArgMatches};
use log::info;
use rand::random;
use took::Timer;

use crate::cli::Solver;
use crate::io::load_instance_with_format;
use crate::io::sintef_solution::SINTEFSolutionBuilder;
use crate::solution::Solution;
#[cfg(feature = "timed_solution_logger")]
use crate::utils::logging::timed::TimedSolutionLogger;
#[cfg(feature = "progress_tracking")]
use crate::utils::stats::search_progress_stats::SearchProgressTracking;
#[cfg(feature = "search_assertions")]
use crate::utils::validator::{assert_valid_solution, assert_valid_solution_description};
use crate::utils::create_seeded_rng;

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

    let load_timer = Timer::new();
    let instance = load_instance_with_format(&args.instance, max_vehicles, &args.format)?;

    log::info!("instance loaded after {}", load_timer.took());

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
