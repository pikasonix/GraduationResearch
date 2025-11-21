#pragma once

#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/solution/permutation.hpp"

// K-ejection insertion operations

namespace pdptw::solution {

// K-ejection: Thử chèn request bằng cách đẩy K requests khác ra
// Dùng trong AGES khi simple insertion thất bại
class KEjectionOps {
public:
    // Tìm best 1-ejection insertion: chèn request bằng cách đẩy 1 request khác ra
    static std::optional<KEjectionInsertion<1>> find_best_insertion_k_ejection_1(
        const Solution &sol,
        size_t pickup_id,
        std::mt19937 &rng,
        const lns::AbsenceCounter &absence);

    // Tìm best 2-ejection insertion: chèn request bằng cách đẩy 2 requests khác ra
    static std::optional<KEjectionInsertion<2>> find_best_insertion_k_ejection_2(
        const Solution &sol,
        size_t pickup_id,
        std::mt19937 &rng,
        const lns::AbsenceCounter &absence);

private:
    // Score ejection dựa trên absence counter (cao = nên đẩy ra)
    static double score_ejection(const lns::AbsenceCounter &absence, size_t request_id) {
        return static_cast<double>(absence.get_absence(request_id));
    }
};

} // namespace pdptw::solution
