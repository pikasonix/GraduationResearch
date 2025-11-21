#ifndef PDPTW_LNS_DESTROY_ROUTE_REMOVAL_HPP
#define PDPTW_LNS_DESTROY_ROUTE_REMOVAL_HPP

#include "pdptw/lns/destroy/operator.hpp"
#include <random>

namespace pdptw {
namespace lns {

// Route Removal: Loại bỏ tất cả requests từ một hoặc nhiều route được chọn ngẫu nhiên
class RouteRemovalOperator : public DestroyOperator {
public:
    RouteRemovalOperator();

    void destroy(
        solution::Solution &solution,
        size_t num_to_remove) override;

    std::string name() const override { return "RouteRemoval"; }

private:
    std::mt19937 rng_;
};

} // namespace lns
} // namespace pdptw

#endif // PDPTW_LNS_DESTROY_ROUTE_REMOVAL_HPP
