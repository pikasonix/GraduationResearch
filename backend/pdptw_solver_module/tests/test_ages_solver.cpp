#include "ages/ages_solver.h"
#include "pdptw/construction/constructor.hpp"
#include "pdptw/io/li_lim_reader.hpp"
#include "pdptw/problem/pdptw.hpp"
#include <filesystem>
#include <gtest/gtest.h>

using namespace pdptw;

class AGESSolverTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Load a small test instance
        std::string instance_path = "instances/lr107.txt";

        if (!std::filesystem::exists(instance_path)) {
            GTEST_SKIP() << "Test instance not found: " << instance_path;
        }

        try {
            instance = io::read_li_lim_instance(instance_path);
        } catch (const std::exception &e) {
            GTEST_SKIP() << "Failed to load instance: " << e.what();
        }
    }

    problem::PDPTWInstance instance;
};

// Test basic construction
TEST_F(AGESSolverTest, DISABLED_Construction) {
    AGESSolver::Parameters params = AGESSolver::Parameters::quick_test();
    AGESSolver solver(instance, params);

    // Should not throw
    EXPECT_NO_THROW({
        const auto &stats = solver.get_statistics();
        EXPECT_EQ(stats.phases_completed, 0);
    });
}

// Test solve with default parameters
TEST_F(AGESSolverTest, DISABLED_SolveDefault) {
    AGESSolver::Parameters params = AGESSolver::Parameters::quick_test();
    params.max_phases = 2;
    params.max_generations = 5;
    params.population_size = 3;

    AGESSolver solver(instance, params);
    Solution solution = solver.solve();

    // Check solution is valid
    EXPECT_GT(solution.get_objective(), 0.0);
    EXPECT_GT(solution.get_num_routes(), 0);

    // Check statistics
    const auto &stats = solver.get_statistics();
    EXPECT_GT(stats.phases_completed, 0);
    EXPECT_LE(stats.phases_completed, params.max_phases);
    EXPECT_GT(stats.total_generations, 0);
}

// Test solve from initial solution
TEST_F(AGESSolverTest, DISABLED_SolveFromInitial) {
    // Construct initial solution
    Solution initial = construction::Constructor::sequential_construction(instance);
    double initial_obj = initial.get_objective();

    // Solve with AGES
    AGESSolver::Parameters params = AGESSolver::Parameters::quick_test();
    AGESSolver solver(instance, params);
    Solution solution = solver.solve(initial);

    // Should improve or at least match
    EXPECT_LE(solution.get_objective(), initial_obj);
}

// Test time limit
TEST_F(AGESSolverTest, DISABLED_TimeLimit) {
    AGESSolver::Parameters params = AGESSolver::Parameters::defaults();
    params.time_limit_seconds = 0.5; // Very short
    params.max_phases = 100;         // Many phases, but will timeout

    AGESSolver solver(instance, params);

    auto start = std::chrono::steady_clock::now();
    Solution solution = solver.solve();
    auto end = std::chrono::steady_clock::now();

    double elapsed = std::chrono::duration<double>(end - start).count();

    // Should respect time limit (with small buffer)
    EXPECT_LT(elapsed, params.time_limit_seconds + 1.0);
    EXPECT_TRUE(solver.is_time_limit_exceeded());
}

// Test adaptive operators
TEST_F(AGESSolverTest, DISABLED_AdaptiveOperators) {
    AGESSolver::Parameters params = AGESSolver::Parameters::quick_test();
    params.enable_adaptive_operators = true;
    params.max_phases = 3;

    AGESSolver solver(instance, params);
    solver.solve();

    // Check adaptive control has statistics
    const auto &ac = solver.get_adaptive_control();
    std::string stats = ac.get_statistics_string();
    EXPECT_FALSE(stats.empty());
}

