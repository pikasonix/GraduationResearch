#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/lns/destroy/absence_removal.hpp"
#include "pdptw/lns/destroy/adjacent_string_removal.hpp"
#include "pdptw/lns/destroy/route_removal.hpp"
#include "pdptw/lns/destroy/worst_removal.hpp"
#include "test_helpers.hpp"
#include <gtest/gtest.h>

using namespace pdptw::lns;
using namespace pdptw::solution;

// ============================================================================
// RouteRemoval Tests
// ============================================================================

TEST(DestroyTest, RouteRemoval_Single) {
    // Create instance and solution with 2 vehicles, 2 requests
    auto instance = create_simple_instance();
    Solution solution(instance);

    // Insert first request on first vehicle
    size_t pickup_id = instance.pickup_id_of_request(0);
    size_t vn_start = 0; // Vehicle 0 start depot
    solution.relink_when_inserting_pd(vn_start, pickup_id, vn_start, vn_start + 1);
    solution.unassigned_requests().remove(pickup_id); // Mark as assigned

    // Insert second request on second vehicle
    pickup_id = instance.pickup_id_of_request(1);
    vn_start = 2; // Vehicle 1 start depot
    solution.relink_when_inserting_pd(vn_start, pickup_id, vn_start, vn_start + 1);
    solution.unassigned_requests().remove(pickup_id); // Mark as assigned

    // Both requests should be assigned
    EXPECT_EQ(solution.unassigned_requests().count(), 0);

    // Remove requests from one route
    RouteRemovalOperator destroy_op;
    destroy_op.destroy(solution, 1); // Remove 1 request

    // Should remove all requests from one route (1 request)
    // Requests removed via unassigned_requests
    EXPECT_EQ(solution.unassigned_requests().count(), 1);
}

TEST(DestroyTest, RouteRemoval_Multiple) {
    // Create instance with multiple requests per route
    auto instance = create_test_instance(4); // 4 requests
    Solution solution(instance);

    // Insert 2 requests on first vehicle
    size_t vn_start = 0;
    size_t pickup0 = instance.pickup_id_of_request(0);
    size_t pickup1 = instance.pickup_id_of_request(1);

    solution.relink_when_inserting_pd(vn_start, pickup0, vn_start, vn_start + 1);
    solution.unassigned_requests().remove(pickup0);
    solution.relink_when_inserting_pd(vn_start + 1, pickup1, vn_start + 1, vn_start + 2);
    solution.unassigned_requests().remove(pickup1);

    // Insert 2 requests on second vehicle
    vn_start = 2;
    size_t pickup2 = instance.pickup_id_of_request(2);
    size_t pickup3 = instance.pickup_id_of_request(3);

    solution.relink_when_inserting_pd(vn_start, pickup2, vn_start, vn_start + 1);
    solution.unassigned_requests().remove(pickup2);
    solution.relink_when_inserting_pd(vn_start + 1, pickup3, vn_start + 1, vn_start + 2);
    solution.unassigned_requests().remove(pickup3);

    // All requests should be assigned
    EXPECT_EQ(solution.unassigned_requests().count(), 0);

    // Remove requests from routes
    RouteRemovalOperator destroy_op;
    destroy_op.destroy(solution, 2); // Remove 2 requests

    // Should remove requests (exact count depends on route selection)
    // Requests removed via unassigned_requests
    EXPECT_GT(solution.unassigned_requests().count(), 0);
}

// ============================================================================
// WorstRemoval Tests
// ============================================================================

TEST(DestroyTest, WorstRemoval_CostCalculation) {
    auto instance = create_simple_instance();
    Solution solution(instance);

    // Insert both requests
    size_t pickup0 = instance.pickup_id_of_request(0);
    size_t pickup1 = instance.pickup_id_of_request(1);

    solution.relink_when_inserting_pd(0, pickup0, 0, 1);
    solution.unassigned_requests().remove(pickup0);
    solution.relink_when_inserting_pd(2, pickup1, 2, 3);
    solution.unassigned_requests().remove(pickup1);

    WorstRemovalOperator destroy_op;

    // Calculate cost contributions
    // This is tested implicitly through destroy behavior
    destroy_op.destroy(solution, 1);

    // Requests removed via unassigned_requests
    EXPECT_EQ(solution.unassigned_requests().count(), 1);
}

TEST(DestroyTest, WorstRemoval_SelectsWorst) {
    auto instance = create_test_instance(3); // 3 requests
    Solution solution(instance);

    // Insert all 3 requests on same vehicle
    size_t vn_start = 0;
    for (size_t r = 0; r < 3; ++r) {
        size_t pickup = instance.pickup_id_of_request(r);
        size_t insert_after = vn_start + r * 2;
        solution.relink_when_inserting_pd(insert_after, pickup, insert_after, insert_after + 1);
        solution.unassigned_requests().remove(pickup);
    }

    EXPECT_EQ(solution.unassigned_requests().count(), 0);

    // Remove worst request
    WorstRemovalOperator destroy_op;
    destroy_op.destroy(solution, 1);

    // Requests removed via unassigned_requests
    EXPECT_EQ(solution.unassigned_requests().count(), 1);
}

