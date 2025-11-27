#include "pdptw/lns/destroy/adjacent_string_removal.hpp"
#include <algorithm>
#include <cmath>

namespace pdptw {
namespace lns {

AdjacentStringRemovalOperator::AdjacentStringRemovalOperator()
    : rng_(std::random_device{}()) {
}

problem::Num AdjacentStringRemovalOperator::relatedness(
    const problem::PDPTWInstance &instance,
    size_t req1,
    size_t req2) {
    size_t pickup1 = instance.pickup_id_of_request(req1);
    size_t pickup2 = instance.pickup_id_of_request(req2);

    const auto &node1 = instance.nodes()[pickup1];
    const auto &node2 = instance.nodes()[pickup2];

    double distance = instance.distance(pickup1, pickup2);

    double time_diff = std::abs(node1.ready() - node2.ready());

    double demand_diff = std::abs(node1.demand() - node2.demand());

    problem::Num relatedness_value =
        distance_weight_ * distance +
        time_weight_ * time_diff +
        demand_weight_ * demand_diff;

    return relatedness_value;
}

void AdjacentStringRemovalOperator::destroy(
    solution::Solution &solution,
    size_t num_to_remove) {

    const auto &instance = solution.instance();

    std::vector<size_t> assigned_requests;
    for (size_t req_id = 0; req_id < instance.num_requests(); ++req_id) {
        if (!solution.unassigned_requests().contains(req_id)) {
            assigned_requests.push_back(req_id);
        }
    }

    if (assigned_requests.empty() || num_to_remove == 0) {
        return;
    }

    std::uniform_int_distribution<size_t> seed_dist(0, assigned_requests.size() - 1);
    size_t seed_idx = seed_dist(rng_);
    size_t seed_request = assigned_requests[seed_idx];

    std::vector<std::pair<size_t, problem::Num>> relatedness_list;
    for (size_t req_id : assigned_requests) {
        if (req_id != seed_request) {
            problem::Num rel = relatedness(instance, seed_request, req_id);
            relatedness_list.push_back({req_id, rel});
        }
    }

    std::sort(relatedness_list.begin(), relatedness_list.end(),
              [](const auto &a, const auto &b) {
                  return a.second < b.second;
              });

    size_t pickup_id = instance.pickup_id_of_request(seed_request);
    solution.unassign_request(pickup_id);

    size_t removed_count = 1;

    std::uniform_real_distribution<double> dist(0.0, 1.0);
    double randomization_factor = 6.0;

    while (removed_count < num_to_remove && !relatedness_list.empty()) {
        double y = std::pow(dist(rng_), randomization_factor);
        size_t index = static_cast<size_t>(y * relatedness_list.size());
        index = std::min(index, relatedness_list.size() - 1);

        size_t req_id = relatedness_list[index].first;

        pickup_id = instance.pickup_id_of_request(req_id);
        solution.unassign_request(pickup_id);

        relatedness_list.erase(relatedness_list.begin() + index);
        removed_count++;
    }
}

} // namespace lns
} // namespace pdptw
