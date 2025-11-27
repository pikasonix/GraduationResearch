#include "pdptw/ages/ages_solver.hpp"
#include "pdptw/construction/constructor.hpp"
#include "pdptw/io/li_lim_reader.hpp"
#include "pdptw/io/sartori_buriol_reader.hpp"
#include "pdptw/io/sintef_solution.hpp"
#include "pdptw/lns/largescale/decomposition_lns.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include "pdptw/solution/description.hpp"
#include "pdptw/solver/lns_solver.hpp"
#include "pdptw/utils/logging.hpp"
#include "pdptw/utils/time_limit.hpp"
#include "pdptw/utils/validator.hpp"
#include <CLI/CLI.hpp>
#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <random>
#include <spdlog/spdlog.h>

namespace fs = std::filesystem;
using namespace pdptw;

int main(int argc, char **argv) {
    // CLI Setup
    CLI::App app{"PDPTW Solver - Large Scale Pickup and Delivery Problem with Time Windows"};

    std::string instance_file;
    std::string output_dir = "solutions";
    std::string log_level = "info";
    std::string format = "auto";

    // LNS Parameters
    int max_iterations = 100000;
    int max_non_improving = 20000;
    double time_limit_seconds = 0.0;
    double min_destroy = 0.20;
    double max_destroy = 0.35;
    int min_destroy_count = -1;
    int max_destroy_count = -1;
    unsigned int seed = 42;
    std::string acceptance = "rtr"; // RTR or SA or Greedy

    // Solution metadata
    std::string authors = "PDPTW Solver";
    std::string reference = "LNS with SA/RTR";

    size_t max_vehicles = 0;

    app.add_option("-i,--instance", instance_file, "Instance file path (Li-Lim/SINTEF format)")
        ->required()
        ->check(CLI::ExistingFile);

    app.add_option("-f,--format", format, "Instance format: auto, lilim, sartori")
        ->default_val("auto")
        ->check(CLI::IsMember({"auto", "lilim", "sartori"}));

    app.add_option("-o,--output", output_dir, "Output directory for solutions")
        ->default_val("solutions");

    app.add_option("--iterations", max_iterations, "Maximum LNS iterations")
        ->default_val(100000);

    app.add_option("--max-non-improving", max_non_improving, "Max non-improving iterations")
        ->default_val(20000);

    app.add_option("--time-limit", time_limit_seconds, "Time limit in seconds (0=no limit)")
        ->default_val(0);

    auto min_destroy_fraction_opt = app.add_option("--min-destroy", min_destroy, "Min destroy fraction (0.0-1.0)")
                                        ->default_val(0.10)
                                        ->check(CLI::Range(0.0, 1.0));

    auto max_destroy_fraction_opt = app.add_option("--max-destroy", max_destroy, "Max destroy fraction (0.0-1.0)")
                                        ->default_val(0.40)
                                        ->check(CLI::Range(0.0, 1.0));

    auto min_destroy_count_opt = app.add_option(
                                        "--min-destroy-count",
                                        min_destroy_count,
                                        "Min destroy count (overrides --min-destroy when > 0)")
                                     ->default_val(-1)
                                     ->check(CLI::Range(-1, 1000));

    auto max_destroy_count_opt = app.add_option(
                                        "--max-destroy-count",
                                        max_destroy_count,
                                        "Max destroy count (overrides --max-destroy when > 0)")
                                     ->default_val(-1)
                                     ->check(CLI::Range(-1, 1000));

    app.add_option("--seed", seed, "Random seed")
        ->default_val(42);

    app.add_option("--acceptance", acceptance, "Acceptance criterion: sa (Simulated Annealing), rtr (Record-to-Record), greedy (Only Improvements)")
        ->default_val("rtr")
        ->check(CLI::IsMember({"sa", "rtr", "greedy"}));

    app.add_option("--max-vehicles", max_vehicles, "Maximum vehicles (0=auto)")
        ->default_val(0);

    app.add_option("--authors", authors, "Solution authors metadata")
        ->default_val("PDPTW Solver");

    app.add_option("--reference", reference, "Solution reference metadata")
        ->default_val("LNS with SA/RTR");

    app.add_option("-l,--log-level", log_level, "Log level (trace, debug, info, warn, error)")
        ->default_val("info");

    CLI11_PARSE(app, argc, argv);

    const bool user_set_destroy_fractions =
        (min_destroy_fraction_opt->count() > 0) || (max_destroy_fraction_opt->count() > 0);
    bool user_set_destroy_counts =
        (min_destroy_count_opt->count() > 0) || (max_destroy_count_opt->count() > 0);

    if (!user_set_destroy_fractions && !user_set_destroy_counts) {
        user_set_destroy_counts = false;
    }

    if (user_set_destroy_counts) {
        if (min_destroy_count < 0 && max_destroy_count > 0) {
            min_destroy_count = max_destroy_count;
        }
        if (max_destroy_count < 0 && min_destroy_count > 0) {
            max_destroy_count = min_destroy_count;
        }
    }

    // Initialization
    pdptw::utils::init_logging(log_level);

    auto start_time = std::chrono::high_resolution_clock::now();

    // Load Instance
    spdlog::info("Loading instance: {}", instance_file);

    problem::PDPTWInstance instance;
    try {
        if (format == "lilim") {
            instance = io::load_li_lim_instance(instance_file, max_vehicles);
        } else if (format == "sartori") {
            instance = io::load_sartori_buriol_instance(instance_file, max_vehicles);
        } else {
            try {
                instance = io::load_li_lim_instance(instance_file, max_vehicles);
            } catch (const std::exception &e) {
                spdlog::info("Failed to load as Li & Lim format ({}), trying Sartori & Buriol format...", e.what());
                instance = io::load_sartori_buriol_instance(instance_file, max_vehicles);
            }
        }
    } catch (const std::exception &e) {
        spdlog::error("Failed to load instance: {}", e.what());
        return 1;
    }

    std::string instance_name = fs::path(instance_file).stem().string();

    spdlog::info("Instance: {} ({} requests, {} vehicles)", instance_name, instance.num_requests(), instance.num_vehicles());

    // Construct Initial Solution

    solution::Solution initial_solution = construction::Constructor::construct(
        instance,
        construction::ConstructionStrategy::SequentialInsertion);

    solution::SolutionDescription init_desc(initial_solution);
    spdlog::info("Initial solution: {:.2f} ({} routes)", initial_solution.objective(), init_desc.num_routes());

    auto validation = utils::validate_solution(instance, initial_solution);
    if (!validation.is_valid) {
        spdlog::warn("Initial solution validation FAILED");
    }

    // Setup LNS Solver

    LNSSolverParams lns_params;
    lns_params.max_iterations = max_iterations;
    lns_params.max_non_improving_iterations = max_non_improving;
    lns_params.time_limit_seconds = time_limit_seconds;
    lns_params.min_destroy_fraction = min_destroy;
    lns_params.max_destroy_fraction = max_destroy;
    if (user_set_destroy_counts && min_destroy_count > 0 && max_destroy_count > 0) {
        lns_params.min_destroy_requests = min_destroy_count;
        lns_params.max_destroy_requests = max_destroy_count;
    }
    lns_params.seed = seed;
    lns_params.verbose = (log_level == "info" || log_level == "debug" || log_level == "trace");
    lns_params.log_frequency = 50;

    if (acceptance == "sa") {
        lns_params.acceptance_type = LNSSolverParams::AcceptanceType::SIMULATED_ANNEALING;
        lns_params.initial_temperature = 0.5;
        lns_params.final_temperature = 0.05;
    } else if (acceptance == "rtr") {
        lns_params.acceptance_type = LNSSolverParams::AcceptanceType::RECORD_TO_RECORD;
        lns_params.initial_temperature = 0.0333;
        lns_params.final_temperature = 0.0;
    } else {
        lns_params.acceptance_type = LNSSolverParams::AcceptanceType::ONLY_IMPROVEMENTS;
    }

    // AGES Phase - Fleet Minimization
    spdlog::info("Starting AGES fleet minimization...");

    std::optional<utils::TimeLimit> overall_time_limit;
    if (time_limit_seconds > 0.0) {
        overall_time_limit.emplace(time_limit_seconds);
    }

    std::mt19937 ages_rng(seed);
    ages::AGESParameters ages_params = ages::AGESParameters::default_params(instance.num_requests());
    ages_params.max_perturbation_phases = 100;
    ages_params.min_perturbation_moves = 1;
    ages_params.max_perturbation_moves = 3;
    ages_params.use_shuffle_stack = true;
    ages_params.count_successful_perturbations_only = true;
    ages_params.shift_probability = 0.5;

    ages::AGESSolver ages_solver(instance, ages_params);
    utils::TimeLimit *limit_ptr = overall_time_limit ? &*overall_time_limit : nullptr;
    solution::Solution ages_solution = ages_solver.run(initial_solution, ages_rng, std::nullopt, limit_ptr);

    size_t routes_before_ages = initial_solution.number_of_non_empty_routes();
    size_t routes_after_ages = ages_solution.number_of_non_empty_routes();

    spdlog::info("AGES: {} → {} routes, cost: {:.2f}", routes_before_ages, routes_after_ages, ages_solution.objective());

    initial_solution = ages_solution;

    bool skip_lns = false;
    if (overall_time_limit) {
        double remaining = overall_time_limit->remaining_seconds();
        if (remaining <= 0.0) {
            spdlog::warn("Time limit exhausted during AGES phase; skipping LNS optimization.");
            skip_lns = true;
        } else {
            lns_params.time_limit_seconds = remaining;
        }
    }

    solution::Solution final_solution = initial_solution;
    LNSStatistics stats;
    bool ran_lns = false;

    if (!skip_lns) {
        spdlog::info("Starting LNS optimization...");

        LNSSolver solver(instance, lns_params);
        final_solution = solver.solve(initial_solution);
        stats = solver.get_statistics();
        ran_lns = true;

        // Large-scale decomposition LNS for instances >= 150 requests
        if (instance.num_requests() >= 150) {
            lns::largescale::LargeScaleParams ls_params;
            ls_params.base_lns_params = lns_params;
            ls_params.base_lns_params.verbose = false;
            ls_params.base_lns_params.log_frequency = 100;
            ls_params.max_iterations = 12;
            ls_params.nested_iterations = 250;
            ls_params.split_settings.min_requests_per_group = 40;
            ls_params.split_settings.max_requests_per_group = 120;
            ls_params.split_settings.mode = decomposition::SplitMode::Geographic;

            utils::TimeLimit *ls_limit = nullptr;
            if (overall_time_limit) {
                ls_limit = &*overall_time_limit;
            }

            std::mt19937 ls_rng(seed ^ 0xC0FFEEu);
            lns::largescale::DecompositionLNSSolver ls_solver(instance, ls_params);
            auto improved = ls_solver.run(solution::Solution(final_solution), ls_rng, ls_limit);

            if (improved.objective() < final_solution.objective()) {
                spdlog::info("Large-scale LNS: {:.2f} → {:.2f}",
                             final_solution.objective(), improved.objective());
                final_solution = std::move(improved);
            }
        }

        auto count_used_routes = [](const solution::Solution &sol) {
            size_t used = 0;
            for (size_t route_id = 0; route_id < sol.instance().num_vehicles(); ++route_id) {
                if (!sol.is_route_empty(route_id)) {
                    ++used;
                }
            }
            return used;
        };

        const size_t routes_after_lns = count_used_routes(final_solution);

        if (final_solution.unassigned_requests().count() == 0) {
            auto fleet_params = lns::FleetMinimizationParameters::default_params(instance.num_requests());
            lns::FleetMinimizationLNS fleet_solver(instance, fleet_params);

            std::mt19937 fleet_rng(seed ^ 0x9E3779B9u);

            auto fleet_result = fleet_solver.run(solution::Solution(final_solution), fleet_rng);
            final_solution = std::move(fleet_result.solution);

            spdlog::info("Fleet minimization: {} → {} routes", routes_after_lns, count_used_routes(final_solution));
        } else {
            spdlog::warn("Skipping fleet minimization: {} unassigned requests", final_solution.unassigned_requests().count());
        }
    } else {
        spdlog::warn("Skipping LNS: time limit exhausted");
        stats.initial_objective = initial_solution.objective();
        stats.best_objective = final_solution.objective();
        stats.final_objective = final_solution.objective();
        stats.total_iterations = 0;
    }

    // Statistics
    if (ran_lns) {
        stats.final_objective = final_solution.objective();
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> elapsed = end_time - start_time;

    solution::SolutionDescription final_desc(final_solution);

    const double final_objective = final_solution.objective();
    const double best_objective = ran_lns
                                      ? std::min(static_cast<double>(stats.best_objective), final_objective)
                                      : final_objective;

    spdlog::info("");
    spdlog::info("=== SOLUTION SUMMARY ===");
    spdlog::info("Instance: {}", instance_name);
    spdlog::info("Objective: {:.2f} → {:.2f} (best: {:.2f})", stats.initial_objective, final_objective, best_objective);
    if (stats.initial_objective != 0.0) {
        spdlog::info("Improvement: {:.2f}%", (stats.initial_objective - best_objective) / stats.initial_objective * 100.0);
    }
    spdlog::info("Routes: {}, Distance: {:.2f}", final_desc.num_routes(), final_solution.objective());
    spdlog::info("Iterations: {} ({} accepted, {} improving)", stats.total_iterations, stats.accepted_solutions, stats.improving_solutions);
    spdlog::info("Time: {:.2f}s", elapsed.count());

    auto final_validation = utils::validate_solution(instance, final_solution);
    if (final_validation.is_valid) {
        spdlog::info("Validation: PASSED");
    } else {
        spdlog::warn("Validation: FAILED");
    }

    // Write Solution
    try {
        fs::create_directories(output_dir);
    } catch (const std::exception &e) {
        spdlog::error("Failed to create output directory: {}", e.what());
        return 1;
    }

    std::string solution_filename = io::generate_sintef_filename(
        instance_name,
        final_desc.num_routes(),
        final_solution.objective());

    std::string output_path = (fs::path(output_dir) / solution_filename).string();

    try {
        io::SINTEFSolutionMetadata metadata;
        metadata.instance_name = instance_name;
        metadata.authors = authors;
        metadata.reference = reference;
        io::write_sintef_solution(final_solution, instance, output_path, metadata);
        spdlog::info("Solution: {}", output_path);
    } catch (const std::exception &e) {
        spdlog::error("Failed to write solution: {}", e.what());
        return 1;
    }

    std::string validator_path = R"(D:\Docments\20251\GR2\_PDPTW benchmark\PDPTW Li & Lim benchmark\validator\validator.py)";
    std::string validator_cmd = "python \"" + validator_path + "\" -i \"" + instance_file + "\" -s \"" + output_path + "\"";

    int validator_result = std::system(validator_cmd.c_str());

    if (validator_result == 0) {
        spdlog::info("External validation: PASSED");
    } else {
        spdlog::warn("External validation: FAILED or ERROR");
    }
    pdptw::utils::shutdown_logging();

    return 0;
}