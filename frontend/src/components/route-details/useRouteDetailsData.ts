"use client";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Instance, Route } from '@/utils/dataModels';
import { createInstance, createNode, createRoute } from '@/utils/dataModels';
import { supabase } from '@/supabase/client';

export interface RouteDetailsData {
    route: Route | any;
    instance: Instance | any;
    routes?: Route[];
}

function decodeBase64Json(b64: string) {
    try { return JSON.parse(typeof window === 'undefined' ? Buffer.from(b64, 'base64').toString('utf-8') : atob(b64)); } catch { return null; }
}

interface Options { routeId?: string | number; }

function isUuid(value: string | null | undefined): value is string {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildMinimalInstanceFromSolutionData(solutionData: any): Instance {
    const inst = createInstance();
    const mapping = Array.isArray(solutionData?.mapping_ids) ? solutionData.mapping_ids : [];

    // DEBUG: Log raw mapping_ids from DB
    console.log('[useRouteDetailsData DEBUG] mapping_ids count:', mapping.length);
    if (mapping.length > 1) {
        console.log('[useRouteDetailsData DEBUG] Sample mapping[1]:', JSON.stringify(mapping[1], null, 2));
    }

    inst.name = String(solutionData?.instance_name || 'Persisted Solution');
    inst.type = 'persisted';
    inst.capacity = Number(solutionData?.capacity ?? 100);
    inst.location = '';

    inst.nodes = mapping.map((m: any, idx: number) => {
        const lat = Number(m?.lat);
        const lng = Number(m?.lng);
        const kind = String(m?.kind || '');
        const isPickup = kind === 'pickup';
        const isDelivery = kind === 'delivery';
        
        // Use order details from mapping if available, otherwise defaults
        const demand = Number(m?.demand ?? 0);
        const twStart = Number(m?.time_window_start ?? 0);
        const twEnd = Number(m?.time_window_end ?? 480); // 8 hours default
        const serviceTime = Number(m?.service_time ?? 5);
        
        // DEBUG: Log first few non-depot nodes
        if (idx > 0 && idx <= 3) {
            console.log(`[useRouteDetailsData DEBUG] Node ${idx}: kind=${kind}, demand=${demand}, tw=[${twStart}, ${twEnd}], serviceTime=${serviceTime}`);
            console.log(`[useRouteDetailsData DEBUG] Raw m.demand=${m?.demand}, m.time_window_start=${m?.time_window_start}, m.time_window_end=${m?.time_window_end}`);
        }
        
        const node = createNode(
            idx,
            [Number.isFinite(lat) ? lat : 0, Number.isFinite(lng) ? lng : 0],
            demand,
            [twStart, twEnd],
            serviceTime,
            isPickup,
            isDelivery,
        );
        
        // Attach extra metadata for display
        (node as any).order_id = m?.order_id || null;
        (node as any).location_id = m?.location_id || null;
        (node as any).kind = kind;
        
        return node;
    });

    inst.all_coords = inst.nodes.map((n) => n.coords);
    inst.size = inst.nodes.length;
    inst.times = [];
    return inst;
}

function buildRoutesFromDb(dbRoutes: any[], instance: Instance): Route[] {
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
    const routes: Route[] = [];

    // DEBUG: Log instance nodes count
    console.log(`[buildRoutesFromDb DEBUG] Instance has ${instance.nodes.length} nodes`);

    dbRoutes.forEach((r: any, idx: number) => {
        const routeNumber = Number(r?.route_number);
        const id = Number.isFinite(routeNumber) ? routeNumber : idx + 1;
        const route = createRoute(id);
        route.cost = Number(r?.planned_cost ?? 0);
        route.set_color(palette[idx % palette.length]);

        const seq = Array.isArray(r?.route_data?.route_sequence)
            ? r.route_data.route_sequence.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
            : [];

        // DEBUG: Log route sequence
        console.log(`[buildRoutesFromDb DEBUG] Route ${id} raw sequence:`, seq);
        console.log(`[buildRoutesFromDb DEBUG] Route ${id} sequence range: min=${Math.min(...seq)}, max=${Math.max(...seq)}`);

        // Include depot at start/end for map rendering.
        route.sequence = [0, ...seq, 0];
        route.path = route.sequence
            .map((nodeId) => {
                const node = instance.nodes.find((n) => n.id === nodeId);
                if (!node) {
                    console.warn(`[buildRoutesFromDb DEBUG] Node ${nodeId} not found in instance!`);
                }
                return node?.coords;
            })
            .filter(Boolean) as [number, number][];

        // DEBUG: Log path
        console.log(`[buildRoutesFromDb DEBUG] Route ${id} path length: ${route.path.length}, sequence length: ${route.sequence.length}`);

        // Keep DB ids accessible if needed by downstream components.
        (route as any).db_route_id = r?.id;
        (route as any).route_number = r?.route_number;
        (route as any).planned_distance_km = r?.planned_distance_km;
        (route as any).planned_duration_hours = r?.planned_duration_hours;

        routes.push(route);
    });

    return routes;
}

/**
 * Hook nạp dữ liệu route / instance từ:
 * 1. query ?data= (base64 json {route,instance,routes})
 * 2. localStorage: selectedRoute, currentInstance, allRoutes
 */
export function useRouteDetailsData(opts: Options = {}) {
    const { routeId } = opts;
    const searchParams = useSearchParams();
    const searchKey = searchParams?.toString() || '';
    const [data, setData] = useState<RouteDetailsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setLoading(true);
            setError(null);

            try {
                let route: any = null;
                let instance: any = null;
                let routes: any[] | undefined = undefined;

                const params = searchParams;
                const encoded = params?.get('data');
                const urlSolutionId = params?.get('solutionId') || params?.get('solution_id');
                const useCache = params?.get('useCache') === 'true';
                const hasBuilderData =
                    typeof window !== 'undefined' &&
                    (!!localStorage.getItem('builderInstanceText') || !!localStorage.getItem('builderInputData'));
                const allowCache = useCache || !!encoded || hasBuilderData;
                const solutionId = isUuid(urlSolutionId) ? urlSolutionId : null;

                // Priority 0: Fetch from DB when solutionId present.
                if (isUuid(solutionId)) {
                    const { data: solutionRow, error: solutionErr } = await supabase
                        .from('optimization_solutions')
                        .select('id, solution_data')
                        .eq('id', solutionId)
                        .maybeSingle();

                    if (solutionErr) throw new Error(solutionErr.message);
                    if (!solutionRow) throw new Error(`Không tìm thấy solutionId=${solutionId}`);

                    const { data: dbRoutes, error: routesErr } = await supabase
                        .from('routes')
                        .select('id, route_number, planned_distance_km, planned_duration_hours, planned_cost, route_data')
                        .eq('solution_id', solutionId)
                        .order('route_number', { ascending: true });

                    if (routesErr) throw new Error(routesErr.message);

                    instance = buildMinimalInstanceFromSolutionData(solutionRow.solution_data);
                    routes = buildRoutesFromDb(dbRoutes ?? [], instance);

                    if (routeId && routes?.length) {
                        route = routes.find((r) => String(r.id) === String(routeId)) || null;
                    }
                    if (!route && routes?.length) route = routes[0];

                    if (!cancelled) {
                        setData({ route, instance, routes });
                    }
                    return;
                }

                // Default behavior: show nothing until user selects a solution.
                if (!allowCache) {
                    if (!cancelled) setData({ route: null, instance: null, routes: undefined });
                    return;
                }

                // Priority 1: Query params
                if (encoded) {
                    const parsed = decodeBase64Json(encoded);
                    // Support both formats: {route, instance, routes} or {instanceText, orders, ...}
                    if (parsed?.instanceText) {
                        // Store instanceText for RouteDetailsView to parse
                        localStorage.setItem('builderInstanceText', parsed.instanceText);
                    }
                    if (parsed?.route && parsed?.instance) {
                        route = parsed.route;
                        instance = parsed.instance;
                        routes = parsed.routes || undefined;
                    }
                }

                // Priority 2: Load from localStorage only if:
                // - There's builderInstanceText (new data from /orders)
                // - Or there's a specific routeId (user wants to view a specific route)
                // - Or there's explicit data in localStorage (not just old cache)
                if ((!route || !instance) && allowCache) {
                    try {
                        const lsRoute = localStorage.getItem('selectedRoute');
                        const lsInstance = localStorage.getItem('currentInstance');
                        const lsRoutes = localStorage.getItem('allRoutes');
                        if (lsRoutes) {
                            routes = JSON.parse(lsRoutes);
                        }
                        if (lsInstance) instance = JSON.parse(lsInstance);
                        // Nếu có routeId cố gắng tìm trong routes
                        if (routeId && routes) {
                            route = routes.find(r => String(r.id) === String(routeId));
                        }
                        // Fallback dùng selectedRoute nếu chưa có
                        if (!route && lsRoute) route = JSON.parse(lsRoute);
                        // Nếu chưa có routes nhưng có route -> tạo list 1 phần tử để UI vẫn hiển thị
                        if ((!routes || routes.length === 0) && route) {
                            routes = [route];
                        }
                    } catch { }
                }

                if (!route && routeId) {
                    setError('Không tìm thấy route với id=' + routeId);
                }

                if (!cancelled) {
                    setData(route ? { route, instance, routes } : { route: null, instance, routes });
                }
            } catch (e: any) {
                if (!cancelled) setError(e?.message || 'Lỗi nạp dữ liệu');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();
        return () => { cancelled = true; };
    }, [routeId, searchKey]);

    return { data, error, loading };
}