// Test adaptive temperature
TEST_F(AGESSolverTest, DISABLED_AdaptiveTemperature) {
    AGESSolver::Parameters params = AGESSolver::Parameters::quick_test();
    params.enable_adaptive_temperature = true;
    params.initial_temperature = 1.0;
    params.cooling_rate = 0.9;

    AGESSolver solver(instance, params);

    double initial_temp = solver.get_adaptive_control().get_temperature();
    EXPECT_DOUBLE_EQ(initial_temp, params.initial_temperature);

    solver.solve();

    // Temperature should have changed
    double final_temp = solver.get_adaptive_control().get_temperature();
    // Could be cooled or reset, just check it's within valid range
    EXPECT_GE(final_temp, 0.001);
    EXPECT_LE(final_temp, params.initial_temperature);
}

// Test adaptive population
TEST_F(AGESSolverTest, DISABLED_AdaptivePopulation) {
    AGESSolver::Parameters params = AGESSolver::Parameters::quick_test();
    params.enable_adaptive_population = true;
    params.population_size = 5;
    params.max_phases = 3;

    AGESSolver solver(instance, params);

    // Initial population size
    size_t initial_size = params.population_size;

    solver.solve();

    // Population size might have changed
    // Just verify solver ran successfully
    const auto &stats = solver.get_statistics();
    EXPECT_GT(stats.phases_completed, 0);
}

// Test statistics
TEST_F(AGESSolverTest, DISABLED_Statistics) {
    AGESSolver::Parameters params = AGESSolver::Parameters::quick_test();
    AGESSolver solver(instance, params);

    solver.solve();

    const auto &stats = solver.get_statistics();

    // Check all statistics are populated
    EXPECT_GT(stats.phases_completed, 0);
    EXPECT_GT(stats.total_generations, 0);
    EXPECT_GT(stats.initial_objective, 0.0);
    EXPECT_GT(stats.best_objective, 0.0);
    EXPECT_GE(stats.improvement_percentage, 0.0);
    EXPECT_GT(stats.total_time_seconds, 0.0);

    // Check string representation
    std::string stats_str = stats.to_string();
    EXPECT_FALSE(stats_str.empty());
    EXPECT_NE(stats_str.find("AGES Solver Statistics"), std::string::npos);
}

// Test termination on stagnation
TEST_F(AGESSolverTest, DISABLED_TerminateOnStagnation) {
    AGESSolver::Parameters params = AGESSolver::Parameters::defaults();
    params.max_phases = 100;    // Many phases
    params.max_generations = 5; // But small generations
    params.population_size = 3;

    AGESSolver solver(instance, params);
    solver.solve();

    const auto &stats = solver.get_statistics();

    // Should terminate before max_phases due to stagnation
    EXPECT_LT(stats.phases_completed, params.max_phases);
}

// Test best solution tracking
TEST_F(AGESSolverTest, DISABLED_BestSolutionTracking) {
    AGESSolver::Parameters params = AGESSolver::Parameters::quick_test();
    AGESSolver solver(instance, params);

    // Before solving
    EXPECT_EQ(solver.get_best_solution(), nullptr);

    solver.solve();

    // After solving
    const Solution *best = solver.get_best_solution();
    EXPECT_NE(best, nullptr);

    if (best) {
        EXPECT_GT(best->get_objective(), 0.0);
        EXPECT_EQ(best->get_objective(), solver.get_statistics().best_objective);
    }
}

// Test parameter presets
TEST_F(AGESSolverTest, ParameterPresets) {
    // Test defaults
    auto defaults = AGESSolver::Parameters::defaults();
    EXPECT_EQ(defaults.max_phases, 10);
    EXPECT_EQ(defaults.max_generations, 100);
    EXPECT_EQ(defaults.population_size, 10);

    // Test quick_test
    auto quick = AGESSolver::Parameters::quick_test();
    EXPECT_EQ(quick.max_phases, 3);
    EXPECT_EQ(quick.max_generations, 10);
    EXPECT_EQ(quick.population_size, 5);
}
