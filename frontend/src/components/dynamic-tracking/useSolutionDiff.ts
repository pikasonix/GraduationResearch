"use client";

import { useMemo } from 'react';
import type {
    SolutionDiff,
    TimelineNode,
    MetricsChange,
    OrderReassignment,
    RouteModification,
    VehicleUtilizationChange,
    Route
} from '@/utils/dataModels';

/**
 * Computes the difference between two solutions in a timeline
 */
export function useSolutionDiff(fromNode: TimelineNode | null, toNode: TimelineNode | null): SolutionDiff | null {
    return useMemo(() => {
        if (!fromNode || !toNode) return null;

        const fromMeta = fromNode.metadata;
        const toMeta = toNode.metadata;
        const fromSolution = fromNode.solution;
        const toSolution = toNode.solution;

        // Calculate metrics changes
        const metricsChange: MetricsChange = {
            totalCost: toMeta.total_cost - fromMeta.total_cost,
            totalDistance: toMeta.total_distance_km - fromMeta.total_distance_km,
            totalTime: toMeta.total_time_hours - fromMeta.total_time_hours,
            vehiclesUsed: toMeta.total_vehicles_used - fromMeta.total_vehicles_used,
            costPercent: fromMeta.total_cost > 0 
                ? ((toMeta.total_cost - fromMeta.total_cost) / fromMeta.total_cost) * 100 
                : 0,
            distancePercent: fromMeta.total_distance_km > 0 
                ? ((toMeta.total_distance_km - fromMeta.total_distance_km) / fromMeta.total_distance_km) * 100 
                : 0,
            timePercent: fromMeta.total_time_hours > 0 
                ? ((toMeta.total_time_hours - fromMeta.total_time_hours) / fromMeta.total_time_hours) * 100 
                : 0,
        };

        // Build node-to-route mappings for both solutions
        const fromNodeToRoute = new Map<number, number>();
        const toNodeToRoute = new Map<number, number>();

        fromSolution.routes.forEach((route: Route) => {
            route.sequence.forEach((nodeId: number) => {
                if (nodeId !== 0) { // Skip depot
                    fromNodeToRoute.set(nodeId, route.id);
                }
            });
        });

        toSolution.routes.forEach((route: Route) => {
            route.sequence.forEach((nodeId: number) => {
                if (nodeId !== 0) { // Skip depot
                    toNodeToRoute.set(nodeId, route.id);
                }
            });
        });

        // Detect order reassignments
        const ordersReassigned: OrderReassignment[] = [];
        const allNodeIds = new Set([...fromNodeToRoute.keys(), ...toNodeToRoute.keys()]);

        allNodeIds.forEach((nodeId) => {
            const fromRouteId = fromNodeToRoute.get(nodeId) ?? null;
            const toRouteId = toNodeToRoute.get(nodeId) ?? null;

            // Reassignment detected if route changed
            if (fromRouteId !== toRouteId) {
                const node = toSolution.routes
                    .flatMap(r => r.sequence.map(seq => ({ nodeId: seq, routeId: r.id })))
                    .find(n => n.nodeId === nodeId);

                // Try to get node metadata from solution data
                const nodeMetadata = toMeta.mapping_ids?.[nodeId];
                const kind = nodeMetadata?.kind || 'unknown';
                const orderId = nodeMetadata?.order_id || null;

                ordersReassigned.push({
                    nodeId,
                    orderId,
                    fromRoute: fromRouteId,
                    toRoute: toRouteId,
                    impactScore: 0, // TODO: Calculate based on time window changes
                    kind: kind as 'pickup' | 'delivery' | 'depot' | 'unknown'
                });
            }
        });

        // Detect route changes
        const fromRouteIds = new Set(fromSolution.routes.map((r: Route) => r.id));
        const toRouteIds = new Set(toSolution.routes.map((r: Route) => r.id));

        const routesAdded = Array.from(toRouteIds).filter(id => !fromRouteIds.has(id));
        const routesRemoved = Array.from(fromRouteIds).filter(id => !toRouteIds.has(id));
        const routesModified: RouteModification[] = [];

        // Analyze common routes for modifications
        const commonRouteIds = Array.from(fromRouteIds).filter(id => toRouteIds.has(id));
        
        commonRouteIds.forEach((routeId) => {
            const fromRoute = fromSolution.routes.find((r: Route) => r.id === routeId);
            const toRoute = toSolution.routes.find((r: Route) => r.id === routeId);

            if (!fromRoute || !toRoute) return;

            const fromNodes = new Set(fromRoute.sequence.filter((n: number) => n !== 0));
            const toNodes = new Set(toRoute.sequence.filter((n: number) => n !== 0));

            const ordersAdded = Array.from(toNodes).filter(n => !fromNodes.has(n));
            const ordersRemoved = Array.from(fromNodes).filter(n => !toNodes.has(n));
            const sequenceChanged = JSON.stringify(fromRoute.sequence) !== JSON.stringify(toRoute.sequence);

            if (ordersAdded.length > 0 || ordersRemoved.length > 0 || sequenceChanged) {
                routesModified.push({
                    routeId,
                    changeType: 'modified',
                    ordersAdded,
                    ordersRemoved,
                    sequenceChanged,
                    metricsChange: {
                        cost: toRoute.cost - fromRoute.cost,
                        distance: 0, // TODO: Extract from route metadata if available
                        time: 0 // TODO: Extract from route metadata if available
                    }
                });
            }
        });

        // Vehicle utilization changes (placeholder - requires route capacity data)
        const vehicleUtilizationChange: VehicleUtilizationChange[] = [];

        // Time window violations delta (placeholder - requires constraint checking)
        const timeWindowViolationsDelta = 0;

        // Summary
        const totalChanges = ordersReassigned.length + routesAdded.length + routesRemoved.length + routesModified.length;
        const ordersAffected = ordersReassigned.length;
        const routesAffected = routesAdded.length + routesRemoved.length + routesModified.length;
        const isImprovement = metricsChange.totalCost < 0;

        const diff: SolutionDiff = {
            fromSolution: fromMeta,
            toSolution: toMeta,
            metricsChange,
            ordersReassigned,
            routesAdded,
            routesRemoved,
            routesModified,
            vehicleUtilizationChange,
            timeWindowViolationsDelta,
            summary: {
                totalChanges,
                ordersAffected,
                routesAffected,
                isImprovement
            }
        };

        return diff;
    }, [fromNode, toNode]);
}

