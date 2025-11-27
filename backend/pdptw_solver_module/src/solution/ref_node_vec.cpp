#include "pdptw/solution/ref_node_vec.hpp"
#include <cassert>

namespace pdptw {
namespace solution {

// REFNodeVec: vector chứa tất cả REFListNodes của solution

REFNodeVec::REFNodeVec(const problem::PDPTWInstance &instance) {
    data.reserve(instance.nodes().size());

    // Tạo REFListNode cho mỗi node trong instance
    for (size_t i = 0; i < instance.nodes().size(); ++i) {
        const auto &node = instance.nodes()[i];
        refn::REFNode ref_node(node);
        data.emplace_back(ref_node);
    }

    // Khởi tạo các cặp depot start/end cho mỗi vehicle
    // Vehicle i: data[i*2] là start depot, data[i*2+1] là end depot
    for (size_t i = 0; i < instance.num_vehicles(); ++i) {
        size_t start_idx = i * 2;
        size_t end_idx = i * 2 + 1;

        // Start depot trỏ đến end depot
        data[start_idx].vn_id = start_idx;
        data[start_idx].succ = end_idx;

        // End depot trỏ về start depot
        data[end_idx].vn_id = start_idx;
        data[end_idx].pred = start_idx;
    }
}

// Reset về trạng thái ban đầu: tất cả requests chưa được phân công
void REFNodeVec::reset(const problem::PDPTWInstance &instance) {
    // Reset các cặp depot của vehicles
    for (size_t i = 0; i < instance.num_vehicles(); ++i) {
        size_t start_idx = i * 2;
        size_t end_idx = i * 2 + 1;

        data[start_idx].vn_id = start_idx;
        data[start_idx].succ = end_idx;

        data[end_idx].vn_id = start_idx;
        data[end_idx].pred = start_idx;
    }

    // Reset tất cả request nodes về trạng thái unassigned (self-loop)
    size_t num_depot_nodes = instance.num_vehicles() * 2;
    for (size_t i = num_depot_nodes; i < data.size(); ++i) {
        data[i].vn_id = i;
        data[i].succ = i;
        data[i].pred = i;
    }
}

// Liên kết lại node vào route và cập nhật cả con trỏ của nodes kế cận
void REFNodeVec::relink(size_t vn_id, size_t node_id, size_t pred_id, size_t succ_id) {
    // Cập nhật con trỏ của node
    data[node_id].vn_id = vn_id;
    data[node_id].pred = pred_id;
    data[node_id].succ = succ_id;

    // Cập nhật successor của predecessor
    data[pred_id].succ = node_id;

    // Cập nhật predecessor của successor
    data[succ_id].pred = node_id;
}

std::pair<const REFListNode *, REFListNode *>
REFNodeVec::get_pair_internal(size_t from, size_t to) {
    assert(from < data.size() && "from index out of bounds");
    assert(to < data.size() && "to index out of bounds");
    assert(from != to && "from and to must be different");

    // Return const pointer to source, mutable pointer to target
    return std::make_pair(&data[from], &data[to]);
}

// Mở rộng REF data theo chiều xuôi: từ 'from' đến 'to'
void REFNodeVec::extend_forward_unchecked(size_t from, size_t to,
                                          const problem::PDPTWInstance &instance) {
    auto [source, target] = get_pair_internal(from, to);

    const auto &dist_time = instance.distance_and_time(from, to);
    source->data.extend_forward_into_target(target->node, target->data, dist_time);
}

// Mở rộng REF data theo chiều ngược: từ 'to' về 'from'
void REFNodeVec::extend_backward_unchecked(size_t from, size_t to,
                                           const problem::PDPTWInstance &instance) {
    auto [source, target] = get_pair_internal(from, to);

    const auto &dist_time = instance.distance_and_time(to, from);
    source->data.extend_backward_into_target(target->node, target->data, dist_time);
}

} // namespace solution
} // namespace pdptw
