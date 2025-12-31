"use client";

import React, { useState, useEffect } from "react";
import { DispatchDriver } from "@/app/monitor/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Filter, Truck, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonitorSidebarProps {
    drivers: DispatchDriver[];
    selectedDriverId: string | null;
    onSelectDriver: (id: string | null) => void;
}

export default function MonitorSidebar({
    drivers,
    selectedDriverId,
    onSelectDriver,
}: MonitorSidebarProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "available" | "busy" | "offline">("all");

    const filteredDrivers = drivers.filter((driver) => {
        const matchesSearch =
            driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            driver.vehicleType.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === "all" || driver.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "available":
                return "bg-green-500 hover:bg-green-600";
            case "busy":
                return "bg-amber-500 hover:bg-amber-600";
            case "offline":
                return "bg-gray-400 hover:bg-gray-500";
            default:
                return "bg-gray-500";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "available":
                return "Sẵn sàng";
            case "busy":
                return "Đang bận";
            case "offline":
                return "Ngoại tuyến";
            default:
                return status;
        }
    };

    return (
        <div className="w-[350px] bg-white border-r flex flex-col h-full shadow-lg z-10">
            <div className="p-4 border-b space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Truck className="h-6 w-6 text-blue-600" />
                    Giám sát Đội xe
                </h2>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Tìm kiếm tài xế, xe..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-2 text-sm justify-between">
                    {/* Simple status tabs */}
                    {(["all", "available", "busy", "offline"] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={cn(
                                "px-2 py-1 rounded-md transition-colors capitalize text-xs",
                                filterStatus === status
                                    ? "bg-blue-100 text-blue-700 font-medium"
                                    : "text-gray-500 hover:bg-gray-100"
                            )}
                        >
                            {status === 'all' ? 'Tất cả' : getStatusLabel(status)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                    {filteredDrivers.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            Không tìm thấy tài xế
                        </div>
                    ) : (
                        filteredDrivers.map((driver) => (
                            <div
                                key={driver.id}
                                onClick={() => onSelectDriver(driver.id)}
                                className={cn(
                                    "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                                    selectedDriverId === driver.id
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 bg-white"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-semibold text-gray-800">{driver.name}</div>
                                    <Badge className={cn("text-xs", getStatusColor(driver.status))}>
                                        {getStatusLabel(driver.status)}
                                    </Badge>
                                </div>

                                <div className="text-xs text-gray-500 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-700">Xe:</span>
                                        <span>{driver.vehicleType}</span>
                                    </div>
                                    {/* Mock Speed/Location info */}
                                    <div className="flex items-center gap-2 justify-between mt-2 pt-2 border-t border-gray-100">
                                        <span>45 km/h</span>
                                        <span className="text-gray-400 truncate max-w-[120px]">
                                            {driver.currentLat.toFixed(4)}, {driver.currentLng.toFixed(4)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="p-3 border-t bg-gray-50 text-xs text-center text-gray-500">
                Tổng cộng: {drivers.length} tài xế
            </div>
        </div>
    );
}
