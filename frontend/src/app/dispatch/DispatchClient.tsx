"use client";

import React, { useState, useEffect } from 'react';
import { Send, ListTodo, Package, Truck, Users, UserCircle2, MapPin, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DispatchSidebarLeft from '@/components/dispatch/DispatchSidebarLeft';
import DispatchSidebarRight from '@/components/dispatch/DispatchSidebarRight';
import DispatchMap from '@/components/dispatch/DispatchMap';
import { Route, Instance, Node, createInstance, createNode, createRoute } from '@/utils/dataModels';
import { getDrivers, getVehicles, assignExistingRouteToVehicle, assignRouteToVehicle, getUnassignedRoutes, getActiveRouteAssignments, Driver, Vehicle } from '@/services/driverService';
import { useGetSessionQuery } from '@/lib/redux/services/auth';
import { useGetUserProfileOverviewQuery } from '@/lib/redux/services/userApi';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/supabase/client';

// --- Types ---
export interface DispatchRoute {
    id: number | string;
    name: string;
    stops: number;
    distance: number;
    duration: number;
    totalLoad: number;
    originalRoute: Route;
    isAssigned?: boolean;
    dbRouteId?: string; // Database route ID for updating
}

export interface DispatchVehicle {
    id: string;
    licensePlate: string;
    vehicleType: string;
    capacity: number;
    status: 'available' | 'busy' | 'offline';
    currentLat: number;
    currentLng: number;
    distanceToDepot: string;
    driverId?: string | null; // Optional driver assignment
    driverName?: string | null;
}

// Vehicle type labels
const vehicleTypeLabels: Record<string, string> = {
    'motorcycle': 'Xe máy',
    'van': 'Van',
    'truck_small': 'Xe tải nhỏ',
    'truck_medium': 'Xe tải vừa',
    'truck_large': 'Xe tải lớn'
};

function isUuid(value: string | null | undefined): value is string {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildMinimalInstanceFromSolutionData(solutionData: any): Instance {
    const inst = createInstance();
    const mapping = Array.isArray(solutionData?.mapping_ids) ? solutionData.mapping_ids : [];

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
        return createNode(
            idx,
            [Number.isFinite(lat) ? lat : 0, Number.isFinite(lng) ? lng : 0],
            0,
            [0, 1_000_000],
            0,
            isPickup,
            isDelivery,
        );
    });

    inst.all_coords = inst.nodes.map((n) => n.coords);
    inst.size = inst.nodes.length;
    inst.times = [];
    return inst;
}

function buildRouteFromDbRow(dbRoute: any, idx: number, instance: Instance | null): Route {
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
    const routeNumber = Number(dbRoute?.route_number);
    const id = Number.isFinite(routeNumber) ? routeNumber : idx + 1;
    const route = createRoute(id);
    route.cost = Number(dbRoute?.planned_cost ?? 0);
    route.set_color(palette[idx % palette.length]);

    const seq = Array.isArray(dbRoute?.route_data?.route_sequence)
        ? dbRoute.route_data.route_sequence.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : [];

    route.sequence = [0, ...seq, 0];
    route.path = route.sequence
        .map((nodeId) => instance?.nodes?.find((n) => n.id === nodeId)?.coords)
        .filter(Boolean) as [number, number][];

    (route as any).db_route_id = dbRoute?.id;
    (route as any).route_number = dbRoute?.route_number;
    (route as any).planned_distance_km = dbRoute?.planned_distance_km;
    (route as any).planned_duration_hours = dbRoute?.planned_duration_hours;

    return route;
}

