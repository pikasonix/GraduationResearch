#pragma once

#include "pdptw/lns/repair/operator.hpp"

namespace pdptw {
namespace lns {
namespace repair {

// K-Regret Insertion: Chèn request có regret cao nhất (chênh lệch giữa vị trí tốt nhất và tốt thứ 2)
class RegretInsertionOperator : public RepairOperator {
public:
    void repair(solution::Solution &solution, Random &rng) override;
};

} // namespace repair
} // namespace lns
} // namespace pdptw
