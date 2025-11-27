import React from 'react';
import { DispatchRoute } from '@/app/dispatch/DispatchClient';
import { Truck, Clock, MapPin, Weight } from 'lucide-react';

interface DispatchSidebarLeftProps {
    routes: DispatchRoute[];
    selectedRouteId: number | null;
    onSelectRoute: (id: number) => void;
}

export default function DispatchSidebarLeft({ routes, selectedRouteId, onSelectRoute }: DispatchSidebarLeftProps) {
    return (
        <div className="w-64 bg-white border-r flex flex-col h-full z-10 shadow-sm shrink-0">
            <div className="p-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                    <Truck size={16} className="text-blue-600" />
                    <span>Chưa gán ({routes.length})</span>
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {routes.map(route => {
                    const isSelected = selectedRouteId === route.id;
                    return (
                        <div
                            key={route.id}
                            onClick={() => onSelectRoute(route.id)}
                            className={`
                                px-3 py-2 rounded-md border cursor-pointer transition-all duration-200
                                ${isSelected
                                    ? 'bg-blue-50 border-blue-400 shadow-sm'
                                    : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                }
                            `}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-semibold text-xs ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                    Tuyến #{route.id}
                                </span>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                    {route.stops} điểm dừng
                                </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-gray-500">
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
                })}
            </div>
        </div>
    );
}
