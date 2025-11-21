// K-EJECTION OPERATIONS - Chưa được triển khai
// Đây là các toán tử nâng cao cho LNS: loại bỏ k requests để chèn 1 request mới

#include "pdptw/solution/k_ejection.hpp"
#include <spdlog/spdlog.h>

namespace pdptw::solution {

std::optional<KEjectionInsertion<1>> KEjectionOps::find_best_insertion_k_ejection_1(
    const Solution &sol,
    size_t pickup_id,
    std::mt19937 &rng,
    const lns::AbsenceCounter &absence) {
    return std::nullopt;
}

std::optional<KEjectionInsertion<2>> KEjectionOps::find_best_insertion_k_ejection_2(
    const Solution &sol,
    size_t pickup_id,
    std::mt19937 &rng,
    const lns::AbsenceCounter &absence) {
    return std::nullopt;
}

} // namespace pdptw::solution