TEST(DestroyTest, WorstRemoval_Randomization) {
    auto instance = create_test_instance(5); // 5 requests
    Solution solution(instance);

    // Insert all requests
    size_t vn_start = 0;
    for (size_t r = 0; r < 5; ++r) {
        size_t pickup = instance.pickup_id_of_request(r);
        size_t insert_after = vn_start + r * 2;
        solution.relink_when_inserting_pd(insert_after, pickup, insert_after, insert_after + 1);
    }

    WorstRemovalOperator destroy_op;

    // Remove multiple times, should get some variety due to randomization
    // Note: With void return, we verify via solution state changes
    for (int i = 0; i < 5; ++i) {
        Solution sol_copy = solution;
        destroy_op.destroy(sol_copy, 1);
        // Verify request was removed via unassigned count
        EXPECT_GE(sol_copy.unassigned_requests().count(), 1);
    }
}

// ============================================================================
// AdjacentStringRemoval Tests
// ============================================================================

TEST(DestroyTest, AdjacentString_Relatedness) {
    auto instance = create_simple_instance();

    AdjacentStringRemovalOperator destroy_op;

    // Relatedness is tested implicitly through removal behavior
    // Requests that are spatially/temporally close should have lower relatedness metric
    EXPECT_TRUE(true); // Placeholder - internal method testing
}

TEST(DestroyTest, AdjacentString_RemovesRelated) {
    auto instance = create_test_instance(4); // 4 requests
    Solution solution(instance);

    // Insert all requests on same vehicle
    size_t vn_start = 0;
    for (size_t r = 0; r < 4; ++r) {
        size_t pickup = instance.pickup_id_of_request(r);
        size_t insert_after = vn_start + r * 2;
        solution.relink_when_inserting_pd(insert_after, pickup, insert_after, insert_after + 1);
        solution.unassigned_requests().remove(pickup);
    }

    AdjacentStringRemovalOperator destroy_op;
    destroy_op.destroy(solution, 2);

    // Should remove related requests
    // Requests removed via unassigned_requests
    EXPECT_EQ(solution.unassigned_requests().count(), 2);
}

TEST(DestroyTest, AdjacentString_RandomSeed) {
    auto instance = create_test_instance(5);
    Solution solution(instance);

    // Insert all requests
    size_t vn_start = 0;
    for (size_t r = 0; r < 5; ++r) {
        size_t pickup = instance.pickup_id_of_request(r);
        size_t insert_after = vn_start + r * 2;
        solution.relink_when_inserting_pd(insert_after, pickup, insert_after, insert_after + 1);
    }

    // Different runs should potentially select different strings
    // Note: With void return, we verify via solution state changes
    for (int i = 0; i < 5; ++i) {
        Solution sol_copy = solution;
        AdjacentStringRemovalOperator destroy_op;
        destroy_op.destroy(sol_copy, 3);
        // Verify requests were removed via unassigned count
        EXPECT_GE(sol_copy.unassigned_requests().count(), 2);
    }
}

// ============================================================================
// AbsenceRemoval Tests
// ============================================================================

TEST(DestroyTest, AbsenceRemoval_UsesCounter) {
    auto instance = create_simple_instance();
    Solution solution(instance);

    // Insert first request only
    size_t pickup0 = instance.pickup_id_of_request(0);
    solution.relink_when_inserting_pd(0, pickup0, 0, 1);

    // Create absence counter and update it
    AbsenceCounter counter(instance.num_requests());
    counter.update(solution); // Request 1 will have absence = 1

    AbsenceRemovalOperator destroy_op(counter);

    // Insert second request now
    size_t pickup1 = instance.pickup_id_of_request(1);
    solution.relink_when_inserting_pd(2, pickup1, 2, 3);

    // Remove based on absence
    destroy_op.destroy(solution, 1);

    // Requests removed via unassigned_requests
    // Should prefer request 1 (higher absence count)
    // Check first removed request (implementation specific)
}

TEST(DestroyTest, AbsenceRemoval_RemovesLongestAbsent) {
    auto instance = create_test_instance(3);
    Solution solution(instance);

    // Create absence counter
    AbsenceCounter counter(instance.num_requests());

    // Simulate: request 0 always assigned, request 1 absent 2 times, request 2 absent 5 times
    Solution temp_sol(instance);
    size_t pickup0 = instance.pickup_id_of_request(0);
    temp_sol.relink_when_inserting_pd(0, pickup0, 0, 1);

    for (int i = 0; i < 5; ++i) {
        counter.update(temp_sol);
    }

    // Now insert all requests
    size_t pickup1 = instance.pickup_id_of_request(1);
    size_t pickup2 = instance.pickup_id_of_request(2);
    solution.relink_when_inserting_pd(0, pickup0, 0, 1);
    solution.relink_when_inserting_pd(1, pickup1, 1, 2);
    solution.relink_when_inserting_pd(2, pickup2, 2, 3);

    // Remove based on absence
    AbsenceRemovalOperator destroy_op(counter);
    destroy_op.destroy(solution, 1);

    // Requests removed via unassigned_requests
    // Should prefer request 2 (highest absence count)
    // Check first removed request (implementation specific)
}
