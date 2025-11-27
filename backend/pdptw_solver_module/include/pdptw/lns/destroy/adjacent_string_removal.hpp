#ifndef PDPTW_LNS_DESTROY_ADJACENT_STRING_REMOVAL_HPP
#define PDPTW_LNS_DESTROY_ADJACENT_STRING_REMOVAL_HPP

#include "pdptw/lns/destroy/operator.hpp"
#include "pdptw/problem/pdptw.hpp"
#include <random>

namespace pdptw {
namespace lns {

// Adjacent String Removal (Shaw Removal): Loại bỏ các request liên quan về không gian/thời gian
// Chọn 1 request làm seed, sau đó loại bỏ các request liên quan
class AdjacentStringRemovalOperator : public DestroyOperator {
public:
    AdjacentStringRemovalOperator();

    void destroy(
        solution::Solution &solution,
        size_t num_to_remove) override;

    std::string name() const override { return "AdjacentString"; }

private:
    // Tính độ liên quan giữa 2 requests (giá trị thấp = liên quan nhiều)
    problem::Num relatedness(
        const problem::PDPTWInstance &instance,
        size_t req1,
        size_t req2);

    std::mt19937 rng_;

    // Trọng số tính độ liên quan: khoảng cách, thời gian, demand
    double distance_weight_ = 9.0;
    double time_weight_ = 3.0;
    double demand_weight_ = 2.0;
};

} // namespace lns
} // namespace pdptw

#endif // PDPTW_LNS_DESTROY_ADJACENT_STRING_REMOVAL_HPP
