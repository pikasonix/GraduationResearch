import { createSupabaseAdminClient, isSupabaseEnabled } from '../supabaseAdmin';
import { fetchRouteMetricsFromEnrichmentApi, type Waypoint } from '../enrichment/enrichmentClient';
import { parseSolverSolutionText } from './parseSolverSolution';
import type { CleanedRoute } from '../workers/dummyNodeCleaner';

type MappingId = {
    kind: 'depot' | 'pickup' | 'delivery' | 'dummy_start' | 'ghost_pickup';
    order_id: string | null;
    location_id: string | null;
    lat: number;
    lng: number;
    is_dummy?: boolean;
    vehicle_id?: string;
    original_order_ids?: string[];
};

type Edges = {
    distance_meters: number[][];
    duration_seconds: number[][];
};

function isFiniteNumber(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n);
}

function toNumMatrix(value: any): number[][] | null {
    if (!Array.isArray(value)) return null;
    if (!value.every(Array.isArray)) return null;
    return value.map((row: any[]) => row.map((v) => Number(v)));
}

function parseCostFromFilename(filename: string | undefined): number | null {
    if (!filename) return null;
    const base = filename.split('\\').pop() || filename;
    const m = base.match(/_([0-9]+(?:\.[0-9]+)?)\.[a-z0-9]+$/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function computeFromEdges(edges: Edges, nodePath: number[]): { distance_meters: number; duration_seconds: number } {
    let dist = 0;
    let dur = 0;

    for (let i = 1; i < nodePath.length; i++) {
        const a = nodePath[i - 1];
        const b = nodePath[i];
        dist += Number(edges.distance_meters?.[a]?.[b] ?? 0);
        dur += Number(edges.duration_seconds?.[a]?.[b] ?? 0);
    }

    return { distance_meters: dist, duration_seconds: dur };
}

export async function persistSolutionSnapshot(opts: {
    jobId: string;
    organizationId: string;
    solutionText: string;
    solverFilename?: string;
    inputData: any;
    cleanedRoutes?: CleanedRoute[]; // For reoptimization with cleaned dummy nodes
    parentSolutionId?: string; // For re-optimization: link to previous solution
}): Promise<{ solutionId: string } | null> {
    if (!isSupabaseEnabled()) return null;

    const mappingIds: MappingId[] | undefined = Array.isArray(opts.inputData?.mapping_ids)
        ? (opts.inputData.mapping_ids as MappingId[])
        : undefined;

    if (!mappingIds || mappingIds.length === 0) {
        // No mapping => cannot create route_stops (per requirement, skip persistence)
        return null;
    }

    const depot = mappingIds[0];
    if (!depot || depot.kind !== 'depot' || !isFiniteNumber(depot.lat) || !isFiniteNumber(depot.lng)) {
        throw new Error('input_data.mapping_ids[0] must be depot with lat/lng');
    }

    const edgesDistance = toNumMatrix(opts.inputData?.edges?.distance_meters);
    const edgesDuration = toNumMatrix(opts.inputData?.edges?.duration_seconds);
    const edges: Edges | null = edgesDistance && edgesDuration ? { distance_meters: edgesDistance, duration_seconds: edgesDuration } : null;

    // Use cleaned routes if provided (from reoptimization), otherwise parse from text
    const routesToProcess = opts.cleanedRoutes 
        ? opts.cleanedRoutes.map(cr => ({
              routeNumber: cr.route_number,
              sequence: cr.node_sequence,
              vehicle_id: cr.vehicle_id,
              start_time: cr.start_time,
              initial_load: cr.initial_load,
          }))
        : parseSolverSolutionText(opts.solutionText).routes.map(r => ({
              routeNumber: r.routeNumber,
              sequence: r.sequence,
              vehicle_id: undefined,
              start_time: undefined,
              initial_load: undefined,
          }));

    if (!routesToProcess.length) {
        throw new Error('No routes to persist');
    }

    const routesPayload: any[] = [];

    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;

    for (const r of routesToProcess) {
        const nodePath = [0, ...r.sequence, 0];

        const waypoints: Waypoint[] = nodePath.map((nodeIndex) => {
            const m = mappingIds[nodeIndex];
            if (!m) {
                throw new Error(`Missing mapping_ids for node_index ${nodeIndex}`);
            }
            return { lat: Number(m.lat), lng: Number(m.lng) };
        });

        const metrics = edges
            ? computeFromEdges(edges, nodePath)
            : await fetchRouteMetricsFromEnrichmentApi(waypoints);

        totalDistanceMeters += metrics.distance_meters;
        totalDurationSeconds += metrics.duration_seconds;

        const stopsRaw = r.sequence.map((nodeIndex: number) => {
            const m = mappingIds[nodeIndex];
            if (!m) {
                throw new Error(`mapping_ids[${nodeIndex}] missing`);
            }
            
            // Skip dummy/ghost nodes - they don't have real order_id/location_id
            if (m.is_dummy || m.kind === 'dummy_start' || m.kind === 'ghost_pickup' || m.kind === 'depot') {
                return null; // Will be filtered out
            }
            
            if (!m.order_id || !m.location_id) {
                throw new Error(`mapping_ids[${nodeIndex}] missing order_id/location_id (kind=${m.kind}, is_dummy=${m.is_dummy})`);
            }

            return {
                order_id: m.order_id,
                location_id: m.location_id,
                stop_type: m.kind === 'pickup' ? 'pickup' : 'delivery',
            };
        }).filter((stop): stop is NonNullable<typeof stop> => stop !== null);
        
        // Re-number stop_sequence after filtering
        const stops = stopsRaw.map((stop, idx) => ({
            ...stop,
            stop_sequence: idx + 1,
        }));

        routesPayload.push({
            route_number: r.routeNumber,
            vehicle_id: r.vehicle_id || null, // Include vehicle_id if available from cleaned route
            planned_distance_km: Number((metrics.distance_meters / 1000).toFixed(2)),
            planned_duration_hours: Number((metrics.duration_seconds / 3600).toFixed(2)),
            planned_cost: 0,
            route_data: {
                route_sequence: r.sequence,
                metrics_meters_seconds: metrics,
                used_edges_matrix: !!edges,
                start_time: r.start_time, // From dummy node extraction
                initial_load: r.initial_load, // From ghost pickup extraction
            },
            stops,
        });
    }

    const totalDistanceKm = Number((totalDistanceMeters / 1000).toFixed(2));
    const totalTimeHours = Number((totalDurationSeconds / 3600).toFixed(2));
    const totalCost = parseCostFromFilename(opts.solverFilename) ?? 0;

    const solutionData = {
        raw_solution_text: opts.solutionText,
        mapping_ids: mappingIds,
        routes: routesToProcess.map(r => ({ routeNumber: r.routeNumber, sequence: r.sequence })),
        totals: {
            distance_meters: totalDistanceMeters,
            duration_seconds: totalDurationSeconds,
            distance_km: totalDistanceKm,
            time_hours: totalTimeHours,
            solver_cost: totalCost,
        },
        edges_available: !!edges,
        is_reoptimization: !!opts.cleanedRoutes, // Flag to indicate this was a reoptimization
    };

    // DEBUG: Log mapping_ids being persisted
    console.log(`[persistSolutionSnapshot DEBUG] mapping_ids count: ${mappingIds.length}`);
    console.log(`[persistSolutionSnapshot DEBUG] Sample mapping_ids[1]:`, JSON.stringify(mappingIds[1], null, 2));
    
    // DEBUG: Log route sequences being persisted
    routesPayload.forEach((rp, idx) => {
        console.log(`[persistSolutionSnapshot DEBUG] Route ${idx + 1} sequence:`, rp.route_data.route_sequence);
        console.log(`[persistSolutionSnapshot DEBUG] Route ${idx + 1} sequence range: min=${Math.min(...rp.route_data.route_sequence)}, max=${Math.max(...rp.route_data.route_sequence)}`);
    });

    const payload = {
        job_id: opts.jobId,
        organization_id: opts.organizationId,
        optimization_objective: 'minimize_cost',
        total_vehicles_used: routesPayload.length,
        total_distance_km: totalDistanceKm,
        total_time_hours: totalTimeHours,
        total_cost: totalCost,
        solution_data: solutionData,
        routes: routesPayload,
        parent_solution_id: opts.parentSolutionId || null, // NEW: Link to parent solution
    };

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc('persist_solution_snapshot', { payload });
    if (error) {
        throw new Error(`persist_solution_snapshot RPC failed: ${error.message}`);
    }

    if (!data || typeof data !== 'string') {
        throw new Error('persist_solution_snapshot did not return a solution id');
    }

    const solutionId = data;
    console.log(`✓ Created solution ${solutionId}${opts.parentSolutionId ? ` (child of ${opts.parentSolutionId})` : ''}`);

    // NEW: Copy driver assignments from parent solution if exists
    if (opts.parentSolutionId) {
        console.log(`Copying driver assignments from parent solution ${opts.parentSolutionId}...`);
        
        const { data: affectedCount, error: copyError } = await supabase.rpc('copy_driver_assignments', {
            p_parent_solution_id: opts.parentSolutionId,
            p_new_solution_id: solutionId
        });
        
        if (copyError) {
            // CRITICAL but don't throw - solution is still valid, just missing assignments
            console.error('⚠️  CRITICAL: Failed to preserve driver assignments:', copyError);
            console.error('⚠️  Dispatchers will need to manually re-assign drivers');
        } else {
            console.log(`✓ Preserved driver assignments for ${affectedCount || 0} routes`);
        }
    }

    return { solutionId };
}
