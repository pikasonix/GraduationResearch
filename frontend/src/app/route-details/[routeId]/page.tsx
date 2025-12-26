"use client";
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RouteDetailsView from '@/components/route-details/RouteDetailsView';
import { useRouteDetailsData } from '@/components/route-details/useRouteDetailsData';

export default function RouteDetailsDynamicPage() {
    const { routeId } = useParams();
    const router = useRouter();
    const [useRealRouting, setUseRealRouting] = useState(false);
    const { data, error, loading } = useRouteDetailsData({ routeId: routeId as string });

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            {error && <div className="p-2 bg-red-50 text-red-600 text-sm">{error}</div>}
            {loading && <div className="p-2 bg-yellow-50 text-yellow-700 text-sm">Đang tải...</div>}
            <RouteDetailsView
                route={data?.route || null}
                instance={data?.instance || null}
                useRealRouting={useRealRouting}
                onToggleRealRouting={() => setUseRealRouting(v => !v)}
                showBack
                onBack={() => router.push('/route-details')}
                allRoutes={data?.routes || undefined}
            />
        </div>
    );
}
