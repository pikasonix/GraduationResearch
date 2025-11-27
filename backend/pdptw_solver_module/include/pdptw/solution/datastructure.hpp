#pragma once

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/refn/ref_data.hpp"
#include "pdptw/solution/blocknode.hpp"
#include "pdptw/solution/ref_node_vec.hpp"
#include "pdptw/solution/requestbank.hpp"
#include <memory>
#include <unordered_map>
#include <vector>

/**
 * @file datastructure.hpp
 * @brief Core solution data structures for PDPTW
 *
 * This file contains the main Solution class which represents a complete
 * solution to the PDPTW problem, including route structures and REF data.
 *
 * @namespace pdptw::solution
 */

namespace pdptw::solution {

// Forward declarations
class SolutionDescription;

using NodeId = size_t;
using RouteId = size_t;
using PDPTWInstance = pdptw::problem::PDPTWInstance;
using REFData = pdptw::refn::REFData;

/**
 * @brief Update bounds for partial route updates
 *
 * Specifies the boundaries for updating REF data when modifying a route.
 * Used to optimize updates by only recalculating necessary portions.
 */
struct UpdateBounds {
    size_t vn;         ///< Vehicle node ID (start of route)
    size_t pred_first; ///< Predecessor of first modified node
    size_t succ_last;  ///< Successor of last modified node

    /**
     * @brief Create bounds for complete route update
     * @param vn Vehicle node ID
     * @return UpdateBounds covering entire route
     */
    static UpdateBounds complete_route(size_t vn) {
        return UpdateBounds{vn, vn, vn + 1};
    }
};

/**
 * @brief Complete solution for PDPTW problem
 *
 * Represents a complete solution to the Pickup and Delivery Problem with Time Windows.
 * The solution maintains:
 * - Forward and backward REF data for all nodes
 * - Block structures for efficient insertion/removal
 * - Tracking of unassigned requests
 * - Route feasibility and cost information
 *
 * Node IDs follow the structure:
 * - Vehicle nodes: 0, 1 (veh 0), 2, 3 (veh 1), ...
 * - Pickup/Delivery pairs: (2*v_count + 2*r), (2*v_count + 2*r + 1)
 */
class Solution {
public:
    /**
     * @brief Construct empty solution for given instance
     * @param instance PDPTW problem instance
     */
    explicit Solution(const PDPTWInstance &instance);

    // ============================================================
    // Basic accessors
    // ============================================================

    /**
     * @brief Get the problem instance
     * @return Reference to PDPTWInstance
     */
    const PDPTWInstance &instance() const { return *instance_; }

    /**
     * @brief Get forward REF data
     * @return Reference to forward REFNodeVec
     */
    const REFNodeVec &fw_data() const { return fw_data_; }
    REFNodeVec &fw_data() { return fw_data_; }

    /**
     * @brief Get backward REF data
     * @return Reference to backward REFNodeVec
     */
    const REFNodeVec &bw_data() const { return bw_data_; }
    REFNodeVec &bw_data() { return bw_data_; }

    /**
     * @brief Get block structures
     * @return Reference to BlockNodes
     */
    const BlockNodes &blocks() const { return blocks_; }
    BlockNodes &blocks() { return blocks_; }

    /**
     * @brief Get unassigned requests tracker
     * @return Reference to RequestBank
     */
    const RequestBank &unassigned_requests() const { return unassigned_requests_; }
    RequestBank &unassigned_requests() { return unassigned_requests_; }

    /**
     * @brief Check if route is empty
     * @param route_id Route index (0-based)
     * @return true if route has no customer nodes
     */
    bool is_route_empty(size_t route_id) const;

    /**
     * @brief Get number of empty routes
     * @return Count of routes with no customers
     */
    size_t num_empty_routes() const;

    // ============================================================
    // Node navigation
    // ============================================================

    /**
     * @brief Get predecessor of a node
     * @param node_id Node ID
     * @return ID of predecessor node
     */
    size_t pred(size_t node_id) const;

    /**
     * @brief Get successor of a node
     * @param node_id Node ID
     * @return ID of successor node
     */
    size_t succ(size_t node_id) const;

    /**
     * @brief Get predecessor and successor pair
     * @param node_id Node ID
     * @return Pair (predecessor, successor)
     */
    std::pair<size_t, size_t> pred_succ_pair(size_t node_id) const;

