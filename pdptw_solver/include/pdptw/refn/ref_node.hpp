#ifndef PDPTW_REFN_REF_NODE_HPP
#define PDPTW_REFN_REF_NODE_HPP

#include <cstddef>
#include <cstdint> // For int16_t

// Forward declarations
namespace pdptw {
namespace problem {
class Node;
using Num = double;
using Capacity = int16_t;
} // namespace problem
} // namespace pdptw

namespace pdptw {
namespace refn {

using problem::Capacity;
using problem::Num;

// REF Node: Node đơn giản hóa dùng cho Resource Extension Function
// Chỉ chứa dữ liệu cần thiết cho feasibility checking
class REFNode {
public:
    size_t id;
    Capacity demand;
    Num ready;
    Num due;
    Num servicetime;

    REFNode() : id(0), demand(0), ready(0.0), due(0.0), servicetime(0.0) {}

    explicit REFNode(const problem::Node &node);

    REFNode(const REFNode &) = default;
    REFNode &operator=(const REFNode &) = default;
};

} // namespace refn
} // namespace pdptw

#endif // PDPTW_REFN_REF_NODE_HPP
