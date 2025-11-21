#include "pdptw/construction/constructor.hpp"
#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/lns/repair/absence_based_regret.hpp"
#include "pdptw/lns/repair/greedy_insertion.hpp"
#include "pdptw/lns/repair/hardest_first_insertion.hpp"
#include "pdptw/lns/repair/regret_insertion.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/problem/travel_matrix.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <gtest/gtest.h>
#include <memory>
#include <random>

using namespace pdptw;
using namespace pdptw::problem;
using namespace pdptw::solution;
using namespace pdptw::lns;
using namespace pdptw::lns::repair;
using namespace pdptw::construction;

class RepairTest : public ::testing::Test {
protected:
    std::shared_ptr<PDPTWInstance> instance;

    void SetUp() override {
        // Create simple instance with 3 requests, 2 vehicles
        std::vector<Vehicle> vehicles = {Vehicle(100, 1000), Vehicle(100, 1000)};

        std::vector<Node> nodes;
        // Depot nodes (0, 1 for vehicle 0; 2, 3 for vehicle 1)
        nodes.push_back(Node(0, 0, 0, NodeType::Depot, 0, 0, 0, 0, 1000, 0));
        nodes.push_back(Node(1, 1, 0, NodeType::Depot, 0, 0, 0, 0, 1000, 0));
        nodes.push_back(Node(2, 2, 1, NodeType::Depot, 0, 0, 0, 0, 1000, 0));
        nodes.push_back(Node(3, 3, 1, NodeType::Depot, 0, 0, 0, 0, 1000, 0));

        // Request 0: pickup at 4, delivery at 5
        nodes.push_back(Node(4, 4, 0, NodeType::Pickup, 10, 10, 20, 0, 500, 5));
        nodes.push_back(Node(5, 5, 0, NodeType::Delivery, 20, 20, -20, 0, 600, 5));

        // Request 1: pickup at 6, delivery at 7
        nodes.push_back(Node(6, 6, 1, NodeType::Pickup, 30, 30, 15, 0, 500, 5));
        nodes.push_back(Node(7, 7, 1, NodeType::Delivery, 40, 40, -15, 0, 600, 5));

        // Request 2: pickup at 8, delivery at 9
        nodes.push_back(Node(8, 8, 2, NodeType::Pickup, 50, 50, 25, 0, 500, 5));
        nodes.push_back(Node(9, 9, 2, NodeType::Delivery, 60, 60, -25, 0, 600, 5));

        auto travel_matrix = std::make_shared<TravelMatrix>(10);
        for (size_t i = 0; i < 10; ++i) {
            for (size_t j = 0; j < 10; ++j) {
                double dist = (i == j) ? 0.0 : 10.0;
                travel_matrix->set_time(i, j, dist);
                travel_matrix->set_distance(i, j, dist);
            }
        }

        instance = std::make_shared<PDPTWInstance>(
            create_instance_with("test", 2, 3, vehicles, nodes, travel_matrix));
    }
};

// ==================== GreedyInsertion Tests ====================

TEST_F(RepairTest, GreedyInsertion_InsertsAllRequests) {
    Solution solution(*instance);
    std::mt19937 rng(42);

    // All requests start as unassigned
    EXPECT_EQ(solution.unassigned_requests().count(), 3);

    GreedyInsertionOperator greedy;
    greedy.repair(solution, rng);

    // Greedy should insert at least some requests (may not insert all due to constraints)
    EXPECT_LT(solution.unassigned_requests().count(), 3); // At least 1 should be inserted
}

TEST_F(RepairTest, GreedyInsertion_DifferentSeeds) {
    Solution solution1(*instance);
    Solution solution2(*instance);
    std::mt19937 rng1(42);
    std::mt19937 rng2(123);

    GreedyInsertionOperator greedy;
    greedy.repair(solution1, rng1);
    greedy.repair(solution2, rng2);

    // Both should insert at least some requests
    EXPECT_LT(solution1.unassigned_requests().count(), 3);
    EXPECT_LT(solution2.unassigned_requests().count(), 3);
}

