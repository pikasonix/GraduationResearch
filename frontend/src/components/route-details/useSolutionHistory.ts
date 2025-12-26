"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabase/client';

export type SolutionHistoryItem = {
    id: string;
    created_at: string | null;
    solution_name: string | null;
    total_cost: number;
    total_distance_km: number;
    total_time_hours: number;
    total_vehicles_used: number;
};

function getOrgIdFromLocalStorage(): string | null {
    try {
        const raw = localStorage.getItem('routePlanningMetadata');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const orgId = parsed?.organizationId;
        return typeof orgId === 'string' && orgId ? orgId : null;
    } catch {
        return null;
    }
}

export function useSolutionHistory(opts?: { organizationId?: string; limit?: number }) {
    const limit = opts?.limit ?? 20;
    const organizationId = useMemo(() => {
        if (opts?.organizationId) return opts.organizationId;
        if (typeof window === 'undefined') return null;
        return getOrgIdFromLocalStorage();
    }, [opts?.organizationId]);

    const [solutions, setSolutions] = useState<SolutionHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setLoading(true);
            setError(null);

            try {
                if (!organizationId) {
                    setSolutions([]);
                    return;
                }

                const { data, error } = await supabase
                    .from('optimization_solutions')
                    .select('id, created_at, solution_name, total_cost, total_distance_km, total_time_hours, total_vehicles_used')
                    .eq('organization_id', organizationId)
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (error) throw error;

                const rows = Array.isArray(data) ? data : [];
                const mapped: SolutionHistoryItem[] = rows.map((r: any) => ({
                    id: String(r.id),
                    created_at: r.created_at ? String(r.created_at) : null,
                    solution_name: r.solution_name ? String(r.solution_name) : null,
                    total_cost: Number(r.total_cost ?? 0),
                    total_distance_km: Number(r.total_distance_km ?? 0),
                    total_time_hours: Number(r.total_time_hours ?? 0),
                    total_vehicles_used: Number(r.total_vehicles_used ?? 0),
                }));

                if (!cancelled) setSolutions(mapped);
            } catch (e: any) {
                if (!cancelled) setError(e?.message || 'Không thể tải lịch sử solution');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [organizationId, limit]);

    return { solutions, loading, error, organizationId };
}
