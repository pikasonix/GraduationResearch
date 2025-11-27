#pragma once

#include "pdptw/lns/repair/operator.hpp"

namespace pdptw {
namespace lns {
namespace repair {

// Hardest-First Insertion: Chèn requests khó nhất trước (dựa trên absence count)
class HardestFirstInsertionOperator : public AbsenceAwareRepairOperator {
public:
    void repair(solution::Solution &solution, const AbsenceCounter &absence_counter, Random &rng) override;
};

} // namespace repair
} // namespace lns
} // namespace pdptw
