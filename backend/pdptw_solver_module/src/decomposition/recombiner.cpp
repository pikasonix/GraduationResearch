#include "pdptw/decomposition/recombiner.hpp"
#include "pdptw/construction/insertion.hpp"
#include "pdptw/solution/description.hpp"
#include <algorithm>
#include <spdlog/spdlog.h>

namespace pdptw::decomposition {

SolutionRecombiner::SolutionRecombiner(const problem::PDPTWInstance &instance)
    : instance_(instance) {}

solution::Solution SolutionRecombiner::recombine(const std::vector<PartialInstance> &partials,
                                                 const std::vector<size_t> &unassigned_request_ids,
                                                 RecombineMode mode,
                                                 std::mt19937 &rng) const {
    if (partials.empty()) {
        solution::Solution empty(instance_);
        for (size_t request_id : unassigned_request_ids) {
            size_t pickup = instance_.pickup_id_of_request(request_id);
            empty.unassigned_requests().insert_pickup_id(pickup);
        }
        return empty;
    }

    switch (mode) {
    case RecombineMode::GreedyMerge:
        return greedy_merge(partials, unassigned_request_ids);
    case RecombineMode::BestFitMerge:
        return best_fit_merge(partials, unassigned_request_ids, rng);
    }
    return greedy_merge(partials, unassigned_request_ids);
}

solution::Solution SolutionRecombiner::greedy_merge(const std::vector<PartialInstance> &partials,
                                                    const std::vector<size_t> &unassigned_request_ids) const {
    solution::Solution combined(instance_);

    const size_t num_vehicles = instance_.num_vehicles();
    std::vector<std::vector<size_t>> itineraries(num_vehicles);
    for (size_t v = 0; v < num_vehicles; ++v) {
        size_t vn = instance_.vn_id_of(v);
        itineraries[v] = {vn, vn + 1};
    }

    for (const auto &partial : partials) {
        solution::SolutionDescription desc(partial.initial_solution);
        const auto &routes = desc.itineraries();
        for (size_t route_id = 0; route_id < routes.size(); ++route_id) {
            if (routes[route_id].size() <= 2) {
                continue;
            }
            auto &target = itineraries[route_id];
            target.clear();
            size_t start_full = instance_.vn_id_of(route_id);
            target.push_back(start_full);
            for (size_t node_id : routes[route_id]) {
                if (node_id == partial.instance.vn_id_of(route_id) || node_id == partial.instance.vn_id_of(route_id) + 1) {
                    continue;
                }
                size_t full_node = partial.partial_to_full_nodes[node_id];
                target.push_back(full_node);
            }
            target.push_back(start_full + 1);
        }
    }

    combined.set(itineraries);

    combined.unassigned_requests().clear();
    for (size_t request_id = 0; request_id < instance_.num_requests(); ++request_id) {
        size_t pickup = instance_.pickup_id_of_request(request_id);
        combined.unassigned_requests().remove(pickup);
    }
    for (size_t request_id : unassigned_request_ids) {
        size_t pickup = instance_.pickup_id_of_request(request_id);
        combined.unassigned_requests().insert_pickup_id(pickup);
    }

    return combined;
}

solution::Solution SolutionRecombiner::best_fit_merge(const std::vector<PartialInstance> &partials,
                                                      const std::vector<size_t> &unassigned_request_ids,
                                                      std::mt19937 &rng) const {
    // 1. Start with greedy merge
    solution::Solution combined = greedy_merge(partials, unassigned_request_ids);

    // 2. Get all unassigned requests
    std::vector<size_t> pending_requests = combined.unassigned_requests().iter_request_ids();

    // 3. Shuffle to randomize insertion order
    std::shuffle(pending_requests.begin(), pending_requests.end(), rng);

    // 4. Try to insert each request
    for (size_t request_id : pending_requests) {
        // Find best insertion position
        auto candidate = construction::Insertion::find_best_insertion(
            combined, request_id, construction::InsertionStrategy::BestCost);

        // If feasible, apply insertion
        if (candidate.feasible) {
            construction::Insertion::insert_request(combined, candidate);
        }
    }

    return combined;
}

} // namespace pdptw::decomposition
