#pragma once

#include "pdptw/decomposition/splitter.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <random>
#include <vector>

namespace pdptw::decomposition {

enum class RecombineMode {
    GreedyMerge,
    BestFitMerge
};

class SolutionRecombiner {
public:
    explicit SolutionRecombiner(const problem::PDPTWInstance &instance);

    solution::Solution recombine(const std::vector<PartialInstance> &partials,
                                 const std::vector<size_t> &unassigned_request_ids,
                                 RecombineMode mode,
                                 std::mt19937 &rng) const;

private:
    const problem::PDPTWInstance &instance_;

    solution::Solution greedy_merge(const std::vector<PartialInstance> &partials,
                                    const std::vector<size_t> &unassigned_request_ids) const;

    solution::Solution best_fit_merge(const std::vector<PartialInstance> &partials,
                                      const std::vector<size_t> &unassigned_request_ids,
                                      std::mt19937 &rng) const;
};

} // namespace pdptw::decomposition
