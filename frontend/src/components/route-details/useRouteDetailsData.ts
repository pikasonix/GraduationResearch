"use client";
import { useState, useEffect } from 'react';
import type { Instance, Route } from '@/utils/dataModels';

export interface RouteDetailsData {
    route: Route | any;
    instance: Instance | any;
    routes?: Route[];
}

function decodeBase64Json(b64: string) {
    try { return JSON.parse(typeof window === 'undefined' ? Buffer.from(b64, 'base64').toString('utf-8') : atob(b64)); } catch { return null; }
}

interface Options { routeId?: string | number; }

/**
 * Hook nạp dữ liệu route / instance từ:
 * 1. query ?data= (base64 json {route,instance,routes})
 * 2. localStorage: selectedRoute, currentInstance, allRoutes
 */
export function useRouteDetailsData(opts: Options = {}) {
    const { routeId } = opts;
    const [data, setData] = useState<RouteDetailsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            let route: any = null; let instance: any = null; let routes: any[] | undefined = undefined;
            const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
            const encoded = params?.get('data');
            if (encoded) {
                const parsed = decodeBase64Json(encoded);
                if (parsed?.route && parsed?.instance) {
                    route = parsed.route; instance = parsed.instance; routes = parsed.routes || undefined;
                }
            }
            if (!route || !instance) {
                try {
                    const lsRoute = localStorage.getItem('selectedRoute');
                    const lsInstance = localStorage.getItem('currentInstance');
                    const lsRoutes = localStorage.getItem('allRoutes');
                    if (lsRoutes) {
                        routes = JSON.parse(lsRoutes);
                    }
                    if (lsInstance) instance = JSON.parse(lsInstance);
                    // Nếu có routeId cố gắng tìm trong routes
                    if (routeId && routes) {
                        route = routes.find(r => String(r.id) === String(routeId));
                    }
                    // Fallback dùng selectedRoute nếu chưa có
                    if (!route && lsRoute) route = JSON.parse(lsRoute);
                    // Nếu chưa có routes nhưng có route -> tạo list 1 phần tử để UI vẫn hiển thị
                    if ((!routes || routes.length === 0) && route) {
                        routes = [route];
                    }
                } catch { }
            }
            if (!route && routeId) {
                setError('Không tìm thấy route với id=' + routeId);
            }
            setData(route ? { route, instance, routes } : { route: null, instance, routes });
        } catch (e: any) {
            setError(e?.message || 'Lỗi nạp dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [routeId]);

    return { data, error, loading };
}
