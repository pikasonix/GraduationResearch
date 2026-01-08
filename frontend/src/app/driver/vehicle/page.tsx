"use client";

import React, { useState, useEffect } from 'react';
import { Truck, Check, AlertCircle, RefreshCw, MapPin, Clock, Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useGetSessionQuery } from '@/lib/redux/services/auth';
import { getDriverByUserId, getVehiclesWithActiveRoutes, getDriverVehicle, claimVehicleRoutes, unclaimVehicleRoutes, type VehicleWithDriver } from '@/services/driverService';
import MotobikeIcon from '@/components/icon/components/vehicle/Motorbike';
import MiniTruckIcon from '@/components/icon/components/vehicle/MiniTruck';
import BigTruckIcon from '@/components/icon/components/vehicle/BigTruck';
import { supabase } from '@/supabase/client';

const vehicleTypeConfig = {
    motorcycle: {
        label: 'Xe máy',
        icon: MotobikeIcon,
        color: 'from-orange-100 to-orange-200',
        borderColor: 'border-orange-300',
        textColor: 'text-orange-600',
        selectedBg: 'bg-orange-50',
        selectedBorder: 'border-orange-500',
    },
    van: {
        label: 'Van',
        icon: MiniTruckIcon,
        color: 'from-blue-100 to-blue-200',
        borderColor: 'border-blue-300',
        textColor: 'text-blue-600',
        selectedBg: 'bg-blue-50',
        selectedBorder: 'border-blue-500',
    },
    truck_small: {
        label: 'Xe tải nhỏ',
        icon: MiniTruckIcon,
        color: 'from-green-100 to-green-200',
        borderColor: 'border-green-300',
        textColor: 'text-green-600',
        selectedBg: 'bg-green-50',
        selectedBorder: 'border-green-500',
    },
    truck_medium: {
        label: 'Xe tải vừa',
        icon: BigTruckIcon,
        color: 'from-purple-100 to-purple-200',
        borderColor: 'border-purple-300',
        textColor: 'text-purple-600',
        selectedBg: 'bg-purple-50',
        selectedBorder: 'border-purple-500',
    },
    truck_large: {
        label: 'Xe tải lớn',
        icon: BigTruckIcon,
        color: 'from-red-100 to-red-200',
        borderColor: 'border-red-300',
        textColor: 'text-red-600',
        selectedBg: 'bg-red-50',
        selectedBorder: 'border-red-500',
    },
};

