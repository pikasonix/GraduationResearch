#include "pdptw/problem/pdptw.hpp"
#include "pdptw/problem/travel_matrix.hpp"
#include <algorithm>
#include <limits>
#include <spdlog/spdlog.h>
#include <stdexcept>

namespace pdptw::problem {

Vehicle::Vehicle(Capacity seats, Num shift_length)
    : seats_(seats), shift_length_(shift_length) {}

bool Vehicle::check_capacity(Capacity demand) const {
    return demand <= seats_;
}

Node::Node(NodeId id, size_t oid, size_t gid, NodeType node_type,
           double x, double y, Capacity demand,
           Num ready, Num due, Num servicetime)
    : id_(id), oid_(oid), gid_(gid), node_type_(node_type),
      x_(x), y_(y), demand_(demand),
      ready_(ready), due_(due), servicetime_(servicetime) {}
PDPTWInstance::PDPTWInstance(std::string name, size_t num_requests, size_t num_vehicles,
                             std::vector<Node> nodes, std::vector<Vehicle> vehicles,
                             std::shared_ptr<TravelMatrix> travel_matrix)
    : name_(std::move(name)), num_requests_(num_requests), num_vehicles_(num_vehicles),
      nodes_(std::move(nodes)), vehicles_(std::move(vehicles)),
      travel_matrix_(std::move(travel_matrix)) {}

Num PDPTWInstance::distance(NodeId from, NodeId to) const {
    return travel_matrix_->get_distance(from, to);
}

Num PDPTWInstance::time(NodeId from, NodeId to) const {
    return travel_matrix_->get_time(from, to);
}

DistanceAndTime PDPTWInstance::distance_and_time(NodeId from, NodeId to) const {
    return DistanceAndTime{
        travel_matrix_->get_distance(from, to),
        travel_matrix_->get_time(from, to)};
}

const Vehicle &PDPTWInstance::vehicle_from_vn_id(NodeId vn_id) const {
    return vehicles_[vn_id / 2];
}

NodeId PDPTWInstance::vn_id_of(VehicleId v_id) const {
    return v_id * 2;
}

NodeType PDPTWInstance::node_type(NodeId id) const {
    return nodes_[id].node_type();
}

bool PDPTWInstance::is_request(NodeId node_id) const {
    return node_id >= num_vehicles_ * 2;
}

bool PDPTWInstance::is_pickup(NodeId node_id) const {
    return is_request(node_id) && node_id % 2 == 0;
}

bool PDPTWInstance::is_delivery(NodeId node_id) const {
    return is_request(node_id) && node_id % 2 == 1;
}

const Node &PDPTWInstance::pickup_of(NodeId delivery_id) const {
    return nodes_[delivery_id - 1];
}

const Node &PDPTWInstance::delivery_of(NodeId pickup_id) const {
    return nodes_[pickup_id + 1];
}

const Node &PDPTWInstance::pair_of(NodeId node_id) const {
    switch (nodes_[node_id].node_type()) {
    case NodeType::Pickup:
        return nodes_[node_id + 1];
    case NodeType::Delivery:
        return nodes_[node_id - 1];
    default:
        throw std::runtime_error("pair_of() called on depot node");
    }
}

RequestId PDPTWInstance::request_id(NodeId node_id) const {
    return (node_id / 2) - vehicles_.size();
}

NodeId PDPTWInstance::pickup_id_of_request(RequestId request_id) const {
    return (request_id + vehicles_.size()) * 2;
}

NodeId PDPTWInstance::delivery_id_of_request(RequestId request_id) const {
    return (request_id + vehicles_.size()) * 2 + 1;
}

// Tạo instance với tiền xử lý: thu hẹp time windows để tăng hiệu quả tìm kiếm
PDPTWInstance create_instance_with(
    std::string name,
    size_t num_vehicles,
    size_t num_requests,
    std::vector<Vehicle> vehicles,
    std::vector<Node> nodes,
    std::shared_ptr<TravelMatrix> travel_matrix) {
    for (size_t i = 0; i < num_requests; ++i) {
        size_t p_id = (num_vehicles * 2) + (i * 2);
        size_t d_id = p_id + 1;

        // Tìm thời gian sớm nhất có thể đến pickup và muộn nhất có thể rời delivery
        Num earliest_arrival = std::numeric_limits<Num>::max();
        Num latest_departure = std::numeric_limits<Num>::lowest();

        for (size_t v_id = 0; v_id < vehicles.size(); ++v_id) {
            Num travel_time_v_p = travel_matrix->get_time(v_id * 2, p_id);
            Num travel_time_d_v = travel_matrix->get_time(d_id, v_id * 2 + 1);

            earliest_arrival = std::min(earliest_arrival,
                                        nodes[v_id * 2].ready() + travel_time_v_p);
            latest_departure = std::max(latest_departure,
                                        nodes[v_id * 2 + 1].due() - travel_time_d_v);
        }

        Num new_ready = std::max(nodes[p_id].ready(), earliest_arrival);
        new_ready = std::min(new_ready, nodes[p_id].due());
        nodes[p_id].set_ready(new_ready);

        // Kiểm tra tính khả thi: pickup phải đến delivery kịp trước due time
        Num tt = travel_matrix->get_time(p_id, d_id);
        if (nodes[p_id].ready() > nodes[d_id].due() - tt) {
            spdlog::warn("p_id: {} không thể đến delivery kịp thời gian (rdy: {}, due: {}, tt: {})",
                         p_id, nodes[p_id].ready(), nodes[d_id].due(), tt);
        }

        Num new_due = std::min(nodes[d_id].due(),
                               latest_departure - nodes[d_id].servicetime());
        nodes[d_id].set_due(new_due);

        // Thu hẹp time window của delivery: phải sau pickup + service time + travel time
        Num p_rdy = nodes[p_id].ready();
        Num p_st = nodes[p_id].servicetime();
        Num d_ready = std::max(nodes[d_id].ready(), p_rdy + p_st + tt);
        nodes[d_id].set_ready(d_ready);

        // Thu hẹp time window của pickup: phải trước delivery due - travel time - service time
        Num d_due = nodes[d_id].due();
        if (tt + p_st > d_due) {
            spdlog::warn("Cảnh báo: travel time + service time vượt quá due time ({} + {} > {})", tt, p_st, d_due);
        }
        Num p_due = std::min(nodes[p_id].due(), d_due - tt - p_st);
        nodes[p_id].set_due(p_due);
    }

    return PDPTWInstance(std::move(name), num_requests, num_vehicles,
                         std::move(nodes), std::move(vehicles),
                         std::move(travel_matrix));
}

} // namespace pdptw::problem
