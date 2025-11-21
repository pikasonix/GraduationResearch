#ifndef PDPTW_LNS_DESTROY_WORST_REMOVAL_HPP
#define PDPTW_LNS_DESTROY_WORST_REMOVAL_HPP

#include "pdptw/lns/destroy/operator.hpp"
#include "pdptw/problem/pdptw.hpp"
#include <random>

namespace pdptw {
namespace lns {

// Worst Removal: Loại bỏ các request có cost contribution cao nhất
// Sử dụng lựa chọn ngẫu nhiên thiên về các request tệ nhất
class WorstRemovalOperator : public DestroyOperator {
public:
    WorstRemovalOperator();

    void destroy(
        solution::Solution &solution,
        size_t num_to_remove) override;

    std::string name() const override { return "WorstRemoval"; }

private:
    // Tính cost contribution của mỗi request
    std::vector<std::pair<size_t, problem::Num>> calculate_contributions(
        const solution::Solution &solution);

    std::mt19937 rng_;
    double randomization_factor_ = 6.0; // Độ ngẫu nhiên
};

} // namespace lns
} // namespace pdptw

#endif // PDPTW_LNS_DESTROY_WORST_REMOVAL_HPP
