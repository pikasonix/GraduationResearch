#include "pdptw/refn/ref_node.hpp"
#include "pdptw/problem/pdptw.hpp"

namespace pdptw {
namespace refn {

REFNode::REFNode(const problem::Node &node)
    : id(node.id()),
      demand(node.demand()),
      ready(node.ready()),
      due(node.due()),
      servicetime(node.servicetime()) {
}

} // namespace refn
} // namespace pdptw
