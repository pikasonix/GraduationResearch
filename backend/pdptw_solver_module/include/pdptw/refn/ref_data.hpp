#ifndef PDPTW_REFN_REF_DATA_HPP
#define PDPTW_REFN_REF_DATA_HPP

#include "pdptw/refn/ref_node.hpp"
#include <algorithm>

// Forward declarations
namespace pdptw {
namespace problem {
struct DistanceAndTime;
}
} // namespace pdptw

namespace pdptw {
namespace refn {

// REFData: Lưu trữ resource consumption tích lũy dọc theo route segment
// - Load (hiện tại và max)
// - Distance và time
// - Time window feasibility
// - Earliest/latest arrival times
class REFData {
public:
    Capacity current_load;
    Capacity max_load;
    Num distance;
    Num time;
    Num earliest_completion;
    Num latest_start;
    bool tw_feasible;

    REFData()
        : current_load(0),
          max_load(0),
          distance(0.0),
          time(0.0),
          earliest_completion(0.0),
          latest_start(0.0),
          tw_feasible(true) {}

    REFData(const REFData &) = default;
    REFData &operator=(const REFData &) = default;

    // ============ Time window accessors ============

    // Thời gian route (bao gồm: service time, travel time, waiting time)
    Num duration() const {
        return std::max(time, earliest_completion - latest_start);
    }

    Num earliest_start_time() const {
        return earliest_completion - duration();
    }

    Num latest_start_time() const {
        return latest_start;
    }

    Num earliest_completion_time() const {
        return earliest_completion;
    }

    Num latest_completion_time() const {
        return latest_start + duration();
    }

    // ============ Factory methods ============

    // Tạo REFData từ 1 node (bắt đầu route segment mới)
    static REFData with_node(const REFNode &node);

    // Reset REFData về 1 node
    void reset_with_node(const REFNode &node);

    // ============ REF Extension Operations ============

    // Extend forward: Thêm node vào cuối (cập nhật load, time windows, feasibility)
    void extend_forward(const REFNode &node, const problem::DistanceAndTime &param);

    // Extend forward vào target (không thay đổi REFData gốc)
    void extend_forward_into_target(
        const REFNode &node,
        REFData &target,
        const problem::DistanceAndTime &param) const;

    // Extend backward: Thêm node vào đầu (cập nhật load, time windows, feasibility)
    void extend_backward(const REFNode &node, const problem::DistanceAndTime &param);

    // Extend backward vào target (không thay đổi REFData gốc)
    void extend_backward_into_target(
        const REFNode &node,
        REFData &target,
        const problem::DistanceAndTime &param) const;

    // Concat: Nối 2 REF segments lại (kiểm tra feasibility khi kết nối)
    void concat(const REFData &other, const problem::DistanceAndTime &param);

    // Concat vào target (không thay đổi REFData gốc)
    void concat_into_target(
        const REFData &other,
        REFData &target,
        const problem::DistanceAndTime &param) const;
};

} // namespace refn
} // namespace pdptw

#endif // PDPTW_REFN_REF_DATA_HPP
