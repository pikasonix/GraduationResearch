#include "pdptw/solution/blocknode.hpp"
#include "pdptw/problem/pdptw.hpp"

namespace pdptw::solution {

// BlockNode: đại diện cho một đoạn liên tục các nodes trong route

BlockNode::BlockNode()
    : first_node_id(0), last_node_id(0), data() {}

BlockNode::BlockNode(size_t first, size_t last, const refn::REFData &ref_data)
    : first_node_id(first), last_node_id(last), data(ref_data) {}

// Nối hai block lại với nhau, cập nhật REF data tương ứng
void BlockNode::concat_into_target(const BlockNode &other, BlockNode &target,
                                   const problem::PDPTWInstance &instance) const {
    target.first_node_id = this->first_node_id;
    target.last_node_id = other.last_node_id;

    auto travel = instance.distance_and_time(this->last_node_id, other.first_node_id);
    this->data.concat_into_target(other.data, target.data, travel);
}

// BlockNodes: quản lý tập hợp các blocks trong solution

BlockNodes::BlockNodes(const problem::PDPTWInstance &instance) {
    size_t num_nodes = instance.nodes().size();
    is_block_start_.resize(num_nodes, false);
    data_.resize(num_nodes);

    // Khởi tạo mỗi block đại diện cho một node đơn lẻ
    for (size_t i = 0; i < num_nodes; ++i) {
        data_[i].first_node_id = i;
        data_[i].last_node_id = i;
    }
}

bool BlockNodes::is_block_start(size_t node_id) const {
    return node_id < is_block_start_.size() && is_block_start_[node_id];
}

void BlockNodes::set_block_valid(size_t node_id) {
    if (node_id < is_block_start_.size()) {
        is_block_start_[node_id] = true;
    }
}

void BlockNodes::invalidate_block(size_t node_id) {
    if (node_id < is_block_start_.size()) {
        is_block_start_[node_id] = false;
    }
}

void BlockNodes::invalidate_all() {
    std::fill(is_block_start_.begin(), is_block_start_.end(), false);
}

const BlockNode &BlockNodes::get_block(size_t node_id) const {
    return data_[node_id];
}

BlockNode &BlockNodes::get_block_mut(size_t node_id) {
    return data_[node_id];
}

size_t BlockNodes::size() const {
    return data_.size();
}

const BlockNode &BlockNodes::operator[](size_t index) const {
    return data_[index];
}

BlockNode &BlockNodes::operator[](size_t index) {
    return data_[index];
}

} // namespace pdptw::solution
