#ifndef PDPTW_LNS_DESTROY_OPERATOR_HPP
#define PDPTW_LNS_DESTROY_OPERATOR_HPP

#include "pdptw/solution/datastructure.hpp"
#include <string>
#include <vector>

namespace pdptw {
namespace lns {

// Destroy operator: Loại bỏ các request khỏi solution để tạo "lỗ hổng" cho repair operator
class DestroyOperator {
public:
    virtual ~DestroyOperator() = default;

    // Loại bỏ requests khỏi solution
    virtual void destroy(
        solution::Solution &solution,
        size_t num_to_remove) = 0;

    virtual std::string name() const = 0;

    // Trọng số operator (cho adaptive selection)
    double weight() const { return weight_; }
    void set_weight(double w) { weight_ = w; }

protected:
    double weight_ = 1.0;
};

} // namespace lns
} // namespace pdptw

#endif // PDPTW_LNS_DESTROY_OPERATOR_HPP