    /**
     * @brief Get vehicle node ID for a node
     * @param node_id Node ID
     * @return Vehicle node ID (start of route)
     */
    size_t vn_id(size_t node_id) const;

    // ============================================================
    // Solution modification
    // ============================================================

    /**
     * @brief Clear all routes (reset to empty solution)
     */
    void clear();

    /**
     * @brief Set solution from itineraries
     * @param itineraries Vector of routes (each route is vector of node IDs)
     *
     * Each itinerary should start with vehicle node and end with vehicle+1.
     * Example: [0, 10, 12, 11, 13, 1] for vehicle 0
     */
    void set(const std::vector<std::vector<size_t>> &itineraries);

    /**
     * @brief Update route sequence (assumes nodes don't change)
     * @param route Vector of node IDs in new order
     */
    void update_route_sequence(const std::vector<size_t> &route);

    /**
     * @brief Relink a node with new predecessor/successor
     * @param vn_id Vehicle node ID
     * @param node_id Node to relink
     * @param pred New predecessor
     * @param succ New successor
     */
    void relink(size_t vn_id, size_t node_id, size_t pred, size_t succ);

    /**
     * @brief Link two nodes directly
     * @param n1 First node
     * @param n2 Second node (becomes successor of n1)
     */
    void link_nodes(size_t n1, size_t n2);

    /**
     * @brief Relink when inserting pickup-delivery pair
     * @param vn_id Vehicle node ID
     * @param pickup_id Pickup node ID
     * @param pickup_after Node after which pickup is inserted
     * @param delivery_before Node before which delivery is inserted
     * @return Pair of (pickup_after, delivery_before) for validation
     *
     * Handles two cases:
     * 1. Pickup and delivery consecutive: pickup -> delivery
     * 2. Pickup and delivery separated: pickup -> ... -> delivery
     */
    std::pair<size_t, size_t> relink_when_inserting_pd(
        size_t vn_id,
        size_t pickup_id,
        size_t pickup_after,
        size_t delivery_before);

    /**
     * @brief Relink gap when removing a node
     * @param node Node ID being removed
     * @return Pair (predecessor, successor) for validation
     */
    std::pair<size_t, size_t> relink_gap_when_removing_node(size_t node);

    /**
     * @brief Relink gap when removing pickup-delivery pair
     * @param pickup_id Pickup node ID (delivery is pickup_id + 1)
     * @return Pair (pred of pickup, succ of delivery) for validation
     */
    std::pair<size_t, size_t> relink_gap_when_removing_pd(size_t pickup_id);

    /**
     * @brief Track a request as unassigned without modifying neighbours
     * @param pickup_id Pickup node ID to track
     */
    void track_request_unassigned(size_t pickup_id);

    /**
     * @brief Remove a pickup-delivery pair from its current route
     * @param pickup_id Pickup node ID
     */
    void unassign_request(size_t pickup_id);

    // ============================================================
    // REF data validation
    // ============================================================

    /**
     * @brief Validate REF data between two nodes
     * @param pickup_after Start node
     * @param delivery_before End node
     */
    void validate_between(size_t pickup_after, size_t delivery_before);

    /**
     * @brief Partially validate REF data with bounds
     * @param first First node to update
     * @param last Last node to update
     * @param bounds Update boundaries
     */
    void partially_validate_between(
        size_t first,
        size_t last,
        const UpdateBounds &bounds);

    /**
     * @brief Revalidate all blocks for a route
     * @param vn_id Vehicle node ID
     */
    void revalidate_blocks(size_t vn_id);

    // ============================================================
    // Route feasibility and metrics
    // ============================================================

    /**
     * @brief Check if a route is time-window feasible
     * @param route_id Route index
     * @return true if route satisfies all time windows
     */
    bool is_route_feasible(size_t route_id) const;

    /**
     * @brief Calculate total travel distance/cost
     * @return Sum of distances across all routes
     */
    double total_cost() const;

    /**
     * @brief Calculate total waiting time
     * @return Sum of waiting time at all nodes
     */
    double total_waiting_time() const;

    /**
     * @brief Calculate solution objective value
     * @return Total cost + penalty for unassigned requests
     */
    double objective() const;

    /**
     * @brief Count non-empty routes currently in use
     * @return Number of routes that contain at least one pickup/delivery
     */
    size_t number_of_non_empty_routes() const;

