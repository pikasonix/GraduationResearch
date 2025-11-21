#pragma once

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <optional>
#include <random>
#include <vector>

namespace pdptw::decomposition {

struct PartialInstance {
    problem::PDPTWInstance instance;
    solution::Solution initial_solution;
    std::vector<size_t> partial_to_full_nodes;
    std::vector<size_t> original_request_ids;

    PartialInstance(problem::PDPTWInstance inst,
                    solution::Solution init,
                    std::vector<size_t> mapping,
                    std::vector<size_t> requests)
        : instance(std::move(inst)),
          initial_solution(std::move(init)),
          partial_to_full_nodes(std::move(mapping)),
          original_request_ids(std::move(requests)) {}
};

enum class SplitMode {
    Geographic,
    Random
};

struct SplitSettings {
    SplitMode mode = SplitMode::Geographic;
    size_t min_requests_per_group = 25;
    size_t max_requests_per_group = 60;
    size_t target_num_groups = 0; // 0 = auto
};

class SolutionSplitter {
public:
    explicit SolutionSplitter(const solution::Solution &reference_solution);
    std::vector<PartialInstance> split(const SplitSettings &settings, std::mt19937 &rng) const;

private:
    const solution::Solution &full_solution_;
    const problem::PDPTWInstance &instance_;

    std::vector<std::vector<size_t>> build_clusters(const SplitSettings &settings, std::mt19937 &rng) const;
    std::vector<std::vector<size_t>> kmeans_clusters(const std::vector<std::pair<double, double>> &points, size_t k, std::mt19937 &rng) const;
    PartialInstance build_partial(const std::vector<size_t> &request_ids) const;
};

} // namespace pdptw::decomposition