#include "pdptw/lns/repair/hardest_first_insertion.hpp"
#include "pdptw/construction/insertion.hpp"
#include <algorithm>
#include <iostream>

namespace pdptw {
namespace lns {
namespace repair {

void HardestFirstInsertionOperator::repair(solution::Solution &solution, const AbsenceCounter &absence_counter, Random &rng) {
    auto &bank = solution.unassigned_requests();

    if (bank.count() == 0)
        return;

    auto unassigned_requests = bank.iter_request_ids();

    if (unassigned_requests.empty())
        return;

    std::sort(unassigned_requests.begin(), unassigned_requests.end(),
              [&absence_counter](size_t a, size_t b) {
                  return absence_counter.get_absence(a) > absence_counter.get_absence(b);
              });

    for (size_t request_id : unassigned_requests) {
        size_t pickup_id = solution.instance().pickup_id_of_request(request_id);

        if (!bank.contains(pickup_id)) {
            continue;
        }

        auto candidate = pdptw::construction::Insertion::find_best_insertion(
            solution, request_id, pdptw::construction::InsertionStrategy::BestCost);

        if (candidate.feasible) {
            pdptw::construction::Insertion::insert_request(solution, candidate);
            bank.remove(pickup_id);
        }
    }
}

} // namespace repair
} // namespace lns
} // namespace pdptw
