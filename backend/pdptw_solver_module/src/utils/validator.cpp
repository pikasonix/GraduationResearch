#include "pdptw/utils/validator.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include "pdptw/solution/description.hpp"
#include <cassert>
#include <spdlog/spdlog.h>
#include <sstream>
#include <stdexcept>
#include <unordered_set>

namespace pdptw::utils {

void ValidatorResult::assert_valid() const {
    if (is_valid) {
        return;
    }

    if (violation.has_value()) {
        const auto &v = violation.value();
        std::ostringstream oss;
        switch (v.type) {
        case ViolationType::Precedence:
            oss << "Vi phạm precedence: delivery trước pickup";
            break;
        case ViolationType::Demand:
            oss << "Vi phạm demand: vượt capacity " << v.excess;
            break;
        case ViolationType::TimeWindow:
            oss << "Vi phạm time window: tardiness = " << v.excess;
            break;
        }
        throw std::runtime_error(oss.str());
    }

    if (objective_mismatch.has_value()) {
        std::ostringstream oss;
        oss << "Objective mismatch: computed=" << objective_value
            << ", expected=" << objective_mismatch.value();
        throw std::runtime_error(oss.str());
    }

    throw std::runtime_error("Unknown validation error");
}

ValidatorResult validate_route(
    const problem::PDPTWInstance &instance,
    const std::vector<size_t> &route,
    std::optional<double> expected_objective) {

    if (route.empty()) {
        return ValidatorResult::Valid(0.0);
    }

    size_t vehicle_id = route[0] / 2;
    double capacity = instance.vehicles()[vehicle_id].seats();

    // Theo dõi các pickups và deliveries đã thăm
    std::unordered_set<size_t> pickups_visited;
    std::unordered_set<size_t> deliveries_visited;

    // DEBUG: Log route đang kiểm tra
    spdlog::debug("=== Validating route for vehicle {} ===", vehicle_id);
    std::string route_str = "";
    for (size_t node_id : route) {
        route_str += std::to_string(node_id) + " ";
    }
    spdlog::debug("Route nodes: {}", route_str);

    // Khởi tạo tại depot
    problem::Node start_node = instance.nodes()[route[0]];
    double load = start_node.demand();
    double distance = 0.0;
    double time = start_node.ready() + start_node.servicetime();

    // Kiểm tra từng node trong route
    for (size_t i = 1; i < route.size(); ++i) {
        problem::Node node = instance.nodes()[route[i]];

        // DEBUG: Log node details
        spdlog::debug("  Node {}: type={}, is_pickup={}, is_delivery={}",
                      node.id(),
                      static_cast<int>(node.node_type()),
                      node.is_pickup(),
                      node.is_delivery());

        if (node.is_pickup()) {
            size_t req_id = instance.request_id(node.id());
            pickups_visited.insert(req_id);
            spdlog::debug("    -> Pickup cho request {}", req_id);
        } else if (node.is_delivery()) {
            size_t req_id = instance.request_id(node.id());
            deliveries_visited.insert(req_id);
            spdlog::debug("    -> Delivery cho request {}", req_id);

            // Kiểm tra precedence: pickup phải được thăm trước delivery
            if (pickups_visited.find(req_id) == pickups_visited.end()) {
                spdlog::error("PRECEDENCE VIOLATION: Delivery {} before pickup!", req_id);
                return ValidatorResult::ConstraintViolation(
                    Violation(ViolationType::Precedence));
            }
        }

        // Cập nhật load
        load += node.demand();

        // Kiểm tra capacity constraint
        if (load > capacity) {
            return ValidatorResult::ConstraintViolation(
                Violation(ViolationType::Demand, load - capacity));
        }

        // Cập nhật distance và time
        problem::DistanceAndTime dist_time = instance.distance_and_time(route[i - 1], route[i]);
        distance += dist_time.distance;
        time += dist_time.time;

        // Kiểm tra time window constraint
        if (time > node.due()) {
            return ValidatorResult::ConstraintViolation(
                Violation(ViolationType::TimeWindow, time - node.due()));
        } else if (time < node.ready()) {
            time = node.ready(); // Chờ time window mở
        }

        time += node.servicetime();
    }

    // Kiểm tra tất cả pickups đều có deliveries tương ứng
    spdlog::debug("  Kiểm tra cặp pickup->delivery...");
    spdlog::debug("  Pickups thăm: {}", pickups_visited.size());
    spdlog::debug("  Deliveries thăm: {}", deliveries_visited.size());

    for (size_t pickup_id : pickups_visited) {
        if (deliveries_visited.find(pickup_id) == deliveries_visited.end()) {
            spdlog::error("VI PHẠM PRECEDENCE: Pickup {} không có delivery!", pickup_id);
            return ValidatorResult::ConstraintViolation(
                Violation(ViolationType::Precedence));
        }
    }

    spdlog::debug("  Kiểm tra cặp delivery->pickup...");
    for (size_t delivery_id : deliveries_visited) {
        if (pickups_visited.find(delivery_id) == pickups_visited.end()) {
            spdlog::error("Route validation THẤT BẠI: Delivery không có pickup");
            spdlog::error("  Request {} có delivery nhưng pickup KHÔNG trong route", delivery_id);
            spdlog::error("  Pickups in route: {}", pickups_visited.size());
            spdlog::error("  Deliveries in route: {}", deliveries_visited.size());
            return ValidatorResult::ConstraintViolation(
                Violation(ViolationType::Precedence));
        }
    }

    // Kiểm tra objective value nếu có
    if (expected_objective.has_value() &&
        std::abs(distance - expected_objective.value()) > 1e-6) {
        return ValidatorResult::ObjectiveMismatch(distance, expected_objective.value());
    }

    return ValidatorResult::Valid(distance);
}

ValidatorResult validate_solution(
    const problem::PDPTWInstance &instance,
    const solution::Solution &solution) {

    double total_distance = 0.0;

    // Lấy tất cả routes từ solution description
    auto desc = solution.to_description();
    const auto &routes = desc.itineraries();

    spdlog::info("=== KIỂM TRA SOLUTION: {} routes ===", routes.size());

    // Kiểm tra từng route
    for (size_t route_idx = 0; route_idx < routes.size(); ++route_idx) {
        const auto &route = routes[route_idx];

        // Log route đang kiểm tra
        if (route.size() > 2) {
            std::ostringstream route_str;
            route_str << "Route " << (route_idx + 1) << ": ";
            for (size_t node : route) {
                route_str << node << " ";
            }
            spdlog::debug("Validating {}", route_str.str());
        }

        auto result = validate_route(instance, route, std::nullopt);

        if (!result.is_valid) {
            // Log which route failed
            std::ostringstream oss;
            oss << "Validation FAILED for route " << (route_idx + 1);
            spdlog::error(oss.str());
            return result; // Return first violation found
        }

        total_distance += result.objective_value;
    }

    spdlog::info("=== VALIDATION PASSED: total_distance={} ===", total_distance);

    // Check if computed total matches solution's objective
    double solution_cost = solution.total_cost();
    if (std::abs(total_distance - solution_cost) > 1e-6) {
        return ValidatorResult::ObjectiveMismatch(total_distance, solution_cost);
    }

    return ValidatorResult::Valid(total_distance);
}

void assert_valid_solution(
    const problem::PDPTWInstance &instance,
    const solution::Solution &solution) {

    auto result = validate_solution(instance, solution);
    result.assert_valid();
}

void assert_valid_solution_description(
    const problem::PDPTWInstance &instance,
    const solution::SolutionDescription &desc) {

    // Create solution from description (use pointer, as Solution expects PDPTWInstance*)
    solution::Solution solution(dynamic_cast<const problem::PDPTWInstance &>(instance));
    solution.set_with(desc);

    // Validate the solution
    assert_valid_solution(instance, solution);
}

} // namespace pdptw::utils
