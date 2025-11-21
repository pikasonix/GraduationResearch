#include "pdptw/construction/insertion.hpp"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <spdlog/spdlog.h>

#ifdef USE_OPENMP
#include <omp.h>
#endif

namespace pdptw::construction {

size_t Insertion::get_pickup_vn(const PDPTWInstance &instance, size_t request_id) {
    return instance.num_vehicles() * 2 + request_id * 2;
}

size_t Insertion::get_delivery_vn(const PDPTWInstance &instance, size_t request_id) {
    return instance.num_vehicles() * 2 + request_id * 2 + 1;
}

InsertionCandidate Insertion::find_best_insertion(
    const solution::Solution &solution,
    size_t request_id,
    InsertionStrategy strategy) {
    auto candidates = find_all_insertions(solution, request_id);

    if (candidates.empty()) {
        return InsertionCandidate();
    }

    switch (strategy) {
    case InsertionStrategy::BestCost:
    case InsertionStrategy::Sequential:
        return *std::min_element(candidates.begin(), candidates.end());

    case InsertionStrategy::Regret2:
    case InsertionStrategy::Regret3: {
        return *std::min_element(candidates.begin(), candidates.end());
    }
    }

    return InsertionCandidate();
}

Num Insertion::calculate_insertion_cost(
    const solution::Solution &solution,
    size_t request_id,
    [[maybe_unused]] size_t vehicle_id, // Reserved for future capacity/vehicle-specific costs
    size_t pickup_after,
    size_t delivery_after) {
    const auto &instance = solution.instance();

    size_t pickup_vn = get_pickup_vn(instance, request_id);
    size_t delivery_vn = get_delivery_vn(instance, request_id);

    size_t pickup_node = pickup_vn;
    size_t delivery_node = delivery_vn;

    size_t pickup_after_node = pickup_after;
    size_t pickup_before_node = solution.succ(pickup_after);

    size_t delivery_after_node = delivery_after;
    size_t delivery_before_node = solution.succ(delivery_after);

    Num old_cost = 0.0;
    Num new_cost = 0.0;

    old_cost += instance.distance(pickup_after_node, pickup_before_node);
    new_cost += instance.distance(pickup_after_node, pickup_node);
    new_cost += instance.distance(pickup_node, pickup_before_node);

    if (delivery_after != pickup_after && delivery_after != pickup_vn) {
        // Delivery is in a different position
        old_cost += instance.distance(delivery_after_node, delivery_before_node);
        new_cost += instance.distance(delivery_after_node, delivery_node);
        new_cost += instance.distance(delivery_node, delivery_before_node);
    } else if (delivery_after == pickup_vn) {
        // Delivery right after pickup - no edge to remove
        new_cost += instance.distance(pickup_node, delivery_node);
        new_cost += instance.distance(delivery_node, pickup_before_node);
        // Subtract the edge we already added (pickup -> pickup_before)
        new_cost -= instance.distance(pickup_node, pickup_before_node);
    }

    return new_cost - old_cost;
}

bool Insertion::is_feasible_insertion(
    const solution::Solution &solution,
    size_t request_id,
    size_t vehicle_id,
    size_t pickup_after,
    size_t delivery_after) {
    const auto &instance = solution.instance();

    // Get VN IDs
    size_t pickup_vn = get_pickup_vn(instance, request_id);
    [[maybe_unused]] size_t delivery_vn = get_delivery_vn(instance, request_id); // Reserved for future validation

    // Debug logging for first request only
    bool debug_this = (request_id == 0 && vehicle_id == 0 && pickup_after == 0);

    // Check precedence: delivery must be inserted after pickup
    // After insertion:
    //   - pickup will be inserted after pickup_after
    //   - delivery will be inserted after delivery_after
    //
    // Valid cases for precedence:
    //   1. delivery_after == pickup_after
    //      → Both at same position, pickup inserted first, then delivery
    //   2. delivery_after == pickup_vn
    //      → Delivery right after the newly inserted pickup
    //   3. delivery_after is reachable from pickup_after in the current route
    //      → Delivery will be after pickup in final route

    bool pickup_before_delivery = false;

    if (delivery_after == pickup_after) {
        // Case 1: Same insertion position - pickup will be first
        pickup_before_delivery = true;
    } else if (delivery_after == pickup_vn) {
        // Case 2: Delivery right after pickup (special case, pickup not yet inserted)
        // This case handled during actual insertion
        pickup_before_delivery = true;
    } else {
        // Case 3: Walk from pickup_after to see if we can reach delivery_after
        size_t current = pickup_after;
        int max_steps = 300; // Safety limit to avoid infinite loop
        int steps = 0;

        while (current != 0 && steps < max_steps) {
            if (current == delivery_after) {
                pickup_before_delivery = true;
                break;
            }
            current = solution.succ(current);
            steps++;

            // Check if we've reached end of route (depot_end)
            size_t depot_end = vehicle_id * 2 + 1;
            if (current == depot_end) {
                break;
            }
        }
    }

    if (!pickup_before_delivery) {
        if (debug_this) {
            spdlog::debug("Request {}: Precedence check FAILED (pickup_after={}, delivery_after={})",
                          request_id, pickup_after, delivery_after);
        }
        return false;
    }

    // Check capacity constraints
    const auto &pickup_node = instance.nodes()[instance.num_vehicles() * 2 + request_id * 2];

    // Simple capacity check - in real implementation, would use REF data
    // For now, just check if demand is within vehicle capacity
    // Use absolute value since delivery demand is negative
    if (std::abs(pickup_node.demand()) > instance.vehicles()[vehicle_id].seats()) {
        if (debug_this) {
            spdlog::debug("Request {}: Capacity check FAILED (demand={}, capacity={})",
                          request_id, std::abs(pickup_node.demand()),
                          instance.vehicles()[vehicle_id].seats());
        }
        return false;
    }

    if (debug_this) {
        spdlog::debug("Request {}: Basic checks PASSED (pickup_after={}, delivery_after={})",
                      request_id, pickup_after, delivery_after);
    }

    // TIME WINDOW CHECK using REF forward/backward

    const auto &vehicle = instance.vehicles()[vehicle_id];
    const auto &pickup = instance.nodes()[pickup_vn];
    const auto &delivery = instance.nodes()[delivery_vn];

    // Convert to REFNodes
    refn::REFNode ref_pickup(pickup);
    refn::REFNode ref_delivery(delivery);

    // Get REF data at pickup insertion point
    const auto &before_pickup = solution.fw_data()[pickup_after];

    // Check if we can reach pickup in time from pickup_after
    auto dist_time_to_pickup = instance.distance_and_time(pickup_after, pickup_vn);
    if (before_pickup.data.earliest_completion + dist_time_to_pickup.time > pickup.due()) {
        if (debug_this) {
            spdlog::debug("Request {}: Cannot reach pickup in time", request_id);
        }
        return false;
    }

    // Extend forward from pickup_after to pickup
    refn::REFData tmp;
    before_pickup.data.extend_forward_into_target(ref_pickup, tmp, dist_time_to_pickup);

    // Check capacity after picking up
    if (!vehicle.check_capacity(tmp.current_load)) {
        if (debug_this) {
            spdlog::debug("Request {}: Capacity exceeded after pickup", request_id);
        }
        return false;
    }

    // check delivery positions - iterate forward from pickup
    size_t delivery_before = solution.succ(delivery_after);
    size_t current = solution.succ(pickup_after);
    size_t depot_end = vehicle_id * 2 + 1;

    while (current != delivery_before && current != depot_end) {
        const auto &next_node = instance.nodes()[current];
        refn::REFNode ref_next(next_node);

        auto dist_time = instance.distance_and_time(
            current == solution.succ(pickup_after) ? pickup_vn : solution.pred(current),
            current);

        refn::REFData new_tmp;
        tmp.extend_forward_into_target(ref_next, new_tmp, dist_time);
        tmp = new_tmp;

        // Check if still feasible
        if (!tmp.tw_feasible || !vehicle.check_capacity(tmp.current_load)) {
            if (debug_this) {
                spdlog::debug("Request {}: Route infeasible while reaching delivery position", request_id);
            }
            return false;
        }

        current = solution.succ(current);
    }

    // Try inserting delivery at delivery_before position
    auto dist_time_to_delivery = instance.distance_and_time(
        delivery_after == pickup_after ? pickup_vn : delivery_after,
        delivery_vn);
    auto dist_time_from_delivery = instance.distance_and_time(delivery_vn, delivery_before);

    // Extend to delivery
    refn::REFData tmp_with_delivery;
    tmp.extend_forward_into_target(ref_delivery, tmp_with_delivery, dist_time_to_delivery);

    // Concat with backward data
    refn::REFData new_route_data;
    tmp_with_delivery.concat_into_target(
        solution.bw_data()[delivery_before].data,
        new_route_data,
        dist_time_from_delivery);

    // Final feasibility check for complete route
    if (!new_route_data.tw_feasible || !vehicle.check_capacity(new_route_data.max_load)) {
        if (debug_this) {
            spdlog::debug("Request {}: Final route check FAILED", request_id);
        }
        return false;
    }

    if (debug_this) {
        spdlog::debug("Request {}: ALL checks PASSED including time windows", request_id);
    }

    return true;
}

void Insertion::insert_request(
    solution::Solution &solution,
    const InsertionCandidate &candidate) {
    if (!candidate.feasible) {
        return; // Cannot insert infeasible candidate
    }

    const auto &instance = solution.instance();

    // Get node IDs
    size_t pickup_id = get_pickup_vn(instance, candidate.request_id);
    size_t delivery_id = pickup_id + 1;

    size_t vn_id = solution.vn_id(candidate.pickup_after);

    // delivery_before corresponds to the node that should follow the delivery
    size_t delivery_before = solution.succ(candidate.delivery_after);

    // Use Solution helper to keep forward/backward links consistent
    auto [validate_start, validate_end] = solution.relink_when_inserting_pd(
        vn_id,
        pickup_id,
        candidate.pickup_after,
        delivery_before);

    // Remove from unassigned requests
    solution.unassigned_requests().remove(pickup_id);

    // Validate route segment
    solution.validate_between(validate_start, validate_end);
    // Double-check precedence
    bool found_delivery = false;
    size_t current = pickup_id;
    size_t safety = 0;
    const size_t MAX_WALK = static_cast<size_t>(instance.num_requests() * 2 + 10);

    std::vector<size_t> walk_path; // For debugging

    while (safety++ < MAX_WALK) {
        walk_path.push_back(current);
        if (current == delivery_id) {
            found_delivery = true;
            break;
        }
        size_t next = solution.succ(current);
        if (next == vn_id + 1 || next == current) { // Reached depot end or cycle
            break;
        }
        current = next;
    }

    if (!found_delivery) {
        spdlog::error("PRECEDENCE VIOLATION after insert_request!");
        spdlog::error("  Request {}: pickup={}, delivery={}", candidate.request_id, pickup_id, delivery_id);
        spdlog::error("  Insertion: pickup_after={}, delivery_after={}", candidate.pickup_after, candidate.delivery_after);
        spdlog::error("  Calculated: delivery_before={}", delivery_before);

        // Print walk path
        std::string path_str;
        for (size_t node : walk_path) {
            path_str += std::to_string(node) + " -> ";
        }
        spdlog::error("  Walk path: {}", path_str);

        throw std::runtime_error("Precedence violation detected immediately after insertion!");
    }
}

std::vector<InsertionCandidate> Insertion::calculate_regret(
    const solution::Solution &solution,
    const std::vector<size_t> &unassigned_requests,
    size_t k) {
    std::vector<InsertionCandidate> regret_candidates;

    for (size_t request_id : unassigned_requests) {
        // Find all feasible insertions for this request
        auto candidates = find_all_insertions(solution, request_id);

        if (candidates.empty()) {
            // No feasible insertion - create infeasible candidate with high regret
            InsertionCandidate inf_candidate;
            inf_candidate.request_id = request_id;
            inf_candidate.regret_value = std::numeric_limits<Num>::infinity();
            regret_candidates.push_back(inf_candidate);
            continue;
        }

        // Sort by cost
        std::sort(candidates.begin(), candidates.end());

        // Calculate regret: difference between best and k-th best
        Num regret = 0.0;
        if (candidates.size() >= k) {
            regret = candidates[k - 1].cost_increase - candidates[0].cost_increase;
        } else if (candidates.size() > 1) {
            // Less than k candidates - use last available
            regret = candidates.back().cost_increase - candidates[0].cost_increase;
        } else {
            // Only one candidate - regret is 0 (no alternative)
            regret = 0.0;
        }

        // Take best candidate and set its regret value
        InsertionCandidate best = candidates[0];
        best.regret_value = regret;
        regret_candidates.push_back(best);
    }

    return regret_candidates;
}

std::vector<InsertionCandidate> Insertion::find_all_insertions(
    const solution::Solution &solution,
    size_t request_id) {
    std::vector<InsertionCandidate> candidates;
    const auto &instance = solution.instance();

    size_t total_checks = 0;
    size_t feasible_checks = 0;

    // Calculate max iterations based on instance size to prevent infinite loops
    // Max nodes in a route = 2 (depots) + num_requests * 2 (pickup+delivery pairs)
    // Add buffer of 10 for safety
    const size_t MAX_NODES_IN_ROUTE = instance.num_requests() * 2 + 12;

#ifdef USE_OPENMP
    // Parallel version: each thread collects candidates independently
    std::vector<std::vector<InsertionCandidate>> thread_candidates;
    std::vector<size_t> thread_total_checks;
    std::vector<size_t> thread_feasible_checks;

    // OpenMP requires signed integral type for loop variable
    int num_vehicles = static_cast<int>(instance.num_vehicles());

#pragma omp parallel
    {
        std::vector<InsertionCandidate> local_candidates;
        size_t local_total_checks = 0;
        size_t local_feasible_checks = 0;

#pragma omp for schedule(dynamic) nowait
        for (int v_int = 0; v_int < num_vehicles; ++v_int) {
            size_t v = static_cast<size_t>(v_int);
            size_t depot_start = v * 2;
            size_t depot_end = v * 2 + 1;

            // Try all positions for pickup
            size_t pickup_after = depot_start;
            size_t pickup_iterations = 0;

            while (pickup_after != depot_end && pickup_iterations < MAX_NODES_IN_ROUTE) {
                pickup_iterations++;

                // Try all positions for delivery (must be after pickup)
                size_t delivery_after = pickup_after;
                size_t delivery_iterations = 0;

                while (delivery_after != depot_end && delivery_iterations < MAX_NODES_IN_ROUTE) {
                    delivery_iterations++;
                    local_total_checks++;

                    // Check feasibility
                    if (is_feasible_insertion(solution, request_id, v,
                                              pickup_after, delivery_after)) {
                        local_feasible_checks++;

                        // Calculate cost
                        Num cost = calculate_insertion_cost(solution, request_id, v,
                                                            pickup_after, delivery_after);

                        local_candidates.emplace_back(request_id, v,
                                                      pickup_after, delivery_after,
                                                      cost, true);
                    }

                    // Move to next delivery position
                    delivery_after = solution.succ(delivery_after);
                }

                if (delivery_iterations >= MAX_NODES_IN_ROUTE) {
#pragma omp critical
                    spdlog::warn("Possible cycle detected in find_all_insertions: vehicle {} hit max delivery iterations ({})",
                                 v, MAX_NODES_IN_ROUTE);
                }

                // Move to next pickup position
                pickup_after = solution.succ(pickup_after);
            }

            if (pickup_iterations >= MAX_NODES_IN_ROUTE) {
#pragma omp critical
                spdlog::warn("Possible cycle detected in find_all_insertions: vehicle {} hit max pickup iterations ({})",
                             v, MAX_NODES_IN_ROUTE);
            }
        }

// Collect results from all threads
#pragma omp critical
        {
            thread_candidates.push_back(std::move(local_candidates));
            thread_total_checks.push_back(local_total_checks);
            thread_feasible_checks.push_back(local_feasible_checks);
        }
    }

    // Merge results from all threads
    for (const auto &tc : thread_candidates) {
        candidates.insert(candidates.end(), tc.begin(), tc.end());
    }
    for (size_t count : thread_total_checks) {
        total_checks += count;
    }
    for (size_t count : thread_feasible_checks) {
        feasible_checks += count;
    }
#else
    // Serial version (original code)
    // Try all vehicles
    for (size_t v = 0; v < instance.num_vehicles(); ++v) {
        size_t depot_start = v * 2;
        size_t depot_end = v * 2 + 1;

        // Try all positions for pickup
        size_t pickup_after = depot_start;
        size_t pickup_iterations = 0;

        while (pickup_after != depot_end && pickup_iterations < MAX_NODES_IN_ROUTE) {
            pickup_iterations++;

            // Try all positions for delivery (must be after pickup)
            size_t delivery_after = pickup_after;
            size_t delivery_iterations = 0;

            while (delivery_after != depot_end && delivery_iterations < MAX_NODES_IN_ROUTE) {
                delivery_iterations++;
                total_checks++;

                // Check feasibility
                if (is_feasible_insertion(solution, request_id, v,
                                          pickup_after, delivery_after)) {
                    feasible_checks++;

                    // Calculate cost
                    Num cost = calculate_insertion_cost(solution, request_id, v, pickup_after, delivery_after);

                    candidates.emplace_back(request_id, v, pickup_after, delivery_after, cost, true);
                }

                // Move to next delivery position
                delivery_after = solution.succ(delivery_after);
            }

            if (delivery_iterations >= MAX_NODES_IN_ROUTE) {
                spdlog::warn("Possible cycle detected in find_all_insertions: vehicle {} hit max delivery iterations ({})", v, MAX_NODES_IN_ROUTE);
            }

            // Move to next pickup position
            pickup_after = solution.succ(pickup_after);
        }

        if (pickup_iterations >= MAX_NODES_IN_ROUTE) {
            spdlog::warn("Possible cycle detected in find_all_insertions: vehicle {} hit max pickup iterations ({})", v, MAX_NODES_IN_ROUTE);
        }
    }
#endif

    if (request_id == 0) { // Only log for first request to avoid spam
        spdlog::debug("Request {}: Checked {} positions, {} feasible, {} candidates found", request_id, total_checks, feasible_checks, candidates.size());
    }

    return candidates;
}

} // namespace pdptw::construction