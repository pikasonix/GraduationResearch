#pragma once

#include <optional>
#include <string>
#include <vector>

// Forward declarations
namespace pdptw::solution {
class Solution;
class SolutionDescription;
} // namespace pdptw::solution

namespace pdptw::problem {
class PDPTWInstance;
}

namespace pdptw::utils {

// Các loại constraint violations
enum class ViolationType {
    Precedence, // Pickup chưa được visit trước delivery
    Demand,     // Vượt capacity của vehicle
    TimeWindow  // Vi phạm time window (tardiness)
};

// Constraint violation với chi tiết
struct Violation {
    ViolationType type;
    double excess; // Mức độ vi phạm (capacity excess hoặc tardiness)

    Violation(ViolationType t, double e = 0.0) : type(t), excess(e) {}
};

// Kết quả validation
struct ValidatorResult {
    bool is_valid;
    double objective_value; // Tổng distance/cost
    std::optional<Violation> violation;
    std::optional<double> objective_mismatch; // Expected vs computed objective

    ValidatorResult() : is_valid(true), objective_value(0.0) {}

    static ValidatorResult Valid(double obj) {
        ValidatorResult result;
        result.is_valid = true;
        result.objective_value = obj;
        return result;
    }

    static ValidatorResult ConstraintViolation(const Violation &v) {
        ValidatorResult result;
        result.is_valid = false;
        result.violation = v;
        return result;
    }

    static ValidatorResult ObjectiveMismatch(double computed, double expected) {
        ValidatorResult result;
        result.is_valid = false;
        result.objective_value = computed;
        result.objective_mismatch = expected;
        return result;
    }

    // Helper method cho assertions
    void assert_valid() const;
};

// Validate 1 route
ValidatorResult validate_route(
    const problem::PDPTWInstance &instance,
    const std::vector<size_t> &route,
    std::optional<double> expected_objective = std::nullopt);

// Validate complete solution
ValidatorResult validate_solution(
    const problem::PDPTWInstance &instance,
    const solution::Solution &solution);

// Assert solution hợp lệ (throws nếu không)
void assert_valid_solution(
    const problem::PDPTWInstance &instance,
    const solution::Solution &solution);

// Assert solution description hợp lệ (throws nếu không)
void assert_valid_solution_description(
    const problem::PDPTWInstance &instance,
    const solution::SolutionDescription &desc);

} // namespace pdptw::utils
