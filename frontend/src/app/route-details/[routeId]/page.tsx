"use client";
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RouteDetailsView from '@/components/route-details/RouteDetailsView';
import { useRouteDetailsData } from '@/components/route-details/useRouteDetailsData';

import { Map, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function RouteDetailsDynamicPage() {
    const { routeId } = useParams();
    const router = useRouter();
    const [useRealRouting, setUseRealRouting] = useState(false);
    const { data, error, loading } = useRouteDetailsData({ routeId: routeId as string });

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/route-details')} className="mr-2">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-bold text-gray-800">Route Details #{routeId}</h1>
                    </div>
                </div>
            </div>

            {error && <div className="p-2 bg-red-50 text-red-600 text-sm">{error}</div>}
            {loading && <div className="p-2 bg-yellow-50 text-yellow-700 text-sm">Đang tải...</div>}
            <RouteDetailsView
                route={data?.route || null}
                instance={data?.instance || null}
                useRealRouting={useRealRouting}
                onToggleRealRouting={() => setUseRealRouting(v => !v)}
                showBack={false}
                onBack={() => router.push('/route-details')}
                allRoutes={data?.routes || undefined}
            />
        </div>
    );
}
