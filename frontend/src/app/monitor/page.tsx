"use client";

import React, { useMemo, useRef, useState, useEffect } from 'react';
import MonitorSidebar from '@/components/monitor/MonitorSidebar';
import MonitorMap from '@/components/monitor/MonitorMap';
import MonitorTimeline, { DriverTimeline, TimelineEvent } from '@/components/monitor/MonitorTimeline';
import MonitorStats from '@/components/monitor/MonitorStats';
import { getDrivers, getVehicles, getActiveRouteAssignments, RouteAssignment } from '@/services/driverService';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/supabase/client';
import { useGetSessionQuery } from '@/lib/redux/services/auth';
import { useGetUserProfileOverviewQuery } from '@/lib/redux/services/userApi';

// Types
export interface DispatchDriver {
    id: string;
    name: string;
    status: 'available' | 'busy' | 'offline';
    vehicleType: string;
    vehiclePlate: string;
    vehicleId: string | null;
    capacity: number;
    currentLat: number;
    currentLng: number;
    heading: number; // Direction in degrees (0 = North, 90 = East, etc.)
    distanceToDepot: string | number;
}

export interface DispatchRoute {
    id: string;
    vehicleId: string;
    geometry: any; // GeoJSON LineString
    color?: string;
    orderCount: number;
    stops?: Array<{
        nodeId: number;
        seqIndex: number;
        kind: string;
        lat: number;
        lng: number;
        orderId?: string | null;
        locationId?: string | null;
    }>;
    meta?: {
        routeNumber?: number | null;
        plannedDurationSeconds?: number | null;
        plannedDistanceMeters?: number | null;
        startTimeUnix?: number | null;
    };
}

function isUuid(value: string | null | undefined): value is string {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type SolutionMappingId = {
    kind?: string;
    order_id?: string | null;
    location_id?: string | null;
    lat?: number;
    lng?: number;
    vehicle_id?: string;
};

type SolutionNode = {
    id: number;
    lat: number;
    lng: number;
    kind: string;
    orderId: string | null;
    locationId: string | null;
};

function buildNodesFromSolutionData(solutionData: any): SolutionNode[] {
    const mapping: SolutionMappingId[] = Array.isArray(solutionData?.mapping_ids) ? solutionData.mapping_ids : [];
    return mapping.map((m: SolutionMappingId, idx: number) => {
        const lat = Number(m?.lat);
        const lng = Number(m?.lng);
        return {
            id: idx,
            lat: Number.isFinite(lat) ? lat : 0,
            lng: Number.isFinite(lng) ? lng : 0,
            kind: String(m?.kind || ''),
            orderId: typeof m?.order_id === 'string' || m?.order_id === null ? m.order_id ?? null : null,
            locationId: typeof m?.location_id === 'string' || m?.location_id === null ? m.location_id ?? null : null,
        };
    });
}

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    const hh = Number.isFinite(h) ? h : 0;
    const mm = Number.isFinite(m) ? m : 0;
    return hh * 60 + mm;
}