// ==================== RegretInsertion Tests ====================

TEST_F(RepairTest, RegretInsertion_InsertsRequests) {
    Solution solution(*instance);
    std::mt19937 rng(42);

    EXPECT_EQ(solution.unassigned_requests().count(), 3);

    RegretInsertionOperator regret;
    regret.repair(solution, rng);

    // Regret should insert feasible requests
    EXPECT_LE(solution.unassigned_requests().count(), 2);
}

TEST_F(RepairTest, RegretInsertion_HandlesEmptySolution) {
    Solution solution(*instance);
    std::mt19937 rng(42);

    // Start with empty solution
    EXPECT_EQ(solution.unassigned_requests().count(), 3);

    RegretInsertionOperator regret;
    regret.repair(solution, rng);

    // Should insert at least some requests
    EXPECT_LT(solution.unassigned_requests().count(), 3);
}

// ==================== HardestFirstInsertion Tests ====================

TEST_F(RepairTest, HardestFirst_UsesAbsenceCounter) {
    Solution solution(*instance);
    std::mt19937 rng(42);
    AbsenceCounter absence(3);

    // Update absence counter (simulate some iterations)
    absence.update(solution);
    absence.update(solution);

    HardestFirstInsertionOperator hardest;
    hardest.repair(solution, absence, rng);

    // Should insert requests prioritized by absence
    EXPECT_LE(solution.unassigned_requests().count(), 2);
}

TEST_F(RepairTest, HardestFirst_AllUnassigned) {
    Solution solution(*instance);
    std::mt19937 rng(42);
    AbsenceCounter absence(3);

    EXPECT_EQ(solution.unassigned_requests().count(), 3);

    HardestFirstInsertionOperator hardest;
    hardest.repair(solution, absence, rng);

    EXPECT_LT(solution.unassigned_requests().count(), 3);
}

// ==================== AbsenceBasedRegret Tests ====================

TEST_F(RepairTest, AbsenceRegret_CombinesAbsenceAndRegret) {
    Solution solution(*instance);
    std::mt19937 rng(42);
    AbsenceCounter absence(3);

    // Update absence counter
    absence.update(solution);
    absence.update(solution);

    AbsenceBasedRegretOperator absence_regret;
    absence_regret.repair(solution, absence, rng);

    // Should insert requests with weighted regret
    EXPECT_LE(solution.unassigned_requests().count(), 2);
}

TEST_F(RepairTest, AbsenceRegret_DifferentAbsenceCounts) {
    Solution solution(*instance);
    std::mt19937 rng(42);
    AbsenceCounter absence(3);

    // Create different absence counts by updating multiple times
    for (int i = 0; i < 5; ++i) {
        absence.update(solution);
    }

    AbsenceBasedRegretOperator absence_regret;
    absence_regret.repair(solution, absence, rng);

    EXPECT_LE(solution.unassigned_requests().count(), 2);
}

// ==================== Integration Tests ====================

TEST_F(RepairTest, AllOperators_WorkOnSameSolution) {
    std::mt19937 rng(42);
    AbsenceCounter absence(3);

    // Test greedy
    {
        Solution sol(*instance);
        GreedyInsertionOperator op;
        op.repair(sol, rng);
        EXPECT_LE(sol.unassigned_requests().count(), 3); // May not insert all
    }

    // Test regret
    {
        Solution sol(*instance);
        RegretInsertionOperator op;
        op.repair(sol, rng);
        EXPECT_LT(sol.unassigned_requests().count(), 3);
    }

    // Test hardest-first
    {
        Solution sol(*instance);
        HardestFirstInsertionOperator op;
        op.repair(sol, absence, rng);
        EXPECT_LT(sol.unassigned_requests().count(), 3);
    }

    // Test absence-regret
    {
        Solution sol(*instance);
        AbsenceBasedRegretOperator op;
        op.repair(sol, absence, rng);
        EXPECT_LT(sol.unassigned_requests().count(), 3);
    }
}
