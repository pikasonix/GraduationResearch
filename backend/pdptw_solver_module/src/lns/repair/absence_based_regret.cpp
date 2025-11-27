#include "pdptw/lns/repair/absence_based_regret.hpp"
#include "pdptw/construction/insertion.hpp"
#include <algorithm>
#include <cmath>

namespace pdptw {
namespace lns {
namespace repair {

void AbsenceBasedRegretOperator::repair(solution::Solution &solution, const AbsenceCounter &absence_counter, Random &rng) {
    auto &bank = solution.unassigned_requests();
    if (bank.count() == 0)
        return;

    const size_t k = 2;

    bool progress = true;
    while (bank.count() > 0 && progress) {
        progress = false;

        auto unassigned = bank.iter_request_ids();
        if (unassigned.empty())
            break;

        auto candidates = pdptw::construction::Insertion::calculate_regret(solution, unassigned, k);

        if (candidates.empty())
            break;

        auto max_weighted_it = std::max_element(candidates.begin(), candidates.end(),
                                                [&absence_counter](const pdptw::construction::InsertionCandidate &a,
                                                                   const pdptw::construction::InsertionCandidate &b) {
                                                    double weight_a = a.regret_value * (1.0 + absence_counter.get_absence(a.request_id));
                                                    double weight_b = b.regret_value * (1.0 + absence_counter.get_absence(b.request_id));
                                                    return weight_a < weight_b;
                                                });

        if (max_weighted_it != candidates.end() && max_weighted_it->feasible) {
            pdptw::construction::Insertion::insert_request(solution, *max_weighted_it);

            size_t pickup_id = solution.instance().pickup_id_of_request(max_weighted_it->request_id);
            bank.remove(pickup_id);
            progress = true;
        } else {
            break;
        }
    }
}

} // namespace repair
} // namespace lns
} // namespace pdptw
