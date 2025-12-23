"use client";

import React, { useState, useEffect } from 'react';
import MonitorSidebar from '@/components/monitor/MonitorSidebar';
import MonitorMap from '@/components/monitor/MonitorMap';
import { DispatchDriver } from '@/app/dispatch/DispatchClient';
import { getDrivers, getVehicles } from '@/services/driverService';
import { toast } from 'sonner';

// Reusing logic from DispatchClient to assemble driver data
const vehicleTypeLabels: Record<string, string> = {
    'motorcycle': 'Xe máy',
    'van': 'Van',
    'truck_small': 'Xe tải nhỏ',
    'truck_medium': 'Xe tải vừa',
    'truck_large': 'Xe tải lớn'
};

export default function MonitorPage() {
    const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch data interval
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        async function loadData() {
            try {
                // In a real scenario, this would be specialized monitoring API or websocket
                // For now, reuse driverService
                const [driversData, vehiclesData] = await Promise.all([
                    getDrivers(),
                    getVehicles()
                ]);

                const mappedDrivers: DispatchDriver[] = driversData.map(driver => {
                    const vehicle = vehiclesData.find(v => v.is_active); // Simplified matching
                    // Mock coordinates varying slightly to simulate movement if needed?
                    // For now, trust the DB values (which might be static mock data)

                    return {
                        id: driver.id,
                        name: driver.full_name,
                        status: driver.is_active ? 'available' : 'offline', // Simplified status
                        vehicleType: vehicle ? (vehicleTypeLabels[vehicle.vehicle_type] || vehicle.vehicle_type) : 'Chưa có xe',
                        vehicleId: vehicle?.id || null,
                        capacity: vehicle?.capacity_weight || 1000,
                        currentLat: vehicle?.current_latitude || 21.0285,
                        currentLng: vehicle?.current_longitude || 105.8500,
                        distanceToDepot: 'N/A'
                    };
                });

                // Add some "busy" status mocking for visual variety if everyone is available
                // mappedDrivers[0].status = 'busy'; 

                setDrivers(mappedDrivers);
            } catch (e) {
                console.error("Failed to load monitoring data:", e);
                // toast.error('Lỗi cập nhật dữ liệu giám sát'); // Don't spam toasts on interval
            } finally {
                setLoading(false);
            }
        }

        loadData();
        // Poll every 10 seconds
        intervalId = setInterval(loadData, 10000);

        return () => clearInterval(intervalId);
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">Đang tải dữ liệu giám sát...</div>;
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-100">
            {/* Left Sidebar */}
            <MonitorSidebar
                drivers={drivers}
                selectedDriverId={selectedDriverId}
                onSelectDriver={setSelectedDriverId}
            />

            {/* Main Map Area */}
            <div className="flex-1 relative">
                <MonitorMap
                    drivers={drivers}
                    selectedDriverId={selectedDriverId}
                    onSelectDriver={setSelectedDriverId}
                />

                {/* Floating Status Summary? */}
                <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-sm border text-xs space-y-1">
                    <div className="font-semibold text-gray-700 mb-1">Trạng thái hệ thống</div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span>{drivers.filter(d => d.status === 'available').length} Sẵn sàng</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>{drivers.filter(d => d.status === 'busy').length} Đang bận</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        <span>{drivers.filter(d => d.status === 'offline').length} Ngoại tuyến</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
