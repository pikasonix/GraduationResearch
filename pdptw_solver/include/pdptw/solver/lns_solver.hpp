#ifndef PDPTW_LNS_SOLVER_HPP
#define PDPTW_LNS_SOLVER_HPP

#include "pdptw/construction/constructor.hpp"
#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/lns/destroy/operator.hpp"
#include "pdptw/lns/fleet_minimization.hpp"
#include "pdptw/lns/repair/operator.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <functional>
#include <memory>
#include <optional>
#include <random>
#include <vector>

namespace pdptw {

// Type aliases for convenience
using Num = problem::Num;
using PDPTWInstance = problem::PDPTWInstance;
using Solution = solution::Solution;

// ============================================================================
// Acceptance Criterion: Quyết định có chấp nhận solution mới không
// ============================================================================

class AcceptanceCriterion {
public:
    virtual ~AcceptanceCriterion() = default;

    // Cập nhật temperature/threshold theo iteration progress
    virtual void update(int iteration, int max_iterations) = 0;

    // Kiểm tra có chấp nhận solution mới không
    virtual bool accept(
        Num new_obj,
        Num current_obj,
        Num best_obj,
        std::mt19937 &rng) = 0;

    // Lấy temperature/threshold hiện tại
    virtual double get_temperature() const = 0;
};

// Simulated Annealing: Chấp nhận xấu hơn với xác suất e^(-delta/T)
class SimulatedAnnealing : public AcceptanceCriterion {
private:
    double initial_temp;
    double final_temp;
    double current_temp;
    double cooling_factor;

public:
    SimulatedAnnealing(double initial_temperature, double final_temperature, int max_iterations);

    void update(int iteration, int max_iterations) override;
    bool accept(Num new_obj, Num current_obj, Num best_obj, std::mt19937 &rng) override;
    double get_temperature() const override { return current_temp; }
};

// Record-to-Record Travel: Chấp nhận nếu trong threshold của best
class RecordToRecordTravel : public AcceptanceCriterion {
private:
    double initial_threshold;
    double final_threshold;
    double current_threshold;
    double cooling_constant;

public:
    RecordToRecordTravel(double initial_threshold, double final_threshold, int max_iterations);

    void update(int iteration, int max_iterations) override;
    bool accept(Num new_obj, Num current_obj, Num best_obj, std::mt19937 &rng) override;
    double get_temperature() const override { return current_threshold; }
};

// OnlyImprovements: Chỉ chấp nhận cải thiện
class OnlyImprovements : public AcceptanceCriterion {
public:
    void update(int iteration, int max_iterations) override {}
    bool accept(Num new_obj, Num current_obj, Num best_obj, std::mt19937 &rng) override;
    double get_temperature() const override { return 0.0; }
};

// ============================================================================
// LNS Solver Statistics: Thống kê quá trình LNS
// ============================================================================

struct LNSStatistics {
    int total_iterations = 0;
    int accepted_solutions = 0;
    int improving_solutions = 0;
    int new_best_solutions = 0;

    // Thống kê per-operator
    struct OperatorStats {
        int times_used = 0;
        int times_improved = 0;
        int times_found_new_best = 0;
        double avg_improvement = 0.0; // Cải thiện trung bình khi improved
    };

    std::vector<OperatorStats> destroy_stats;
    std::vector<OperatorStats> repair_stats;

    // Objective values
    Num initial_objective = 0;
    Num best_objective = 0;
    Num final_objective = 0;

    // Timing
    double total_time_seconds = 0.0;

    void print_summary() const;
};

// ============================================================================
// LNS Solver Parameters: Tham số LNS
// ============================================================================

struct LNSSolverParams {
    // Giới hạn iterations
    int max_iterations = 100000;
    int max_non_improving_iterations = 20000;
    double time_limit_seconds = 0.0; // 0 = không giới hạn

    // Destroy size parameters
    double min_destroy_fraction = 0.20; // Fraction dự phòng khi counts disabled
    double max_destroy_fraction = 0.35;
    std::optional<int> min_destroy_requests;
    std::optional<int> max_destroy_requests;

    // Acceptance criterion
    enum class AcceptanceType {
        SIMULATED_ANNEALING,
        RECORD_TO_RECORD,
        ONLY_IMPROVEMENTS
    };
    AcceptanceType acceptance_type = AcceptanceType::SIMULATED_ANNEALING;
    double initial_temperature = 0.5;
    double final_temperature = 0.01;

    // Random seed
    unsigned int seed = 42;

    // Logging
    bool verbose = true;
    int log_frequency = 100; // Log mỗi N iterations
};

// ============================================================================
// LNS Solver: Large Neighborhood Search solver
// ============================================================================

class LNSSolver {
private:
    const PDPTWInstance &instance;
    LNSSolverParams params;
    std::mt19937 rng;

    // Operators
    std::vector<std::unique_ptr<lns::DestroyOperator>> destroy_operators;
    // Standard repair operators: Greedy, Regret
    std::vector<std::unique_ptr<lns::repair::RepairOperator>> repair_operators;
    // Absence-aware repair operators: HardestFirst, AbsenceRegret
    std::vector<std::unique_ptr<lns::repair::AbsenceAwareRepairOperator>> absence_repair_operators;

    // Absence counter: đếm số lần requests vắng mặt
    lns::AbsenceCounter absence_counter;

    // Current operator indices (cho rotation)
    size_t current_destroy_idx = 0;
    size_t current_repair_idx = 0;

    // Acceptance criterion
    std::unique_ptr<AcceptanceCriterion> acceptance_criterion;

    // Statistics
    LNSStatistics stats;

    // Solutions
    Solution best_solution;
    Solution current_solution;

    // Helper methods
    void initialize_operators();
    void initialize_acceptance_criterion();
    int compute_destroy_size(int iteration) const;
    void rotate_operators();
    bool should_accept(Num new_obj, Num current_obj) const;
    void update_statistics(
        int iteration,
        const Solution &new_solution,
        bool accepted,
        bool improved,
        bool new_best);
    void log_iteration(int iteration, const Solution &new_solution, bool accepted) const;

public:
    LNSSolver(const PDPTWInstance &inst, const LNSSolverParams &params = LNSSolverParams());

    // Solve từ initial solution
    Solution solve(const Solution &initial_solution);

    // Lấy statistics từ lần solve cuối
    const LNSStatistics &get_statistics() const { return stats; }
};

} // namespace pdptw

#endif // PDPTW_LNS_SOLVER_HPP
