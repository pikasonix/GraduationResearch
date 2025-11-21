#include "pdptw/solver/lns_solver.hpp"
#include "pdptw/lns/destroy/absence_removal.hpp"
#include "pdptw/lns/destroy/adjacent_string_removal.hpp"
#include "pdptw/lns/destroy/route_removal.hpp"
#include "pdptw/lns/destroy/worst_removal.hpp"
#include "pdptw/lns/repair/absence_based_regret.hpp"
#include "pdptw/lns/repair/greedy_insertion.hpp"
#include "pdptw/lns/repair/hardest_first_insertion.hpp"
#include "pdptw/lns/repair/regret_insertion.hpp"
#include "pdptw/utils/time_limit.hpp"
#include "pdptw/utils/validator.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <limits>

namespace pdptw {

// Simulated Annealing: Làm lạnh theo hàm mũ

SimulatedAnnealing::SimulatedAnnealing(
    double initial_temperature,
    double final_temperature,
    int max_iterations) : initial_temp(initial_temperature),
                          final_temp(final_temperature),
                          current_temp(initial_temperature) {
    // Làm lạnh mũ: T(k) = T0 * alpha^k, với alpha = (Tf / T0)^(1/max_iterations)
    if (max_iterations <= 0 || initial_temp <= 0.0 || final_temp <= 0.0) {
        cooling_factor = 1.0;
    } else {
        cooling_factor = std::pow(final_temp / initial_temp, 1.0 / max_iterations);
    }
}

void SimulatedAnnealing::update(int iteration, int max_iterations) {
    if (max_iterations <= 0) {
        current_temp = initial_temp;
        return;
    }

    // Tránh temperature quá nhỏ (dưới độ chính xác số học)
    current_temp = initial_temp * std::pow(cooling_factor, iteration);
    if (current_temp < std::numeric_limits<double>::min()) {
        current_temp = std::numeric_limits<double>::min();
    }
}

bool SimulatedAnnealing::accept(
    Num new_obj,
    Num current_obj,
    Num best_obj,
    std::mt19937 &rng) {
    if (new_obj < current_obj) {
        return true; // Luôn chấp nhận cải thiện
    }

    // Chấp nhận với xác suất exp(-delta / T)
    double delta = static_cast<double>(new_obj - current_obj);
    double probability = std::exp(-delta / current_temp);

    std::uniform_real_distribution<double> dist(0.0, 1.0);
    return dist(rng) < probability;
}

// Record-to-Record Travel: Làm lạnh tuyến tính theo threshold

RecordToRecordTravel::RecordToRecordTravel(
    double initial_threshold,
    double final_threshold,
    int max_iterations) : initial_threshold(initial_threshold),
                          final_threshold(final_threshold),
                          current_threshold(initial_threshold) {
    // Làm lạnh tuyến tính
    if (max_iterations <= 0) {
        cooling_constant = 0.0;
    } else {
        cooling_constant = (initial_threshold - final_threshold) / static_cast<double>(max_iterations);
    }
}

void RecordToRecordTravel::update(int iteration, int max_iterations) {
    if (max_iterations <= 0) {
        current_threshold = final_threshold;
        return;
    }

    current_threshold = initial_threshold - cooling_constant * static_cast<double>(iteration);
    if (current_threshold < final_threshold) {
        current_threshold = final_threshold;
    }
}

bool RecordToRecordTravel::accept(
    Num new_obj,
    Num current_obj,
    Num best_obj,
    std::mt19937 &rng) {
    // Chấp nhận nếu trong phạm vi threshold% so với best
    if (new_obj <= best_obj) {
        return true;
    }

    const double best_value = static_cast<double>(best_obj);
    double relative_deviation;
    if (std::abs(best_value) < std::numeric_limits<double>::epsilon()) {
        relative_deviation = static_cast<double>(new_obj - best_obj);
    } else {
        relative_deviation = static_cast<double>(new_obj - best_obj) / best_value;
    }

    return relative_deviation <= current_threshold;
}

// Only Improvements: Chỉ chấp nhận cải thiện

bool OnlyImprovements::accept(
    Num new_obj,
    Num current_obj,
    Num best_obj,
    std::mt19937 &rng) {
    return new_obj < current_obj;
}

// Thống kê LNS

void LNSStatistics::print_summary() const {
    std::cout << "\n========================================\n";
    std::cout << "LNS Solver Statistics\n";
    std::cout << "========================================\n";
    std::cout << "Total iterations:        " << total_iterations << "\n";
    std::cout << "Accepted solutions:      " << accepted_solutions
              << " (" << std::fixed << std::setprecision(1)
              << (100.0 * accepted_solutions / total_iterations) << "%)\n";
    std::cout << "Improving solutions:     " << improving_solutions
              << " (" << (100.0 * improving_solutions / total_iterations) << "%)\n";
    std::cout << "New best solutions:      " << new_best_solutions << "\n";
    std::cout << "----------------------------------------\n";
    std::cout << "Initial objective:       " << initial_objective << "\n";
    std::cout << "Best objective:          " << best_objective << "\n";
    std::cout << "Final objective:         " << final_objective << "\n";
    std::cout << "Improvement:             " << (initial_objective - best_objective)
              << " (" << (100.0 * (initial_objective - best_objective) / initial_objective) << "%)\n";
    std::cout << "Total time:              " << std::fixed << std::setprecision(2)
              << total_time_seconds << " seconds\n";
    std::cout << "========================================\n\n";

    // Per-operator statistics
    if (!destroy_stats.empty()) {
        std::cout << "Destroy Operators:\n";
        const char *destroy_names[] = {"AdjacentString", "Worst", "Absence", "Random"};
        for (size_t i = 0; i < destroy_stats.size(); ++i) {
            const auto &ds = destroy_stats[i];
            std::cout << "  " << destroy_names[i] << ": "
                      << "used=" << ds.times_used
                      << ", improved=" << ds.times_improved
                      << ", best=" << ds.times_found_new_best << "\n";
        }
    }

    if (!repair_stats.empty()) {
        std::cout << "Repair Operators:\n";
        const char *repair_names[] = {"Greedy", "Regret2", "HardestFirst", "AbsenceRegret"};
        for (size_t i = 0; i < repair_stats.size(); ++i) {
            const auto &rs = repair_stats[i];
            std::cout << "  " << repair_names[i] << ": "
                      << "used=" << rs.times_used
                      << ", improved=" << rs.times_improved
                      << ", best=" << rs.times_found_new_best << "\n";
        }
    }
}

// LNS Solver chính

LNSSolver::LNSSolver(const PDPTWInstance &inst, const LNSSolverParams &p)
    : instance(inst),
      params(p),
      rng(p.seed),
      absence_counter(inst.num_requests()),
      best_solution(inst),
      current_solution(inst) {
    initialize_operators();
    initialize_acceptance_criterion();
}

void LNSSolver::initialize_operators() {
    // Tạo tất cả các destroy operators
    destroy_operators.push_back(std::make_unique<lns::AdjacentStringRemovalOperator>());
    destroy_operators.push_back(std::make_unique<lns::WorstRemovalOperator>());
    destroy_operators.push_back(std::make_unique<lns::AbsenceRemovalOperator>(absence_counter));
    destroy_operators.push_back(std::make_unique<lns::RouteRemovalOperator>());

    // Repair operators chuẩn (chỉ dùng rng)
    repair_operators.push_back(std::make_unique<lns::repair::GreedyInsertionOperator>());
    repair_operators.push_back(std::make_unique<lns::repair::RegretInsertionOperator>());

    // Repair operators có nhận biết về absence (dùng absence counter)
    absence_repair_operators.push_back(std::make_unique<lns::repair::HardestFirstInsertionOperator>());
    absence_repair_operators.push_back(std::make_unique<lns::repair::AbsenceBasedRegretOperator>());

    // Khởi tạo thống kê (4 destroy + 2 standard + 2 absence = 8)
    stats.destroy_stats.resize(destroy_operators.size());
    stats.repair_stats.resize(repair_operators.size() + absence_repair_operators.size());
}

void LNSSolver::initialize_acceptance_criterion() {
    switch (params.acceptance_type) {
    case LNSSolverParams::AcceptanceType::SIMULATED_ANNEALING:
        acceptance_criterion = std::make_unique<SimulatedAnnealing>(
            params.initial_temperature,
            params.final_temperature,
            params.max_iterations);
        break;

    case LNSSolverParams::AcceptanceType::RECORD_TO_RECORD:
        acceptance_criterion = std::make_unique<RecordToRecordTravel>(
            params.initial_temperature,
            params.final_temperature,
            params.max_iterations);
        break;

    case LNSSolverParams::AcceptanceType::ONLY_IMPROVEMENTS:
        acceptance_criterion = std::make_unique<OnlyImprovements>();
        break;
    }
}

int LNSSolver::compute_destroy_size(int iteration) const {
    const int total_requests = static_cast<int>(instance.num_requests());
    const int unassigned = static_cast<int>(current_solution.unassigned_requests().count());
    const int num_assigned = total_requests - unassigned;

    if (num_assigned <= 0) {
        return 0;
    }

    // Nếu có định số lượng requests bị destroy
    if (params.min_destroy_requests.has_value() && params.max_destroy_requests.has_value()) {
        int min_requests = std::min(params.min_destroy_requests.value(), params.max_destroy_requests.value());
        int max_requests = std::max(params.min_destroy_requests.value(), params.max_destroy_requests.value());

        double progress = 0.0;
        if (params.max_iterations > 1) {
            progress = static_cast<double>(iteration) / static_cast<double>(params.max_iterations - 1);
        }
        progress = std::clamp(progress, 0.0, 1.0);

        double target = static_cast<double>(min_requests) +
                        progress * static_cast<double>(max_requests - min_requests);

        int destroy_size = static_cast<int>(std::round(target));
        destroy_size = std::clamp(destroy_size, 1, num_assigned);
        return destroy_size;
    }

    // Tăng dần kích thước destroy: bắt đầu nhỏ, dần tăng lên (fallback dựa trên fraction)
    double progress = (params.max_iterations > 0)
                          ? static_cast<double>(iteration) / static_cast<double>(params.max_iterations)
                          : 0.0;
    progress = std::clamp(progress, 0.0, 1.0);

    double fraction = params.min_destroy_fraction +
                      progress * (params.max_destroy_fraction - params.min_destroy_fraction);

    int destroy_size = static_cast<int>(std::round(fraction * static_cast<double>(num_assigned)));
    destroy_size = std::clamp(destroy_size, 1, num_assigned);
    return destroy_size;
}

void LNSSolver::rotate_operators() {
    // Xoay vòng round-robin qua tất cả operators
    current_destroy_idx = (current_destroy_idx + 1) % destroy_operators.size();

    // Tổng repair operators = standard + absence-aware
    size_t total_repair = repair_operators.size() + absence_repair_operators.size();
    current_repair_idx = (current_repair_idx + 1) % total_repair;
}

void LNSSolver::update_statistics(
    int iteration,
    const Solution &new_solution,
    bool accepted,
    bool improved,
    bool new_best) {
    stats.total_iterations = iteration + 1;

    if (accepted) {
        stats.accepted_solutions++;
    }

    if (improved) {
        stats.improving_solutions++;

        // Cập nhật thống kê operators
        auto &destroy_stat = stats.destroy_stats[current_destroy_idx];
        auto &repair_stat = stats.repair_stats[current_repair_idx];

        destroy_stat.times_improved++;
        repair_stat.times_improved++;

        if (new_best) {
            destroy_stat.times_found_new_best++;
            repair_stat.times_found_new_best++;
        }
    }

    if (new_best) {
        stats.new_best_solutions++;
        stats.best_objective = new_solution.objective();
    }

    // Cập nhật số lần sử dụng
    stats.destroy_stats[current_destroy_idx].times_used++;
    stats.repair_stats[current_repair_idx].times_used++;
}

void LNSSolver::log_iteration(int iteration, const Solution &new_solution, bool accepted) const {
    if (!params.verbose || iteration % params.log_frequency != 0) {
        return;
    }

    std::cout << "Iter " << std::setw(4) << iteration
              << " | Best: " << std::setw(8) << best_solution.objective()
              << " | Current: " << std::setw(8) << current_solution.objective()
              << " | New: " << std::setw(8) << new_solution.objective()
              << " | " << (accepted ? "ACCEPT" : "REJECT")
              << " | Temp: " << std::fixed << std::setprecision(4)
              << acceptance_criterion->get_temperature()
              << " | D" << current_destroy_idx << "/R" << current_repair_idx
              << "\n";
}

Solution LNSSolver::solve(const Solution &initial_solution) {
    auto start_time = std::chrono::high_resolution_clock::now();

    // Tạo bộ theo dõi giới hạn thời gian
    utils::TimeLimit time_limit(params.time_limit_seconds);

    // Khởi tạo solutions
    current_solution = Solution(initial_solution);
    best_solution = Solution(initial_solution);

    stats.initial_objective = initial_solution.objective();
    stats.best_objective = initial_solution.objective();

    if (params.verbose) {
        std::cout << "\n========================================\n";
        std::cout << "Starting LNS Solver\n";
        std::cout << "========================================\n";
        std::cout << "Initial objective: " << initial_solution.objective() << "\n";
        std::cout << "Max iterations: " << params.max_iterations << "\n";
        std::cout << "Max non-improving: " << params.max_non_improving_iterations << "\n";
        std::cout << "Destroy range: [" << params.min_destroy_fraction
                  << ", " << params.max_destroy_fraction << "]\n";
        std::cout << "========================================\n\n";
    }

    int iterations_without_improvement = 0;

    // Kết thúc sớm nếu solution ban đầu rỗng (không có requests)
    if (initial_solution.objective() == 0) {
        if (params.verbose) {
            std::cout << "\nWarning: Initial solution is empty (objective = 0)\n";
            std::cout << "Cannot improve from empty solution. Terminating early.\n";
        }

        auto end_time = std::chrono::high_resolution_clock::now();
        std::chrono::duration<double> elapsed = end_time - start_time;
        stats.total_time_seconds = elapsed.count();
        stats.final_objective = 0;

        if (params.verbose) {
            stats.print_summary();
        }

        return best_solution;
    }

    for (int iter = 0; iter < params.max_iterations; ++iter) {
        // Check time limit using TimeLimit object
        if (time_limit.is_finished()) {
            if (params.verbose) {
                std::cout << "\nTerminating: Time limit of " << params.time_limit_seconds
                          << " seconds reached at iteration " << iter << "\n";
            }
            break;
        }

        // Update acceptance criterion temperature
        acceptance_criterion->update(iter, params.max_iterations);

        // Compute destroy size
        int destroy_size = compute_destroy_size(iter);

        // Skip iteration if destroy_size is 0 (no requests assigned)
        if (destroy_size == 0) {
            if (params.verbose && iter % 100 == 0) {
                std::cout << "Warning: No requests assigned, skipping destroy-repair at iteration " << iter << "\n";
            }
            continue;
        }

        // Create a copy to modify
        Solution new_solution = current_solution;

        // Apply destroy operator
        auto &destroy_op = destroy_operators[current_destroy_idx];
        destroy_op->destroy(new_solution, destroy_size);

        // Apply repair operator: either standard (RepairOperator) or absence-aware (AbsenceAwareRepairOperator)
        size_t total_standard = repair_operators.size();
        size_t repair_stat_idx;

        try {
            if (current_repair_idx < total_standard) {
                // Standard repair operator (uses rng only)
                auto &repair_op = repair_operators[current_repair_idx];
                repair_op->repair(new_solution, rng);
                repair_stat_idx = current_repair_idx;
            } else {
                // Absence-aware repair operator
                size_t absence_idx = current_repair_idx - total_standard;
                auto &absence_op = absence_repair_operators[absence_idx];
                absence_op->repair(new_solution, absence_counter, rng);
                repair_stat_idx = current_repair_idx;
            }
        } catch (const std::exception &e) {
            // Repair failed - skip this iteration
            if (params.verbose && iter % 10 == 0) {
                std::cout << "Warning: Repair failed at iteration " << iter
                          << ": " << e.what() << "\n";
            }
            rotate_operators();
            continue;
        }

        if (time_limit.is_finished()) {
            if (params.verbose) {
                std::cout << "\nTerminating: Time limit reached after repair at iteration " << iter << "\n";
            }
            break;
        }

        // Update absence counter based on what's unassigned
        absence_counter.update(new_solution);

        // Evaluate new solution
        Num new_obj = new_solution.objective();
        Num current_obj = current_solution.objective();
        Num best_obj = best_solution.objective();

        // Check acceptance
        bool improved = new_obj < current_obj;
        bool new_best = new_obj < best_obj;
        bool accepted = acceptance_criterion->accept(new_obj, current_obj, best_obj, rng);

        // Update solutions
        if (accepted) {
            current_solution = new_solution;
            iterations_without_improvement = new_best ? 0 : iterations_without_improvement + 1;
        } else {
            iterations_without_improvement++;
        }

        if (new_best) {
            best_solution = new_solution;

            if (params.verbose) {
                std::cout << "*** NEW BEST at iteration " << iter
                          << ": " << best_obj << " -> " << new_obj
                          << " (improvement: " << (best_obj - new_obj) << ")\n";
            }
        }

        // Update statistics
        update_statistics(iter, new_solution, accepted, improved, new_best);

        // Log iteration
        log_iteration(iter, new_solution, accepted);

        // Rotate operators for next iteration
        rotate_operators();

        // Check termination criteria
        if (iterations_without_improvement >= params.max_non_improving_iterations) {
            if (params.verbose) {
                std::cout << "\nTerminating: " << params.max_non_improving_iterations
                          << " iterations without improvement\n";
            }
            break;
        }
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> elapsed = end_time - start_time;
    stats.total_time_seconds = elapsed.count();
    stats.final_objective = current_solution.objective();

    if (params.verbose) {
        stats.print_summary();

        // Validate final solution using utils validator
        auto validation_result = utils::validate_solution(instance, best_solution);
        std::cout << "Final solution validation: "
                  << (validation_result.is_valid ? "VALID" : "INVALID") << "\n";
        if (!validation_result.is_valid) {
            if (validation_result.violation.has_value()) {
                std::cout << "Validation violation: ";
                switch (validation_result.violation->type) {
                case utils::ViolationType::Precedence:
                    std::cout << "Precedence\n";
                    break;
                case utils::ViolationType::Demand:
                    std::cout << "Demand/Capacity\n";
                    break;
                case utils::ViolationType::TimeWindow:
                    std::cout << "Time window\n";
                    break;
                }
            } else if (validation_result.objective_mismatch.has_value()) {
                std::cout << "Objective mismatch: expected " << validation_result.objective_mismatch.value()
                          << " but computed " << validation_result.objective_value << "\n";
            }
        }
    }

    return best_solution;
}

} // namespace pdptw
