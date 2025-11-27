#include "pdptw/lns/fleet_minimization.hpp"
#include "pdptw/lns/destroy/adjacent_string_removal.hpp"
#include "pdptw/lns/repair/greedy_insertion.hpp"
#include <algorithm>
#include <chrono>

namespace pdptw::lns {

FleetMinimizationLNS::FleetMinimizationLNS(
    const PDPTWInstance &instance,
    const FleetMinimizationParameters &params)
    : instance_(&instance), params_(params) {}

FleetMinimizationResult FleetMinimizationLNS::run(
    Solution initial_solution,
    std::mt19937 &rng,
    std::optional<AbsenceCounter> initial_absence) {

    // Khởi tạo absence counter để theo dõi số lần request chưa được assign
    AbsenceCounter absence = initial_absence.value_or(AbsenceCounter(instance_->num_requests()));

    // Lưu solution tốt nhất (ít route nhất, chi phí thấp nhất)
    SolutionDescription best_sol = initial_solution.to_description();
    size_t best_route_count = initial_solution.number_of_non_empty_routes();
    double best_objective = initial_solution.total_cost();

    // Nếu solution ban đầu khả thi (không có request nào unassigned), thử giảm số route
    if (initial_solution.unassigned_requests().count() == 0) {
        reduce_number_of_routes(initial_solution, absence);
    }

    // Lưu solution hiện tại để có thể rollback nếu cần
    SolutionDescription current_sol = initial_solution.to_description();

    std::vector<size_t> currently_unassigned =
        initial_solution.unassigned_requests().iter_request_ids();
    size_t current_num_unassigned = currently_unassigned.size();

    // Khởi tạo destroy operator (dùng adjacent string removal)
    auto destroy_op = AdjacentStringRemovalOperator();

    // Khởi tạo repair operator (dùng greedy insertion)
    repair::GreedyInsertionOperator repair_op;

    // Theo dõi thời gian chạy
    auto start_time = std::chrono::steady_clock::now();
    bool time_limit_reached = false;
    size_t iterations_performed = 0;

    // Vòng lặp LNS chính để tối ưu fleet size
    for (size_t iter = 0; iter < params_.max_iterations; ++iter) {
        iterations_performed = iter + 1;

        // Kiểm tra time limit
        if (params_.time_limit_seconds > 0.0) {
            auto current_time = std::chrono::steady_clock::now();
            double elapsed = std::chrono::duration<double>(current_time - start_time).count();
            if (elapsed >= params_.time_limit_seconds) {
                time_limit_reached = true;
                break;
            }
        }

        // Destroy phase: xóa một số requests khỏi solution
        size_t num_destroy = sample_destroy_count(rng);
        destroy_op.destroy(initial_solution, num_destroy);

        // Repair phase: chèn lại các requests đã xóa
        repair_op.repair(initial_solution, rng);

        // Tính toán metric để quyết định accept/reject
        size_t new_unassigned = initial_solution.unassigned_requests().count();
        size_t new_absence_sum = absence.get_sum_for_unassigned(initial_solution);
        size_t old_absence_sum = absence.get_sum_for_requests(currently_unassigned);

        // Accept nếu giảm được số request unassigned hoặc giảm tổng absence
        if (new_unassigned < current_num_unassigned || new_absence_sum < old_absence_sum) {
            // Nếu tìm được solution khả thi (tất cả requests đã assigned)
            if (new_unassigned == 0) {
                size_t candidate_route_count = initial_solution.number_of_non_empty_routes();
                double candidate_objective = initial_solution.total_cost();
                // Cập nhật best nếu ít route hơn, hoặc bằng route nhưng chi phí thấp hơn
                if (candidate_route_count < best_route_count ||
                    (candidate_route_count == best_route_count &&
                     candidate_objective < best_objective)) {
                    best_sol = initial_solution.to_description();
                    best_route_count = candidate_route_count;
                    best_objective = candidate_objective;
                }
                // Tiếp tục giảm số route (xóa route có tổng absence thấp nhất)
                reduce_number_of_routes(initial_solution, absence);
            }

            // Cập nhật current solution
            current_sol = initial_solution.to_description();

            currently_unassigned = initial_solution.unassigned_requests().iter_request_ids();
            current_num_unassigned = currently_unassigned.size();

            // Tăng absence counter cho các requests còn unassigned
            auto unassigned_ids = initial_solution.unassigned_requests().iter_request_ids();
            absence.increment_for_iter_requests(unassigned_ids.begin(), unassigned_ids.end());
        } else {
            // Reject: tăng absence và khôi phục solution trước đó
            auto unassigned_ids = initial_solution.unassigned_requests().iter_request_ids();
            absence.increment_for_iter_requests(unassigned_ids.begin(), unassigned_ids.end());
            initial_solution.set_with(current_sol);
        }
    }

    // Khôi phục best solution tìm được
    initial_solution.set_with(best_sol);

    return FleetMinimizationResult{
        std::move(initial_solution),
        best_sol,
        std::move(absence),
        iterations_performed,
        time_limit_reached};
}

void FleetMinimizationLNS::reduce_number_of_routes(
    Solution &solution,
    const AbsenceCounter &absence) {

    // Tìm route có tổng absence count thấp nhất
    auto route_ids = solution.iter_route_ids();

    size_t min_absence_route = 0;
    size_t min_absence_sum = SIZE_MAX;

    for (size_t route_id : route_ids) {
        if (solution.is_route_empty(route_id)) {
            continue;
        }

        // Tính tổng absence của tất cả requests trong route
        auto route_nodes = solution.iter_route(route_id);
        size_t absence_sum = 0;

        for (size_t node_id : route_nodes) {
            if (solution.instance().is_pickup(node_id)) {
                size_t request_id = solution.instance().request_id(node_id);
                absence_sum += absence.get_absence(request_id);
            }
        }

        if (absence_sum < min_absence_sum) {
            min_absence_sum = absence_sum;
            min_absence_route = route_id;
        }
    }

    // Xóa route có absence thấp nhất (dễ insert lại nhất)
    solution.unassign_complete_route(min_absence_route);

    // Giảm giới hạn số vehicle xuống fleet size hiện tại
    solution.clamp_max_number_of_vehicles_to_current_fleet_size();
}

size_t FleetMinimizationLNS::sample_destroy_count(std::mt19937 &rng) const {
    // Random số lượng requests cần destroy trong khoảng [min_destroy, max_destroy]
    std::uniform_int_distribution<size_t> dist(params_.min_destroy, params_.max_destroy);
    return dist(rng);
}

} // namespace pdptw::lns
