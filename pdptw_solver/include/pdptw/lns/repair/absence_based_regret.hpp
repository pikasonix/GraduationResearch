#pragma once

#include "pdptw/lns/repair/operator.hpp"

namespace pdptw {
namespace lns {
namespace repair {

// Absence-based Regret Insertion: Chèn requests dựa trên regret và số lần vắng mặt
class AbsenceBasedRegretOperator : public AbsenceAwareRepairOperator {
public:
    void repair(solution::Solution &solution, const AbsenceCounter &absence_counter, Random &rng) override;
};

} // namespace repair
} // namespace lns
} // namespace pdptw
