import React, { useState } from 'react';
import { DispatchVehicle, DispatchRoute } from '@/app/dispatch/DispatchClient';
import { Search, Filter, Truck, UserCircle2, MapPin, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface DispatchSidebarRightProps {
    vehicles: DispatchVehicle[];
    selectedVehicleId: string | null;
    onSelectVehicle: (id: string) => void;
    selectedRoute: DispatchRoute | null;
    onAssignRoute?: (vehicleId: string) => Promise<void>;
}

export default function DispatchSidebarRight({ vehicles, selectedVehicleId, onSelectVehicle, selectedRoute, onAssignRoute }: DispatchSidebarRightProps) {
    const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'busy'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);

    const filteredVehicles = vehicles.filter(vehicle => {
        const matchesStatus = filterStatus === 'all' || vehicle.status === filterStatus;
        const matchesSearch = vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.vehicleType.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (vehicle.driverName && vehicle.driverName.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesStatus && matchesSearch;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available': return 'text-green-600 bg-green-50 border-green-200';
            case 'busy': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'offline': return 'text-gray-500 bg-gray-100 border-gray-200';
            default: return 'text-gray-500 bg-gray-100 border-gray-200';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'available': return 'Sẵn sàng';
            case 'busy': return 'Bận';
            case 'offline': return 'Ngoại tuyến';
            default: return status;
        }
    };

    return (
        <div className="w-80 bg-white border-l flex flex-col h-full z-10 shadow-sm shrink-0">
            {/* Header & Filter */}
            <div className="p-3 border-b bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                        <Truck size={16} className="text-blue-600" />
                        <span>Đội xe ({vehicles.length})</span>
                    </h2>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${filterStatus === 'all' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            Tất cả
                        </button>
                        <button
                            onClick={() => setFilterStatus('available')}
                            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${filterStatus === 'available' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            Sẵn sàng
                        </button>
                        <button
                            onClick={() => setFilterStatus('busy')}
                            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${filterStatus === 'busy' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            Bận
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Tìm biển số hoặc loại xe..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Vehicle List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredVehicles.map(vehicle => {
                    const isSelected = selectedVehicleId === vehicle.id;
                    return (
                        <div
                            key={vehicle.id}
                            onClick={() => onSelectVehicle(vehicle.id)}
                            className={`
                                p-2 rounded-md border cursor-pointer transition-all duration-200
                                ${isSelected
                                    ? 'bg-blue-50 border-blue-400 shadow-sm'
                                    : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                }
                            `}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                    <Truck size={18} className="text-gray-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <h3 className={`font-semibold text-xs truncate ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                            {vehicle.licensePlate}
                                        </h3>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getStatusColor(vehicle.status)}`}>
                                            {getStatusText(vehicle.status)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-gray-500">
                                        <span className="truncate">{vehicle.vehicleType} • {vehicle.capacity}kg</span>
                                        {vehicle.driverName && (
                                            <span className="flex items-center gap-0.5">
                                                <UserCircle2 size={8} />
                                                {vehicle.driverName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Dispatch Action Panel (Sticky Bottom) */}
            <div className="p-3 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                {selectedRoute ? (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-gray-500">Tuyến đã chọn</span>
                            <span className="text-xs font-bold text-gray-800">{selectedRoute.name}</span>
                        </div>

                        {selectedVehicleId ? (
                            (() => {
                                const vehicle = vehicles.find(v => v.id === selectedVehicleId);
                                if (!vehicle) return null;
                                const isOverloaded = selectedRoute.totalLoad > vehicle.capacity;

                                return (
                                    <div className="space-y-2">
                                        <div className="p-2 bg-gray-50 rounded-md border border-gray-100">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Tải trọng</span>
                                                <span className={isOverloaded ? 'text-red-600 font-bold' : 'text-gray-700'}>
                                                    {selectedRoute.totalLoad} / {vehicle.capacity} kg
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full ${isOverloaded ? 'bg-red-500' : 'bg-green-500'}`}
                                                    style={{ width: `${Math.min((selectedRoute.totalLoad / vehicle.capacity) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {isOverloaded ? (
                                            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
                                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                                <span>Cảnh báo quá tải! Chọn xe lớn hơn.</span>
                                            </div>
                                        ) : (
                                            <button
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
                                                disabled={isAssigning || !onAssignRoute}
                                                onClick={async () => {
                                                    if (onAssignRoute && selectedVehicleId) {
                                                        setIsAssigning(true);
                                                        try {
                                                            await onAssignRoute(selectedVehicleId);
                                                        } finally {
                                                            setIsAssigning(false);
                                                        }
                                                    }
                                                }}
                                            >
                                                {isAssigning ? (
                                                    <>
                                                        <Loader2 size={14} className="animate-spin" />
                                                        Đang xử lý...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 size={14} />
                                                        Điều phối tuyến
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="text-center py-4 text-gray-400 text-xs italic border-2 border-dashed border-gray-100 rounded-md">
                                Chọn xe để điều phối
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-4 text-gray-400 text-xs italic">
                        Chọn tuyến để bắt đầu
                    </div>
                )}
            </div>
        </div>
    );
}
