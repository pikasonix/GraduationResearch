import React from 'react';

interface MonitorStatsProps {
    totalRoutes: number;
    completedRoutes: number;
    attentionRoutes: number;
    totalDistance: number;
    totalTimeFormatted: string;
    changedRoutes: number;
    deviatedRoutes: number;
}

export default function MonitorStats({
    totalRoutes,
    completedRoutes,
    attentionRoutes,
    totalDistance,
    totalTimeFormatted,
    changedRoutes,
    deviatedRoutes,
}: MonitorStatsProps) {
    return (
        <div className="bg-white border-t p-4 flex items-center justify-between text-sm shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-20 relative">
            <div className="flex flex-col">
                <span className="text-gray-500 text-xs mb-1">Tổng số lộ trình</span>
                <span className="font-bold text-lg text-gray-900">{totalRoutes}</span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-4"></div>

            <div className="flex flex-col">
                <span className="text-gray-500 text-xs mb-1">Đã hoàn thành</span>
                <span className="font-bold text-lg text-gray-900">{completedRoutes}</span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-4"></div>

            <div className="flex flex-col">
                <span className="text-gray-500 text-xs mb-1">Cần chú ý</span>
                <span className="font-bold text-lg text-red-600">{attentionRoutes}</span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-4"></div>

            <div className="flex flex-col">
                <span className="text-gray-500 text-xs mb-1">Tổng quãng đường (km)</span>
                <span className="font-bold text-lg text-gray-900">{totalDistance.toFixed(2)}</span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-4"></div>

            <div className="flex flex-col">
                <span className="text-gray-500 text-xs mb-1">Tổng thời gian lộ trình</span>
                <span className="font-bold text-lg text-gray-900">{totalTimeFormatted}</span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-4"></div>

            <div className="flex flex-col">
                <span className="text-gray-500 text-xs mb-1">Lộ trình thay đổi</span>
                <span className="font-bold text-lg text-gray-900">{changedRoutes}</span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-4"></div>

            <div className="flex flex-col">
                <span className="text-gray-500 text-xs mb-1">Lệch lộ trình</span>
                <span className="font-bold text-lg text-gray-900">{deviatedRoutes}</span>
            </div>
        </div>
    );
}
