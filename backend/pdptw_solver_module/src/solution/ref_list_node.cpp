#include "pdptw/solution/ref_list_node.hpp"

namespace pdptw {
namespace solution {

// REFListNode: node trong danh sách liên kết với REF data

REFListNode::REFListNode()
    : node(), succ(0), pred(0), vn_id(std::numeric_limits<size_t>::max()), data() {}

REFListNode::REFListNode(const refn::REFNode &node)
    : node(node),
      succ(node.id),
      pred(node.id),
      vn_id(std::numeric_limits<size_t>::max()),
      data(refn::REFData::with_node(node)) {}

// Cập nhật con trỏ của node hiện tại
// LƯU Ý: CHỈ cập nhật con trỏ của node này, KHÔNG cập nhật con trỏ của nodes kế cận
void REFListNode::relink(size_t new_vn_id, size_t new_pred, size_t new_succ) {
    vn_id = new_vn_id;
    pred = new_pred;
    succ = new_succ;
}

} // namespace solution
} // namespace pdptw
