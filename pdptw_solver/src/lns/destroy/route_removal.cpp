#include "pdptw/lns/destroy/route_removal.hpp"
#include <algorithm>

namespace pdptw {
namespace lns {

RouteRemovalOperator::RouteRemovalOperator()
    : rng_(std::random_device{}()) {
}

void RouteRemovalOperator::destroy(
    solution::Solution &solution,
    size_t num_to_remove) {

    const auto &instance = solution.instance();
    size_t num_vehicles = instance.num_vehicles();

    if (num_vehicles == 0) {
        return;
    }

    std::vector<size_t> non_empty_routes;
    for (size_t v = 0; v < num_vehicles; ++v) {
        if (!solution.is_route_empty(v)) {
            non_empty_routes.push_back(v);
        }
    }

    if (non_empty_routes.empty()) {
        return;
    }

    std::shuffle(non_empty_routes.begin(), non_empty_routes.end(), rng_);

    size_t removed_count = 0;

    for (size_t v : non_empty_routes) {
        if (removed_count >= num_to_remove) {
            break;
        }

        size_t vn_id = instance.vn_id_of(v);

        std::vector<size_t> route_requests;
        auto route_nodes = solution.iter_route_by_vn_id(vn_id);

        for (size_t node_id : route_nodes) {
            if (instance.nodes()[node_id].is_pickup()) {
                size_t pickup_id = node_id;
                route_requests.push_back(pickup_id);
            }
        }

        for (size_t pickup_id : route_requests) {
            if (removed_count >= num_to_remove) {
                break;
            }

            solution.unassign_request(pickup_id);

            removed_count++;
        }
    }
}

} // namespace lns
} // namespace pdptw
