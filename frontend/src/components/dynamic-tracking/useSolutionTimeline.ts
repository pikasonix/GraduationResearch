"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/supabase/client';
import type { 
    TimelineNode, 
    OptimizationSolutionMetadata, 
    Solution,
    Instance,
    Route
} from '@/utils/dataModels';
import { createInstance, createNode, createRoute } from '@/utils/dataModels';

interface UseSolutionTimelineOptions {
    rootSolutionId?: string | null;
    organizationId?: string | null;
}

function parseSolutionData(solutionData: any): { instance: Instance; routes: Route[] } {
    const instance = createInstance();
    const mapping = Array.isArray(solutionData?.mapping_ids) ? solutionData.mapping_ids : [];
    
    instance.name = String(solutionData?.instance_name || 'Solution');
    instance.type = 'persisted';
    instance.capacity = Number(solutionData?.capacity ?? 100);
    instance.location = '';
    
    instance.nodes = mapping.map((m: any, idx: number) => {
        const lat = Number(m?.lat);
        const lng = Number(m?.lng);
        const kind = String(m?.kind || '');
        const isPickup = kind === 'pickup';
        const isDelivery = kind === 'delivery';
        const demand = Number(m?.demand ?? 0);
        const twStart = Number(m?.time_window_start ?? 0);
        const twEnd = Number(m?.time_window_end ?? 480);
        const serviceTime = Number(m?.service_time ?? 5);
        
        const node = createNode(
            idx,
            [Number.isFinite(lat) ? lat : 0, Number.isFinite(lng) ? lng : 0],
            demand,
            [twStart, twEnd],
            serviceTime,
            isPickup,
            isDelivery
        );
        
        (node as any).order_id = m?.order_id || null;
        (node as any).location_id = m?.location_id || null;
        (node as any).kind = kind;
        
        return node;
    });
    
    instance.all_coords = instance.nodes.map((n) => n.coords);
    instance.size = instance.nodes.length;
    instance.times = [];
    
    // Parse routes from solution_data
    const routesData = Array.isArray(solutionData?.routes) ? solutionData.routes : [];
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
    
    console.log('[parseSolutionData] Parsing routes:', {
        routesCount: routesData.length,
        sampleRoute: routesData[0] ? {
            id: routesData[0].id,
            hasSequence: Array.isArray(routesData[0].sequence),
            hasPath: Array.isArray(routesData[0].path),
            sequenceLength: routesData[0].sequence?.length,
            pathLength: routesData[0].path?.length
        } : null
    });
    
    const routes: Route[] = routesData.map((r: any, idx: number) => {
        const route = createRoute(r.id || idx + 1);
        route.cost = Number(r.cost ?? 0);
        route.set_color(palette[idx % palette.length]);
        route.sequence = Array.isArray(r.sequence) ? r.sequence : [];
        route.path = Array.isArray(r.path) ? r.path : [];
        return route;
    });
    
    return { instance, routes };
}

function createSolutionFromMetadata(metadata: OptimizationSolutionMetadata): Solution {
    const { instance, routes } = parseSolutionData(metadata.solution_data);
    
    return {
        instance_name: instance.name,
        reference: metadata.solution_name || metadata.id,
        date: metadata.created_at,
        author: 'system',
        routes
    };
}

/**
 * Fetches all solutions from a root solution and builds a timeline tree
 * by following parent_solution_id relationships
 */
export function useSolutionTimeline(options: UseSolutionTimelineOptions = {}) {
    const [timelineNodes, setTimelineNodes] = useState<TimelineNode[]>([]);
    const [rootNode, setRootNode] = useState<TimelineNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchTimeline() {
            setLoading(true);
            setError(null);

            try {
                const { rootSolutionId, organizationId } = options;

                if (!rootSolutionId && !organizationId) {
                    setTimelineNodes([]);
                    setRootNode(null);
                    setLoading(false);
                    return;
                }

                // Fetch all solutions for the organization
                let query = supabase
                    .from('optimization_solutions')
                    .select('id, created_at, solution_name, total_cost, total_distance_km, total_time_hours, total_vehicles_used, organization_id, job_id, solution_data')
                    .order('created_at', { ascending: true });

                if (organizationId) {
                    query = query.eq('organization_id', organizationId);
                }

                const { data, error: fetchError } = await query;

                if (fetchError) throw new Error(fetchError.message);
                if (!data || data.length === 0) {
                    setTimelineNodes([]);
                    setRootNode(null);
                    setLoading(false);
                    return;
                }

                // Build metadata objects
                const allSolutions: OptimizationSolutionMetadata[] = data.map((row: any) => ({
                    id: row.id,
                    created_at: row.created_at,
                    solution_name: row.solution_name,
                    total_cost: Number(row.total_cost ?? 0),
                    total_distance_km: Number(row.total_distance_km ?? 0),
                    total_time_hours: Number(row.total_time_hours ?? 0),
                    total_vehicles_used: Number(row.total_vehicles_used ?? 0),
                    parent_solution_id: null, // Not available in current schema
                    organization_id: row.organization_id,
                    job_id: row.job_id,
                    solution_data: row.solution_data,
                    mapping_ids: row.solution_data?.mapping_ids || [] // Parse from solution_data
                }));

                // If rootSolutionId specified, show only that solution
                let relevantSolutions = allSolutions;
                if (rootSolutionId) {
                    relevantSolutions = allSolutions.filter(s => s.id === rootSolutionId);
                    if (relevantSolutions.length === 0) {
                        // Root not found, show empty
                        setTimelineNodes([]);
                        setRootNode(null);
                        setLoading(false);
                        return;
                    }
                }

                // Build tree structure - simplified to flat chronological list
                const solutionMap = new Map<string, TimelineNode>();
                
                // First pass: create nodes
                relevantSolutions.forEach((metadata, index) => {
                    const solution = createSolutionFromMetadata(metadata);
                    const node: TimelineNode = {
                        solution,
                        metadata,
                        children: [],
                        depth: 0, // All at same level since no parent-child
                        timestamp: metadata.created_at,
                        index
                    };
                    solutionMap.set(metadata.id, node);
                });

                // Build chronological array (already sorted by created_at from query)
                const chronological: TimelineNode[] = Array.from(solutionMap.values())
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                // Update indices to reflect chronological order
                chronological.forEach((node, idx) => {
                    node.index = idx;
                });

                if (!cancelled) {
                    setTimelineNodes(chronological);
                    // Set root as the first node if rootSolutionId provided, otherwise first chronological
                    const root = rootSolutionId 
                        ? solutionMap.get(rootSolutionId) || chronological[0] || null
                        : chronological[0] || null;
                    setRootNode(root);
                }
            } catch (e: any) {
                if (!cancelled) {
                    setError(e?.message || 'Failed to load solution timeline');
                    console.error('[useSolutionTimeline]', e);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchTimeline();

        return () => {
            cancelled = true;
        };
    }, [options.rootSolutionId, options.organizationId]);

    return {
        timelineNodes,
        rootNode,
        loading,
        error
    };
}
