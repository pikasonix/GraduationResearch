// ============================================================================
// AGES SOLVER
// ============================================================================

#include "pdptw/ages/ages_solver.hpp"
#include "pdptw/solution/description.hpp"
#include "pdptw/solution/k_ejection.hpp"
#include "pdptw/solution/permutation.hpp"
#include <algorithm>
#include <spdlog/spdlog.h>
#include <sstream>

namespace pdptw::ages {

using pdptw::solution::KEjectionOps;
using pdptw::solution::PermutationOps;

AGESSolver::AGESSolver(
    const problem::PDPTWInstance &instance,
    const AGESParameters &params)
    : instance_(&instance), params_(params) {}

solution::Solution AGESSolver::run(
    solution::Solution sol,
    std::mt19937 &rng,
    std::optional<lns::AbsenceCounter> initial_absence,
    utils::TimeLimit *time_limit) {

    std::vector<size_t> non_empty_routes = sol.iter_route_ids();
    std::ostringstream oss;
    for (size_t i = 0; i < non_empty_routes.size() && i < 20; ++i) {
        if (i > 0)
            oss << ",";
        oss << non_empty_routes[i];
    }
    if (non_empty_routes.size() > 20)
        oss << "...";

    spdlog::info("[AGES] Starting");
    const size_t initial_routes = sol.number_of_non_empty_routes();
    spdlog::info("[AGES] Initial: {} routes (IDs: {}), cost {:.2f}",
                 initial_routes,
                 oss.str(),
                 sol.objective());

    lns::AbsenceCounter abs = initial_absence.has_value()
                                  ? std::move(initial_absence.value())
                                  : lns::AbsenceCounter(instance_->num_requests());

    solution::SolutionDescription min_vehicle_solution = sol.to_description();
    solution::SolutionDescription min_unassigned_solution = sol.to_description();
    size_t cnt = 0;

    bool time_limit_hit = false;

    while (cnt < params_.max_perturbation_phases) {
        if (time_limit && time_limit->is_finished()) {
            time_limit_hit = true;
            break;
        }

        if (sol.unassigned_requests().count() == 0) {
            std::vector<size_t> non_empty_routes = sol.iter_route_ids();

            if (!non_empty_routes.empty()) {
                std::uniform_int_distribution<size_t> dist(0, non_empty_routes.size() - 1);
                size_t random_route = non_empty_routes[dist(rng)];

                size_t before_routes = sol.number_of_non_empty_routes();
                spdlog::info("[AGES DEBUG] Before eject: {} active routes, ejecting route {}", before_routes, random_route);

                sol.unassign_complete_route(random_route);
                sol.clamp_max_number_of_vehicles_to_current_fleet_size();

                size_t after_routes = sol.number_of_non_empty_routes();
                spdlog::info("[AGES DEBUG] After eject: {} active routes", after_routes);
            } else {
                break;
            }
        }

        cnt = 0;

        // Xây dựng stack từ các request chưa gán
        std::vector<size_t> stack;
        for (size_t req_id : sol.unassigned_requests().iter_request_ids()) {
            size_t pickup_id = instance_->pickup_id_of_request(req_id);
            stack.push_back(pickup_id);
        }
        std::shuffle(stack.begin(), stack.end(), rng);
        size_t min_unassigned = stack.size();

        auto route_ids = sol.iter_route_ids();
        auto empty_routes = sol.iter_empty_route_ids();
        spdlog::info("[AGES DEBUG] Starting reinsertion: {} unassigned, {} total routes available, {} empty",
                     stack.size(), route_ids.size(), empty_routes.size());
        // Vòng lặp chèn lại dựa trên stack
        while (!stack.empty() && cnt < params_.max_perturbation_phases) {
            if (time_limit && time_limit->is_finished()) {
                time_limit_hit = true;
                break;
            }

            size_t u = stack.back();
            stack.pop_back();

            // Nếu request đã được gán trong lúc chờ, bỏ qua
            if (sol.succ(u) != u) {
                sol.unassign_request(u);
            } else if (!sol.unassigned_requests().contains(u)) {
                sol.unassign_request(u);
            } // Thử chèn ngẫu nhiên
            auto insertion = PermutationOps::find_random_insert_for_request(sol, u, rng);

            if (insertion.has_value()) {
                size_t route_id = insertion.value().vn_id / 2;
                bool was_empty = sol.is_route_empty(route_id);
                size_t before_empty = sol.iter_empty_route_ids().size();

                spdlog::info("[AGES DEBUG] Inserting request {} into route {} (was_empty={}, empty_routes={})", u / 2, route_id, was_empty, before_empty);

                PermutationOps::insert(sol, insertion.value());

                size_t after_empty = sol.iter_empty_route_ids().size();
                size_t active_routes = sol.number_of_non_empty_routes();
                spdlog::info("[AGES DEBUG] After insertion: {} empty routes → {} active routes",
                             after_empty, active_routes);
            } else {
                // Thất bại - tăng absence counter
                size_t req_id = instance_->request_id(u);
                abs.increment_single_request(req_id);

                // Thử k-ejection
                eject_and_insert(sol, u, stack, rng, abs);

                // Nhiễu loạn
                std::uniform_int_distribution<size_t> pert_dist(
                    params_.min_perturbation_moves,
                    params_.max_perturbation_moves);
                size_t num_perturbations = pert_dist(rng);

                size_t performed_perturbations = perform_perturbation(
                    sol, rng, num_perturbations);

                size_t counted = params_.count_successful_perturbations_only
                                     ? std::max(performed_perturbations, (size_t)1)
                                     : num_perturbations;
                cnt += counted;

                // Xáo trộn sau nhiễu loạn
                if (params_.use_shuffle_stack) {
                    std::shuffle(stack.begin(), stack.end(), rng);
                }
            }

            // Kiểm tra cải thiện
            if (stack.size() < min_unassigned) {
                cnt = 0;
                min_unassigned = stack.size();
                min_unassigned_solution = sol.to_description();
            } else if (stack.size() > std::max((size_t)50, min_unassigned * 2)) {
                // Thoát sớm nếu quá tệ
                cnt = params_.max_perturbation_phases;
                break;
            }
        }

        if (time_limit_hit) {
            break;
        }

        // Cập nhật nghiệm tốt nhất
        if (stack.empty()) {
            assert(sol.unassigned_requests().count() == 0);
            min_vehicle_solution = sol.to_description();

            size_t routes = sol.number_of_non_empty_routes();
            spdlog::info("[AGES] ★ Feasible: {} routes, cost {:.2f}", routes, sol.objective());
        } else {
            spdlog::info("[AGES DEBUG] Failed reinsertion: {} requests still unassigned, restoring best", stack.size());
            sol.set_with(min_vehicle_solution);
        }
    }

    if (time_limit_hit) {
        spdlog::info("[AGES] Time limit reached, returning best feasible solution found so far");
        sol.set_with(min_vehicle_solution);
    }

    size_t final_routes = sol.number_of_non_empty_routes();
    spdlog::info("[AGES] Completed: {} routes", final_routes);

    return sol;
}

void AGESSolver::eject_and_insert(
    solution::Solution &sol,
    size_t u,
    std::vector<size_t> &stack,
    std::mt19937 &rng,
    lns::AbsenceCounter &abs) {
    // Thử 1-ejection
    auto k1_result = KEjectionOps::find_best_insertion_k_ejection_1(sol, u, rng, abs);

    if (k1_result.has_value()) {
        for (const auto &ejection : k1_result->ejections) {
            sol.unassign_request(ejection.pickup_id);
            stack.push_back(ejection.pickup_id);
        }
        PermutationOps::insert(sol, k1_result->insertion);
        return;
    }

    // Thử 2-ejection
    auto k2_result = KEjectionOps::find_best_insertion_k_ejection_2(sol, u, rng, abs);

    if (k2_result.has_value()) {
        for (const auto &ejection : k2_result->ejections) {
            sol.unassign_request(ejection.pickup_id);
            stack.push_back(ejection.pickup_id);
        }
        PermutationOps::insert(sol, k2_result->insertion);
        return;
    }

    // Cả 2 đều thất bại - đẩy lại vào stack
    stack.push_back(u);
}

size_t AGESSolver::perform_perturbation(
    solution::Solution &sol,
    std::mt19937 &rng,
    size_t num_perturbations) {
    size_t cnt = 0;
    for (size_t i = 0; i < num_perturbations; ++i) {
        std::uniform_real_distribution<double> prob_dist(0.0, 1.0);

        if (prob_dist(rng) < params_.shift_probability) {
            if (PermutationOps::random_shift(sol, rng)) {
                cnt++;
            }
        } else {
            if (PermutationOps::random_exchange(sol, rng)) {
                cnt++;
            }
        }
    }
    return cnt;
}

} // namespace pdptw::ages