import React, { useMemo } from 'react';
import { DispatchRoute } from '@/app/dispatch/DispatchClient';
import { Truck, Clock, MapPin, Weight, CheckCircle2 } from 'lucide-react';

interface DispatchSidebarLeftProps {
    routes: DispatchRoute[];
    selectedRouteId: number | string | null;
    onSelectRoute: (id: number | string) => void;
}

export default function DispatchSidebarLeft({ routes, selectedRouteId, onSelectRoute }: DispatchSidebarLeftProps) {
    // Separate unassigned and assigned routes
    const { unassignedRoutes, assignedRoutes } = useMemo(() => {
        const unassigned: DispatchRoute[] = [];
        const assigned: DispatchRoute[] = [];

        routes.forEach(route => {
            if (route.isAssigned) {
                assigned.push(route);
            } else {
                unassigned.push(route);
            }
        });

        return { unassignedRoutes: unassigned, assignedRoutes: assigned };
    }, [routes]);

    // Helper to render a route card
    const renderRouteCard = (route: DispatchRoute, index: number, isAssigned: boolean) => {
        const isSelected = selectedRouteId === route.id;
        const displayNumber = index + 1; // Sequential numbering starting from 1

        return (
            <div
                key={route.id}
                onClick={() => onSelectRoute(route.id)}
                className={`
                    px-3 py-2 rounded-md border cursor-pointer transition-all duration-200
                    ${isAssigned
                        ? isSelected
                            ? 'bg-green-100 border-green-400 shadow-sm'
                            : 'bg-green-50 border-green-200 hover:border-green-300 hover:bg-green-100'
                        : isSelected
                            ? 'bg-blue-50 border-blue-400 shadow-sm'
                            : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                    }
                `}
            >
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5">
                        {isAssigned && (
                            <CheckCircle2 size={12} className="text-green-600" />
                        )}
                        <span className={`font-semibold text-xs ${isAssigned
                                ? isSelected ? 'text-green-700' : 'text-green-600'
                                : isSelected ? 'text-blue-700' : 'text-gray-600'
                            }`}>
                            Tuyến #{displayNumber}
                        </span>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isAssigned
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                        {route.stops} điểm dừng
                    </span>
                </div>

                <div className={`flex items-center gap-3 text-[11px] ${isAssigned ? 'text-green-600' : 'text-gray-500'}`}>
                    <div className="flex items-center gap-1">
                        <MapPin size={10} />
                        <span>{route.distance.toFixed(0)}km</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock size={10} />
                        <span>{route.duration.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Weight size={10} />
                        <span>{route.totalLoad}kg</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-64 bg-white border-r flex flex-col h-full z-10 shadow-sm shrink-0">
            {/* Unassigned Routes Section */}
            <div className="p-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                    <Truck size={16} className="text-blue-600" />
                    <span>Chưa gán ({unassignedRoutes.length})</span>
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Unassigned Routes */}
                <div className="p-2 space-y-2">
                    {unassignedRoutes.length === 0 ? (
                        <div className="text-center py-4 text-gray-400 text-xs">
                            Tất cả tuyến đã được gán
                        </div>
                    ) : (
                        unassignedRoutes.map((route, index) => renderRouteCard(route, index, false))
                    )}
                </div>

                {/* Assigned Routes Section */}
                {assignedRoutes.length > 0 && (
                    <>
                        <div className="p-3 border-t border-b bg-green-50">
                            <h2 className="font-semibold text-green-700 text-sm flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-green-600" />
                                <span>Đã gán ({assignedRoutes.length})</span>
                            </h2>
                        </div>
                        <div className="p-2 space-y-2 bg-green-50/30">
                            {assignedRoutes.map((route, index) =>
                                renderRouteCard(route, unassignedRoutes.length + index, true)
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
