#ifndef EVOLUTION_H
#define EVOLUTION_H

#include "ages/genetic_operators.h"
#include "ages/population.h"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <memory>
#include <vector>

namespace pdptw {

// Import types
using Solution = solution::Solution;
using Instance = problem::PDPTWInstance;

// Chiến lược tiến hóa cho AGES - quản lý quá trình tiến hóa quần thể
class Evolution {
public:
    // Tham số tiến hóa
    struct Parameters {
        size_t max_generations = 100;         // Số thế hệ tối đa
        size_t max_stagnant_generations = 20; // Dừng nếu không cải thiện
        size_t population_size = 10;          // Kích thước quần thể
        double min_diversity = 0.1;           // Ngưỡng đa dạng tối thiểu
        double diversity_weight = 0.1;        // Trọng số thưởng cho đa dạng
        double crossover_rate = 0.8;          // Xác suất lai ghép vs đột biến
        size_t tournament_size = 3;           // Kích thước giải đấu chọn lọc
        size_t elite_size = 2;                // Số cá thể ưu tú giữ lại
        size_t mutation_intensity = 3;        // Cường độ đột biến (1-10)
        unsigned int seed = 42;               // Seed ngẫu nhiên
    };

    // Thống kê tiến hóa
    struct Statistics {
        size_t generations_run = 0;           // Số thế hệ đã chạy
        size_t total_offspring_generated = 0; // Tổng số con lai tạo ra
        size_t successful_crossovers = 0;     // Số lần lai ghép thành công
        size_t successful_mutations = 0;      // Số lần đột biến thành công
        double initial_best_objective = 0.0;  // Giá trị ban đầu
        double final_best_objective = 0.0;    // Giá trị cuối cùng
        double improvement_percentage = 0.0;  // Phần trăm cải thiện

        std::string to_string() const;
    };

    Evolution(const Instance &instance, const Parameters &params);

    // Chạy tiến hóa từ quần thể ban đầu
    Solution run(const std::vector<Solution> &initial_population);

    // Chạy tiến hóa từ một giải pháp (tạo quần thể bằng đột biến)
    Solution run(const Solution &initial_solution);

    // Chạy một thế hệ tiến hóa: sinh con → đánh giá → chọn lọc
    bool evolve_one_generation();

    // Tính fitness = objective - diversity_weight * diversity (thấp hơn = tốt hơn)
    double calculate_fitness(const Solution &solution) const;

    // Sinh con từ quần thể (lai ghép hoặc đột biến)
    std::vector<Solution> generate_offspring(size_t num_offspring);

    // Chọn lọc cá thể sống sót (elitism + fitness)
    std::vector<Solution> select_survivors(const std::vector<Solution> &offspring);

    // Kiểm tra điều kiện dừng (max gen, stagnant, low diversity)
    bool should_terminate() const;

    const Population &population() const { return population_; }
    Population &population() { return population_; }

    const Solution *get_best_solution() const {
        return population_.get_best_ever();
    }

    const Statistics &get_statistics() const { return stats_; }

    GeneticOperators &genetic_operators() { return genetic_ops_; }
    const GeneticOperators &genetic_operators() const { return genetic_ops_; }

    void reset(); // Reset quần thể và thống kê

private:
    const Instance &instance_;
    Parameters params_;

    Population population_;        // Quần thể hiện tại
    GeneticOperators genetic_ops_; // Toán tử di truyền

    Statistics stats_; // Thống kê
    size_t current_generation_ = 0;
    size_t generations_without_improvement_ = 0;
    double last_best_objective_ = std::numeric_limits<double>::infinity();

    // Tạo quần thể ban đầu từ một giải pháp
    std::vector<Solution> create_initial_population(const Solution &initial_solution);

    // Cập nhật thống kê sau mỗi thế hệ
    void update_statistics();
};

} // namespace pdptw

#endif // EVOLUTION_H
