#include "pdptw/solution/datastructure.hpp"
#include "pdptw/solution/description.hpp"
#include <algorithm>
#include <spdlog/spdlog.h>
#include <stdexcept>

namespace pdptw::solution {

// ============================================================
// Constructor - Khởi tạo solution
// ============================================================

Solution::Solution(const PDPTWInstance &instance)
    : instance_(&instance),
      fw_data_(instance),
      bw_data_(instance),
      blocks_(instance),
      unassigned_requests_(instance),
      max_num_vehicles_available_(instance.num_vehicles()),
      num_requests_(instance.num_requests()) {

    empty_route_ids_.resize(instance.num_vehicles(), true);
}

// ============================================================
// Các hàm truy xuất cơ bản
// ============================================================

bool Solution::is_route_empty(size_t route_id) const {
    size_t vn_id = instance_->vn_id_of(route_id);
    return fw_data_[vn_id].succ == vn_id + 1;
}

size_t Solution::num_empty_routes() const {
    const size_t limit = std::min(max_num_vehicles_available_, empty_route_ids_.size());
    return std::count(empty_route_ids_.begin(), empty_route_ids_.begin() + limit, true);
}

size_t Solution::number_of_non_empty_routes() const {
    size_t count = 0;
    for (size_t route_id = 0; route_id < instance_->num_vehicles(); ++route_id) {
        if (!is_route_empty(route_id)) {
            ++count;
        }
    }
    return count;
}

// ============================================================
// Điều hướng giữa các nodes
// ============================================================

size_t Solution::pred(size_t node_id) const {
    return fw_data_[node_id].pred;
}

size_t Solution::succ(size_t node_id) const {
    return fw_data_[node_id].succ;
}

std::pair<size_t, size_t> Solution::pred_succ_pair(size_t node_id) const {
    return {fw_data_[node_id].pred, fw_data_[node_id].succ};
}

size_t Solution::vn_id(size_t node_id) const {
    return fw_data_[node_id].vn_id;
}

// ============================================================
// Sửa đổi solution
// ============================================================

void Solution::clear() {
    fw_data_.reset(*instance_);
    bw_data_.reset(*instance_);
    std::fill(empty_route_ids_.begin(), empty_route_ids_.end(), true);
    unassigned_requests_.set_all();
    blocks_.invalidate_all();
}

// Thiết lập solution từ danh sách các route (itineraries)
void Solution::set(const std::vector<std::vector<size_t>> &itineraries) {
    // Khởi tạo lại các vehicle nodes
    for (size_t i = 0; i < instance_->num_vehicles(); ++i) {
        link_nodes(i * 2, i * 2 + 1);
    }

    std::fill(empty_route_ids_.begin(), empty_route_ids_.end(), true);
    unassigned_requests_.set_all();
    blocks_.invalidate_all();

    for (const auto &route : itineraries) {
        size_t vehicle_node = route[0];
        size_t vn_id = fw_data_[vehicle_node].vn_id;
        empty_route_ids_[vn_id / 2] = false;

        // Forward pass - Use REFNodeVec::relink() to update neighbor pointers
        size_t prev_id = route[0];
        for (size_t i = 1; i < route.size() - 1; ++i) {
            size_t node_id = route[i];
            // CRITICAL FIX: Use vector's relink() which updates ALL pointers (node + neighbors)
            fw_data_.relink(vn_id, node_id, prev_id, route[i + 1]);
            fw_data_.extend_forward_unchecked(prev_id, node_id, *instance_);

            // Remove pickup from unassigned if this is a pickup node
            if (instance_->is_pickup(node_id)) {
                unassigned_requests_.remove(node_id);
            }
            prev_id = node_id;
        }

        // Backward pass - Use REFNodeVec::relink() to update neighbor pointers
        prev_id = vn_id + 1;
        for (size_t i = route.size() - 1; i > 0; --i) {
            size_t node_id = route[i - 1];
            if (node_id != vn_id) {
                // CRITICAL FIX: Use vector's relink() which updates ALL pointers (node + neighbors)
                bw_data_.relink(vn_id, node_id, i >= 2 ? route[i - 2] : vn_id, prev_id);
                bw_data_.extend_backward_unchecked(prev_id, node_id, *instance_);
                prev_id = node_id;
            }
        }

        // First/last node links
        fw_data_[vn_id].succ = route[1];
        fw_data_[vn_id + 1].pred = route[route.size() - 2];
        fw_data_.extend_forward_unchecked(route[route.size() - 2], vn_id + 1, *instance_);

        bw_data_[vn_id].succ = route[1];
        bw_data_[vn_id + 1].pred = route[route.size() - 2];

        revalidate_blocks(vn_id);
    }

    // Xây dựng lại cache sau khi cấu trúc solution thay đổi hoàn toàn
    rebuild_cache();
}

// Cập nhật thứ tự nodes trong route và tính toán lại REF data
void Solution::update_route_sequence(const std::vector<size_t> &route) {
    size_t vn_id = route[0];

    // Duyệt xuôi: cập nhật con trỏ successor và REF data
    size_t prev_id = route[0];
    for (size_t i = 1; i < route.size() - 1; ++i) {
        size_t node_id = route[i];
        // CRITICAL FIX: Use vector's relink() which updates ALL pointers (node + neighbors)
        fw_data_.relink(vn_id, node_id, prev_id, route[i + 1]);
        fw_data_.extend_forward_unchecked(prev_id, node_id, *instance_);
        prev_id = node_id;
    }

    // Duyệt ngược: cập nhật con trỏ predecessor và REF data
    prev_id = vn_id + 1;
    for (size_t i = route.size() - 1; i > 0; --i) {
        size_t node_id = route[i - 1];
        if (node_id != vn_id) {
            // CRITICAL FIX: Use vector's relink() which updates ALL pointers (node + neighbors)
            bw_data_.relink(vn_id, node_id, i >= 2 ? route[i - 2] : vn_id, prev_id);
            bw_data_.extend_backward_unchecked(prev_id, node_id, *instance_);
            prev_id = node_id;
        }
    }

    // First/last node
    fw_data_[vn_id].succ = route[1];
    fw_data_[vn_id + 1].pred = route[route.size() - 2];
    fw_data_.extend_forward_unchecked(route[route.size() - 2], vn_id + 1, *instance_);

    bw_data_[vn_id].succ = route[1];
    bw_data_[vn_id + 1].pred = route[route.size() - 2];

    revalidate_blocks(vn_id);
}

void Solution::relink(size_t vn_id, size_t node_id, size_t pred, size_t succ) {
    fw_data_.relink(vn_id, node_id, pred, succ);
    bw_data_.relink(vn_id, node_id, pred, succ);
}

void Solution::link_nodes(size_t n1, size_t n2) {
    fw_data_[n1].succ = n2;
    fw_data_[n2].pred = n1;
    bw_data_[n1].succ = n2;
    bw_data_[n2].pred = n1;
}

// Chèn cặp pickup-delivery vào route
// QUAN TRỌNG: phải tính toán trước tất cả neighbor IDs trước khi relink
std::pair<size_t, size_t> Solution::relink_when_inserting_pd(
    size_t vn_id,
    size_t pickup_id,
    size_t pickup_after,
    size_t delivery_before) {
    size_t delivery_id = pickup_id + 1;

    // Tính trước các ID neighbor để tránh đọc từ cấu trúc đang được sửa đổi
    size_t old_succ_pickup = succ(pickup_after);
    size_t old_pred_delivery = pred(delivery_before);

    // Kiểm tra xem pickup và delivery có kề nhau sau khi chèn không
    bool delivery_after_pickup = (old_succ_pickup == delivery_before);

    if (fw_data_[pickup_after].succ == delivery_before) {
        // Case 1: pickup_after -> delivery_before (adjacent insertion)
        // Result: pickup_after -> pickup -> delivery -> delivery_before
        fw_data_.relink(vn_id, pickup_id, pickup_after, delivery_id);
        fw_data_.relink(vn_id, delivery_id, pickup_id, delivery_before);
        bw_data_.relink(vn_id, pickup_id, pickup_after, delivery_id);
        bw_data_.relink(vn_id, delivery_id, pickup_id, delivery_before);
    } else if (delivery_after_pickup) {
        // Case 2: pickup inserted, then delivery immediately after
        // pickup_after -> pickup -> old_succ_pickup(=delivery_before) -> ...
        // becomes: pickup_after -> pickup -> delivery -> delivery_before
        // CRITICAL: relink delivery with pickup as pred, NOT old_pred_delivery
        fw_data_.relink(vn_id, pickup_id, pickup_after, delivery_id);
        fw_data_.relink(vn_id, delivery_id, pickup_id, delivery_before);
        bw_data_.relink(vn_id, pickup_id, pickup_after, delivery_id);
        bw_data_.relink(vn_id, delivery_id, pickup_id, delivery_before);
    } else {
        // Case 3: Non-adjacent insertion with gap between pickup and delivery
        // pickup_after -> pickup -> old_succ_pickup -> ... -> old_pred_delivery -> delivery -> delivery_before
        fw_data_.relink(vn_id, pickup_id, pickup_after, old_succ_pickup);
        fw_data_.relink(vn_id, delivery_id, old_pred_delivery, delivery_before);
        bw_data_.relink(vn_id, pickup_id, pickup_after, old_succ_pickup);
        bw_data_.relink(vn_id, delivery_id, old_pred_delivery, delivery_before);
    }

    // Cập nhật cache với assignment mới
    size_t route_id = vn_id / 2;
    update_cache_on_insert(pickup_id, delivery_id, route_id);

    return {pickup_after, delivery_before};
}

std::pair<size_t, size_t> Solution::relink_gap_when_removing_node(size_t node) {
    auto [pred_node, succ_node] = pred_succ_pair(node);
    link_nodes(pred_node, succ_node);
    return {pred_node, succ_node};
}

std::pair<size_t, size_t> Solution::relink_gap_when_removing_pd(size_t pickup_id) {
    size_t p_pred = fw_data_[pickup_id].pred;
    size_t d_succ = fw_data_[pickup_id + 1].succ;

    if (fw_data_[pickup_id].succ == pickup_id + 1) {
        // Adjacent pair
        link_nodes(p_pred, d_succ);
    } else {
        // Non-adjacent pair
        link_nodes(p_pred, fw_data_[pickup_id].succ);
        link_nodes(fw_data_[pickup_id + 1].pred, d_succ);
    }

    // Don't reset nodes here - will be done by track_request_unassigned
    return {p_pred, d_succ};
}

void Solution::track_request_unassigned(size_t pickup_id) {
    if (unassigned_requests_.contains(pickup_id)) {
        return;
    }

    const size_t delivery_id = pickup_id + 1;

    unassigned_requests_.insert_pickup_id(pickup_id);

    // Invalidate blocks
    blocks_.invalidate_block(pickup_id);
    blocks_.invalidate_block(delivery_id);

    fw_data_[pickup_id].succ = pickup_id;
    fw_data_[pickup_id].pred = pickup_id;
    fw_data_[delivery_id].succ = delivery_id;
    fw_data_[delivery_id].pred = delivery_id;

    bw_data_[pickup_id].succ = pickup_id;
    bw_data_[pickup_id].pred = pickup_id;
    bw_data_[delivery_id].succ = delivery_id;
    bw_data_[delivery_id].pred = delivery_id;
}

void Solution::unassign_request(size_t pickup_id) {
    // Check if truly unassigned (self-loop)
    bool is_linked = (fw_data_[pickup_id].succ != pickup_id);

    if (unassigned_requests_.contains(pickup_id) && !is_linked) {
        return;
    }

    auto [validate_start, validate_end] = relink_gap_when_removing_pd(pickup_id);

    // Update cache before tracking as unassigned
    size_t delivery_id = pickup_id + 1;
    update_cache_on_remove(pickup_id, delivery_id);

    track_request_unassigned(pickup_id);
    validate_between(validate_start, validate_end);
}

// ============================================================
// Xác thực và cập nhật REF data
// ============================================================

void Solution::validate_between(size_t pickup_after, size_t delivery_before) {
    size_t vn_id = fw_data_[pickup_after].vn_id;
    partially_validate_between(
        pickup_after,
        delivery_before,
        UpdateBounds::complete_route(vn_id));
}

// Xác thực lại REF data trong một phần của route (từ first đến last)
void Solution::partially_validate_between(
    size_t first,
    size_t last,
    const UpdateBounds &bounds) {
    size_t vn_id = fw_data_[first].vn_id;

    // Giới hạn an toàn để tránh vòng lặp vô hạn
    const size_t MAX_NODES_IN_ROUTE = instance_->num_requests() * 2 + 12;

    // Cập nhật REF data theo chiều xuôi
    size_t prev_id = first;
    size_t fw_iterations = 0;
    while (prev_id != bounds.succ_last && fw_iterations < MAX_NODES_IN_ROUTE) {
        size_t node_id = fw_data_[prev_id].succ;

        fw_data_.extend_forward_unchecked(prev_id, node_id, *instance_);
        fw_data_[node_id].vn_id = vn_id;
        prev_id = node_id;
        fw_iterations++;
    }

    if (fw_iterations >= MAX_NODES_IN_ROUTE) {
        spdlog::warn("Possible cycle detected in partially_validate_between forward pass: vn_id {} hit max iterations ({})",
                     vn_id, MAX_NODES_IN_ROUTE);
    }

    // Cập nhật REF data theo chiều ngược
    size_t until = fw_data_[bounds.pred_first].succ;
    size_t next_id = last;
    size_t bw_iterations = 0;
    while (next_id != until && bw_iterations < MAX_NODES_IN_ROUTE) {
        size_t node_id = bw_data_[next_id].pred;

        // Stop if we hit an unassigned node (pred points to itself)
        if (node_id == next_id) {
            break;
        }

        bw_data_.extend_backward_unchecked(next_id, node_id, *instance_);
        bw_data_[node_id].vn_id = vn_id;
        next_id = node_id;
        bw_iterations++;
    }

    if (bw_iterations >= MAX_NODES_IN_ROUTE) {
        spdlog::warn("Possible cycle detected in partially_validate_between backward pass: vn_id {} hit max iterations ({})",
                     vn_id, MAX_NODES_IN_ROUTE);
    }

    empty_route_ids_[vn_id / 2] = (succ(vn_id) == vn_id + 1);

    revalidate_blocks(vn_id);
}

// Tính toán lại blocks cho toàn bộ route (tối ưu hóa cho LNS)
void Solution::revalidate_blocks(size_t vn_id) {
    const size_t MAX_NODES_IN_ROUTE = instance_->num_requests() * 2 + 12;
    size_t block_start = succ(vn_id);
    size_t outer_iterations = 0;

    while (block_start != vn_id + 1 && outer_iterations < MAX_NODES_IN_ROUTE) {
        blocks_.set_block_valid(block_start);
        blocks_[block_start].first_node_id = block_start;
        blocks_[block_start].data.reset_with_node(fw_data_[block_start].node);

        size_t open_pickups = 1;
        size_t prev_id = block_start;
        size_t inner_iterations = 0;

        while (open_pickups != 0 && inner_iterations < MAX_NODES_IN_ROUTE) {
            size_t node_id = succ(prev_id);
            blocks_.invalidate_block(node_id);

            auto dist_time = instance_->distance_and_time(prev_id, node_id);
            blocks_[block_start].data.extend_forward(
                fw_data_[node_id].node,
                dist_time);

            if (instance_->is_pickup(node_id)) {
                open_pickups++;
            } else {
                open_pickups--;
            }

            prev_id = node_id;
            inner_iterations++;
        }

        if (inner_iterations >= MAX_NODES_IN_ROUTE) {
            spdlog::warn("Possible cycle in revalidate_blocks inner loop: vn_id {} hit max iterations ({})",
                         vn_id, MAX_NODES_IN_ROUTE);
        }

        blocks_[block_start].last_node_id = prev_id;
        block_start = succ(prev_id);
        outer_iterations++;
    }

    if (outer_iterations >= MAX_NODES_IN_ROUTE) {
        spdlog::warn("Possible cycle in revalidate_blocks outer loop: vn_id {} hit max iterations ({})",
                     vn_id, MAX_NODES_IN_ROUTE);
    }

    // Reset vehicle node blocks
    blocks_[vn_id].data.reset_with_node(fw_data_[vn_id].node);
    blocks_[vn_id + 1].data.reset_with_node(fw_data_[vn_id + 1].node);
}

// ============================================================
// Kiểm tra tính khả thi và tính toán metrics của route
// ============================================================

bool Solution::is_route_feasible(size_t route_id) const {
    size_t vn_id = instance_->vn_id_of(route_id);
    return fw_data_[vn_id].data.tw_feasible;
}

double Solution::total_cost() const {
    double cost = 0.0;
    for (size_t i = 0; i < instance_->num_vehicles(); ++i) {
        cost += fw_data_[(i * 2) + 1].data.distance;
    }
    return cost;
}

double Solution::total_waiting_time() const {
    double waiting_time = 0.0;
    for (size_t i = 0; i < instance_->num_vehicles(); ++i) {
        const auto &data = fw_data_[(i * 2) + 1].data;
        waiting_time += std::max(0.0, data.duration() - data.time);
    }
    return waiting_time;
}

double Solution::objective() const {
    double obj = unassigned_requests_.total_penalty();
    obj += total_cost();
    return obj;
}

// ============================================================
// Duyệt qua các nodes trong route
// ============================================================

std::pair<std::vector<size_t>, REFData> Solution::extract_itinerary_and_data(size_t route_id) const {
    std::vector<size_t> itinerary = iter_route_by_vn_id(route_id * 2);
    REFData data = fw_data_[(route_id * 2) + 1].data;
    return {itinerary, data};
}

std::vector<size_t> Solution::iter_route_by_vn_id(size_t vn_id) const {
    const size_t MAX_NODES_IN_ROUTE = instance_->num_requests() * 2 + 12;
    std::vector<size_t> nodes;
    size_t node_id = vn_id;
    size_t iterations = 0;

    while (node_id != vn_id + 1 && iterations < MAX_NODES_IN_ROUTE) {
        size_t next_id = succ(node_id);
        if (next_id == node_id) {
            auto [pred_id, succ_id] = pred_succ_pair(node_id);
            spdlog::warn("Self-loop detected in iter_route_by_vn_id: vn_id {} stuck at node {} (pred={}, succ={})",
                         vn_id,
                         node_id,
                         pred_id,
                         succ_id);
            break;
        }
        nodes.push_back(node_id);
        node_id = next_id;
        iterations++;
    }

    if (iterations >= MAX_NODES_IN_ROUTE) {
        spdlog::warn("Possible cycle in iter_route_by_vn_id: vn_id {} hit max iterations ({})",
                     vn_id, MAX_NODES_IN_ROUTE);
    }

    nodes.push_back(vn_id + 1); // Add end vehicle node

    return nodes;
}

// ============================================================
// Các hàm hỗ trợ tối thiểu hóa số lượng vehicles
// ============================================================

std::vector<size_t> Solution::iter_route_ids() const {
    std::vector<size_t> route_ids;
    route_ids.reserve(number_of_non_empty_routes());
    for (size_t route_id = 0; route_id < instance_->num_vehicles(); ++route_id) {
        if (!is_route_empty(route_id)) {
            route_ids.push_back(route_id);
        }
    }
    return route_ids;
}

std::vector<size_t> Solution::iter_route(size_t route_id) const {
    return iter_route_by_vn_id(route_id * 2);
}

void Solution::set_with(const SolutionDescription &desc) {
    // Restore solution from saved itineraries
    set(desc.itineraries());
}

// Gỡ bỏ tất cả requests trong một route
void Solution::unassign_complete_route(size_t route_id) {
    size_t vn_start = route_id * 2;
    size_t vn_end = vn_start + 1;

    // Duyệt và đánh dấu tất cả requests là unassigned
    size_t next = succ(vn_start);
    while (next != vn_end) {
        size_t current = next;
        next = succ(current); // Save next before we potentially modify links

        // Track delivery nodes to unassign their requests
        if (instance_->is_delivery(current)) {
            const size_t pickup_id = current - 1;
            const size_t delivery_id = current;

            update_cache_on_remove(pickup_id, delivery_id);
            track_request_unassigned(pickup_id);
        }
    }

    // Clear the route
    link_nodes(vn_start, vn_end);

    fw_data_[vn_start].data.reset_with_node(fw_data_[vn_start].node);
    fw_data_[vn_end].data.reset_with_node(fw_data_[vn_end].node);
    bw_data_[vn_start].data.reset_with_node(bw_data_[vn_start].node);
    bw_data_[vn_end].data.reset_with_node(bw_data_[vn_end].node);

    revalidate_blocks(vn_start);

    empty_route_ids_[route_id] = true;
}

void Solution::clamp_max_number_of_vehicles_to_current_fleet_size() {
    max_num_vehicles_available_ = number_of_non_empty_routes();
    std::fill(empty_route_ids_.begin(), empty_route_ids_.end(), false);
}

SolutionDescription Solution::to_description() const {
    return SolutionDescription(*this);
}

// ============================================================
// Quản lý cache (tăng tốc truy vấn route của node/request)
// ============================================================

void Solution::rebuild_cache() {
    node_to_route_.clear();
    request_assignments_.clear();

    // Xây dựng lại cache từ cấu trúc solution hiện tại
    for (size_t route_id = 0; route_id < instance_->num_vehicles(); ++route_id) {
        if (is_route_empty(route_id)) {
            continue;
        }

        size_t vn_id = route_id * 2;
        size_t pos = 0;
        size_t current = succ(vn_id);
        size_t vn_end = vn_id + 1;

        while (current != vn_end) {
            node_to_route_[current] = route_id;

            if (instance_->is_pickup(current)) {
                size_t request_id = instance_->request_id(current);
                size_t delivery_id = current + 1;

                // Find delivery position
                size_t delivery_pos = pos;
                size_t node = current;
                while (node != delivery_id) {
                    node = succ(node);
                    delivery_pos++;
                }

                request_assignments_[request_id] = RequestAssignment{
                    route_id,
                    pos,
                    delivery_pos};
            }

            current = succ(current);
            pos++;
        }
    }
}

// Cập nhật cache khi chèn request vào route
void Solution::update_cache_on_insert(size_t pickup_id, size_t delivery_id, size_t route_id) {
    node_to_route_[pickup_id] = route_id;
    node_to_route_[delivery_id] = route_id;

    size_t request_id = instance_->request_id(pickup_id);
    request_assignments_[request_id] = RequestAssignment{route_id, 0, 0};
}

// Cập nhật cache khi gỡ bỏ request khỏi route
void Solution::update_cache_on_remove(size_t pickup_id, size_t delivery_id) {
    node_to_route_.erase(pickup_id);
    node_to_route_.erase(delivery_id);

    size_t request_id = instance_->request_id(pickup_id);
    request_assignments_.erase(request_id);
}

size_t Solution::route_of_node(size_t node_id) const {
    auto it = node_to_route_.find(node_id);
    if (it != node_to_route_.end()) {
        return it->second; // O(1) lookup
    }

    // Fallback: linear search (for compatibility during transition)
    for (size_t route_id = 0; route_id < instance_->num_vehicles(); ++route_id) {
        size_t vn_id = route_id * 2;
        size_t current = succ(vn_id);
        size_t vn_end = vn_id + 1;

        while (current != vn_end) {
            if (current == node_id) {
                return route_id;
            }
            current = succ(current);
        }
    }

    throw std::runtime_error("Node not found in any route");
}

size_t Solution::route_of_request(size_t request_id) const {
    auto it = request_assignments_.find(request_id);
    if (it != request_assignments_.end()) {
        return it->second.route_id; // O(1) lookup
    }

    throw std::runtime_error("Request is not assigned to any route");
}

bool Solution::is_request_assigned(size_t request_id) const {
    return request_assignments_.find(request_id) != request_assignments_.end();
}

// ============================================================
// Các phương thức duyệt bổ sung
// ============================================================

std::vector<size_t> Solution::iter_empty_route_ids() const {
    std::vector<size_t> empty_routes;
    // Respect max_num_vehicles_available_ when clamped by AGES
    size_t max_rid = std::min(max_num_vehicles_available_, instance_->num_vehicles());
    for (size_t rid = 0; rid < max_rid; ++rid) {
        if (rid < empty_route_ids_.size() && empty_route_ids_[rid]) {
            empty_routes.push_back(rid);
        }
    }
    return empty_routes;
}

} // namespace pdptw::solution
