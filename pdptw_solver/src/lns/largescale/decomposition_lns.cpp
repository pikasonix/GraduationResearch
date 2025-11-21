#include "pdptw/lns/largescale/decomposition_lns.hpp"
#include "pdptw/construction/insertion.hpp"
#include "pdptw/solution/description.hpp"
#include <spdlog/spdlog.h>

namespace pdptw::lns::largescale {

using decomposition::PartialInstance;
using decomposition::RecombineMode;
using decomposition::SolutionRecombiner;
using decomposition::SolutionSplitter;

namespace {
pdptw::LNSSolverParams nested_params_from(const pdptw::LNSSolverParams &base, size_t nested_iterations) {
    pdptw::LNSSolverParams nested = base;
    nested.max_iterations = static_cast<int>(nested_iterations);
    if (nested.max_iterations <= 0) {
        nested.max_iterations = static_cast<int>(nested_iterations);
    }
    nested.verbose = false;
    nested.log_frequency = std::max(1, nested.max_iterations / 10);
    return nested;
}
} // namespace

DecompositionLNSSolver::DecompositionLNSSolver(const problem::PDPTWInstance &instance,
                                               LargeScaleParams params)
    : instance_(instance),
      params_(std::move(params)) {}

solution::Solution DecompositionLNSSolver::run(solution::Solution current,
                                               std::mt19937 &rng,
                                               utils::TimeLimit *time_limit) {
    solution::Solution best = current;
    double best_cost = current.objective();

    auto nested_params = nested_params_from(params_.base_lns_params, params_.nested_iterations);

    for (size_t iteration = 0; iteration < params_.max_iterations; ++iteration) {
        if (time_limit && time_limit->is_finished()) {
            spdlog::info("[LS-LNS] Time limit reached at iteration {}", iteration);
            break;
        }

        SolutionSplitter splitter(current);
        auto partials = splitter.split(params_.split_settings, rng);

        if (partials.empty()) {
            spdlog::warn("[LS-LNS] Split produced no partial instances; aborting phase");
            break;
        }

        spdlog::info("[LS-LNS] Iteration {}: solving {} partial instances", iteration, partials.size());

        for (auto &partial : partials) {
            pdptw::LNSSolver solver(partial.instance, nested_params);
            partial.initial_solution = solver.solve(partial.initial_solution);
        }

        std::vector<size_t> remaining_unassigned = current.unassigned_requests().iter_request_ids();
        SolutionRecombiner recombiner(instance_);
        solution::Solution combined = recombiner.recombine(partials,
                                                           remaining_unassigned,
                                                           params_.recombine_mode,
                                                           rng);

        double combined_cost = combined.objective();
        if (combined_cost < best_cost) {
            best_cost = combined_cost;
            best = combined;
            spdlog::info("[LS-LNS] New best objective {:.2f}", combined_cost);
        }

        current = combined;
    }

    return best;
}

} // namespace pdptw::lns::largescale
