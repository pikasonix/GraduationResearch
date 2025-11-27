#ifndef AGES_SOLVER_H
#define AGES_SOLVER_H

#include "ages/adaptive_control.h"
#include "ages/evolution.h"
#include "ages/genetic_operators.h"
#include "ages/population.h"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <chrono>
#include <memory>

namespace pdptw {

// Import types
using Solution = solution::Solution;
using Instance = problem::PDPTWInstance;

// AGES (Adaptive Genetic Evolution Strategy) Solver
// Thuật toán tiến hóa di truyền thích nghi cho PDPTW
class AGESSolver {
public:
    // Tham số AGES solver
    struct Parameters {
        // Tham số tiến hóa
        size_t max_phases = 10;               // Số pha AGES tối đa
        size_t iterations_per_phase = 1000;   // Số vòng lặp LNS mỗi pha
        size_t max_generations = 100;         // Số thế hệ tối đa mỗi đợt tiến hóa
        size_t max_stagnant_generations = 20; // Dừng nếu không cải thiện

        // Tham số quần thể
        size_t population_size = 10;   // Kích thước quần thể
        double min_diversity = 0.1;    // Ngưỡng đa dạng tối thiểu
        double diversity_weight = 0.1; // Trọng số thưởng cho đa dạng

        // Tham số toán tử di truyền
        double crossover_rate = 0.8;   // Xác suất lai ghép vs đột biến
        size_t tournament_size = 3;    // Kích thước giải đấu chọn lọc
        size_t elite_size = 2;         // Số cá thể ưu tú giữ lại
        size_t mutation_intensity = 3; // Cường độ đột biến

        // Tham số điều khiển thích nghi
        bool enable_adaptive_operators = true;   // Bật điều chỉnh toán tử
        bool enable_adaptive_temperature = true; // Bật điều chỉnh nhiệt độ
        bool enable_adaptive_population = false; // Bật điều chỉnh quần thể

        double reward_factor = 1.1;       // Hệ số thưởng
        double punishment_factor = 0.95;  // Hệ số phạt
        double initial_temperature = 0.1; // Nhiệt độ SA ban đầu
        double cooling_rate = 0.95;       // Tốc độ làm lạnh

        // Giới hạn thời gian
        double time_limit_seconds = 60.0; // Thời gian tối đa

        // Seed ngẫu nhiên
        unsigned int seed = 42;

        static Parameters defaults() { return Parameters(); }
        static Parameters quick_test() {
            Parameters p;
            p.max_phases = 3;
            p.iterations_per_phase = 100;
            p.max_generations = 10;
            p.population_size = 5;
            return p;
        }
    };

    // Thống kê AGES solver
    struct Statistics {
        size_t phases_completed = 0;  // Số pha hoàn thành
        size_t total_generations = 0; // Tổng số thế hệ
        size_t total_offspring = 0;   // Tổng số con lai tạo ra

        double initial_objective = 0.0;      // Giá trị ban đầu
        double best_objective = 0.0;         // Giá trị tốt nhất
        double improvement_percentage = 0.0; // Phần trăm cải thiện

        double total_time_seconds = 0.0;        // Tổng thời gian
        double construction_time_seconds = 0.0; // Thời gian khởi tạo
        double evolution_time_seconds = 0.0;    // Thời gian tiến hóa

        std::string to_string() const;
    };

    AGESSolver(const Instance &instance, const Parameters &params = Parameters::defaults());

    // Chạy AGES solver từ đầu (tự tạo giải pháp ban đầu)
    Solution solve();

    // Chạy AGES solver từ giải pháp cho trước
    Solution solve(const Solution &initial_solution);

    // Chạy một pha AGES (tiến hóa quần thể)
    bool run_phase(std::vector<Solution> &initial_population);

    const Statistics &get_statistics() const { return stats_; }

    const Solution *get_best_solution() const {
        return evolution_ ? evolution_->get_best_solution() : nullptr;
    }

    const Population &get_population() const {
        return evolution_->population();
    }

    const AdaptiveControl &get_adaptive_control() const {
        return *adaptive_control_;
    }

    bool is_time_limit_exceeded() const;
    double get_elapsed_time() const;

private:
    const Instance &instance_;
    Parameters params_;

    // Các thành phần AGES
    std::unique_ptr<Evolution> evolution_;
    std::unique_ptr<AdaptiveControl> adaptive_control_;

    // Trạng thái
    Statistics stats_;
    size_t current_phase_ = 0;
    double last_best_objective_ = std::numeric_limits<double>::infinity();
    size_t phases_without_improvement_ = 0;

    // Đo thời gian
    std::chrono::steady_clock::time_point start_time_;

    Solution construct_initial_solution();         // Tạo giải pháp ban đầu
    bool should_terminate() const;                 // Kiểm tra điều kiện dừng
    void update_statistics();                      // Cập nhật thống kê sau mỗi pha
    void adapt_parameters();                       // Điều chỉnh tham số giữa các pha
    std::unique_ptr<Evolution> create_evolution(); // Tạo đối tượng Evolution
};

} // namespace pdptw

#endif // AGES_SOLVER_H
