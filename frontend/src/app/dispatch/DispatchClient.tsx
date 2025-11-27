"use client";

import React, { useState, useEffect } from 'react';
import { Send, ListTodo, Package, Truck, Users, UserCircle2, MapPin, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Assuming shadcn/ui or similar exists, otherwise I'll use standard HTML button or check existing components
// I'll use standard HTML/Tailwind for now if I'm not sure about the UI library, but the plan mentioned "Button type='primary'". 
// I'll check if there is a Button component.
import DispatchSidebarLeft from '@/components/dispatch/DispatchSidebarLeft';
import DispatchSidebarRight from '@/components/dispatch/DispatchSidebarRight';
import DispatchMap from '@/components/dispatch/DispatchMap';
import { Route, Instance, Node } from '@/utils/dataModels';

// --- Types ---
export interface DispatchRoute {
    id: number;
    name: string;
    stops: number;
    distance: number;
    duration: number;
    totalLoad: number;
    originalRoute: Route; // Keep reference to original route for map
}

export interface DispatchDriver {
    id: string;
    name: string;
    status: 'available' | 'busy' | 'offline';
    vehicleType: string;
    capacity: number;
    currentLat: number;
    currentLng: number;
    distanceToDepot: string;
}

// --- Mock Data (Drivers only) ---
const mockDrivers: DispatchDriver[] = [
    {
        id: 'D01',
        name: 'Nguyễn Văn A',
        status: 'available',
        vehicleType: 'Van 1T',
        capacity: 1000,
        currentLat: 21.0285,
        currentLng: 105.8500,
        distanceToDepot: '0.5km'
    },
    {
        id: 'D02',
        name: 'Trần Thị B',
        status: 'busy',
        vehicleType: 'Xe máy',
        capacity: 150,
        currentLat: 21.0300,
        currentLng: 105.8400,
        distanceToDepot: '2.1km'
    },
    {
        id: 'D03',
        name: 'Lê Văn C',
        status: 'available',
        vehicleType: 'Xe tải 2T',
        capacity: 2000,
        currentLat: 21.0250,
        currentLng: 105.8300,
        distanceToDepot: '0.8km'
    },
    {
        id: 'D04',
        name: 'Phạm Văn D',
        status: 'available',
        vehicleType: 'Van 500kg',
        capacity: 500,
        currentLat: 21.0350,
        currentLng: 105.8450,
        distanceToDepot: '1.2km'
    },
    {
        id: 'D05',
        name: 'Hoàng Thị E',
        status: 'offline',
        vehicleType: 'Xe máy',
        capacity: 150,
        currentLat: 21.0200,
        currentLng: 105.8600,
        distanceToDepot: '3.5km'
    },
    {
        id: 'D06',
        name: 'Vũ Văn F',
        status: 'available',
        vehicleType: 'Xe tải 5T',
        capacity: 5000,
        currentLat: 21.0400,
        currentLng: 105.8350,
        distanceToDepot: '4.0km'
    },
    {
        id: 'D07',
        name: 'Đặng Thị G',
        status: 'busy',
        vehicleType: 'Van 1T',
        capacity: 1000,
        currentLat: 21.0150,
        currentLng: 105.8550,
        distanceToDepot: '2.8km'
    },
    {
        id: 'D08',
        name: 'Bùi Văn H',
        status: 'available',
        vehicleType: 'Xe máy',
        capacity: 150,
        currentLat: 21.0320,
        currentLng: 105.8420,
        distanceToDepot: '1.5km'
    },
    {
        id: 'D09',
        name: 'Nguyễn Văn I',
        status: 'available',
        vehicleType: 'Xe tải 2T',
        capacity: 2000,
        currentLat: 41.37624639563665,
        currentLng: 2.1783269789290287,
        distanceToDepot: '5.0km'
    },
    {
        id: 'D10',
        name: 'Trần Thị K',
        status: 'busy',
        vehicleType: 'Van 1T',
        capacity: 1000,
        currentLat: 41.37881008220417,
        currentLng: 2.1098762741585,
        distanceToDepot: '6.2km'
    },
    {
        id: 'D11',
        name: 'Lê Văn L',
        status: 'available',
        vehicleType: 'Xe máy',
        capacity: 150,
        currentLat: 41.42517713096385,
        currentLng: 2.1731868529321035,
        distanceToDepot: '4.5km'
    },
    {
        id: 'D12',
        name: 'Phạm Thị M',
        status: 'available',
        vehicleType: 'Van 500kg',
        capacity: 500,
        currentLat: 41.41560352531321,
        currentLng: 2.159941364642967,
        distanceToDepot: '3.8km'
    }
];

export default function DispatchClient() {
    const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [routes, setRoutes] = useState<DispatchRoute[]>([]);
    const [instance, setInstance] = useState<Instance | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const lsRoutes = localStorage.getItem('allRoutes');
            const lsInstance = localStorage.getItem('currentInstance');

            if (lsRoutes && lsInstance) {
                const parsedRoutes: Route[] = JSON.parse(lsRoutes);
                const parsedInstance: Instance = JSON.parse(lsInstance);

                setInstance(parsedInstance);

                const mappedRoutes: DispatchRoute[] = parsedRoutes.map((r, index) => {
                    // Calculate total load and duration
                    let totalLoad = 0;
                    let stops = 0;
                    let duration = 0;

                    if (r.sequence && parsedInstance.nodes) {
                        // Create a map for faster lookup if needed, or just use find
                        // For consistency with RouteAnalysis, we'll track maxLoad
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

                            // Add travel time to next node
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
                        originalRoute: r
                    };
                });

                setRoutes(mappedRoutes);
                if (mappedRoutes.length > 0) {
                    setSelectedRouteId(mappedRoutes[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to load data from localStorage", e);
        } finally {
            setLoading(false);
        }
    }, []);

    const selectedRoute = routes.find(r => r.id === selectedRouteId) || null;
    const selectedDriver = mockDrivers.find(d => d.id === selectedDriverId) || null;

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
                                {mockDrivers.filter(d => d.status === 'available').length} <span className="text-sm font-normal text-gray-400">/ {mockDrivers.length}</span>
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
                                0 <span className="text-sm font-normal text-gray-400">/ {routes.length}</span>
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
                        drivers={mockDrivers}
                        selectedDriverId={selectedDriverId}
                        onSelectDriver={setSelectedDriverId}
                        selectedRoute={selectedRoute}
                        instance={instance}
                    />
                </div>

                {/* Right Sidebar */}
                <DispatchSidebarRight
                    drivers={mockDrivers}
                    selectedDriverId={selectedDriverId}
                    onSelectDriver={setSelectedDriverId}
                    selectedRoute={selectedRoute}
                />
            </div>
        </div>
    );
}
