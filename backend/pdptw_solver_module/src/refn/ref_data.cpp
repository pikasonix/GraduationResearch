#include "pdptw/refn/ref_data.hpp"
#include "pdptw/problem/pdptw.hpp" // For DistanceAndTime definition
#include <algorithm>
#include <limits>

namespace pdptw {
namespace refn {

// Khởi tạo REFData từ một node đơn lẻ
REFData REFData::with_node(const REFNode &node) {
    REFData data;
    data.current_load = node.demand;
    data.max_load = node.demand;
    data.distance = 0.0;
    data.time = node.servicetime;
    data.earliest_completion = node.ready + node.servicetime;
    data.latest_start = node.due;
    data.tw_feasible = true;
    return data;
}

void REFData::reset_with_node(const REFNode &node) {
    *this = with_node(node);
}

// Mở rộng route theo chiều xuôi: thêm node vào cuối
void REFData::extend_forward_into_target(
    const REFNode &node,
    REFData &into,
    const problem::DistanceAndTime &param) const {

    // Cập nhật load: max_load là tải trọng cao nhất trong suốt hành trình
    into.max_load = std::max(max_load, static_cast<Capacity>(current_load + node.demand));
    into.current_load = current_load + node.demand;

    // Kiểm tra tính khả thi của time window
    into.tw_feasible = tw_feasible && (earliest_completion + param.time <= node.due);

    // Thời gian sớm nhất hoàn thành tại node mới
    into.earliest_completion = std::max(earliest_completion + param.time, node.ready) + node.servicetime;

    // Thời gian muộn nhất có thể bắt đầu để đến node mới kịp
    into.latest_start = std::min(latest_start, node.due - time - param.time);

    into.distance = distance + param.distance;
    into.time = time + param.time + node.servicetime;
}

void REFData::extend_forward(const REFNode &node, const problem::DistanceAndTime &param) {
    REFData tmp;
    extend_forward_into_target(node, tmp, param);
    *this = tmp;
}

// Mở rộng route theo chiều ngược: thêm node vào đầu
void REFData::extend_backward_into_target(
    const REFNode &node,
    REFData &into,
    const problem::DistanceAndTime &param) const {

    // Cập nhật load khi thêm node vào đầu route
    into.max_load = std::max(node.demand, static_cast<Capacity>(node.demand + current_load));
    into.current_load = node.demand + current_load;

    // Kiểm tra khả năng đi từ node mới đến route hiện tại kịp time window
    into.tw_feasible = tw_feasible &&
                       (node.ready + node.servicetime + param.time <= latest_start);

    // Thời gian sớm nhất hoàn thành toàn bộ route sau khi thêm node đầu
    into.earliest_completion = std::max(
        node.ready + node.servicetime + param.time + time,
        earliest_completion);

    // Thời gian muộn nhất có thể bắt đầu tại node mới
    into.latest_start = std::min(node.due, latest_start - param.time - node.servicetime);

    into.distance = param.distance + distance;
    into.time = node.servicetime + param.time + time;
}

void REFData::extend_backward(const REFNode &node, const problem::DistanceAndTime &param) {
    REFData tmp;
    extend_backward_into_target(node, tmp, param);
    *this = tmp;
}

// Nối hai route segment lại với nhau
void REFData::concat_into_target(
    const REFData &b,
    REFData &into,
    const problem::DistanceAndTime &param) const {

    // Load tối đa khi nối: so sánh max_load của route đầu với tổng load hiện tại + max_load route sau
    into.max_load = std::max(max_load, static_cast<Capacity>(current_load + b.max_load));
    into.current_load = current_load + b.current_load;

    // Kiểm tra khả năng nối: route đầu phải hoàn thành trước khi route sau bắt đầu
    into.tw_feasible = tw_feasible && b.tw_feasible &&
                       (earliest_completion + param.time <= b.latest_start);

    // Thời gian sớm nhất hoàn thành toàn bộ route đã nối
    into.earliest_completion = std::max(
        earliest_completion + param.time + b.time,
        b.earliest_completion);

    // Thời gian muộn nhất có thể bắt đầu route đầu
    into.latest_start = std::min(latest_start, b.latest_start - param.time - time);

    into.distance = distance + param.distance + b.distance;
    into.time = time + param.time + b.time;
}

void REFData::concat(const REFData &other, const problem::DistanceAndTime &param) {
    REFData tmp;
    concat_into_target(other, tmp, param);
    *this = tmp;
}

} // namespace refn
} // namespace pdptw
