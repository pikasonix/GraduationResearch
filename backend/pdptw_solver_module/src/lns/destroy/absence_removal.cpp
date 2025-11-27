#include "pdptw/lns/destroy/absence_removal.hpp"
#include <algorithm>
#include <cmath>

namespace pdptw {
namespace lns {

AbsenceRemovalOperator::AbsenceRemovalOperator(AbsenceCounter &counter)
    : absence_counter_(counter), rng_(std::random_device{}()) {
}

void AbsenceRemovalOperator::destroy(
    solution::Solution &solution,
    size_t num_to_remove) {

    const auto &instance = solution.instance();

    std::vector<std::pair<size_t, size_t>> request_absence;
    for (size_t req_id = 0; req_id < instance.num_requests(); ++req_id) {
        if (!solution.unassigned_requests().contains(req_id)) {
            size_t absence = absence_counter_.get_absence(req_id);
            request_absence.push_back({req_id, absence});
        }
    }

    if (request_absence.empty()) {
        return;
    }

    std::sort(request_absence.begin(), request_absence.end(),
              [](const auto &a, const auto &b) {
                  return a.second > b.second;
              });

    std::uniform_real_distribution<double> dist(0.0, 1.0);

    size_t removed_count = 0;

    while (removed_count < num_to_remove && !request_absence.empty()) {
        double y = std::pow(dist(rng_), randomization_factor_);
        size_t index = static_cast<size_t>(y * request_absence.size());
        index = std::min(index, request_absence.size() - 1);

        size_t req_id = request_absence[index].first;

        size_t pickup_id = instance.pickup_id_of_request(req_id);
        solution.unassign_request(pickup_id);

        request_absence.erase(request_absence.begin() + index);
        removed_count++;
    }
}

} // namespace lns
} // namespace pdptw
