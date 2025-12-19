"use client";

import React, { useState, useEffect } from 'react';
import { Send, ListTodo, Package, Truck, Users, UserCircle2, MapPin, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DispatchSidebarLeft from '@/components/dispatch/DispatchSidebarLeft';
import DispatchSidebarRight from '@/components/dispatch/DispatchSidebarRight';
import DispatchMap from '@/components/dispatch/DispatchMap';
import { Route, Instance, Node } from '@/utils/dataModels';
import { getDrivers, getVehicles, assignRouteToDriver, Driver, Vehicle } from '@/services/driverService';
import { toast } from 'sonner';

// --- Types ---
export interface DispatchRoute {
    id: number;
    name: string;
    stops: number;
    distance: number;
    duration: number;
    totalLoad: number;
    originalRoute: Route;
    isAssigned?: boolean;
}

export interface DispatchDriver {
    id: string;
    name: string;
    status: 'available' | 'busy' | 'offline';
    vehicleType: string;
    vehicleId: string | null;
    capacity: number;
    currentLat: number;
    currentLng: number;
    distanceToDepot: string;
}

// Vehicle type labels
const vehicleTypeLabels: Record<string, string> = {
    'motorcycle': 'Xe máy',
    'van': 'Van',
    'truck_small': 'Xe tải nhỏ',
    'truck_medium': 'Xe tải vừa',
    'truck_large': 'Xe tải lớn'
};

export default function DispatchClient() {
    const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [routes, setRoutes] = useState<DispatchRoute[]>([]);
    const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
    const [instance, setInstance] = useState<Instance | null>(null);
    const [loading, setLoading] = useState(true);
    const [assignedCount, setAssignedCount] = useState(0);

    useEffect(() => {
        async function loadData() {
            try {
                // Load routes from localStorage
                const lsRoutes = localStorage.getItem('allRoutes');
                const lsInstance = localStorage.getItem('currentInstance');

                if (lsRoutes && lsInstance) {
                    const parsedRoutes: Route[] = JSON.parse(lsRoutes);
                    const parsedInstance: Instance = JSON.parse(lsInstance);

                    setInstance(parsedInstance);

                    const mappedRoutes: DispatchRoute[] = parsedRoutes.map((r, index) => {
                        let totalLoad = 0;
                        let stops = 0;
                        let duration = 0;

                        if (r.sequence && parsedInstance.nodes) {
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
                            id: r.id,
                            name: `Route #${r.id}`,
                            stops: stops,
                            distance: r.cost || 0,
                            duration: parseFloat(duration.toFixed(2)),
                            totalLoad: totalLoad,
                            originalRoute: r,
                            isAssigned: false
                        };
                    });

                    setRoutes(mappedRoutes);
                    if (mappedRoutes.length > 0) {
                        setSelectedRouteId(mappedRoutes[0].id);
                    }
                }

                // Fetch drivers and vehicles from Supabase
                const [driversData, vehiclesData] = await Promise.all([
                    getDrivers(),
                    getVehicles()
                ]);

                // Map drivers with their vehicles
                const mappedDrivers: DispatchDriver[] = driversData.map(driver => {
                    // Find a vehicle for this driver (simple assignment for now)
                    const vehicle = vehiclesData.find(v => v.is_active);
                    return {
                        id: driver.id,
                        name: driver.full_name,
                        status: driver.is_active ? 'available' : 'offline',
                        vehicleType: vehicle ? (vehicleTypeLabels[vehicle.vehicle_type] || vehicle.vehicle_type) : 'Chưa có xe',
                        vehicleId: vehicle?.id || null,
                        capacity: vehicle?.capacity_weight || 1000,
                        currentLat: vehicle?.current_latitude || 0,
                        currentLng: vehicle?.current_longitude || 0,
                        distanceToDepot: 'N/A'
                    };
                });

                setDrivers(mappedDrivers);
            } catch (e) {
                console.error("Failed to load data:", e);
                toast.error('Không thể tải dữ liệu');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Handle route assignment
    const handleAssignRoute = async (driverId: string) => {
        const driver = drivers.find(d => d.id === driverId);
        const route = routes.find(r => r.id === selectedRouteId);

        if (!driver || !route || !driver.vehicleId) {
            toast.error('Vui lòng chọn tài xế có xe');
            return;
        }

        try {
            await assignRouteToDriver({
                organizationId: '00000000-0000-0000-0000-000000000000', // TODO: Get from auth context
                driverId: driver.id,
                vehicleId: driver.vehicleId,
                solutionData: {
                    route: route.originalRoute,
                    instance: instance
                },
                totalDistanceKm: route.distance / 1000,
                totalDurationHours: route.duration / 60
            });

            // Update UI
            setRoutes(prev => prev.map(r =>
                r.id === route.id ? { ...r, isAssigned: true } : r
            ));
            setDrivers(prev => prev.map(d =>
                d.id === driverId ? { ...d, status: 'busy' } : d
            ));
            setAssignedCount(prev => prev + 1);
            setSelectedRouteId(null);
            setSelectedDriverId(null);

            toast.success(`Đã gán ${route.name} cho ${driver.name}`);
        } catch (error) {
            console.error('Assignment failed:', error);
            toast.error('Không thể gán tuyến đường');
        }
    };

    const selectedRoute = routes.find(r => r.id === selectedRouteId) || null;
    const selectedDriver = drivers.find(d => d.id === selectedDriverId) || null;

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
                                {drivers.filter(d => d.status === 'available').length} <span className="text-sm font-normal text-gray-400">/ {drivers.length}</span>
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
                        drivers={drivers}
                        selectedDriverId={selectedDriverId}
                        onSelectDriver={setSelectedDriverId}
                        selectedRoute={selectedRoute}
                        instance={instance}
                    />
                </div>

                {/* Right Sidebar */}
                <DispatchSidebarRight
                    drivers={drivers}
                    selectedDriverId={selectedDriverId}
                    onSelectDriver={setSelectedDriverId}
                    selectedRoute={selectedRoute}
                    onAssignRoute={handleAssignRoute}
                />
            </div>
        </div>
    );
}