export default function DriverVehicleSelectionPage() {
    const { data: sessionData } = useGetSessionQuery();
    const userId = sessionData?.session?.user?.id;

    const [driverId, setDriverId] = useState<string | null>(null);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [currentVehicle, setCurrentVehicle] = useState<VehicleWithDriver | null>(null);
    const [availableVehicles, setAvailableVehicles] = useState<VehicleWithDriver[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function loadDriverData() {
            if (!userId) return;

            try {
                setLoading(true);
                const driver = await getDriverByUserId(userId);
                if (!driver) {
                    toast.error('Không tìm thấy thông tin tài xế');
                    return;
                }

                setDriverId(driver.id);
                setOrganizationId(driver.organization_id);

                // Load vehicles that have active routes
                const vehiclesWithRoutes = await getVehiclesWithActiveRoutes(driver.organization_id);
                
                // Find if driver has claimed any vehicle
                const claimedVehicle = vehiclesWithRoutes.find(v => 
                    v.routes?.some((r: any) => r.driver_id === driver.id)
                );

                setCurrentVehicle(claimedVehicle || null);
                setSelectedVehicleId(claimedVehicle?.id || null);
                setAvailableVehicles(vehiclesWithRoutes);
            } catch (error) {
                console.error('Error loading driver vehicle data:', error);
                toast.error('Không thể tải dữ liệu xe');
            } finally {
                setLoading(false);
            }
        }

        loadDriverData();
    }, [userId]);

    // Realtime subscription for route changes
    useEffect(() => {
        if (!driverId || !organizationId) return;
        
        // Subscribe to routes changes for current driver
        const subscription = supabase
            .channel('driver-routes-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'routes',
                    filter: `driver_id=eq.${driverId}`
                },
                async (payload: any) => {
                    console.log('[Realtime] Route change detected:', payload.eventType);
                    
                    if (payload.eventType === 'DELETE') {
                        // Route deleted - driver lost assignment
                        toast.warning('Cập nhật lộ trình: Đơn hàng của bạn đã thay đổi');
                    } else if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                        // Route updated or new route assigned
                        toast.info('Lộ trình đã được cập nhật');
                    }
                    
                    // Reload data to reflect changes
                    try {
                        const vehiclesWithRoutes = await getVehiclesWithActiveRoutes(organizationId);
                        const claimedVehicle = vehiclesWithRoutes.find(v => 
                            v.routes?.some((r: any) => r.driver_id === driverId)
                        );
                        
                        // Check if driver lost vehicle assignment
                        if (!claimedVehicle && currentVehicle) {
                            toast.info('Lộ trình đã được cập nhật. Bạn hiện không có đơn hàng mới.');
                        }
                        
                        setCurrentVehicle(claimedVehicle || null);
                        setSelectedVehicleId(claimedVehicle?.id || null);
                        setAvailableVehicles(vehiclesWithRoutes);
                    } catch (error) {
                        console.error('[Realtime] Error reloading data:', error);
                    }
                }
            )
            .subscribe();

        console.log('[Realtime] Subscribed to route changes for driver:', driverId);

        return () => {
            console.log('[Realtime] Unsubscribing from route changes');
            subscription.unsubscribe();
        };
    }, [driverId, organizationId, currentVehicle]);

    const handleAssignVehicle = async () => {
        if (!selectedVehicleId || !driverId || !organizationId) {
            toast.error('Vui lòng chọn xe');
            return;
        }

        try {
            setSubmitting(true);
            await claimVehicleRoutes({
                vehicleId: selectedVehicleId,
                driverId,
                organizationId,
            });

            // Reload data
            const vehiclesWithRoutes = await getVehiclesWithActiveRoutes(organizationId);
            const claimedVehicle = vehiclesWithRoutes.find(v => 
                v.routes?.some((r: any) => r.driver_id === driverId)
            );
            
            setCurrentVehicle(claimedVehicle || null);
            setAvailableVehicles(vehiclesWithRoutes);
            toast.success('Đã nhận xe và các tuyến đường thành công');
        } catch (error) {
            console.error('Error claiming vehicle:', error);
            toast.error('Không thể nhận xe');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUnassignVehicle = async () => {
        if (!driverId || !organizationId) return;

        if (!confirm('Bạn có chắc chắn muốn hủy nhận xe và các tuyến đường?')) return;

        try {
            setSubmitting(true);
            await unclaimVehicleRoutes({ driverId, organizationId });
            
            // Reload data
            const vehiclesWithRoutes = await getVehiclesWithActiveRoutes(organizationId);
            setCurrentVehicle(null);
            setSelectedVehicleId(null);
            setAvailableVehicles(vehiclesWithRoutes);
            toast.success('Đã hủy nhận xe');
        } catch (error) {
            console.error('Error unclaiming vehicle:', error);
            toast.error('Không thể hủy nhận xe');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRefresh = async () => {
        if (!driverId || !organizationId) return;

        try {
            setLoading(true);
            const vehiclesWithRoutes = await getVehiclesWithActiveRoutes(organizationId);
            const claimedVehicle = vehiclesWithRoutes.find(v => 
                v.routes?.some((r: any) => r.driver_id === driverId)
            );
            
            setCurrentVehicle(claimedVehicle || null);
            setSelectedVehicleId(claimedVehicle?.id || null);
            setAvailableVehicles(vehiclesWithRoutes);
            toast.success('Đã làm mới dữ liệu');
        } catch (error) {
            console.error('Error refreshing:', error);
            toast.error('Không thể làm mới');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Đang tải dữ liệu xe...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Chọn Phương Tiện</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Chọn xe mặc định của bạn để nhận các tuyến đường
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Làm mới
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Current Vehicle Card */}
                {currentVehicle && (
                    <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-200">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="bg-blue-500 rounded-full p-3">
                                    <Truck className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Xe hiện tại của bạn
                                    </h2>
                                    <p className="text-2xl font-bold text-blue-600 mt-1">
                                        {currentVehicle.license_plate}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {vehicleTypeConfig[currentVehicle.vehicle_type]?.label} • Tải trọng: {currentVehicle.capacity_weight}kg
                                    </p>
                                    {currentVehicle.routes && currentVehicle.routes.length > 0 && (
                                        <div className="flex items-center space-x-3 mt-2 text-sm text-gray-700">
                                            <span className="flex items-center">
                                                <RouteIcon className="w-4 h-4 mr-1" />
                                                {currentVehicle.routes.length} tuyến
                                            </span>
                                            <span className="flex items-center">
                                                <MapPin className="w-4 h-4 mr-1" />
                                                {currentVehicle.routes[0]?.route_data?.route_sequence?.length || 0} điểm
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleUnassignVehicle}
                                disabled={submitting}
                            >
                                Hủy nhận
                            </Button>
                        </div>
                    </div>
                )}

                {/* Available Vehicles with Routes */}
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Xe có tuyến đường chờ nhận
                    </h2>

                    {availableVehicles.length === 0 ? (
                        <div className="bg-white rounded-lg p-12 text-center border-2 border-dashed border-gray-300">
                            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">Không có xe nào được gán tuyến đường</p>
                            <p className="text-sm text-gray-500 mt-2">
                                Vui lòng chờ dispatcher gán tuyến đường và xe
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                {availableVehicles.map((vehicle) => {
                                    const config = vehicleTypeConfig[vehicle.vehicle_type];
                                    const VehicleIcon = config?.icon || Truck;
                                    const isSelected = selectedVehicleId === vehicle.id;
                                    const isCurrent = currentVehicle?.id === vehicle.id;
                                    
                                    // Check if any route is claimed by current driver
                                    const isClaimedByMe = vehicle.routes?.some((r: any) => r.driver_id === driverId);
                                    
                                    // Get route details
                                    const firstRoute = vehicle.routes?.[0];
                                    const routeCount = vehicle.routes?.length || 0;
                                    const stopCount = firstRoute?.route_data?.route_sequence?.length || 0;

                                    return (
                                        <button
                                            key={vehicle.id}
                                            onClick={() => setSelectedVehicleId(vehicle.id)}
                                            className={`
                                                relative p-6 rounded-lg border-2 transition-all text-left
                                                ${isSelected ? `${config?.selectedBg} ${config?.selectedBorder} shadow-lg` : 'bg-white border-gray-200 hover:border-gray-300'}
                                                ${isClaimedByMe ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
                                            `}
                                        >
                                            {/* Selection Indicator */}
                                            {isSelected && !isClaimedByMe && (
                                                <div className="absolute top-3 right-3">
                                                    <div className="bg-blue-500 rounded-full p-1">
                                                        <Check className="w-4 h-4 text-white" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Current Badge */}
                                            {isClaimedByMe && (
                                                <div className="absolute top-3 left-3">
                                                    <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
                                                        Đã nhận
                                                    </span>
                                                </div>
                                            )}

                                            {/* Vehicle Icon */}
                                            <div className={`mb-4 flex justify-center ${isClaimedByMe ? 'mt-6' : ''}`}>
                                                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${config?.color} flex items-center justify-center`}>
                                                    <VehicleIcon className="w-12 h-12" />
                                                </div>
                                            </div>

                                            {/* Vehicle Info */}
                                            <div className="text-center">
                                                <h3 className="text-xl font-bold text-gray-900 mb-1">
                                                    {vehicle.license_plate}
                                                </h3>
                                                <p className={`text-sm font-medium mb-2 ${config?.textColor}`}>
                                                    {config?.label}
                                                </p>
                                                <div className="flex items-center justify-center space-x-2 text-xs text-gray-600 mb-3">
                                                    <span>Tải: {vehicle.capacity_weight}kg</span>
                                                </div>

                                                {/* Route Information */}
                                                {firstRoute && (
                                                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                                                        <div className="flex items-center justify-center space-x-1 text-sm text-gray-700">
                                                            <RouteIcon className="w-4 h-4" />
                                                            <span>{routeCount} tuyến</span>
                                                        </div>
                                                        <div className="flex items-center justify-center space-x-1 text-sm text-gray-600">
                                                            <MapPin className="w-4 h-4" />
                                                            <span>{stopCount} điểm</span>
                                                        </div>
                                                        {firstRoute.planned_distance_km && (
                                                            <div className="flex items-center justify-center space-x-1 text-sm text-gray-600">
                                                                <span>📏 {firstRoute.planned_distance_km.toFixed(1)}km</span>
                                                            </div>
                                                        )}
                                                        {firstRoute.planned_duration_hours && (
                                                            <div className="flex items-center justify-center space-x-1 text-sm text-gray-600">
                                                                <Clock className="w-4 h-4" />
                                                                <span>{(firstRoute.planned_duration_hours * 60).toFixed(0)} phút</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Action Button */}
                            {selectedVehicleId && selectedVehicleId !== currentVehicle?.id && (
                                <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            Nhận xe{' '}
                                            <span className="text-blue-600">
                                                {availableVehicles.find(v => v.id === selectedVehicleId)?.license_plate}
                                            </span>{' '}
                                            và các tuyến đường?
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Bạn sẽ nhận tất cả các tuyến đường đã được gán cho xe này
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleAssignVehicle}
                                        disabled={submitting}
                                        size="lg"
                                    >
                                        {submitting ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                Đang nhận...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                Xác nhận nhận xe
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
