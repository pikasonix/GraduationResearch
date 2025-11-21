#ifndef PDPTW_TEST_HELPERS_HPP
#define PDPTW_TEST_HELPERS_HPP

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/problem/travel_matrix.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <cmath>
#include <memory>

// Helper function to create a simple test instance
inline pdptw::problem::PDPTWInstance create_simple_instance() {
    using namespace pdptw::problem;

    // Create 2 vehicles, 2 requests (4 request nodes: 2 pickups + 2 deliveries)
    // Total 8 nodes: 4 depot nodes (2*2) + 4 request nodes
    const size_t num_vehicles = 2;
    const size_t num_requests = 2;
    const size_t num_nodes = num_vehicles * 2 + num_requests * 2; // 8 nodes

    std::vector<Node> nodes;
    nodes.reserve(num_nodes);

    // Create depot nodes (0-3): start and end for each vehicle
    for (size_t v = 0; v < num_vehicles; ++v) {
        // Start depot: id, oid, gid, type, x, y, demand, ready, due, servicetime
        nodes.emplace_back(v * 2, v * 2, 0, NodeType::Depot, 0.0, 0.0,
                           0, 0.0, 1000.0, 0.0);
        // End depot
        nodes.emplace_back(v * 2 + 1, v * 2 + 1, 0, NodeType::Depot, 0.0, 0.0,
                           0, 0.0, 1000.0, 0.0);
    }

    // Create pickup-delivery pairs (nodes 4-7)
    // Request 0: pickup=4, delivery=5
    nodes.emplace_back(4, 4, 1, NodeType::Pickup, 0.0, 0.0,
                       10, 10.0, 100.0, 10.0); // demand=10
    nodes.emplace_back(5, 5, 1, NodeType::Delivery, 10.0, 10.0,
                       -10, 20.0, 110.0, 10.0); // demand=-10

    // Request 1: pickup=6, delivery=7
    nodes.emplace_back(6, 6, 2, NodeType::Pickup, 20.0, 0.0,
                       15, 15.0, 105.0, 10.0); // demand=15
    nodes.emplace_back(7, 7, 2, NodeType::Delivery, 30.0, 10.0,
                       -15, 25.0, 115.0, 10.0); // demand=-15

    // Create vehicles (capacity, shift_length)
    std::vector<Vehicle> vehicles;
    for (size_t v = 0; v < num_vehicles; ++v) {
        vehicles.emplace_back(50, 1000.0); // capacity=50, shift_length=1000
    }

    // Create travel matrix (8x8)
    auto travel_matrix = std::make_shared<TravelMatrix>(num_nodes);

    // Set some example distances and times
    for (size_t i = 0; i < num_nodes; ++i) {
        for (size_t j = 0; j < num_nodes; ++j) {
            if (i == j) {
                travel_matrix->set_distance(i, j, 0.0);
                travel_matrix->set_time(i, j, 0.0);
            } else {
                // Simple Manhattan distance
                double dist = std::abs(static_cast<double>(i) - static_cast<double>(j)) * 10.0;
                double time = dist / 2.0; // Assume speed = 2
                travel_matrix->set_distance(i, j, dist);
                travel_matrix->set_time(i, j, time);
            }
        }
    }

    return PDPTWInstance("test_instance", num_requests, num_vehicles,
                         std::move(nodes), std::move(vehicles), travel_matrix);
}

// Helper function to create a test instance with configurable number of requests
inline pdptw::problem::PDPTWInstance create_test_instance(size_t num_requests) {
    using namespace pdptw::problem;

    const size_t num_vehicles = 2;
    const size_t num_nodes = num_vehicles * 2 + num_requests * 2;

    std::vector<Node> nodes;
    nodes.reserve(num_nodes);

    // Create depot nodes
    for (size_t v = 0; v < num_vehicles; ++v) {
        nodes.emplace_back(v * 2, v * 2, 0, NodeType::Depot, 0.0, 0.0,
                           0, 0.0, 1000.0, 0.0);
        nodes.emplace_back(v * 2 + 1, v * 2 + 1, 0, NodeType::Depot, 0.0, 0.0,
                           0, 0.0, 1000.0, 0.0);
    }

    // Create request nodes
    for (size_t r = 0; r < num_requests; ++r) {
        size_t pickup_id = num_vehicles * 2 + r * 2;
        size_t delivery_id = pickup_id + 1;

        nodes.emplace_back(pickup_id, pickup_id, r + 1, NodeType::Pickup,
                           10.0 * r, 0.0, 10, 10.0, 100.0, 5.0);
        nodes.emplace_back(delivery_id, delivery_id, r + 1, NodeType::Delivery,
                           10.0 * r + 5.0, 10.0, -10, 20.0, 110.0, 5.0);
    }

    std::vector<Vehicle> vehicles;
    for (size_t v = 0; v < num_vehicles; ++v) {
        vehicles.emplace_back(100, 1000.0);
    }

    auto travel_matrix = std::make_shared<TravelMatrix>(num_nodes);
    for (size_t i = 0; i < num_nodes; ++i) {
        for (size_t j = 0; j < num_nodes; ++j) {
            double dist = (i == j) ? 0.0 : std::abs(static_cast<double>(i - j)) * 5.0;
            double time = dist;
            travel_matrix->set_distance(i, j, dist);
            travel_matrix->set_time(i, j, time);
        }
    }

    return PDPTWInstance("kdsp_test", num_requests, num_vehicles,
                         std::move(nodes), std::move(vehicles), travel_matrix);
}

// Helper function to create a test solution with some served requests
inline pdptw::solution::Solution create_test_solution(const pdptw::problem::PDPTWInstance &instance, size_t num_vehicles) {
    using namespace pdptw::solution;

    Solution solution(instance);

    // Serve first request on first vehicle if available
    if (instance.num_requests() > 0 && num_vehicles > 0) {
        size_t vn_start = 0;
        size_t pickup_id = instance.pickup_id_of_request(0);

        // Insert pickup-delivery pair: depot -> pickup -> delivery -> depot
        solution.relink_when_inserting_pd(vn_start, pickup_id, vn_start, vn_start + 1);
    }

    return solution;
}

#endif // PDPTW_TEST_HELPERS_HPP
