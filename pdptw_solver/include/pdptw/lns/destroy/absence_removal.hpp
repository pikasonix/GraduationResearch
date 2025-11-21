#ifndef PDPTW_LNS_DESTROY_ABSENCE_REMOVAL_HPP
#define PDPTW_LNS_DESTROY_ABSENCE_REMOVAL_HPP

#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/lns/destroy/operator.hpp"
#include <random>

namespace pdptw {
namespace lns {

// Absence Removal: Loại bỏ các request có số lần vắng mặt (unassigned) cao nhất
class AbsenceRemovalOperator : public DestroyOperator {
public:
    explicit AbsenceRemovalOperator(AbsenceCounter &counter);

    void destroy(
        solution::Solution &solution,
        size_t num_to_remove) override;

    std::string name() const override { return "AbsenceRemoval"; }

private:
    AbsenceCounter &absence_counter_;
    std::mt19937 rng_;
    double randomization_factor_ = 4.0;
};

} // namespace lns
} // namespace pdptw

#endif // PDPTW_LNS_DESTROY_ABSENCE_REMOVAL_HPP
