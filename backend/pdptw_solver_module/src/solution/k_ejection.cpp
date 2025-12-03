// K-EJECTION OPERATIONS
// Đây là các toán tử nâng cao cho LNS: loại bỏ k requests để chèn 1 request mới

#include "pdptw/solution/k_ejection.hpp"
#include "pdptw/construction/insertion.hpp"
#include <spdlog/spdlog.h>
#include <limits>

namespace pdptw::solution {

namespace {
// Helper to extract request IDs from a route
std::vector<size_t> get_requests_in_route(const Solution &sol, size_t route_id) {
    std::vector<size_t> requests;
    size_t vn = sol.instance().vn_id_of(route_id);
    size_t curr = sol.succ(vn);
    size_t end_node = vn + 1;
    size_t offset = sol.instance().num_vehicles() * 2;

    while (curr != end_node) {
        if (curr >= offset) {
            size_t rem = curr - offset;
            // Only count pickup nodes (even indices)
            if (rem % 2 == 0) {
                requests.push_back(rem / 2);
            }
        }
        curr = sol.succ(curr);
    }
    return requests;
}

// Helper to build route vector without specific requests
std::vector<size_t> build_route_without(const Solution &sol, size_t route_id, const std::vector<size_t> &excluded_reqs) {
    std::vector<size_t> route;
    size_t vn = sol.instance().vn_id_of(route_id);
    route.push_back(vn);

    size_t curr = sol.succ(vn);
    size_t end_node = vn + 1;
    size_t offset = sol.instance().num_vehicles() * 2;

    while (curr != end_node) {
        bool exclude = false;
        if (curr >= offset) {
            size_t req_id = (curr - offset) / 2;
            for (size_t ex : excluded_reqs) {
                if (req_id == ex) {
                    exclude = true;
                    break;
                }
            }
        }

        if (!exclude) {
            route.push_back(curr);
        }
        curr = sol.succ(curr);
    }
    route.push_back(end_node);
    return route;
}
} // namespace

std::optional<KEjectionInsertion<1>> KEjectionOps::find_best_insertion_k_ejection_1(
    const Solution &sol,
    size_t pickup_id,
    std::mt19937 &rng,
    const lns::AbsenceCounter &absence) {
    
    (void)rng; // Unused for deterministic search
    
    Solution temp_sol(sol.instance());
    size_t num_vehicles = sol.instance().num_vehicles();

    // Initialize empty itineraries
    std::vector<std::vector<size_t>> temp_itineraries(num_vehicles);
    for (size_t v = 0; v < num_vehicles; ++v) {
        size_t vn = sol.instance().vn_id_of(v);
        temp_itineraries[v] = {vn, vn + 1};
    }

    std::optional<KEjectionInsertion<1>> best_result;
    double best_cost = std::numeric_limits<double>::infinity();

    for (size_t r_id = 0; r_id < num_vehicles; ++r_id) {
        if (sol.is_route_empty(r_id)) continue;

        auto requests = get_requests_in_route(sol, r_id);
        if (requests.empty()) continue;

        double original_cost = sol.fw_data()[sol.instance().vn_id_of(r_id) + 1].data.distance;

        for (size_t eject_req : requests) {
            // Build modified route
            auto modified_route = build_route_without(sol, r_id, {eject_req});

            // Update temp_sol
            temp_itineraries[r_id] = modified_route;
            temp_sol.set(temp_itineraries);

            // Try insertion
            auto candidate = construction::Insertion::find_best_insertion(
                temp_sol, pickup_id, construction::InsertionStrategy::BestCost);

            if (candidate.feasible) {
                double new_route_cost = temp_sol.fw_data()[sol.instance().vn_id_of(r_id) + 1].data.distance + candidate.cost_increase;
                double delta = new_route_cost - original_cost;
                
                if (delta < best_cost) {
                    best_cost = delta;
                    best_result = KEjectionInsertion<1>{
                        {PDEjection{eject_req}},
                        PDInsertion{
                            candidate.vehicle_id * 2,
                            pickup_id,
                            candidate.pickup_after,
                            candidate.delivery_after, // delivery_before in PDInsertion context
                            candidate.cost_increase
                        }
                    };
                }
            }

            // Reset temp_itineraries for next iteration
            size_t vn = sol.instance().vn_id_of(r_id);
            temp_itineraries[r_id] = {vn, vn + 1};
        }
    }

    return best_result;
}

std::optional<KEjectionInsertion<2>> KEjectionOps::find_best_insertion_k_ejection_2(
    const Solution &sol,
    size_t pickup_id,
    std::mt19937 &rng,
    const lns::AbsenceCounter &absence) {
    
    (void)rng;
    
    Solution temp_sol(sol.instance());
    size_t num_vehicles = sol.instance().num_vehicles();

    std::vector<std::vector<size_t>> temp_itineraries(num_vehicles);
    for (size_t v = 0; v < num_vehicles; ++v) {
        size_t vn = sol.instance().vn_id_of(v);
        temp_itineraries[v] = {vn, vn + 1};
    }

    std::optional<KEjectionInsertion<2>> best_result;
    double best_cost = std::numeric_limits<double>::infinity();

    for (size_t r_id = 0; r_id < num_vehicles; ++r_id) {
        if (sol.is_route_empty(r_id)) continue;

        auto requests = get_requests_in_route(sol, r_id);
        if (requests.size() < 2) continue;

        double original_cost = sol.fw_data()[sol.instance().vn_id_of(r_id) + 1].data.distance;

        // Iterate pairs
        for (size_t i = 0; i < requests.size(); ++i) {
            for (size_t j = i + 1; j < requests.size(); ++j) {
                size_t req1 = requests[i];
                size_t req2 = requests[j];

                auto modified_route = build_route_without(sol, r_id, {req1, req2});

                temp_itineraries[r_id] = modified_route;
                temp_sol.set(temp_itineraries);

                auto candidate = construction::Insertion::find_best_insertion(
                    temp_sol, pickup_id, construction::InsertionStrategy::BestCost);

                if (candidate.feasible) {
                    double new_route_cost = temp_sol.fw_data()[sol.instance().vn_id_of(r_id) + 1].data.distance + candidate.cost_increase;
                    double delta = new_route_cost - original_cost;

                    if (delta < best_cost) {
                        best_cost = delta;
                        best_result = KEjectionInsertion<2>{
                            {PDEjection{req1}, PDEjection{req2}},
                            PDInsertion{
                                candidate.vehicle_id * 2,
                                pickup_id,
                                candidate.pickup_after,
                                candidate.delivery_after,
                                candidate.cost_increase
                            }
                        };
                    }
                }
                
                size_t vn = sol.instance().vn_id_of(r_id);
                temp_itineraries[r_id] = {vn, vn + 1};
            }
        }
    }

    return best_result;
}

} // namespace pdptw::solution
