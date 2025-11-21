#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

// PDPTW: Pickup and Delivery Problem with Time Windows

namespace pdptw::problem {

class TravelMatrix;

using Num = double;       // Kiểu số cho time/distance
using Capacity = int16_t; // Kiểu capacity của vehicle
using RequestId = size_t;
using NodeId = size_t;
using VehicleId = size_t;

// Loại node
enum class NodeType {
    Depot,
    Pickup,
    Delivery
};

// Helper functions cho NodeType
inline bool is_depot(NodeType type) { return type == NodeType::Depot; }
inline bool is_pickup(NodeType type) { return type == NodeType::Pickup; }
inline bool is_delivery(NodeType type) { return type == NodeType::Delivery; }
inline bool is_request(NodeType type) {
    return type == NodeType::Pickup || type == NodeType::Delivery;
}

// Xe với capacityvà shift_length (thời gian làm việc)
class Vehicle {
public:
    Vehicle() = default;
    Vehicle(Capacity seats, Num shift_length);

    Capacity seats() const { return seats_; }
    Num shift_length() const { return shift_length_; }

    bool check_capacity(Capacity demand) const;

private:
    Capacity seats_ = 0;
    Num shift_length_ = 0.0;
};

// Node trong đồ thị PDPTW: depot, pickup, hoặc delivery
class Node {
public:
    Node() = default;
    Node(NodeId id, size_t oid, size_t gid, NodeType node_type,
         double x, double y, Capacity demand,
         Num ready, Num due, Num servicetime);

    NodeId id() const { return id_; }
    size_t oid() const { return oid_; } // Original ID
    size_t gid() const { return gid_; } // Group ID
    NodeType node_type() const { return node_type_; }
    double x() const { return x_; }
    double y() const { return y_; }
    Capacity demand() const { return demand_; }
    Num ready() const { return ready_; } // Thời gian sớm nhất (time window)
    Num due() const { return due_; }     // Thời gian muộn nhất (time window)
    Num servicetime() const { return servicetime_; }

    // Setters (cần cho preprocessing)
    void set_ready(Num ready) { ready_ = ready; }
    void set_due(Num due) { due_ = due; }

    // Kiểm tra loại node
    bool is_depot() const { return pdptw::problem::is_depot(node_type_); }
    bool is_pickup() const { return pdptw::problem::is_pickup(node_type_); }
    bool is_delivery() const { return pdptw::problem::is_delivery(node_type_); }
    bool is_request() const { return pdptw::problem::is_request(node_type_); }

private:
    NodeId id_ = 0;
    size_t oid_ = 0;
    size_t gid_ = 0;
    NodeType node_type_ = NodeType::Depot;
    double x_ = 0.0;
    double y_ = 0.0;
    Capacity demand_ = 0;
    Num ready_ = 0.0;
    Num due_ = 0.0;
    Num servicetime_ = 0.0;
};

// Kết quả khoảng cách và thời gian
struct DistanceAndTime {
    Num distance;
    Num time;
};

// PDPTW problem instance
class PDPTWInstance {
public:
    PDPTWInstance() = default;
    PDPTWInstance(std::string name, size_t num_requests, size_t num_vehicles,
                  std::vector<Node> nodes, std::vector<Vehicle> vehicles,
                  std::shared_ptr<TravelMatrix> travel_matrix);

    const std::string &name() const { return name_; }
    size_t num_requests() const { return num_requests_; }
    size_t num_vehicles() const { return num_vehicles_; }
    const std::vector<Node> &nodes() const { return nodes_; }
    const std::vector<Vehicle> &vehicles() const { return vehicles_; }

    // Truy cập travel matrix
    Num distance(NodeId from, NodeId to) const;
    Num time(NodeId from, NodeId to) const;
    DistanceAndTime distance_and_time(NodeId from, NodeId to) const;

    // Truy cập vehicle
    const Vehicle &vehicle_from_vn_id(NodeId vn_id) const;
    NodeId vn_id_of(VehicleId v_id) const;

    // Kiểm tra loại node
    NodeType node_type(NodeId id) const;
    bool is_request(NodeId node_id) const;
    bool is_pickup(NodeId node_id) const;
    bool is_delivery(NodeId node_id) const;

    // Truy cập cặp pickup-delivery
    const Node &pickup_of(NodeId delivery_id) const;
    const Node &delivery_of(NodeId pickup_id) const;
    const Node &pair_of(NodeId node_id) const;

    // Chuyển đổi Request ID
    RequestId request_id(NodeId node_id) const;
    NodeId pickup_id_of_request(RequestId request_id) const;
    NodeId delivery_id_of_request(RequestId request_id) const;

private:
    std::string name_;
    size_t num_requests_ = 0;
    size_t num_vehicles_ = 0;
    std::vector<Node> nodes_;
    std::vector<Vehicle> vehicles_;
    std::shared_ptr<TravelMatrix> travel_matrix_;
};

// Tạo PDPTW instance với preprocessing (time window tightening, etc.)
PDPTWInstance create_instance_with(
    std::string name,
    size_t num_vehicles,
    size_t num_requests,
    std::vector<Vehicle> vehicles,
    std::vector<Node> nodes,
    std::shared_ptr<TravelMatrix> travel_matrix);

} // namespace pdptw::problem
