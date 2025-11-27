#include "pdptw/lns/repair/regret_insertion.hpp"
#include "pdptw/construction/insertion.hpp"
#include <algorithm>

namespace pdptw {
namespace lns {
namespace repair {

void RegretInsertionOperator::repair(solution::Solution &solution, Random &rng) {
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

        auto max_regret_it = std::max_element(candidates.begin(), candidates.end(),
                                              [](const pdptw::construction::InsertionCandidate &a,
                                                 const pdptw::construction::InsertionCandidate &b) {
                                                  return a.regret_value < b.regret_value;
                                              });

        if (max_regret_it != candidates.end() && max_regret_it->feasible) {
            pdptw::construction::Insertion::insert_request(solution, *max_regret_it);

            size_t pickup_id = solution.instance().pickup_id_of_request(max_regret_it->request_id);
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
