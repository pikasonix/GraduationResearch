/**
 * Dummy Node Cleaner
 * 
 * Post-processes solver output to remove dummy/ghost nodes and extract
 * metadata for route persistence (start_time, initial_load)
 */

import type {
    MappingIdExtended,
    DummyNode,
    CleanedRoute,
} from '../types/reoptimization';

export interface RawRoute {
    route_number: number;
    node_sequence: number[]; // Includes dummy nodes
}

export interface CleanupResult {
    cleaned_routes: CleanedRoute[];
    removed_dummy_count: number;
    removed_ghost_count: number;
}

export type { CleanedRoute };

/**
 * Clean solver output by removing dummy/ghost nodes and extracting metadata
 * 
 * @param rawRoutes - Routes from solver output (e.g., "Route 1: 0 49 50 1 2 3 0")
 * @param mappingIds - Node metadata including dummy node flags
 * @param dummyNodes - Dummy node details for extracting start_time and initial_load
 * @returns Cleaned routes with only real customer stops
 */
export function cleanDummyNodes(
    rawRoutes: RawRoute[],
    mappingIds: MappingIdExtended[],
    dummyNodes: DummyNode[]
): CleanupResult {
    const cleaned_routes: CleanedRoute[] = [];
    let removed_dummy_count = 0;
    let removed_ghost_count = 0;

    for (const rawRoute of rawRoutes) {
        let start_time: number | undefined;
        let initial_load = 0;
        let vehicle_id: string | undefined;
        const real_stops: CleanedRoute['real_stops'] = [];

        const filteredSequence: number[] = [];

        for (const nodeIndex of rawRoute.node_sequence) {
            const mapping = mappingIds[nodeIndex];
            const dummyNode = dummyNodes.find(d => d.node_index === nodeIndex);

            if (!mapping) {
                console.warn(`Node ${nodeIndex} not found in mapping_ids`);
                continue;
            }

            // Handle depot (skip depot nodes in route)
            if (mapping.kind === 'depot') {
                // Skip depot nodes (typically at start and end)
                continue;
            }

            // Handle dummy nodes (dummy_start or any node with is_dummy=true)
            if (mapping.kind === 'dummy_start' || (mapping.is_dummy && mapping.order_id?.startsWith('DUMMY_'))) {
                removed_dummy_count++;
                vehicle_id = mapping.vehicle_id;
                
                if (dummyNode) {
                    // Extract start time from dummy node's ready_time
                    start_time = dummyNode.ready_time;
                }
                
                // Skip adding to filtered sequence
                continue;
            }

            // Handle ghost pickup node (is_dummy but not DUMMY_ prefix, or explicit ghost_pickup kind)
            if (mapping.kind === 'ghost_pickup' || (mapping.is_dummy && !mapping.order_id?.startsWith('DUMMY_'))) {
                removed_ghost_count++;
                
                if (dummyNode) {
                    // Extract initial load from ghost pickup demand
                    initial_load += dummyNode.demand || 0;
                }
                
                // Skip adding to filtered sequence
                continue;
            }

            // Add real customer stops (pickup/delivery)
            if (mapping.kind === 'pickup' || mapping.kind === 'delivery') {
                filteredSequence.push(nodeIndex);
                
                real_stops.push({
                    node_index: nodeIndex,
                    order_id: mapping.order_id!,
                    location_id: mapping.location_id!,
                    stop_type: mapping.kind,
                    lat: mapping.lat,
                    lng: mapping.lng,
                });
            }
        }

        // Only add route if it has real stops
        if (real_stops.length > 0) {
            cleaned_routes.push({
                vehicle_id: vehicle_id || `unknown-vehicle-${rawRoute.route_number}`,
                route_number: rawRoute.route_number,
                node_sequence: filteredSequence,
                start_time,
                initial_load: initial_load > 0 ? initial_load : undefined,
                real_stops,
            });
        }
    }

    return {
        cleaned_routes,
        removed_dummy_count,
        removed_ghost_count,
    };
}

/**
 * Parse solver output text into raw routes
 * Expected format: "Route 1: 0 49 50 1 2 3 0"
 */
export function parseSolverOutput(solutionText: string): RawRoute[] {
    const routes: RawRoute[] = [];
    const lines = solutionText.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('Route')) continue;

        // Extract route number and node sequence
        const match = trimmed.match(/Route\s+(\d+)\s*:\s*(.+)/);
        if (!match) continue;

        const routeNumber = parseInt(match[1], 10);
        const nodeSequence = match[2]
            .trim()
            .split(/\s+/)
            .map(n => parseInt(n, 10))
            .filter(n => !isNaN(n));

        if (nodeSequence.length > 0) {
            routes.push({
                route_number: routeNumber,
                node_sequence: nodeSequence,
            });
        }
    }

    return routes;
}

/**
 * Validate that ghost pickup nodes have corresponding delivery nodes
 * This prevents orphaned loads (picked orders with no delivery)
 */
export function validateGhostPickups(
    dummyNodes: DummyNode[],
    mappingIds: MappingIdExtended[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const dummyNode of dummyNodes) {
        if (dummyNode.node_type !== 'ghost_pickup') continue;
        if (!dummyNode.original_order_ids || dummyNode.original_order_ids.length === 0) continue;

        // Check each picked order has a delivery node
        for (const orderId of dummyNode.original_order_ids) {
            const hasDelivery = mappingIds.some(
                m => m.kind === 'delivery' && m.order_id === orderId
            );

            if (!hasDelivery) {
                errors.push(
                    `Ghost pickup for vehicle ${dummyNode.vehicle_id} references order ${orderId} ` +
                    `which has no delivery node in the instance`
                );
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Calculate route metrics after cleanup (for validation)
 */
export function calculateCleanedRouteMetrics(cleanedRoute: CleanedRoute): {
    total_stops: number;
    pickup_count: number;
    delivery_count: number;
} {
    const pickup_count = cleanedRoute.real_stops.filter(s => s.stop_type === 'pickup').length;
    const delivery_count = cleanedRoute.real_stops.filter(s => s.stop_type === 'delivery').length;

    return {
        total_stops: cleanedRoute.real_stops.length,
        pickup_count,
        delivery_count,
    };
}
