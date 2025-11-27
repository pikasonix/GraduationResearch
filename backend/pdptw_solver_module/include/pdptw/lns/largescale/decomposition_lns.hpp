#pragma once

#include "pdptw/decomposition/recombiner.hpp"
#include "pdptw/decomposition/splitter.hpp"
#include "pdptw/solver/lns_solver.hpp"
#include "pdptw/utils/time_limit.hpp"
#include <random>

namespace pdptw::lns::largescale {

struct LargeScaleParams {
    size_t max_iterations = 20;
    size_t nested_iterations = 400;
    double ls_probability = 0.15;
    decomposition::SplitSettings split_settings{};
    decomposition::RecombineMode recombine_mode = decomposition::RecombineMode::GreedyMerge;
    LNSSolverParams base_lns_params{};
};

class DecompositionLNSSolver {
public:
    DecompositionLNSSolver(const problem::PDPTWInstance &instance,
                           LargeScaleParams params);

    solution::Solution run(solution::Solution current,
                           std::mt19937 &rng,
                           utils::TimeLimit *time_limit = nullptr);

private:
    const problem::PDPTWInstance &instance_;
    LargeScaleParams params_;
};

} // namespace pdptw::lns::largescale
