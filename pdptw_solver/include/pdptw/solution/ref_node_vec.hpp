#ifndef PDPTW_SOLUTION_REF_NODE_VEC_HPP
#define PDPTW_SOLUTION_REF_NODE_VEC_HPP

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/ref_list_node.hpp"
#include <cstddef>
#include <vector>

namespace pdptw {
namespace solution {

// REF Node Vector: Lưu trữ chính cho route representation của solution
// - Vector storage với O(1) random access by node ID
// - Doubly-linked list qua succ/pred pointers
// - REF data propagation cho feasibility checking
//
// Invariants:
// - data[i*2] là start depot của vehicle i
// - data[i*2+1] là end depot của vehicle i
// - Unassigned requests: vn_id = node_id, succ = pred = node_id
class REFNodeVec {
private:
    std::vector<REFListNode> data;

public:
    // Khởi tạo từ PDPTW instance (vehicle depots linked, requests unassigned)
    explicit REFNodeVec(const problem::PDPTWInstance &instance);

    size_t size() const { return data.size(); }
    bool empty() const { return data.empty(); }

    // Reset về initial state (all unassigned)
    void reset(const problem::PDPTWInstance &instance);

    // Relink node vào route (cập nhật vn_id, pred, succ và maintain consistency)
    void relink(size_t vn_id, size_t node_id, size_t pred_id, size_t succ_id);

    // Forward extend REF data từ 'from' đến 'to'
    void extend_forward_unchecked(size_t from, size_t to,
                                  const problem::PDPTWInstance &instance);

    // Backward extend REF data từ 'from' đến 'to'
    void extend_backward_unchecked(size_t from, size_t to,
                                   const problem::PDPTWInstance &instance);

    // Array access operators
    REFListNode &operator[](size_t index) { return data[index]; }
    const REFListNode &operator[](size_t index) const { return data[index]; }

    // Iterator support
    using iterator = std::vector<REFListNode>::iterator;
    using const_iterator = std::vector<REFListNode>::const_iterator;

    iterator begin() { return data.begin(); }
    iterator end() { return data.end(); }
    const_iterator begin() const { return data.begin(); }
    const_iterator end() const { return data.end(); }
    const_iterator cbegin() const { return data.cbegin(); }
    const_iterator cend() const { return data.cend(); }

private:
    // Helper cho extend operations: trả về (const source, mutable target)
    std::pair<const REFListNode *, REFListNode *> get_pair_internal(size_t from, size_t to);
};

} // namespace solution
} // namespace pdptw

#endif // PDPTW_SOLUTION_REF_NODE_VEC_HPP