export default function DispatchClient() {
    const searchParams = useSearchParams();
    const urlSolutionId = searchParams?.get('solutionId') || searchParams?.get('solution_id');
    const scopedSolutionId = isUuid(urlSolutionId) ? urlSolutionId : null;

    const [selectedRouteId, setSelectedRouteId] = useState<number | string | null>(null);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [routes, setRoutes] = useState<DispatchRoute[]>([]);
    const [vehicles, setVehicles] = useState<DispatchVehicle[]>([]);
    const [instance, setInstance] = useState<Instance | null>(null);
    const [loading, setLoading] = useState(true);
    const [assignedCount, setAssignedCount] = useState(0);
    const [organizationId, setOrganizationId] = useState<string | null>(null);

    // Get current user session and profile
    const { data: sessionData } = useGetSessionQuery();
    const userId = sessionData?.session?.user?.id;
    const { data: userProfile } = useGetUserProfileOverviewQuery(userId ?? "", { skip: !userId });
    const currentOrgId = userProfile?.organization?.id;

    useEffect(() => {
        if (currentOrgId) {
            setOrganizationId(currentOrgId);
        }
    }, [currentOrgId]);

    useEffect(() => {
        async function loadData() {
            if (!organizationId) {
                // Wait for organization ID
                return;
            }

            try {
                setLoading(true);

                // Fetch routes. If solutionId is present, scope to that solution; otherwise show unassigned routes.
                const dbRoutes = scopedSolutionId
                    ? (await supabase
                        .from('routes')
                        .select(`
                            *,
                            optimization_solutions (
                                solution_data
                            )
                        `)
                        .eq('organization_id', organizationId)
                        .eq('solution_id', scopedSolutionId)
                        .order('route_number', { ascending: true })
                    ).data
                    : await getUnassignedRoutes(organizationId);

                const allDbRoutes: any[] = Array.isArray(dbRoutes) ? dbRoutes : [];

                // Extract instance and routes from persisted DB format.
                // - optimization_solutions.solution_data commonly has mapping_ids (not full instance/routes)
                // - routes.route_data commonly has route_sequence
                let parsedInstance: Instance | null = null;
                const routeMap = new Map<string, { route: Route; dbRouteId: string; isAssigned: boolean }>();

                for (let i = 0; i < allDbRoutes.length; i++) {
                    const dbRoute: any = allDbRoutes[i];
                    const solutionData = dbRoute?.optimization_solutions?.solution_data;

                    // Determine if route is assigned based on vehicle_id and status
                    const hasVehicle = !!dbRoute?.vehicle_id;
                    const isAssignedStatus = dbRoute?.status === 'assigned' || dbRoute?.status === 'in_progress';
                    const isAssigned = hasVehicle && isAssignedStatus;

                    if (!parsedInstance && solutionData) {
                        if (Array.isArray(solutionData?.mapping_ids)) {
                            parsedInstance = buildMinimalInstanceFromSolutionData(solutionData);
                        } else if (solutionData?.instance) {
                            // Back-compat if older solutions stored full instance.
                            parsedInstance = solutionData.instance as Instance;
                        }
                    }

                    // Primary: build route from routes.route_data.route_sequence
                    const hasRouteSequence = Array.isArray(dbRoute?.route_data?.route_sequence);
                    if (hasRouteSequence) {
                        const built = buildRouteFromDbRow(dbRoute, i, parsedInstance);
                        routeMap.set(String(dbRoute.id), { route: built, dbRouteId: String(dbRoute.id), isAssigned });
                        continue;
                    }

                    // Fallback: if some older records stored route in solution_data
                    if (solutionData?.route) {
                        routeMap.set(String(dbRoute.id), { route: solutionData.route as Route, dbRouteId: String(dbRoute.id), isAssigned });
                    }
                }

                // Fallback to localStorage if no database routes found
                if (!parsedInstance || routeMap.size === 0) {
                    const lsRoutes = localStorage.getItem('allRoutes');
                    const lsInstance = localStorage.getItem('currentInstance');

                    if (lsRoutes && lsInstance) {
                        const parsedRoutes = JSON.parse(lsRoutes);
                        parsedInstance = JSON.parse(lsInstance);
                        parsedRoutes.forEach((r: Route) => {
                            routeMap.set(String(r.id), { route: r, dbRouteId: String(r.id), isAssigned: false });
                        });
                    }
                }

                if (parsedInstance) {
                    setInstance(parsedInstance);
                }

                // Map routes to DispatchRoute format
                const mappedRoutes: DispatchRoute[] = Array.from(routeMap.values()).map(({ route: r, dbRouteId, isAssigned }) => {
                    let totalLoad = 0;
                    let stops = 0;
                    let duration = 0;

                    if (r.sequence && parsedInstance?.nodes) {
                        let currentLoad = 0;
                        let maxLoad = 0;

                        for (let i = 0; i < r.sequence.length; i++) {
                            const nodeId = r.sequence[i];
                            const node = parsedInstance.nodes.find(n => n.id === nodeId);
                            if (node) {
                                currentLoad += node.demand || 0;
                                maxLoad = Math.max(maxLoad, currentLoad);
                                duration += node.duration || 0;
                                if (!node.is_depot) stops++;
                            }

                            if (i < r.sequence.length - 1 && parsedInstance.times) {
                                const nextNodeId = r.sequence[i + 1];
                                if (parsedInstance.times[nodeId] && parsedInstance.times[nodeId][nextNodeId] !== undefined) {
                                    duration += parsedInstance.times[nodeId][nextNodeId];
                                }
                            }
                        }
                        totalLoad = maxLoad;
                    }

                    return {
                        // Use DB route id as the stable unique identifier for UI keys and selection.
                        id: dbRouteId,
                        name: `Route #${(r as any).route_number ?? r.id}`,
                        stops: stops,
                        distance: r.cost || 0,
                        duration: parseFloat(duration.toFixed(2)),
                        totalLoad: totalLoad,
                        originalRoute: r,
                        isAssigned: isAssigned,
                        dbRouteId: dbRouteId
                    };
                });

                setRoutes(mappedRoutes);
                if (mappedRoutes.length > 0) {
                    setSelectedRouteId(mappedRoutes[0].id);
                }

                // Fetch vehicles and active route assignments
                const [vehiclesData, activeAssignments, driversData] = await Promise.all([
                    getVehicles(organizationId),
                    getActiveRouteAssignments(organizationId),
                    getDrivers(organizationId) // Still fetch drivers to show driver name if assigned
                ]);

                // Create a map of vehicle_id -> driver_id from active assignments (for display)
                const vehicleDriverMap = new Map<string, string>();
                activeAssignments.forEach(assignment => {
                    if (assignment.vehicle_id && assignment.driver_id) {
                        vehicleDriverMap.set(assignment.vehicle_id, assignment.driver_id);
                    }
                });

                // Create a set of vehicles that are already assigned to routes
                const usedVehicleIds = new Set(activeAssignments
                    .map(a => a.vehicle_id)
                    .filter((id): id is string => id !== null));

                // Map vehicles for dispatch
                const mappedVehicles: DispatchVehicle[] = vehiclesData
                    .filter(v => v.is_active) // Only show active vehicles
                    .map(vehicle => {
                        const assignedDriverId = vehicleDriverMap.get(vehicle.id);
                        const assignedDriver = assignedDriverId
                            ? driversData.find(d => d.id === assignedDriverId)
                            : null;

                        const isBusy = usedVehicleIds.has(vehicle.id);

                        return {
                            id: vehicle.id,
                            licensePlate: vehicle.license_plate,
                            vehicleType: vehicleTypeLabels[vehicle.vehicle_type] || vehicle.vehicle_type,
                            capacity: vehicle.capacity_weight,
                            status: isBusy ? 'busy' : 'available',
                            currentLat: vehicle.current_latitude || 0,
                            currentLng: vehicle.current_longitude || 0,
                            distanceToDepot: 'N/A',
                            driverId: assignedDriverId || null,
                            driverName: assignedDriver?.full_name || null
                        };
                    });

                setVehicles(mappedVehicles);
            } catch (e) {
                console.error("Failed to load data:", e);
                toast.error('Không thể tải dữ liệu');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [organizationId, scopedSolutionId]);

    // Handle route assignment to vehicle
    const handleAssignRoute = async (vehicleId: string) => {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const route = routes.find(r => r.id === selectedRouteId);

        if (!vehicle || !route) {
            toast.error('Vui lòng chọn xe và tuyến đường');
            return;
        }

        if (!organizationId) {
            toast.error('Không tìm thấy thông tin tổ chức');
            return;
        }

        try {
            const dbRouteId = route.dbRouteId;
            const canUpdateExisting = isUuid(dbRouteId);
            if (canUpdateExisting) {
                await assignExistingRouteToVehicle({
                    organizationId,
                    routeId: dbRouteId as string,
                    vehicleId: vehicle.id,
                    driverId: vehicle.driverId || null,
                });
            } else {
                await assignRouteToVehicle({
                    organizationId: organizationId,
                    vehicleId: vehicle.id,
                    driverId: vehicle.driverId || null, // Optional driver
                    solutionData: {
                        route: route.originalRoute,
                        instance: instance
                    },
                    totalDistanceKm: route.distance / 1000,
                    totalDurationHours: route.duration / 60
                });
            }

            // Update UI - mark route as assigned (instead of removing)
            setRoutes(prev => prev.map(r =>
                r.id === route.id ? { ...r, isAssigned: true } : r
            ));
            setVehicles(prev => prev.map(v =>
                v.id === vehicleId ? { ...v, status: 'busy' } : v
            ));
            setAssignedCount(prev => prev + 1);
            setSelectedRouteId(null);
            setSelectedVehicleId(null);

            toast.success(`Đã gán ${route.name} cho ${vehicle.licensePlate}`);
        } catch (error) {
            console.error('Assignment failed:', error);
            toast.error('Không thể gán tuyến đường');
        }
    };

    const selectedRoute = routes.find(r => r.id === selectedRouteId) || null;
    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null;

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading data...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-[#f0f2f5] text-[#333333]">
            {/* Top Header */}
            <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 z-20 relative shadow-sm">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                            <ListTodo size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Tổng số tuyến</div>
                            <div className="text-xl font-bold text-gray-800">{routes.length}</div>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-gray-200"></div>

                    <div className="flex items-center gap-3">
                        <div className="bg-green-50 p-2 rounded-lg border border-green-100">
                            <Truck size={20} className="text-green-600" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Xe sẵn sàng</div>
                            <div className="text-xl font-bold text-gray-800">
                                {vehicles.filter(v => v.status === 'available').length} <span className="text-sm font-normal text-gray-400">/ {vehicles.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-gray-200"></div>

                    <div className="flex items-center gap-3">
                        <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
                            <Users size={20} className="text-purple-600" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Đã ghép nối</div>
                            <div className="text-xl font-bold text-gray-800">
                                {assignedCount} <span className="text-sm font-normal text-gray-400">/ {routes.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <button className="bg-[#1677ff] hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95">
                        <Send size={18} />
                        <span>Điều phối tất cả</span>
                    </button>
                </div>
            </header>

            {/* Main Content - 3 Columns */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <DispatchSidebarLeft
                    routes={routes}
                    selectedRouteId={selectedRouteId}
                    onSelectRoute={setSelectedRouteId}
                />

                {/* Center Map */}
                <div className="flex-1 relative bg-gray-200">
                    <DispatchMap
                        vehicles={vehicles}
                        selectedVehicleId={selectedVehicleId}
                        onSelectVehicle={setSelectedVehicleId}
                        selectedRoute={selectedRoute}
                        instance={instance}
                    />
                </div>

                {/* Right Sidebar */}
                <DispatchSidebarRight
                    vehicles={vehicles}
                    selectedVehicleId={selectedVehicleId}
                    onSelectVehicle={setSelectedVehicleId}
                    selectedRoute={selectedRoute}
                    onAssignRoute={handleAssignRoute}
                />
            </div>
        </div>
    );
}
