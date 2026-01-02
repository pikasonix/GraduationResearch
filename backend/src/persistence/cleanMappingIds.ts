/**
 * Clean Mapping IDs
 * 
 * Creates a new mapping_ids array without dummy nodes and re-indexes
 * route sequences to use the new indices.
 */

import type { MappingIdExtended, CleanedRoute } from '../types/reoptimization';

export interface CleanedMappingResult {
    cleanedMappingIds: MappingIdExtended[];
    reindexedRoutes: CleanedRoute[];
    oldToNewIndexMap: Map<number, number>;
}

/**
 * Build cleaned mapping_ids without dummy nodes and re-index routes
 * 
 * Original mapping_ids structure (with dummies):
 * - 0: depot
 * - 1: dummy_start (vehicle 1)
 * - 2: ghost_pickup (vehicle 1) 
 * - 3: dummy_start (vehicle 2)
 * - 4: ghost_pickup (vehicle 2)
 * - 5..N: pickup/delivery nodes
 * 
 * Cleaned mapping_ids structure:
 * - 0: depot
 * - 1..M: pickup/delivery nodes (re-indexed)
 * 
 * @param originalMappingIds - Original mapping IDs including dummy nodes
 * @param cleanedRoutes - Routes with dummy nodes already filtered out
 * @returns Cleaned mapping IDs and re-indexed routes
 */
export function buildCleanedMappingIds(
    originalMappingIds: MappingIdExtended[],
    cleanedRoutes: CleanedRoute[]
): CleanedMappingResult {
    // Build new mapping_ids array without dummy nodes
    const cleanedMappingIds: MappingIdExtended[] = [];
    const oldToNewIndexMap = new Map<number, number>();
    
    let newIndex = 0;
    
    for (let oldIndex = 0; oldIndex < originalMappingIds.length; oldIndex++) {
        const mapping = originalMappingIds[oldIndex];
        
        // Skip dummy nodes
        if (mapping.kind === 'dummy_start' || mapping.kind === 'ghost_pickup') {
            continue;
        }
        
        // Add to cleaned array and record mapping
        cleanedMappingIds.push(mapping);
        oldToNewIndexMap.set(oldIndex, newIndex);
        newIndex++;
    }
    
    // Re-index route sequences
    const reindexedRoutes: CleanedRoute[] = cleanedRoutes.map(route => {
        const oldSequence = route.node_sequence;
        const newSequence = route.node_sequence
            .map(oldNodeIndex => oldToNewIndexMap.get(oldNodeIndex))
            .filter((idx): idx is number => idx !== undefined);
        
        // DEBUG: Log re-indexing
        console.log(`[cleanMappingIds] Route ${route.route_number} old sequence (first 5):`, oldSequence.slice(0, 5));
        console.log(`[cleanMappingIds] Route ${route.route_number} new sequence (first 5):`, newSequence.slice(0, 5));
        console.log(`[cleanMappingIds] Old to new mapping sample: 3->${oldToNewIndexMap.get(3)}, 4->${oldToNewIndexMap.get(4)}, 5->${oldToNewIndexMap.get(5)}`);
        
        // Also update real_stops node indices
        const updatedRealStops = route.real_stops.map(stop => ({
            ...stop,
            node_index: oldToNewIndexMap.get(stop.node_index) ?? stop.node_index,
        }));
        
        return {
            ...route,
            node_sequence: newSequence,
            real_stops: updatedRealStops,
        };
    });
    
    console.log(`[cleanMappingIds] Original: ${originalMappingIds.length} nodes, Cleaned: ${cleanedMappingIds.length} nodes`);
    console.log(`[cleanMappingIds] Removed ${originalMappingIds.length - cleanedMappingIds.length} dummy nodes`);
    
    return {
        cleanedMappingIds,
        reindexedRoutes,
        oldToNewIndexMap,
    };
}