    // ============================================================
    // Route iteration
    // ============================================================

    /**
     * @brief Extract itinerary and REF data for a route
     * @param route_id Route index
     * @return Pair (node IDs vector, REF data for route end)
     */
    std::pair<std::vector<size_t>, REFData> extract_itinerary_and_data(size_t route_id) const;

    /**
     * @brief Iterate through nodes in a route
     * @param vn_id Vehicle node ID
     * @return Vector of node IDs in route (excluding vehicle nodes)
     */
    std::vector<size_t> iter_route_by_vn_id(size_t vn_id) const;

    /**
     * @brief Iterate through all route IDs
     * @return Vector of route indices (0 to num_vehicles-1)
     */
    std::vector<size_t> iter_route_ids() const;

    /**
     * @brief Iterate through empty route IDs
     * @return Vector of empty route indices
     */
    std::vector<size_t> iter_empty_route_ids() const;

    /**
     * @brief Iterate through nodes in route by route ID
     * @param route_id Route index (0-based)
     * @return Vector of node IDs in route
     */
    std::vector<size_t> iter_route(size_t route_id) const;

    // ============================================================
    // Solution state management
    // ============================================================

    /**
     * @brief Restore solution from description
     * @param desc Solution description with saved state
     *
     * Restores the solution to a previously saved state
     * by setting routes from the description's itineraries.
     */
    void set_with(const SolutionDescription &desc);

    /**
     * @brief Unassign all requests in a complete route
     * @param route_id Route index to unassign
     *
     * Moves all pickup-delivery pairs in the route to
     * the unassigned requests bank and empties the route.
     */
    void unassign_complete_route(size_t route_id);

    /**
     * @brief Reduce maximum available vehicles to current usage
     *
     * Sets max_num_vehicles_available to the number of
     * non-empty routes currently in use. This is used
     * in fleet minimization to progressively reduce fleet size.
     */
    void clamp_max_number_of_vehicles_to_current_fleet_size();

    /**
     * @brief Set maximum number of vehicles available
     * @param max Maximum vehicles to allow (prevents using higher-numbered routes)
     */
    void set_max_num_vehicles_available(size_t max) { max_num_vehicles_available_ = max; }

    /**
     * @brief Create solution description for current state
     * @return SolutionDescription with current metrics
     */
    SolutionDescription to_description() const;

    // ============================================================
    // Cache lookup methods (O(1) operations)
    // ============================================================

    /**
     * @brief Get route ID for a node (O(1))
     * @param node_id Node ID to lookup
     * @return Route ID if found, otherwise searches linearly (fallback)
     */
    size_t route_of_node(size_t node_id) const;

    /**
     * @brief Get route ID for a request (O(1))
     * @param request_id Request ID to lookup
     * @return Route ID if request is assigned
     * @throws std::runtime_error if request is unassigned
     */
    size_t route_of_request(size_t request_id) const;

    /**
     * @brief Check if a request is assigned (O(1))
     * @param request_id Request ID to check
     * @return true if request is currently assigned to a route
     */
    bool is_request_assigned(size_t request_id) const;

private:
    // Cache management
    void update_cache_on_insert(size_t pickup_id, size_t delivery_id, size_t route_id);
    void update_cache_on_remove(size_t pickup_id, size_t delivery_id);
    void rebuild_cache();

    const PDPTWInstance *instance_; ///< Problem instance

    REFNodeVec fw_data_; ///< Forward REF data
    REFNodeVec bw_data_; ///< Backward REF data
    BlockNodes blocks_;  ///< Block structures

    std::vector<bool> empty_route_ids_; ///< Tracks empty routes
    RequestBank unassigned_requests_;   ///< Unassigned requests

    size_t max_num_vehicles_available_; ///< Maximum vehicles
    size_t num_requests_;               ///< Number of requests

    // ============================================================
    // CACHING STRUCTURES
    // ============================================================

    struct RequestAssignment {
        size_t route_id;
        size_t pickup_position; // Position in route iteration
        size_t delivery_position;
    };

    std::unordered_map<size_t, size_t> node_to_route_;                  ///< O(1) lookup: node_id -> route_id
    std::unordered_map<size_t, RequestAssignment> request_assignments_; ///< O(1) lookup: request_id -> assignment
};

} // namespace pdptw::solution
