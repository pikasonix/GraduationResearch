#include "pdptw/io/sartori_buriol_reader.hpp"
#include "pdptw/problem/travel_matrix.hpp"
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace pdptw::io {

using namespace pdptw::problem;

struct IONode {
    size_t id;
    double lat, lon;
    int demand;
    size_t earliest, latest;
    size_t service_time;
    size_t p, d;
};

// Helper to parse "KEY: VALUE"
static std::string parse_property(const std::string &line) {
    size_t colon_pos = line.find(':');
    if (colon_pos == std::string::npos) {
        // Some lines might not have a colon or be formatted differently, handle gracefully or throw
        // For Sartori format, properties usually have colons.
        return "";
    }
    // Skip colon and whitespace
    size_t start = line.find_first_not_of(" \t", colon_pos + 1);
    if (start == std::string::npos)
        return "";
    return line.substr(start);
}

problem::PDPTWInstance load_sartori_buriol_instance(
    const std::string &filepath,
    size_t max_vehicles) {

    std::ifstream file(filepath);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file: " + filepath);
    }

    std::string line;
    size_t num_nodes = 0;
    size_t capacity = 0;
    size_t route_time = 0;

    // Read properties
    // 1. NAME
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    // 2. LOCATION
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    // 3. COMMENT
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    // 4. TYPE
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");

    // 5. SIZE
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    std::string size_str = parse_property(line);
    if (size_str.empty())
        throw std::runtime_error("Failed to parse SIZE");
    num_nodes = std::stoul(size_str);

    // 6. DISTRIBUTION
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    // 7. DEPOT
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");

    // 8. ROUTE-TIME
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    std::string rt_str = parse_property(line);
    if (rt_str.empty())
        throw std::runtime_error("Failed to parse ROUTE-TIME");
    route_time = std::stoul(rt_str);

    // 9. TIME-WINDOW
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");

    // 10. CAPACITY
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    std::string cap_str = parse_property(line);
    if (cap_str.empty())
        throw std::runtime_error("Failed to parse CAPACITY");
    capacity = std::stoul(cap_str);

    // Read NODES header
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    if (line.find("NODES") == std::string::npos) {
        throw std::runtime_error("Expected NODES line, got: " + line);
    }

    std::vector<IONode> io_nodes;
    io_nodes.reserve(num_nodes);

    for (size_t i = 0; i < num_nodes; ++i) {
        if (!std::getline(file, line))
            throw std::runtime_error("Unexpected EOF reading nodes");
        std::istringstream iss(line);
        IONode node;
        if (!(iss >> node.id >> node.lat >> node.lon >> node.demand >> node.earliest >> node.latest >> node.service_time >> node.p >> node.d)) {
            throw std::runtime_error("Failed to parse node line: " + line);
        }
        io_nodes.push_back(node);
    }

    // Read EDGES header
    if (!std::getline(file, line))
        throw std::runtime_error("Unexpected EOF");
    if (line.find("EDGES") == std::string::npos) {
        throw std::runtime_error("Expected EDGES line, got: " + line);
    }

    // Read matrix (SIZE x SIZE)
    std::vector<std::vector<double>> raw_matrix(num_nodes, std::vector<double>(num_nodes));
    for (size_t i = 0; i < num_nodes; ++i) {
        if (!std::getline(file, line))
            throw std::runtime_error("Unexpected EOF reading edges");
        std::istringstream iss(line);
        for (size_t j = 0; j < num_nodes; ++j) {
            if (!(iss >> raw_matrix[i][j])) {
                throw std::runtime_error("Failed to parse edge value at " + std::to_string(i) + "," + std::to_string(j));
            }
        }
    }

    // Determine number of vehicles
    size_t actual_vehicles = max_vehicles;
    if (actual_vehicles == 0) {
        actual_vehicles = std::max((size_t)1, num_nodes / 4);
        if (actual_vehicles > 1000)
            actual_vehicles = 1000;
    }

    // Create Vehicles
    std::vector<Vehicle> vehicles;
    vehicles.reserve(actual_vehicles);
    for (size_t i = 0; i < actual_vehicles; ++i) {
        vehicles.emplace_back(capacity, route_time);
    }

    // Transform Nodes
    std::vector<Node> nodes;
    nodes.reserve(2 * actual_vehicles + (num_nodes - 1));

    const auto &depot_io = io_nodes[0];

    // Create Depots
    for (size_t v = 0; v < actual_vehicles; ++v) {
        // Start Depot
        nodes.emplace_back(
            nodes.size(),        // id
            depot_io.id,         // original_id
            static_cast<int>(v), // group_id (vehicle idx)
            NodeType::Depot,
            depot_io.lon, depot_io.lat, // x, y
            depot_io.demand,
            depot_io.earliest,
            depot_io.latest,
            depot_io.service_time);
        // End Depot
        nodes.emplace_back(
            nodes.size(),
            depot_io.id,
            static_cast<int>(v),
            NodeType::Depot,
            depot_io.lon, depot_io.lat,
            depot_io.demand,
            depot_io.earliest,
            depot_io.latest,
            depot_io.service_time);
    }

    // Create Requests
    size_t num_requests = (num_nodes - 1) / 2;
    for (size_t i = 0; i < num_requests; ++i) {
        size_t req_id = i;

        // Pickup
        const auto &p_node = io_nodes[i + 1];
        nodes.emplace_back(
            nodes.size(),
            p_node.id,
            static_cast<int>(req_id),
            NodeType::Pickup,
            p_node.lon, p_node.lat,
            p_node.demand,
            p_node.earliest,
            p_node.latest,
            p_node.service_time);

        // Delivery
        const auto &d_node = io_nodes[i + 1 + num_requests];
        nodes.emplace_back(
            nodes.size(),
            d_node.id,
            static_cast<int>(req_id),
            NodeType::Delivery,
            d_node.lon, d_node.lat,
            -p_node.demand, // Delivery demand must be negative (use pickup's demand)
            d_node.earliest,
            d_node.latest,
            d_node.service_time);
    }

    // Create Travel Matrix
    auto travel_matrix = std::make_shared<TravelMatrix>(nodes.size());

    // Map internal node index -> IO node index
    auto get_io_id = [&](size_t internal_id) -> size_t {
        if (internal_id < 2 * actual_vehicles) {
            return 0; // All depots map to IO node 0
        }
        // Requests start at 2*actual_vehicles
        size_t offset = internal_id - 2 * actual_vehicles;
        // Even offset -> Pickup -> IO node (offset/2) + 1
        // Odd offset -> Delivery -> IO node (offset/2) + 1 + num_requests
        size_t req_idx = offset / 2;
        if (offset % 2 == 0) {
            return req_idx + 1;
        } else {
            return req_idx + 1 + num_requests;
        }
    };

    for (size_t i = 0; i < nodes.size(); ++i) {
        for (size_t j = 0; j < nodes.size(); ++j) {
            size_t u = get_io_id(i);
            size_t v = get_io_id(j);
            double val = raw_matrix[u][v];

            travel_matrix->set_distance(i, j, val);
            travel_matrix->set_time(i, j, val);
        }
    }

    // Extract instance name from path
    std::string instance_name = filepath;
    size_t last_slash = filepath.find_last_of("/\\");
    if (last_slash != std::string::npos)
        instance_name = filepath.substr(last_slash + 1);
    size_t last_dot = instance_name.find_last_of('.');
    if (last_dot != std::string::npos)
        instance_name = instance_name.substr(0, last_dot);

    return create_instance_with(
        instance_name,
        actual_vehicles,
        num_requests,
        vehicles,
        nodes,
        travel_matrix);
}

} // namespace pdptw::io
