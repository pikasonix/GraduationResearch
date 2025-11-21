#include "pdptw/lns/destroy/worst_removal.hpp"
#include <algorithm>
#include <cmath>

namespace pdptw {
namespace lns {

WorstRemovalOperator::WorstRemovalOperator()
    : rng_(std::random_device{}()) {
}

std::vector<std::pair<size_t, problem::Num>> WorstRemovalOperator::calculate_contributions(
    const solution::Solution &solution) {
    std::vector<std::pair<size_t, problem::Num>> contributions;

    const auto &instance = solution.instance();
    size_t num_requests = instance.num_requests();

    for (size_t req_id = 0; req_id < num_requests; ++req_id) {
        if (solution.unassigned_requests().contains(req_id)) {
            continue;
        }

        size_t pickup_id = instance.pickup_id_of_request(req_id);
        size_t delivery_id = instance.delivery_id_of_request(req_id);

        size_t pickup_pred = solution.pred(pickup_id);
        size_t pickup_succ = solution.succ(pickup_id);

        size_t delivery_pred = solution.pred(delivery_id);
        size_t delivery_succ = solution.succ(delivery_id);

        problem::Num cost = 0.0;

        cost += instance.distance(pickup_pred, pickup_id);
        cost += instance.distance(pickup_id, pickup_succ);
        cost -= instance.distance(pickup_pred, pickup_succ);

        cost += instance.distance(delivery_pred, delivery_id);
        cost += instance.distance(delivery_id, delivery_succ);
        cost -= instance.distance(delivery_pred, delivery_succ);

        contributions.push_back({req_id, cost});
    }

    return contributions;
}

void WorstRemovalOperator::destroy(
    solution::Solution &solution,
    size_t num_to_remove) {

    auto contributions = calculate_contributions(solution);

    if (contributions.empty()) {
        return;
    }

    std::sort(contributions.begin(), contributions.end(),
              [](const auto &a, const auto &b) {
                  return a.second > b.second;
              });

    std::uniform_real_distribution<double> dist(0.0, 1.0);

    size_t removed_count = 0;
    while (removed_count < num_to_remove && !contributions.empty()) {
        double y = std::pow(dist(rng_), randomization_factor_);
        size_t index = static_cast<size_t>(y * contributions.size());
        index = std::min(index, contributions.size() - 1);

        size_t req_id = contributions[index].first;

        const auto &instance = solution.instance();
        size_t pickup_id = instance.pickup_id_of_request(req_id);

        solution.unassign_request(pickup_id);

        contributions.erase(contributions.begin() + index);

        removed_count++;
    }
}

} // namespace lns
} // namespace pdptw
