#pragma once

#include "pdptw/lns/repair/operator.hpp"
#include <vector>

namespace pdptw {
namespace lns {
namespace repair {

// Greedy Insertion: Chèn request vào vị trí có chi phí tốt nhất (with blinks - có tính ngẫu nhiên)
class GreedyInsertionOperator : public RepairOperator {
public:
    void repair(solution::Solution &solution, Random &rng) override;

private:
    // Sắp xếp unassigned customers theo thứ tự chèn (có ngẫu nhiên)
    std::vector<size_t> sort_unassigned_customers(solution::Solution &solution, Random &rng);
    // Tìm route trống đầu tiên và chèn request vào
    void find_first_empty_route_and_insert(solution::Solution &solution, size_t pickup_id, Random &rng);
};

} // namespace repair
} // namespace lns
} // namespace pdptw
