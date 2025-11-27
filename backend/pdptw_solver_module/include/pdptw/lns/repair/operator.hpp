#pragma once

#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <random>

namespace pdptw {
namespace lns {
namespace repair {

using Random = std::mt19937;

// Repair operator: Chèn các request chưa assign trở lại solution
class RepairOperator {
public:
    virtual ~RepairOperator() = default;

    // Sửa solution bằng cách chèn unassigned requests
    // Lưu ý: Repair operator tự động xóa request khỏi unassigned_requests() sau khi chèn
    virtual void repair(solution::Solution &solution, Random &rng) = 0;
};

// Repair operator có sử dụng absence counter (đếm số lần request vắng mặt)
class AbsenceAwareRepairOperator {
public:
    virtual ~AbsenceAwareRepairOperator() = default;

    // Sửa solution sử dụng thông tin absence (ưu tiên requests vắng mặt lâu)
    virtual void repair(solution::Solution &solution, const AbsenceCounter &absence_counter, Random &rng) = 0;
};

} // namespace repair
} // namespace lns
} // namespace pdptw