function minutesToHHmm(minutes: number): string {
    const m = Math.max(0, Math.round(minutes));
    const hh = Math.floor(m / 60) % 24;
    const mm = m % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

function isUnixTimestampLike(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function unixToLocalHHmm(unix: number): string {
    // Accept seconds or milliseconds.
    const ms = unix > 1e12 ? unix : unix * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '08:00';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

type Segment = {
    fromNodeId: number;
    toNodeId: number;
    startMinute: number;
    endMinute: number;
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
};

function buildDispatchRoutesFromDb(dbRoutes: any[], nodes: SolutionNode[]): DispatchRoute[] {
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

    return (dbRoutes ?? []).map((r: any, idx: number) => {
        const seq = Array.isArray(r?.route_data?.route_sequence)
            ? r.route_data.route_sequence
                .map((n: any) => Number(n))
                .filter((n: number) => Number.isFinite(n))
            : [];

        // Include depot at start/end for rendering.
        const routeSequence = [0, ...seq, 0];

        // GeoJSON wants [lng, lat]
        const coordinates = routeSequence
            .map((nodeId) => nodes.find((n) => n.id === nodeId))
            .filter(Boolean)
            .map((n: any) => [n.lng, n.lat]);

        const stops = routeSequence
            .map((nodeId, sIdx) => {
                const n = nodes.find((x) => x.id === nodeId);
                if (!n) return null;
                return {
                    nodeId,
                    seqIndex: sIdx,
                    kind: n.kind || (nodeId === 0 ? 'depot' : ''),
                    lat: n.lat,
                    lng: n.lng,
                    orderId: n.orderId,
                    locationId: n.locationId,
                };
            })
            .filter(Boolean) as DispatchRoute['stops'];

        const metrics = r?.route_data?.metrics_meters_seconds;
        const plannedDurationSeconds = Number(metrics?.duration_seconds);
        const plannedDistanceMeters = Number(metrics?.distance_meters);
        const startTimeUnix = isUnixTimestampLike(r?.route_data?.start_time) ? Number(r.route_data.start_time) : null;

        return {
            id: String(r?.id ?? r?.route_number ?? `route-${idx + 1}`),
            vehicleId: String(r?.vehicle_id ?? 'unknown'),
            color: palette[idx % palette.length],
            orderCount: seq.length,
            stops,
            meta: {
                routeNumber: Number.isFinite(Number(r?.route_number)) ? Number(r.route_number) : null,
                plannedDurationSeconds: Number.isFinite(plannedDurationSeconds) ? plannedDurationSeconds : null,
                plannedDistanceMeters: Number.isFinite(plannedDistanceMeters) ? plannedDistanceMeters : null,
                startTimeUnix,
            },
            geometry: {
                type: 'LineString',
                coordinates,
            },
        } satisfies DispatchRoute;
    });
}

function getOrgIdFromLocalStorage(): string | null {
    try {
        const raw = localStorage.getItem('routePlanningMetadata');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const orgId = parsed?.organizationId;
        return typeof orgId === 'string' && orgId ? orgId : null;
    } catch {
        return null;
    }
}

const vehicleTypeLabels: Record<string, string> = {
    'motorcycle': 'Xe máy',
    'van': 'Van',
    'truck_small': 'Xe tải nhỏ',
    'truck_medium': 'Xe tải vừa',
    'truck_large': 'Xe tải lớn'
};

const STATUS_COLORS = {
    'available': 'bg-green-500',
    'busy': 'bg-amber-500',
    'offline': 'bg-gray-400'
};

// Import RoutePosition type from MonitorMap
import { RoutePosition } from '@/components/monitor/MonitorMap';

export default function MonitorPage() {
    const searchParams = useSearchParams();
    const searchKey = useMemo(() => searchParams?.toString() || '', [searchParams]);

    // Get user session and organization
    const { data: sessionData } = useGetSessionQuery();
    const userId = sessionData?.session?.user?.id;
    const { data: userProfile } = useGetUserProfileOverviewQuery(userId ?? "", { skip: !userId });
    const organization = userProfile?.organization ?? null;

    const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
    const [routes, setRoutes] = useState<DispatchRoute[]>([]);
    const [routePositions, setRoutePositions] = useState<Map<string, RoutePosition>>(new Map());
    const [timelines, setTimelines] = useState<DriverTimeline[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(() => {
        // Use current real time
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    });

    const [depot, setDepot] = useState<{ lat: number; lng: number } | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const [activeSolutionId, setActiveSolutionId] = useState<string | null>(null);
    const lastLoadedSolutionIdRef = useRef<string | null>(null);
    const routesRef = useRef<DispatchRoute[]>([]);

    useEffect(() => {
        routesRef.current = routes;
    }, [routes]);

    // Resolve solutionId: URL (?solutionId / ?solution_id) then localStorage.lastSolutionId.
    useEffect(() => {
        const fromUrl = searchParams?.get('solutionId') || searchParams?.get('solution_id');
        const fromLs = typeof window !== 'undefined' ? localStorage.getItem('lastSolutionId') : null;
        const resolved = isUuid(fromUrl) ? fromUrl : (isUuid(fromLs) ? fromLs : null);
        setActiveSolutionId(resolved);
    }, [searchKey, searchParams]);

    // Cross-tab update: when /route-details writes lastSolutionId, refresh monitor.
    useEffect(() => {
        function onStorage(e: StorageEvent) {
            if (e.key !== 'lastSolutionId') return;
            if (isUuid(e.newValue)) setActiveSolutionId(e.newValue);
        }
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Stats
    const [stats, setStats] = useState({
        totalRoutes: 0,
        completedRoutes: 0,
        attentionRoutes: 0,
        totalDistance: 0,
        totalTimeFormatted: "0h 00p",
        changedRoutes: 0,
        deviatedRoutes: 0
    });

    // Clock - use real time updated every 10 seconds
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
        };
        updateTime();
        const interval = setInterval(updateTime, 10000); // Update every 10 seconds
        return () => clearInterval(interval);
    }, []);

    // Fetch Data
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        async function loadData() {
            try {
                async function loadRoutesForSolution(solutionId: string): Promise<{ routes: DispatchRoute[]; nodes: SolutionNode[]; rawSolutionData: any }>{
                    const { data: solutionRow, error: solutionErr } = await supabase
                        .from('optimization_solutions')
                        .select('id, solution_data')
                        .eq('id', solutionId)
                        .maybeSingle();

                    if (solutionErr) throw new Error(solutionErr.message);
                    if (!solutionRow) throw new Error(`Không tìm thấy solutionId=${solutionId}`);

                    const { data: dbRoutes, error: routesErr } = await supabase
                        .from('routes')
                        .select('id, route_number, vehicle_id, driver_id, status, planned_cost, route_data')
                        .eq('solution_id', solutionId)
                        .order('route_number', { ascending: true });

                    if (routesErr) throw new Error(routesErr.message);

                    const rawSolutionData = (solutionRow as any).solution_data;
                    const nodes = buildNodesFromSolutionData(rawSolutionData);
                    return { routes: buildDispatchRoutesFromDb(dbRoutes ?? [], nodes), nodes, rawSolutionData };
                }

                function computeRouteSegments(route: DispatchRoute, routeStartMinute: number, durationSeconds: number | null): Segment[] {
                    const stops = route.stops ?? [];
                    if (stops.length < 2) return [];

                    const points = stops.map((s) => ({ lat: s.lat, lng: s.lng, nodeId: s.nodeId }));
                    const legDistancesKm: number[] = [];
                    let sumKm = 0;
                    for (let i = 1; i < points.length; i++) {
                        const km = haversineKm(points[i - 1], points[i]);
                        legDistancesKm.push(km);
                        sumKm += km;
                    }

                    const totalSeconds = (durationSeconds && durationSeconds > 0)
                        ? durationSeconds
                        : Math.max(60, Math.round((sumKm / 30) * 3600)); // fallback speed 30km/h

                    let cursor = routeStartMinute;
                    const segments: Segment[] = [];
                    for (let i = 1; i < points.length; i++) {
                        const weight = sumKm > 0 ? (legDistancesKm[i - 1] / sumKm) : (1 / (points.length - 1));
                        const segSeconds = Math.max(30, Math.round(totalSeconds * weight));
                        const startMinute = cursor;
                        const endMinute = cursor + segSeconds / 60;
                        segments.push({
                            fromNodeId: points[i - 1].nodeId,
                            toNodeId: points[i].nodeId,
                            startMinute,
                            endMinute,
                            from: { lat: points[i - 1].lat, lng: points[i - 1].lng },
                            to: { lat: points[i].lat, lng: points[i].lng },
                        });
                        cursor = endMinute;
                    }
                    return segments;
                }

                // Calculate bearing/heading between two points (in degrees, 0 = North)
                function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
                    const toRad = (deg: number) => deg * Math.PI / 180;
                    const toDeg = (rad: number) => rad * 180 / Math.PI;
                    const dLng = toRad(lng2 - lng1);
                    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
                    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
                    const bearing = toDeg(Math.atan2(y, x));
                    return (bearing + 360) % 360; // Normalize to 0-360
                }

                function interpolatePosition(segments: Segment[], nowMinute: number): { lat: number; lng: number; heading: number; segmentIndex: number | null } {
                    if (!segments.length) return { lat: 0, lng: 0, heading: 0, segmentIndex: null };
                    if (nowMinute <= segments[0].startMinute) {
                        const s = segments[0];
                        const heading = calculateBearing(s.from.lat, s.from.lng, s.to.lat, s.to.lng);
                        return { lat: s.from.lat, lng: s.from.lng, heading, segmentIndex: 0 };
                    }
                    if (nowMinute >= segments[segments.length - 1].endMinute) {
                        const last = segments[segments.length - 1];
                        const heading = calculateBearing(last.from.lat, last.from.lng, last.to.lat, last.to.lng);
                        return { lat: last.to.lat, lng: last.to.lng, heading, segmentIndex: segments.length - 1 };
                    }

                    for (let i = 0; i < segments.length; i++) {
                        const s = segments[i];
                        if (nowMinute >= s.startMinute && nowMinute <= s.endMinute) {
                            const denom = (s.endMinute - s.startMinute);
                            const t = denom > 0 ? (nowMinute - s.startMinute) / denom : 0;
                            const lat = s.from.lat + (s.to.lat - s.from.lat) * t;
                            const lng = s.from.lng + (s.to.lng - s.from.lng) * t;
                            const heading = calculateBearing(s.from.lat, s.from.lng, s.to.lat, s.to.lng);
                            return { lat, lng, heading, segmentIndex: i };
                        }
                    }
                    const fallback = segments[0];
                    const heading = calculateBearing(fallback.from.lat, fallback.from.lng, fallback.to.lat, fallback.to.lng);
                    return { lat: fallback.from.lat, lng: fallback.from.lng, heading, segmentIndex: 0 };
                }

                function buildTimelineForRoute(route: DispatchRoute, nowMinute: number): { events: TimelineEvent[]; startMinute: number; endMinute: number } {
                    const startHHmm = route.meta?.startTimeUnix ? unixToLocalHHmm(route.meta.startTimeUnix) : '08:00';
                    const startMinute = toMinutes(startHHmm);
                    const segments = computeRouteSegments(route, startMinute, route.meta?.plannedDurationSeconds ?? null);
                    const endMinute = segments.length ? segments[segments.length - 1].endMinute : startMinute;

                    const events: TimelineEvent[] = [];
                    const stops = route.stops ?? [];

                    // Depot start marker
                    events.push({
                        id: `evt-${route.id}-depot-start`,
                        type: 'depot',
                        startTime: minutesToHHmm(startMinute),
                        endTime: minutesToHHmm(startMinute),
                        status: nowMinute >= startMinute ? 'completed' : 'pending',
                        label: 'Kho',
                    });

                    // For each driving segment, and then a stop marker at arrival.
                    segments.forEach((seg, idx) => {
                        const segStatus: TimelineEvent['status'] =
                            nowMinute >= seg.endMinute ? 'completed' :
                            nowMinute >= seg.startMinute ? 'in_progress' : 'pending';

                        events.push({
                            id: `evt-${route.id}-drive-${idx}`,
                            type: 'driving',
                            startTime: minutesToHHmm(seg.startMinute),
                            endTime: minutesToHHmm(seg.endMinute),
                            status: segStatus,
                            label: 'Di chuyển',
                        });

                        // arrival stop
                        const stop = stops[idx + 1];
                        if (!stop) return;

                        const kind = String(stop.kind || '').toLowerCase();
                        const isDepot = stop.nodeId === 0 || kind === 'depot';
                        if (isDepot) {
                            events.push({
                                id: `evt-${route.id}-depot-end`,
                                type: 'depot',
                                startTime: minutesToHHmm(seg.endMinute),
                                endTime: minutesToHHmm(seg.endMinute),
                                status: nowMinute >= seg.endMinute ? 'completed' : 'pending',
                                label: 'Kho',
                            });
                            return;
                        }

                        const stopType: TimelineEvent['type'] = kind === 'pickup' ? 'pickup' : 'delivery';
                        const stopStatus: TimelineEvent['status'] = nowMinute >= seg.endMinute ? 'completed' : 'pending';
                        const labelBase = stopType === 'pickup' ? 'Pickup' : 'Delivery';
                        const label = stop.orderId ? `${labelBase} ${stop.orderId}` : `${labelBase} #${stop.nodeId}`;

                        events.push({
                            id: `evt-${route.id}-stop-${idx}`,
                            type: stopType,
                            startTime: minutesToHHmm(seg.endMinute),
                            endTime: minutesToHHmm(seg.endMinute),
                            status: stopStatus,
                            label,
                        });
                    });

                    return { events, startMinute, endMinute };
                }

                const orgId = typeof window !== 'undefined' ? getOrgIdFromLocalStorage() : null;

                // Fetch basic data
                const [driversData, vehiclesData, activeAssignments] = await Promise.all([
                    getDrivers(orgId ?? undefined).catch(() => []),
                    getVehicles(orgId ?? undefined).catch(() => []),
                    orgId ? getActiveRouteAssignments(orgId).catch(() => [] as RouteAssignment[]) : Promise.resolve([] as RouteAssignment[]),
                ]);

                // Map Drivers & Vehicles
                const nowMinute = toMinutes(currentTime);

                // Load routes for latest solution (if available)
                let effectiveRoutes: DispatchRoute[] = [];
                let solutionNodes: SolutionNode[] = [];
                if (isUuid(activeSolutionId)) {
                    try {
                        if (lastLoadedSolutionIdRef.current !== activeSolutionId) {
                            const loaded = await loadRoutesForSolution(activeSolutionId);
                            effectiveRoutes = loaded.routes;
                            solutionNodes = loaded.nodes;
                            lastLoadedSolutionIdRef.current = activeSolutionId;
                        } else {
                            effectiveRoutes = routesRef.current;
                        }
                    } catch (e: any) {
                        console.error('Failed to load routes for solution:', e);
                        toast.error(e?.message || 'Không thể tải routes theo solution mới nhất');
                        effectiveRoutes = [];
                        lastLoadedSolutionIdRef.current = null;
                    }
                }

                // Depot from organization (prioritize user's organization depot)
                let depotNode: { lat: number; lng: number };
                if (organization?.depot_latitude != null && organization?.depot_longitude != null) {
                    depotNode = {
                        lat: Number(organization.depot_latitude),
                        lng: Number(organization.depot_longitude)
                    };
                } else if (solutionNodes[0]) {
                    // Fallback to solution data if organization depot not set
                    depotNode = { lat: solutionNodes[0].lat, lng: solutionNodes[0].lng };
                } else {
                    // Final fallback to Hanoi center
                    depotNode = { lat: 21.0285, lng: 105.85 };
                }
                setDepot(depotNode);

                // Compute per-route positions (interpolated based on current time) and per-vehicle timelines
                const routePositions = new Map<string, { lat: number; lng: number; heading: number }>();
                const vehiclePositions = new Map<string, { lat: number; lng: number; busy: boolean; orderCount: number }>();
                const timelinesByVehicle = new Map<string, TimelineEvent[]>();

                for (const r of effectiveRoutes) {
                    const timeline = buildTimelineForRoute(r, nowMinute);
                    
                    const startMinute = timeline.startMinute;
                    const endMinute = timeline.endMinute;
                    const segments = computeRouteSegments(r, startMinute, r.meta?.plannedDurationSeconds ?? null);
                    const pos = segments.length ? interpolatePosition(segments, nowMinute) : { lat: depotNode.lat, lng: depotNode.lng, heading: 0, segmentIndex: null };
                    const busy = nowMinute >= startMinute && nowMinute <= endMinute;
                    
                    // Store position by route ID (for MonitorMap)
                    routePositions.set(r.id, { lat: pos.lat, lng: pos.lng, heading: pos.heading });
                    
                    // Also store by vehicle ID (for driver mapping)
                    if (r.vehicleId && r.vehicleId !== 'unknown') {
                        timelinesByVehicle.set(r.vehicleId, timeline.events);
                        vehiclePositions.set(r.vehicleId, { lat: pos.lat, lng: pos.lng, heading: pos.heading, busy, orderCount: r.orderCount });
                    }
                }
                
                // Store routePositions for MonitorMap
                setRoutePositions(routePositions);

                // Map Drivers & Vehicles using actual assignment (if any) and computed positions.
                const mappedDrivers: DispatchDriver[] = driversData.map(driver => {
                    const vehicle = vehiclesData.find(v => v.id === driver.vehicle?.id || (driver.vehicle as any)?.id === v.id); // Check various ways vehicle might be linked
                    // Fallback matching if not directly linked in response
                    const assignedVehicle = vehicle || vehiclesData.find(v => v.is_active);

                    const vehicleId = assignedVehicle?.id || null;
                    const computed = vehicleId ? vehiclePositions.get(vehicleId) : undefined;

                    return {
                        id: driver.id,
                        name: driver.full_name,
                        status: !driver.is_active ? 'offline' : (computed?.busy ? 'busy' : 'available'),
                        vehicleType: assignedVehicle ? (vehicleTypeLabels[assignedVehicle.vehicle_type] || assignedVehicle.vehicle_type) : 'Chưa có xe',
                        vehiclePlate: assignedVehicle?.license_plate || '---',
                        vehicleId,
                        capacity: assignedVehicle?.capacity_weight || 1000,
                        currentLat: computed?.lat ?? depotNode.lat,
                        currentLng: computed?.lng ?? depotNode.lng,
                        heading: computed?.heading ?? 0,
                        distanceToDepot: '5 km'
                    };
                });

                // Prefer solution routes; if no solutionId, fallback to mock routes and empty timelines.
                if (!effectiveRoutes.length) {
                    const mockRoutes: DispatchRoute[] = mappedDrivers
                        .filter(d => d.status !== 'offline')
                        .map((d, idx) => ({
                            id: `route-${d.id}`,
                            vehicleId: d.vehicleId || 'unknown',
                            color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981'][idx % 5],
                            orderCount: Math.floor(Math.random() * 10) + 1,
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [depotNode.lng, depotNode.lat],
                                    [d.currentLng, d.currentLat],
                                ]
                            }
                        }));
                    effectiveRoutes = mockRoutes;
                }

                // Debug: log driver and route counts
                console.log('[Monitor] Data loaded:', {
                    driversCount: mappedDrivers.length,
                    routesCount: effectiveRoutes.length,
                    routeIds: effectiveRoutes.map(r => r.id),
                    vehicleIds: effectiveRoutes.map(r => r.vehicleId),
                    routePositionsCount: routePositions.size,
                    routePositionsSample: Array.from(routePositions.entries()).slice(0, 3),
                });

                setDrivers(mappedDrivers);
                setRoutes(effectiveRoutes);

                const computedTimelines: DriverTimeline[] = effectiveRoutes.map((r, idx) => {
                    const timeline = r.vehicleId && r.vehicleId !== 'unknown' 
                        ? timelinesByVehicle.get(r.vehicleId) 
                        : buildTimelineForRoute(r, nowMinute).events;
                    return {
                        driverId: r.id,
                        driverName: `Route #${r.meta?.routeNumber ?? idx + 1}`,
                        vehiclePlate: r.vehicleId !== 'unknown' ? `Vehicle ${r.vehicleId.slice(0, 8)}` : '---',
                        events: timeline ?? [],
                        color: r.color,
                        orderCount: r.orderCount,
                    };
                });

                setTimelines(computedTimelines);

                // Calculate real stats from routes
                const totalDistance = effectiveRoutes.reduce((sum, r) => {
                    const meters = r.meta?.plannedDistanceMeters;
                    return sum + (Number.isFinite(meters) ? meters / 1000 : 0);
                }, 0);

                // Find the longest route duration (max instead of sum)
                const maxDurationSeconds = effectiveRoutes.reduce((max, r) => {
                    const secs = r.meta?.plannedDurationSeconds;
                    const duration = Number.isFinite(secs) ? secs : 0;
                    return Math.max(max, duration);
                }, 0);

                const totalHours = Math.floor(maxDurationSeconds / 3600);
                const totalMinutes = Math.floor((maxDurationSeconds % 3600) / 60);

                // Update Stats with real data
                setStats({
                    totalRoutes: effectiveRoutes.length,
                    completedRoutes: 0, // Would need real tracking data
                    attentionRoutes: 0, // Would need real tracking data
                    totalDistance: totalDistance,
                    totalTimeFormatted: `${totalHours}h ${totalMinutes.toString().padStart(2, '0')}p`,
                    changedRoutes: 0,
                    deviatedRoutes: 0
                });

                // Update last updated timestamp
                const now = new Date();
                setLastUpdated(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);

            } catch (e) {
                console.error("Failed to load monitoring data:", e);
            } finally {
                setLoading(false);
            }
        }

        loadData();
        intervalId = setInterval(loadData, 10000);
        return () => clearInterval(intervalId);
    }, [activeSolutionId]);

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">Đang tải dữ liệu giám sát...</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-100">
            <div className="flex flex-col flex-1 overflow-hidden relative">
                {/* Main Map Area - 2/3 height */}
                <div className="h-2/3 relative">
                    <MonitorMap
                        drivers={drivers}
                        routes={routes}
                        routePositions={routePositions}
                        selectedDriverId={selectedDriverId}
                        onSelectDriver={setSelectedDriverId}
                        depot={depot}
                        useRealRouting={true}
                        currentTime={currentTime}
                        lastUpdated={lastUpdated}
                    />

                    {/* Floating Filter / Toggle Buttons */}
                    <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-blue-700">
                            Timeline
                        </button>
                        <button className="bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-gray-50">
                            Thống kê
                        </button>
                    </div>
                </div>

                {/* Bottom Timeline Panel - 1/3 height */}
                <div className="h-1/3 border-t bg-white relative z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.1)] overflow-hidden">
                    <MonitorTimeline
                        timelines={timelines}
                        currentTime={currentTime}
                    />
                </div>
            </div>

            {/* Footer Stats */}
            <MonitorStats
                {...stats}
            />
        </div>
    );
}
