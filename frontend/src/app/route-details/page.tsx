"use client";
import React, { useState, useEffect } from 'react';
import RouteDetailsView from '@/components/route-details/RouteDetailsView';
import RouteChipsBar from '@/components/route-details/RouteChipsBar';
import { useRouteDetailsData } from '@/components/route-details/useRouteDetailsData';
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectRadioContent,
    SelectRadioItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Trang index: danh sách routes + xem chi tiết route được chọn
export default function RouteDetailsIndexPage() {
    const { data, error, loading } = useRouteDetailsData();
    const [useRealRouting, setUseRealRouting] = useState(false);
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedRouteId && data?.routes && data.routes.length > 0) {
            setSelectedRouteId(String(data.routes[0].id));
        }
    }, [data?.routes, selectedRouteId]);

    const currentRoute = selectedRouteId && data?.routes ? data.routes.find(r => String(r.id) === selectedRouteId) : data?.route;

    const handleOpenNewTab = (rid: string | number) => {
        if (data?.routes) localStorage.setItem('allRoutes', JSON.stringify(data.routes));
        if (data?.instance) localStorage.setItem('currentInstance', JSON.stringify(data.instance));
        const r = data?.routes?.find(r => String(r.id) === String(rid));
        if (r) localStorage.setItem('selectedRoute', JSON.stringify(r));
        window.open(`/route-details/${rid}`, '_blank');
    };

    return (
        <div className="h-screen flex flex-col">
            <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between">
                <div className="flex items-center">
                    <h1 className="text-xl font-bold text-gray-800 mr-4">Chi tiết tuyến đường</h1>
                    <div className="text-sm text-gray-500">{data?.routes ? `(${data.routes.length} routes)` : 'No routes loaded'}</div>
                </div>
                <div className="flex items-center max-w-5xl w-full">
                    {data?.routes && (
                        <>
                            <div className="hidden sm:block w-5/7 mx-4">
                                <RouteChipsBar
                                    className="w-full"
                                    routes={data.routes}
                                    selectedId={selectedRouteId}
                                    onSelect={(id) => setSelectedRouteId(id)}
                                    onOpenNewTab={(id) => handleOpenNewTab(id)}
                                />
                            </div>
                            <div className="sm:w-2/7 mx-4">
                                <Select
                                    value={selectedRouteId ?? ''}
                                    onValueChange={(v) => setSelectedRouteId(v)}
                                >
                                    <SelectTrigger size="sm">
                                        <SelectValue placeholder="Chọn tuyến đường" />
                                    </SelectTrigger>
                                    <SelectRadioContent>
                                        {data.routes.map(r => (
                                            <SelectRadioItem key={r.id} value={String(r.id)} className="py-1 px-2 text-sm">
                                                {`Route #${r.id}${r.cost ? ` (Cost: ${r.cost})` : ''}`}
                                            </SelectRadioItem>
                                        ))}
                                    </SelectRadioContent>
                                </Select>
                            </div>
                        </>
                    )}
                </div>

            </div>
            {error && <div className="p-2 bg-red-50 text-red-600 text-sm">{error}</div>}
            {loading && <div className="p-2 bg-yellow-50 text-yellow-700 text-sm">Đang tải...</div>}
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1">
                    <RouteDetailsView
                        route={currentRoute || null}
                        instance={data?.instance || null}
                        useRealRouting={useRealRouting}
                        onToggleRealRouting={() => setUseRealRouting(v => !v)}
                        showBack={false}
                    />
                </div>
            </div>
        </div>
    );
}