/**
 * Helper to compute diffs between consecutive nodes in a timeline
 */
export function useTimelineDiffs(timelineNodes: TimelineNode[]): SolutionDiff[] {
    return useMemo(() => {
        const diffs: SolutionDiff[] = [];
        
        for (let i = 1; i < timelineNodes.length; i++) {
            const fromNode = timelineNodes[i - 1];
            const toNode = timelineNodes[i];
            
            // Inline diff calculation (same as useSolutionDiff)
            const fromMeta = fromNode.metadata;
            const toMeta = toNode.metadata;
            const fromSolution = fromNode.solution;
            const toSolution = toNode.solution;

            const metricsChange: MetricsChange = {
                totalCost: toMeta.total_cost - fromMeta.total_cost,
                totalDistance: toMeta.total_distance_km - fromMeta.total_distance_km,
                totalTime: toMeta.total_time_hours - fromMeta.total_time_hours,
                vehiclesUsed: toMeta.total_vehicles_used - fromMeta.total_vehicles_used,
                costPercent: fromMeta.total_cost > 0 
                    ? ((toMeta.total_cost - fromMeta.total_cost) / fromMeta.total_cost) * 100 
                    : 0,
                distancePercent: fromMeta.total_distance_km > 0 
                    ? ((toMeta.total_distance_km - fromMeta.total_distance_km) / fromMeta.total_distance_km) * 100 
                    : 0,
                timePercent: fromMeta.total_time_hours > 0 
                    ? ((toMeta.total_time_hours - fromMeta.total_time_hours) / fromMeta.total_time_hours) * 100 
                    : 0,
            };

            const fromNodeToRoute = new Map<number, number>();
            const toNodeToRoute = new Map<number, number>();

            fromSolution.routes.forEach((route: Route) => {
                route.sequence.forEach((nodeId: number) => {
                    if (nodeId !== 0) fromNodeToRoute.set(nodeId, route.id);
                });
            });

            toSolution.routes.forEach((route: Route) => {
                route.sequence.forEach((nodeId: number) => {
                    if (nodeId !== 0) toNodeToRoute.set(nodeId, route.id);
                });
            });

            const ordersReassigned: OrderReassignment[] = [];
            const allNodeIds = new Set([...fromNodeToRoute.keys(), ...toNodeToRoute.keys()]);

            allNodeIds.forEach((nodeId) => {
                const fromRouteId = fromNodeToRoute.get(nodeId) ?? null;
                const toRouteId = toNodeToRoute.get(nodeId) ?? null;

                if (fromRouteId !== toRouteId) {
                    const nodeMetadata = toMeta.mapping_ids?.[nodeId];
                    const kind = nodeMetadata?.kind || 'unknown';
                    const orderId = nodeMetadata?.order_id || null;

                    ordersReassigned.push({
                        nodeId,
                        orderId,
                        fromRoute: fromRouteId,
                        toRoute: toRouteId,
                        impactScore: 0,
                        kind: kind as 'pickup' | 'delivery' | 'depot' | 'unknown'
                    });
                }
            });

            const fromRouteIds = new Set(fromSolution.routes.map((r: Route) => r.id));
            const toRouteIds = new Set(toSolution.routes.map((r: Route) => r.id));

            const routesAdded = Array.from(toRouteIds).filter(id => !fromRouteIds.has(id));
            const routesRemoved = Array.from(fromRouteIds).filter(id => !toRouteIds.has(id));
            const routesModified: RouteModification[] = [];

            const commonRouteIds = Array.from(fromRouteIds).filter(id => toRouteIds.has(id));
            
            commonRouteIds.forEach((routeId) => {
                const fromRoute = fromSolution.routes.find((r: Route) => r.id === routeId);
                const toRoute = toSolution.routes.find((r: Route) => r.id === routeId);

                if (!fromRoute || !toRoute) return;

                const fromNodes = new Set(fromRoute.sequence.filter((n: number) => n !== 0));
                const toNodes = new Set(toRoute.sequence.filter((n: number) => n !== 0));

                const ordersAdded = Array.from(toNodes).filter(n => !fromNodes.has(n));
                const ordersRemoved = Array.from(fromNodes).filter(n => !toNodes.has(n));
                const sequenceChanged = JSON.stringify(fromRoute.sequence) !== JSON.stringify(toRoute.sequence);

                if (ordersAdded.length > 0 || ordersRemoved.length > 0 || sequenceChanged) {
                    routesModified.push({
                        routeId,
                        changeType: 'modified',
                        ordersAdded,
                        ordersRemoved,
                        sequenceChanged,
                        metricsChange: {
                            cost: toRoute.cost - fromRoute.cost,
                            distance: 0,
                            time: 0
                        }
                    });
                }
            });

            const totalChanges = ordersReassigned.length + routesAdded.length + routesRemoved.length + routesModified.length;
            const ordersAffected = ordersReassigned.length;
            const routesAffected = routesAdded.length + routesRemoved.length + routesModified.length;
            const isImprovement = metricsChange.totalCost < 0;

            diffs.push({
                fromSolution: fromMeta,
                toSolution: toMeta,
                metricsChange,
                ordersReassigned,
                routesAdded,
                routesRemoved,
                routesModified,
                vehicleUtilizationChange: [],
                timeWindowViolationsDelta: 0,
                summary: {
                    totalChanges,
                    ordersAffected,
                    routesAffected,
                    isImprovement
                }
            });
        }

        return diffs;
    }, [timelineNodes]);
}
