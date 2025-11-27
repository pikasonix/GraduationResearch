#include "pdptw/solution/permutation.hpp"
#include "pdptw/problem/pdptw.hpp"
#include <algorithm>
#include <spdlog/spdlog.h>

namespace pdptw::solution {

using pdptw::problem::DistanceAndTime;

// find_random_insert_for_request

std::optional<PDInsertion> PermutationOps::find_random_insert_for_request(
    const Solution &sol,
    size_t pickup_id,
    std::mt19937 &rng) {
    ReservoirSampling sampling;

    // Try all non-empty routes + first empty route
    for (size_t r_id : sol.iter_route_ids()) {
        sampling = find_random_insert_in_route(sol, pickup_id, r_id, rng, sampling);
    }

    // Also try first empty route
    auto empty_routes = sol.iter_empty_route_ids();
    if (!empty_routes.empty()) {
        sampling = find_random_insert_in_route(sol, pickup_id, empty_routes[0], rng, sampling);
    }

    return sampling.take();
}

// find_random_insert_in_route

ReservoirSampling PermutationOps::find_random_insert_in_route(
    const Solution &sol,
    size_t pickup_id,
    size_t route_id,
    std::mt19937 &rng,
    ReservoirSampling sampling) {
    size_t vn_id = route_id * 2;
    const auto &instance = sol.instance();
    const auto &vehicle = instance.vehicle_from_vn_id(vn_id);

    size_t delivery_id = pickup_id + 1;
    const auto &pickup_node = instance.nodes()[pickup_id];
    const auto &delivery_node = instance.nodes()[delivery_id];

    const auto &fw_data = sol.fw_data();
    const auto &bw_data = sol.bw_data();

    size_t feasible_count = 0;
    PDInsertion best_in_route;
    best_in_route.cost = std::numeric_limits<Num>::max();
    size_t pickup_after = vn_id;
    while (pickup_after != vn_id + 1) {
        const auto &before_pickup = fw_data[pickup_after];
        size_t next_after_pickup = before_pickup.succ;

        DistanceAndTime dist_time = instance.distance_and_time(pickup_after, pickup_id);
        if (before_pickup.data.earliest_completion + dist_time.time > pickup_node.due()) {
            pickup_after = next_after_pickup;
            continue;
        }

        auto tmp_data = before_pickup.data;
        tmp_data.extend_forward(fw_data[pickup_id].node, dist_time);

        size_t prev_node = pickup_id;
        size_t delivery_before = next_after_pickup;

        while (prev_node != vn_id + 1) {
            const auto &after_delivery = fw_data[delivery_before];
            DistanceAndTime dist_prev_to_del = instance.distance_and_time(prev_node, delivery_id);

            if (tmp_data.earliest_completion + dist_prev_to_del.time > delivery_node.due()) {
                break;
            }
            auto tmp_after_del = tmp_data;
            tmp_after_del.extend_forward(fw_data[delivery_id].node, dist_prev_to_del);
            DistanceAndTime dist_del_to_next = instance.distance_and_time(delivery_id, delivery_before);
            auto final_data = tmp_after_del;
            final_data.concat(after_delivery.data, dist_del_to_next);

            if (final_data.tw_feasible && vehicle.check_capacity(final_data.max_load)) {
                Num cost_delta = final_data.distance - fw_data[vn_id + 1].data.distance;

                if (cost_delta < best_in_route.cost) {
                    best_in_route = PDInsertion{
                        vn_id,
                        pickup_id,
                        pickup_after,
                        delivery_before,
                        cost_delta};
                }
                feasible_count++;
            }

            prev_node = delivery_before;
            delivery_before = after_delivery.succ;
        }

        pickup_after = next_after_pickup;
    }

    if (feasible_count > 0) {
        sampling.add(best_in_route, feasible_count, rng);
    }

    return sampling;
}

// find_all_inserts_for_request_in_route

std::vector<PDInsertion> PermutationOps::find_all_inserts_for_request_in_route(
    const Solution &sol,
    size_t pickup_id,
    size_t route_id) {
    std::vector<PDInsertion> insertions;
    insertions.reserve(32);

    size_t vn_id = route_id * 2;
    const auto &instance = sol.instance();
    const auto &vehicle = instance.vehicle_from_vn_id(vn_id);

    size_t delivery_id = pickup_id + 1;
    const auto &pickup_node = instance.nodes()[pickup_id];
    const auto &delivery_node = instance.nodes()[delivery_id];

    const auto &fw_data = sol.fw_data();

    size_t pickup_after = vn_id;
    while (pickup_after != vn_id + 1) {
        const auto &before_pickup = fw_data[pickup_after];
        size_t next_after_pickup = before_pickup.succ;

        DistanceAndTime dist_time = instance.distance_and_time(pickup_after, pickup_id);
        if (before_pickup.data.earliest_completion + dist_time.time > pickup_node.due()) {
            pickup_after = next_after_pickup;
            continue;
        }

        auto tmp_data = before_pickup.data;
        tmp_data.extend_forward(fw_data[pickup_id].node, dist_time);

        size_t prev_node = pickup_id;
        size_t delivery_before = next_after_pickup;

        while (prev_node != vn_id + 1) {
            const auto &after_delivery = fw_data[delivery_before];

            DistanceAndTime dist_prev_to_del = instance.distance_and_time(prev_node, delivery_id);

            if (tmp_data.earliest_completion + dist_prev_to_del.time > delivery_node.due()) {
                break;
            }

            auto tmp_after_del = tmp_data;
            tmp_after_del.extend_forward(fw_data[delivery_id].node, dist_prev_to_del);

            DistanceAndTime dist_del_to_next = instance.distance_and_time(delivery_id, delivery_before);
            auto final_data = tmp_after_del;
            final_data.concat(after_delivery.data, dist_del_to_next);

            if (final_data.tw_feasible && vehicle.check_capacity(final_data.max_load)) {
                Num cost_delta = final_data.distance - fw_data[vn_id + 1].data.distance;

                insertions.push_back(PDInsertion{
                    vn_id,
                    pickup_id,
                    pickup_after,
                    delivery_before,
                    cost_delta});
            }

            prev_node = delivery_before;
            delivery_before = after_delivery.succ;
        }

        pickup_after = next_after_pickup;
    }

    std::sort(insertions.begin(), insertions.end(),
              [](const PDInsertion &a, const PDInsertion &b) {
                  return a.cost < b.cost;
              });

    return insertions;
}

// insert - Apply insertion to solution

void PermutationOps::insert(Solution &sol, const PDInsertion &insertion) {
    size_t pickup_id = insertion.pickup_id;
    size_t delivery_id = pickup_id + 1;
    size_t vn_id = insertion.vn_id;
    size_t pickup_after = insertion.pickup_after;
    size_t delivery_before = insertion.delivery_before;

    spdlog::debug("[INSERT] pickup={}, vn={}, after={}, before={}, cost={:.2f}",
                  pickup_id, vn_id, pickup_after, delivery_before, insertion.cost);

    auto [validate_start, validate_end] = sol.relink_when_inserting_pd(
        vn_id, pickup_id, pickup_after, delivery_before);

    sol.unassigned_requests().remove(pickup_id);
    sol.validate_between(validate_start, validate_end);

    spdlog::debug("[INSERT] After validation: cost={:.2f}",
                  sol.objective());
}

// random_shift - Random relocate move

bool PermutationOps::random_shift(Solution &sol, std::mt19937 &rng) {
    std::vector<size_t> assigned_pickups;
    for (size_t req_id = 0; req_id < sol.instance().num_requests(); ++req_id) {
        size_t pickup_id = sol.instance().pickup_id_of_request(req_id);
        if (!sol.unassigned_requests().contains(req_id)) {
            assigned_pickups.push_back(pickup_id);
        }
    }

    if (assigned_pickups.empty()) {
        return false;
    }

    std::uniform_int_distribution<size_t> pickup_dist(0, assigned_pickups.size() - 1);
    size_t pickup_id = assigned_pickups[pickup_dist(rng)];
    size_t vn1_id = sol.vn_id(pickup_id);
    size_t route1_id = vn1_id / 2;

    std::vector<size_t> other_routes;
    for (size_t r_id : sol.iter_route_ids()) {
        if (r_id != route1_id) {
            other_routes.push_back(r_id);
        }
    }

    if (other_routes.empty()) {
        return false;
    }

    std::uniform_int_distribution<size_t> route_dist(0, other_routes.size() - 1);
    size_t target_route_id = other_routes[route_dist(rng)];

    ReservoirSampling sampling;
    sampling = find_random_insert_in_route(sol, pickup_id, target_route_id, rng, sampling);

    auto insertion_opt = sampling.take();
    if (!insertion_opt.has_value()) {
        return false;
    }

    PDInsertion insertion = insertion_opt.value();

    auto [p1_pred, d1_succ] = sol.relink_gap_when_removing_pd(pickup_id);

    size_t delivery_id = pickup_id + 1;
    size_t vn2_id = insertion.vn_id;

    size_t succ_pickup = sol.succ(insertion.pickup_after);
    sol.relink(vn2_id, pickup_id, insertion.pickup_after, succ_pickup);

    size_t pred_delivery = (insertion.delivery_before == succ_pickup)
                               ? pickup_id
                               : sol.pred(insertion.delivery_before);
    sol.relink(vn2_id, delivery_id, pred_delivery, insertion.delivery_before);

    sol.validate_between(p1_pred, d1_succ);
    sol.validate_between(insertion.pickup_after, insertion.delivery_before);

    return true;
}

// random_exchange - DISABLED (requires compute_eject_and_best_insert implementation)
bool PermutationOps::random_exchange(Solution &sol, std::mt19937 &rng) {
    return false;
}

} // namespace pdptw::solution
