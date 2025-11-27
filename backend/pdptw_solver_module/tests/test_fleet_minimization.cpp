#include "pdptw/construction/constructor.hpp"
#include "pdptw/lns/fleet_minimization.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include "test_helpers.hpp"
#include <gtest/gtest.h>
#include <random>

using namespace pdptw::problem;
using namespace pdptw::solution;
using namespace pdptw::construction;
using namespace pdptw::lns;

class FleetMinimizationTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Use helper function to create simple test instance
        instance = std::make_unique<PDPTWInstance>(create_simple_instance());
    }

    std::unique_ptr<PDPTWInstance> instance;
};

TEST_F(FleetMinimizationTest, BasicConstruction) {
    // Test that we can create FleetMinimizationLNS with default parameters
    auto params = FleetMinimizationParameters::default_params(2);
    FleetMinimizationLNS fleet_minimizer(*instance, params);

    // Default params scale with problem size
    EXPECT_EQ(params.max_iterations, 200);
    EXPECT_GE(params.min_destroy, 1);
    EXPECT_GE(params.max_destroy, params.min_destroy); // max >= min
}

TEST_F(FleetMinimizationTest, RunWithFeasibleSolution) {
    // Create initial solution using Constructor
    Solution solution = Constructor::construct(*instance,
                                               ConstructionStrategy::SequentialInsertion);

    // Run fleet minimization with very few iterations
    auto params = FleetMinimizationParameters::default_params(2);
    params.max_iterations = 10;      // Short run for testing
    params.time_limit_seconds = 0.0; // No time limit

    FleetMinimizationLNS fleet_minimizer(*instance, params);
    std::mt19937 rng(42);

    auto result = fleet_minimizer.run(std::move(solution), rng, std::nullopt);

    // Check that the algorithm completed
    EXPECT_LE(result.iterations_performed, params.max_iterations);
    EXPECT_FALSE(result.time_limit_reached);

    // Check that we have a valid result
    EXPECT_TRUE(result.best.has_value());
}

TEST_F(FleetMinimizationTest, IterationCountRespected) {
    // Create feasible solution
    Solution solution = Constructor::construct(*instance,
                                               ConstructionStrategy::SequentialInsertion);

    // Set very low iteration limit
    auto params = FleetMinimizationParameters::default_params(2);
    params.max_iterations = 5;

    FleetMinimizationLNS fleet_minimizer(*instance, params);
    std::mt19937 rng(999);

    auto result = fleet_minimizer.run(std::move(solution), rng, std::nullopt);

    // Should not exceed max iterations
    EXPECT_LE(result.iterations_performed, params.max_iterations);
}

TEST_F(FleetMinimizationTest, ResultStructureValid) {
    // Create solution
    Solution solution = Constructor::construct(*instance,
                                               ConstructionStrategy::SequentialInsertion);

    auto params = FleetMinimizationParameters::default_params(2);
    params.max_iterations = 10;

    FleetMinimizationLNS fleet_minimizer(*instance, params);
    std::mt19937 rng(555);

    auto result = fleet_minimizer.run(std::move(solution), rng, std::nullopt);

    // Check result structure
    EXPECT_GE(result.iterations_performed, 0);
    EXPECT_LE(result.iterations_performed, params.max_iterations);

    // Time limit should not be reached (we didn't set one)
    EXPECT_FALSE(result.time_limit_reached);
}

TEST_F(FleetMinimizationTest, AbsenceCounterIntegration) {
    // Create solution
    Solution solution = Constructor::construct(*instance,
                                               ConstructionStrategy::SequentialInsertion);

    // Create initial absence counter
    AbsenceCounter initial_absence(2); // 2 requests
    initial_absence.update(solution);

    auto params = FleetMinimizationParameters::default_params(2);
    params.max_iterations = 15;

    FleetMinimizationLNS fleet_minimizer(*instance, params);
    std::mt19937 rng(888);

    auto result = fleet_minimizer.run(std::move(solution), rng, initial_absence);

    // Absence counter should still be valid
    // Just check the result doesn't crash
    EXPECT_GE(result.iterations_performed, 0);
}
