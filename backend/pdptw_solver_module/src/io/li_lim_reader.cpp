#include "pdptw/io/li_lim_reader.hpp"
#include "pdptw/problem/travel_matrix.hpp"
#include <cmath>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace pdptw::io {

using namespace pdptw::problem;

struct IONode {
    size_t id;
    double x, y;
    int demand;
    double earliest, latest;
    double service_time;
    size_t pickup_sibling;
    size_t delivery_sibling;
};

static std::tuple<size_t, int, double> parse_header(const std::string &line) {
    std::istringstream iss(line);
    size_t k;
    int q;
    double s;

    if (!(iss >> k >> q >> s)) {
        throw std::runtime_error("Failed to parse header line: " + line);
    }

    return {k, q, s};
}

static IONode parse_node(const std::string &line) {
    std::istringstream iss(line);
    IONode node;

    if (!(iss >> node.id >> node.x >> node.y >> node.demand >>
          node.earliest >> node.latest >> node.service_time >>
          node.pickup_sibling >> node.delivery_sibling)) {
        throw std::runtime_error("Failed to parse node line: " + line);
    }

    return node;
}

// Chuyển đổi IO nodes sang PDPTW nodes (đảm bảo pickup-delivery kề nhau)
static std::vector<Node> transform_nodes(
    const std::vector<IONode> &io_nodes,
    size_t num_vehicles) {

    std::vector<Node> nodes;
    nodes.reserve(io_nodes.size() + num_vehicles * 2);

    const auto &depot = io_nodes[0];

    for (size_t v = 0; v < num_vehicles; ++v) {
        nodes.emplace_back(
            nodes.size(),
            0,
            static_cast<int>(v),
            NodeType::Depot,
            depot.x, depot.y,
            0,
            depot.earliest,
            depot.latest,
            depot.service_time);

        nodes.emplace_back(
            nodes.size(),
            0,
            static_cast<int>(v),
            NodeType::Depot,
            depot.x, depot.y,
            0,
            depot.earliest,
            depot.latest,
            depot.service_time);
    }

    int request_id = 0;
    for (size_t i = 1; i < io_nodes.size(); ++i) {
        const auto &io_node = io_nodes[i];

        if (io_node.pickup_sibling == 0) {
            nodes.emplace_back(
                nodes.size(),
                i,
                request_id,
                NodeType::Pickup,
                io_node.x, io_node.y,
                io_node.demand,
                io_node.earliest,
                io_node.latest,
                io_node.service_time);

            size_t delivery_idx = io_node.delivery_sibling;
            if (delivery_idx >= io_nodes.size()) {
                throw std::runtime_error("Invalid delivery sibling index: " +
                                         std::to_string(delivery_idx));
            }

            const auto &delivery_node = io_nodes[delivery_idx];

            nodes.emplace_back(
                nodes.size(),
                delivery_idx,
                request_id,
                NodeType::Delivery,
                delivery_node.x, delivery_node.y,
                delivery_node.demand,
                delivery_node.earliest,
                delivery_node.latest,
                delivery_node.service_time);

            request_id++;
        }
    }

    return nodes;
}

static std::shared_ptr<TravelMatrix> create_travel_matrix(
    const std::vector<Node> &nodes) {

    auto matrix = std::make_shared<TravelMatrix>(nodes.size());

    for (size_t i = 0; i < nodes.size(); ++i) {
        for (size_t j = 0; j < nodes.size(); ++j) {
            double dx = nodes[i].x() - nodes[j].x();
            double dy = nodes[i].y() - nodes[j].y();
            double dist = std::sqrt(dx * dx + dy * dy);

            matrix->set_distance(i, j, dist);
            matrix->set_time(i, j, dist);
        }
    }

    return matrix;
}

PDPTWInstance load_li_lim_instance(
    const std::string &filepath,
    size_t max_vehicles) {

    std::ifstream file(filepath);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file: " + filepath);
    }

    std::string line;

    if (!std::getline(file, line)) {
        throw std::runtime_error("Empty file or cannot read header");
    }

    auto [file_num_vehicles, capacity, speed] = parse_header(line);

    std::vector<IONode> io_nodes;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#')
            continue;
        io_nodes.push_back(parse_node(line));
    }

    if (io_nodes.empty() || io_nodes[0].id != 0) {
        throw std::runtime_error("Invalid file: first node must be depot with id=0");
    }

    size_t num_requests = (io_nodes.size() - 1) / 2;
    size_t num_vehicles = (max_vehicles > 0) ? max_vehicles : num_requests;

    std::vector<Vehicle> vehicles;
    vehicles.reserve(num_vehicles);
    for (size_t i = 0; i < num_vehicles; ++i) {
        vehicles.emplace_back(capacity, io_nodes[0].latest);
    }

    std::vector<Node> nodes = transform_nodes(io_nodes, num_vehicles);

    auto travel_matrix = create_travel_matrix(nodes);

    std::string instance_name = filepath;
    size_t last_slash = filepath.find_last_of("/\\");
    if (last_slash != std::string::npos) {
        instance_name = filepath.substr(last_slash + 1);
    }
    size_t last_dot = instance_name.find_last_of('.');
    if (last_dot != std::string::npos) {
        instance_name = instance_name.substr(0, last_dot);
    }

    return create_instance_with(
        instance_name,
        num_vehicles,
        num_requests,
        vehicles,
        nodes,
        travel_matrix);
}

} // namespace pdptw::io
