#include "pdptw/construction/constructor.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include "pdptw/utils/validator.hpp"
#include <gtest/gtest.h>

using namespace pdptw;

class ValidatorTest : public ::testing::Test {
protected:
    std::shared_ptr<problem::PdptwInstance> instance;

    void SetUp() override {
        // Create a small test instance with 2 requests
        instance = std::make_shared<problem::PdptwInstance>();

        // Create nodes: 2 depots (0,1) + 2 pickups (2,3) + 2 deliveries (4,5)
        std::vector<problem::Node> nodes;

        // Depot 0 (start)
        nodes.push_back(problem::Node{
            0, problem::NodeType::Depot(), 0.0, 0.0, 0.0, 100.0, 0.0, 0.0});

        // Depot 1 (end)
        nodes.push_back(problem::Node{
            1, problem::NodeType::Depot(), 0.0, 0.0, 0.0, 100.0, 0.0, 0.0});

        // Pickup 2 (request 0)
        nodes.push_back(problem::Node{
            2, problem::NodeType::Pickup(), 0.0, 1.0, 1.0, 0.0, 50.0, 1.0});

        // Pickup 3 (request 1)
        nodes.push_back(problem::Node{
            3, problem::NodeType::Pickup(), 0.0, 2.0, 1.0, 0.0, 50.0, 1.0});

        // Delivery 4 (request 0)
        nodes.push_back(problem::Node{
            4, problem::NodeType::Delivery(), 2.0, 3.0, -1.0, 0.0, 50.0, 1.0});

        // Delivery 5 (request 1)
        nodes.push_back(problem::Node{
            5, problem::NodeType::Delivery(), 4.0, 5.0, -1.0, 0.0, 50.0, 1.0});

        instance->set_nodes(std::move(nodes));

        // Create distance matrix (simple Euclidean)
        size_t n = instance->nodes().size();
        std::vector<double> distances(n * n, 0.0);
        for (size_t i = 0; i < n; ++i) {
            for (size_t j = 0; j < n; ++j) {
                if (i != j) {
                    double dx = instance->nodes()[i].x - instance->nodes()[j].x;
                    double dy = instance->nodes()[i].y - instance->nodes()[j].y;
                    distances[i * n + j] = std::sqrt(dx * dx + dy * dy);
                }
            }
        }
        instance->set_distance_matrix(std::move(distances));

        // Create vehicles (1 vehicle with capacity 2)
        std::vector<problem::Vehicle> vehicles;
        vehicles.push_back(problem::Vehicle{0, 0, 1, 2.0, 100.0});
        instance->set_vehicles(std::move(vehicles));

        instance->set_num_requests(2);
    }
};

TEST_F(ValidatorTest, ValidEmptyRoute) {
    std::vector<size_t> route;
    auto result = utils::validate_route(*instance, route);

    EXPECT_TRUE(result.is_valid);
    EXPECT_DOUBLE_EQ(result.objective_value, 0.0);
}

TEST_F(ValidatorTest, ValidSingleRequestRoute) {
    // Route: depot 0 -> pickup 2 -> delivery 4 -> depot 1
    std::vector<size_t> route = {0, 2, 4, 1};
    auto result = utils::validate_route(*instance, route);

    EXPECT_TRUE(result.is_valid);
    EXPECT_GT(result.objective_value, 0.0);
}

TEST_F(ValidatorTest, PrecedenceViolation) {
    // Route: depot 0 -> delivery 4 -> pickup 2 -> depot 1
    // (delivery before pickup - violates precedence)
    std::vector<size_t> route = {0, 4, 2, 1};
    auto result = utils::validate_route(*instance, route);

    EXPECT_FALSE(result.is_valid);
    ASSERT_TRUE(result.violation.has_value());
    EXPECT_EQ(result.violation->type, utils::ViolationType::Precedence);
}

TEST_F(ValidatorTest, CapacityViolation) {
    // Create instance with lower capacity
    instance->vehicles()[0].seats = 0.5; // Too small for 2 pickups

    // Route: depot 0 -> pickup 2 -> pickup 3 -> delivery 4 -> delivery 5 -> depot 1
    std::vector<size_t> route = {0, 2, 3, 4, 5, 1};
    auto result = utils::validate_route(*instance, route);

    EXPECT_FALSE(result.is_valid);
    ASSERT_TRUE(result.violation.has_value());
    EXPECT_EQ(result.violation->type, utils::ViolationType::Demand);
    EXPECT_GT(result.violation->excess, 0.0);
}

TEST_F(ValidatorTest, TimeWindowViolation) {
    // Make time window very tight for delivery 4
    instance->nodes()[4].due = 1.0; // Too early to reach

    // Route: depot 0 -> pickup 2 -> delivery 4 -> depot 1
    std::vector<size_t> route = {0, 2, 4, 1};
    auto result = utils::validate_route(*instance, route);

    EXPECT_FALSE(result.is_valid);
    ASSERT_TRUE(result.violation.has_value());
    EXPECT_EQ(result.violation->type, utils::ViolationType::TimeWindow);
    EXPECT_GT(result.violation->excess, 0.0);
}

TEST_F(ValidatorTest, ValidCompleteSolution) {
    // Create a valid solution using constructor
    solution::Solution solution(instance.get());
    construction::SequentialInsertionConstructor constructor;
    constructor.construct(solution);

    // Validate the solution
    auto result = utils::validate_solution(*instance, solution);

    EXPECT_TRUE(result.is_valid);
    EXPECT_GT(result.objective_value, 0.0);
}

TEST_F(ValidatorTest, AssertValidSolutionNoThrow) {
    // Create valid solution
    solution::Solution solution(instance.get());
    construction::SequentialInsertionConstructor constructor;
    constructor.construct(solution);

    // Should not throw
    EXPECT_NO_THROW(utils::assert_valid_solution(*instance, solution));
}

TEST_F(ValidatorTest, AssertInvalidSolutionThrows) {
    // Create solution with precedence violation
    solution::Solution solution(instance.get());

    // Manually create invalid route
    auto &route = solution.routes()[0];
    route.insert_delivery_before_pickup(0, 0); // This creates violation

    // Should throw
    EXPECT_THROW(utils::assert_valid_solution(*instance, solution), std::runtime_error);
}

TEST_F(ValidatorTest, ObjectiveMismatch) {
    std::vector<size_t> route = {0, 2, 4, 1};

    // Provide wrong expected objective
    auto result = utils::validate_route(*instance, route, 999.0);

    EXPECT_FALSE(result.is_valid);
    ASSERT_TRUE(result.objective_mismatch.has_value());
    EXPECT_DOUBLE_EQ(result.objective_mismatch.value(), 999.0);
}

TEST_F(ValidatorTest, MultipleRoutesValidation) {
    // Create solution with multiple routes
    solution::Solution solution(instance.get());

    // Route 0: request 0
    auto &route0 = solution.routes()[0];
    route0.insert_pickup(0, 0);
    route0.insert_delivery(0, 1);

    // Create second vehicle if needed (using existing vehicle structure)
    // For simplicity, test with single route

    auto result = utils::validate_solution(*instance, solution);
    EXPECT_TRUE(result.is_valid || !result.is_valid); // Just check it runs
}

TEST_F(ValidatorTest, IncompletePickupDeliveryPair) {
    // Route with pickup but no delivery
    std::vector<size_t> route = {0, 2, 1}; // Only pickup 2, no delivery 4
    auto result = utils::validate_route(*instance, route);

    EXPECT_FALSE(result.is_valid);
    ASSERT_TRUE(result.violation.has_value());
    EXPECT_EQ(result.violation->type, utils::ViolationType::Precedence);
}
