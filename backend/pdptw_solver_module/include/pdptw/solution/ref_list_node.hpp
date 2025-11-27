#ifndef PDPTW_SOLUTION_REF_LIST_NODE_HPP
#define PDPTW_SOLUTION_REF_LIST_NODE_HPP

#include "pdptw/refn/ref_data.hpp"
#include "pdptw/refn/ref_node.hpp"
#include <cstddef>
#include <limits>

namespace pdptw {
namespace solution {

// REF List Node: Node trong doubly-linked list với REF data
// Duy trì: REFNode (id, demand, time windows), links (succ/pred), vehicle assignment (vn_id), REF data
class REFListNode {
public:
    refn::REFNode node; // Thông tin node cơ bản
    size_t succ;        // Successor node ID
    size_t pred;        // Predecessor node ID
    size_t vn_id;       // Vehicle/route ID
    refn::REFData data; // REF data tích lũy

    REFListNode();
    explicit REFListNode(const refn::REFNode &node);

    // Relink node với vehicle và neighbors mới
    void relink(size_t new_vn_id, size_t new_pred, size_t new_succ);
};

} // namespace solution
} // namespace pdptw

#endif // PDPTW_SOLUTION_REF_LIST_NODE_HPP
