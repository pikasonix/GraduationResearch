#ifndef GENETIC_OPERATORS_H
#define GENETIC_OPERATORS_H

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <random>
#include <vector>

namespace pdptw {

// Import types
using Solution = solution::Solution;
using Instance = problem::PDPTWInstance;

// Toán tử di truyền cho AGES - lai ghép và đột biến
class GeneticOperators {
public:
    explicit GeneticOperators(const Instance &instance, unsigned int seed = 42);

    // Lai ghép dựa trên tuyến: chọn ngẫu nhiên các tuyến từ 2 cha mẹ
    bool route_crossover(const Solution &parent1,
                         const Solution &parent2,
                         Solution &offspring);

    // Lai ghép theo thứ tự (OX): giữ thứ tự các request từ cha mẹ
    bool order_crossover(const Solution &parent1,
                         const Solution &parent2,
                         Solution &offspring);

    // Lai ghép tuyến tốt nhất: lấy các tuyến có chi phí thấp từ 2 cha mẹ
    bool best_route_crossover(const Solution &parent1,
                              const Solution &parent2,
                              Solution &offspring);

    // Đột biến: Di chuyển request sang vị trí khác
    size_t mutate_relocate(Solution &solution, size_t num_mutations = 1);

    // Đột biến: Hoán đổi 2 request
    size_t mutate_swap(Solution &solution, size_t num_mutations = 1);

    // Đột biến: Xáo trộn đoạn tuyến
    size_t mutate_shuffle(Solution &solution, size_t num_mutations = 1);

    // Đột biến thích nghi: tự chọn toán tử dựa trên hiệu quả
    size_t adaptive_mutate(Solution &solution, size_t intensity = 3);

    // Chọn lọc giải đấu: chọn tốt nhất trong nhóm ngẫu nhiên
    size_t tournament_selection(const std::vector<Solution> &population,
                                size_t tournament_size = 3);

    // Chọn lọc bánh xe roulette: xác suất tỉ lệ với fitness
    size_t roulette_selection(const std::vector<Solution> &population);

    std::mt19937 &rng() { return rng_; }

    std::string get_statistics() const;
    void reset_statistics();

private:
    const Instance &instance_;
    std::mt19937 rng_; // Bộ sinh số ngẫu nhiên

    // Thống kê cho chọn lọc thích nghi
    struct OperatorStats {
        size_t used = 0;       // Số lần dùng
        size_t successful = 0; // Số lần thành công
        double success_rate() const {
            return used > 0 ? static_cast<double>(successful) / used : 0.0;
        }
    };

    OperatorStats crossover_stats_;
    OperatorStats mutation_relocate_stats_;
    OperatorStats mutation_swap_stats_;
    OperatorStats mutation_shuffle_stats_;

    // Copy một tuyến từ giải pháp này sang giải pháp khác
    bool copy_route(const Solution &from,
                    Solution &to,
                    size_t route_id,
                    std::vector<bool> &assigned);

    // Sửa chữa giải pháp bằng cách chèn các request chưa gán
    size_t repair_solution(Solution &solution,
                           const std::vector<size_t> &unassigned);
};

} // namespace pdptw

#endif // GENETIC_OPERATORS_H
