import { Router, Request, Response, NextFunction } from 'express';
import { createSupabaseAdminClient, isSupabaseEnabled } from '../supabaseAdmin';

type AuthedRequest = Request & { authUserId?: string };

function getBearerToken(req: Request): string | null {
    const header = req.header('Authorization') || req.header('authorization');
    if (!header) return null;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1] ?? null;
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!isSupabaseEnabled()) {
            res.status(501).json({ success: false, error: 'Supabase is not configured on backend' });
            return;
        }

        const token = getBearerToken(req);
        if (!token) {
            res.status(401).json({ success: false, error: 'Missing Authorization bearer token' });
            return;
        }

        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user?.id) {
            res.status(401).json({ success: false, error: 'Invalid token' });
            return;
        }

        req.authUserId = data.user.id;
        next();
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        res.status(500).json({ success: false, error: message });
    }
}

async function getDriverByUserId(userId: string) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from('drivers')
        .select('id, user_id, full_name, phone, organization_id, is_active, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return data;
}

function toIsoString(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    try {
        return new Date(value).toISOString();
    } catch {
        return String(value);
    }
}

function toNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

function mapRouteToAssignedRouteDto(route: any, totalStops: number, completedStops: number) {
    const plannedStart = route.planned_start_time || route.created_at;
    const scheduledDate = plannedStart ? toIsoString(plannedStart).slice(0, 10) : '';

    return {
        id: route.id,
        driver_id: route.driver_id,
        vehicle_id: route.vehicle_id ?? null,
        status: route.status ?? 'planned',
        scheduled_date: scheduledDate,
        started_at: route.actual_start_time ?? null,
        completed_at: route.actual_end_time ?? null,
        total_stops: totalStops,
        completed_stops: completedStops,
        created_at: route.created_at ?? null,
        updated_at: route.updated_at ?? null,
    };
}

function mapStopToDto(stop: any, location: any | null, order: any | null) {
    const stopType = String(stop.stop_type || stop.stopType || '').toLowerCase() || 'delivery';
    const isCompleted = !!stop.is_completed;

    const locationName = location?.name ?? 'Unknown location';
    const latitude = toNumber(location?.latitude) ?? 0;
    const longitude = toNumber(location?.longitude) ?? 0;

    const status = isCompleted ? 'completed' : 'pending';

    const timeWindowStart =
        stopType === 'pickup' ? order?.pickup_time_start : order?.delivery_time_start;
    const timeWindowEnd =
        stopType === 'pickup' ? order?.pickup_time_end : order?.delivery_time_end;

    const contactName = stopType === 'pickup' ? order?.pickup_contact_name : order?.delivery_contact_name;
    const contactPhone = stopType === 'pickup' ? order?.pickup_contact_phone : order?.delivery_contact_phone;

    const orderDto = order
        ? {
            id: order.id,
            order_number: order.tracking_number ?? order.reference_code ?? order.id,
            customer_name: contactName ?? 'Khách hàng',
            customer_phone: contactPhone ?? null,
            items_count: 1,
            status: order.status ?? 'pending',
        }
        : null;

    return {
        id: stop.id,
        route_id: stop.route_id,
        sequence: stop.stop_sequence,
        location_name: locationName,
        latitude,
        longitude,
        type: stopType,
        status,
        scheduled_time: stop.planned_arrival_time ?? null,
        time_window_start: timeWindowStart ?? null,
        time_window_end: timeWindowEnd ?? null,
        completed_at: stop.actual_departure_time ?? stop.actual_arrival_time ?? null,
        orders: orderDto ? [orderDto] : [],
    };
}

export function setupMobileRoutes(): Router {
    const router = Router();

    router.get('/health', (_req, res) => {
        res.json({ status: 'ok', supabaseEnabled: isSupabaseEnabled() });
    });

    router.get('/driver/me', requireAuth, async (req: AuthedRequest, res: Response) => {
        try {
            const driver = await getDriverByUserId(req.authUserId!);
            if (!driver) {
                res.status(404).json({ success: false, error: 'Driver not found' });
                return;
            }

            res.json({
                id: driver.id,
                user_id: driver.user_id,
                full_name: driver.full_name,
                phone: driver.phone,
                avatar_url: null,
                rating: null,
                total_deliveries: null,
                status: driver.is_active === false ? 'inactive' : 'active',
                created_at: driver.created_at,
                updated_at: driver.updated_at,
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: message });
        }
    });

    router.get('/routes/assigned', requireAuth, async (req: AuthedRequest, res: Response) => {
        try {
            const supabase = createSupabaseAdminClient();
            const driver = await getDriverByUserId(req.authUserId!);
            if (!driver) {
                res.status(404).json({ success: false, error: 'Driver not found' });
                return;
            }

            const statusParam = (req.query.status as string | undefined)?.trim();
            const allowedStatuses = ['planned', 'assigned', 'in_progress', 'completed'];
            const statuses = statusParam && allowedStatuses.includes(statusParam)
                ? [statusParam]
                : ['assigned', 'in_progress'];

            const { data: routes, error: routesErr } = await supabase
                .from('routes')
                .select('id, driver_id, vehicle_id, status, planned_start_time, actual_start_time, actual_end_time, created_at, updated_at')
                .eq('driver_id', driver.id)
                .in('status', statuses)
                .order('planned_start_time', { ascending: true, nullsFirst: false });

            if (routesErr) throw new Error(routesErr.message);

            const routeIds = (routes ?? []).map((r: any) => r.id);
            const countsByRouteId = new Map<string, { total: number; completed: number }>();

            if (routeIds.length > 0) {
                const { data: stops, error: stopsErr } = await supabase
                    .from('route_stops')
                    .select('id, route_id, is_completed')
                    .in('route_id', routeIds);

                if (stopsErr) throw new Error(stopsErr.message);

                for (const stop of stops ?? []) {
                    const key = stop.route_id as string;
                    const current = countsByRouteId.get(key) ?? { total: 0, completed: 0 };
                    current.total += 1;
                    if (stop.is_completed) current.completed += 1;
                    countsByRouteId.set(key, current);
                }
            }

            const dtos = (routes ?? []).map((route: any) => {
                const counts = countsByRouteId.get(route.id) ?? { total: 0, completed: 0 };
                return mapRouteToAssignedRouteDto(route, counts.total, counts.completed);
            });

            res.json({ routes: dtos });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: message });
        }
    });

    router.get('/routes/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
        try {
            const supabase = createSupabaseAdminClient();
            const driver = await getDriverByUserId(req.authUserId!);
            if (!driver) {
                res.status(404).json({ success: false, error: 'Driver not found' });
                return;
            }

            const routeId = req.params.id;
            const { data: route, error: routeErr } = await supabase
                .from('routes')
                .select('id, driver_id, vehicle_id, status, planned_start_time, actual_start_time, actual_end_time, created_at, updated_at')
                .eq('id', routeId)
                .maybeSingle();

            if (routeErr) throw new Error(routeErr.message);
            if (!route) {
                res.status(404).json({ success: false, error: 'Route not found' });
                return;
            }

            if (route.driver_id !== driver.id) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            const { data: routeStops, error: stopsErr } = await supabase
                .from('route_stops')
                .select('id, route_id, stop_sequence, location_id, order_id, stop_type, is_completed, planned_arrival_time, actual_arrival_time, actual_departure_time')
                .eq('route_id', routeId)
                .order('stop_sequence', { ascending: true });

            if (stopsErr) throw new Error(stopsErr.message);

            const totalStops = (routeStops ?? []).length;
            const completedStops = (routeStops ?? []).filter((s: any) => !!s.is_completed).length;

            const locationIds = Array.from(new Set((routeStops ?? []).map((s: any) => s.location_id).filter(Boolean)));
            const orderIds = Array.from(new Set((routeStops ?? []).map((s: any) => s.order_id).filter(Boolean)));

            const [locationsRes, ordersRes] = await Promise.all([
                locationIds.length
                    ? supabase
                        .from('locations')
                        .select('id, name, latitude, longitude')
                        .in('id', locationIds)
                    : Promise.resolve({ data: [], error: null } as any),
                orderIds.length
                    ? supabase
                        .from('orders')
                        .select(
                            'id, tracking_number, reference_code, status, pickup_time_start, pickup_time_end, delivery_time_start, delivery_time_end, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone'
                        )
                        .in('id', orderIds)
                    : Promise.resolve({ data: [], error: null } as any),
            ]);

            if (locationsRes.error) throw new Error(locationsRes.error.message);
            if (ordersRes.error) throw new Error(ordersRes.error.message);

            const locationById = new Map<string, any>((locationsRes.data ?? []).map((l: any) => [l.id, l]));
            const orderById = new Map<string, any>((ordersRes.data ?? []).map((o: any) => [o.id, o]));

            console.log(`[DEBUG] Route ${routeId}: ${routeStops?.length || 0} stops, ${orderIds.length} unique orders`);

            const stopsDtos = (routeStops ?? []).map((stop: any) => {
                const location = locationById.get(stop.location_id);
                const order = orderById.get(stop.order_id);
                const dto = mapStopToDto(stop, location ?? null, order ?? null);
                console.log(`[DEBUG] Stop ${dto.sequence}: ${dto.type} at ${dto.location_name}, orders=${dto.orders.length}`);
                return dto;
            });

            const routeDto = mapRouteToAssignedRouteDto(route, totalStops, completedStops);

            console.log(`[DEBUG] Sending response: ${stopsDtos.length} stops`);
            res.json({ route: routeDto, stops: stopsDtos });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: message });
        }
    });

    router.post('/routes/:id/start', requireAuth, async (req: AuthedRequest, res: Response) => {
        try {
            const supabase = createSupabaseAdminClient();
            const driver = await getDriverByUserId(req.authUserId!);
            if (!driver) {
                res.status(404).json({ success: false, error: 'Driver not found' });
                return;
            }

            const routeId = req.params.id;
            const startedAt = req.body?.started_at ?? req.body?.startedAt;
            if (!startedAt) {
                res.status(400).json({ success: false, error: 'started_at is required' });
                return;
            }

            const { data: route, error: routeErr } = await supabase
                .from('routes')
                .select('id, driver_id')
                .eq('id', routeId)
                .maybeSingle();
            if (routeErr) throw new Error(routeErr.message);
            if (!route) {
                res.status(404).json({ success: false, error: 'Route not found' });
                return;
            }
            if (route.driver_id !== driver.id) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            const { data: updated, error: updErr } = await supabase
                .from('routes')
                .update({ status: 'in_progress', actual_start_time: startedAt })
                .eq('id', routeId)
                .select('id, driver_id, vehicle_id, status, planned_start_time, actual_start_time, actual_end_time, created_at, updated_at')
                .single();
            if (updErr) throw new Error(updErr.message);

            const { data: stops, error: stopsErr } = await supabase
                .from('route_stops')
                .select('id, is_completed, route_id')
                .eq('route_id', routeId);
            if (stopsErr) throw new Error(stopsErr.message);
            const totalStops = (stops ?? []).length;
            const completedStops = (stops ?? []).filter((s: any) => !!s.is_completed).length;

            res.json({ route: mapRouteToAssignedRouteDto(updated, totalStops, completedStops), message: 'Route started' });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: message });
        }
    });

    router.post('/routes/:id/complete', requireAuth, async (req: AuthedRequest, res: Response) => {
        try {
            const supabase = createSupabaseAdminClient();
            const driver = await getDriverByUserId(req.authUserId!);
            if (!driver) {
                res.status(404).json({ success: false, error: 'Driver not found' });
                return;
            }

            const routeId = req.params.id;
            const completedAt = req.body?.completed_at ?? req.body?.completedAt;
            if (!completedAt) {
                res.status(400).json({ success: false, error: 'completed_at is required' });
                return;
            }

            const { data: route, error: routeErr } = await supabase
                .from('routes')
                .select('id, driver_id')
                .eq('id', routeId)
                .maybeSingle();
            if (routeErr) throw new Error(routeErr.message);
            if (!route) {
                res.status(404).json({ success: false, error: 'Route not found' });
                return;
            }
            if (route.driver_id !== driver.id) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            const { data: updated, error: updErr } = await supabase
                .from('routes')
                .update({ status: 'completed', actual_end_time: completedAt })
                .eq('id', routeId)
                .select('id, driver_id, vehicle_id, status, planned_start_time, actual_start_time, actual_end_time, created_at, updated_at')
                .single();
            if (updErr) throw new Error(updErr.message);

            const { data: stops, error: stopsErr } = await supabase
                .from('route_stops')
                .select('id, is_completed, route_id')
                .eq('route_id', routeId);
            if (stopsErr) throw new Error(stopsErr.message);
            const totalStops = (stops ?? []).length;
            const completedStops = (stops ?? []).filter((s: any) => !!s.is_completed).length;

            res.json({ route: mapRouteToAssignedRouteDto(updated, totalStops, completedStops), message: 'Route completed' });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: message });
        }
    });

    router.post('/stops/:id/complete', requireAuth, async (req: AuthedRequest, res: Response) => {
        try {
            const supabase = createSupabaseAdminClient();
            const driver = await getDriverByUserId(req.authUserId!);
            if (!driver) {
                res.status(404).json({ success: false, error: 'Driver not found' });
                return;
            }

            const stopId = req.params.id;
            const completedAt = req.body?.completed_at ?? req.body?.completedAt;
            const notes = req.body?.notes ?? null;
            if (!completedAt) {
                res.status(400).json({ success: false, error: 'completed_at is required' });
                return;
            }

            const { data: stop, error: stopErr } = await supabase
                .from('route_stops')
                .select('id, route_id, stop_sequence, location_id, order_id, stop_type, is_completed, planned_arrival_time, actual_arrival_time, actual_departure_time')
                .eq('id', stopId)
                .maybeSingle();
            if (stopErr) throw new Error(stopErr.message);
            if (!stop) {
                res.status(404).json({ success: false, error: 'Stop not found' });
                return;
            }

            const { data: route, error: routeErr } = await supabase
                .from('routes')
                .select('id, driver_id')
                .eq('id', stop.route_id)
                .maybeSingle();
            if (routeErr) throw new Error(routeErr.message);
            if (!route) {
                res.status(404).json({ success: false, error: 'Route not found' });
                return;
            }
            if (route.driver_id !== driver.id) {
                res.status(403).json({ success: false, error: 'Access denied' });
                return;
            }

            // 1. Complete the stop
            const { data: updatedStop, error: updErr } = await supabase
                .from('route_stops')
                .update({
                    is_completed: true,
                    completion_notes: notes,
                    actual_arrival_time: completedAt,
                    actual_departure_time: completedAt,
                })
                .eq('id', stopId)
                .select('id, route_id, stop_sequence, location_id, order_id, stop_type, is_completed, planned_arrival_time, actual_arrival_time, actual_departure_time')
                .single();
            if (updErr) throw new Error(updErr.message);

            // 2. Check if order should be marked as completed
            // An order is completed when BOTH its pickup and delivery stops are completed
            const orderId = updatedStop.order_id;
            console.log(`[STOP COMPLETE] Order ${orderId}: Checking order status...`);
            
            // Get all stops for this order
            const { data: orderStops, error: orderStopsErr } = await supabase
                .from('route_stops')
                .select('id, stop_type, is_completed')
                .eq('order_id', orderId);
            
            if (orderStopsErr) throw new Error(orderStopsErr.message);
            
            // Check if both pickup and delivery are completed
            const pickupStop = orderStops?.find(s => s.stop_type === 'pickup');
            const deliveryStop = orderStops?.find(s => s.stop_type === 'delivery');
            console.log(`[STOP COMPLETE] Pickup completed: ${pickupStop?.is_completed}, Delivery completed: ${deliveryStop?.is_completed}`);
            
            const bothStopsCompleted = pickupStop?.is_completed === true && deliveryStop?.is_completed === true;
            
            // Update order status if both stops are completed
            if (bothStopsCompleted) {
                console.log(`[STOP COMPLETE] Both stops completed! Setting order status to 'completed'`);
                const { error: orderUpdateErr } = await supabase
                    .from('orders')
                    .update({
                        status: 'completed',
                        delivered_at: completedAt
                    })
                    .eq('id', orderId);
                
                if (orderUpdateErr) {
                    console.error('Error updating order status:', orderUpdateErr);
                    // Don't fail the request if order update fails, just log it
                } else {
                    console.log(`[STOP COMPLETE] ✅ Order ${orderId} marked as completed`);
                }
            } else if (pickupStop?.is_completed === true && deliveryStop?.is_completed !== true) {
                // If pickup is completed but delivery is not, set status to 'in_transit'
                console.log(`[STOP COMPLETE] Pickup completed but delivery pending. Setting order status to 'in_transit'`);
                const { error: orderUpdateErr } = await supabase
                    .from('orders')
                    .update({
                        status: 'in_transit',
                        picked_up_at: completedAt
                    })
                    .eq('id', orderId);
                
                if (orderUpdateErr) {
                    console.error('Error updating order status to in_transit:', orderUpdateErr);
                } else {
                    console.log(`[STOP COMPLETE] ✅ Order ${orderId} marked as in_transit`);
                }
            } else {
                console.log(`[STOP COMPLETE] Order status unchanged (pickup: ${pickupStop?.is_completed}, delivery: ${deliveryStop?.is_completed})`);
            }

            const [locationRes, orderRes] = await Promise.all([
                supabase.from('locations').select('id, name, latitude, longitude').eq('id', updatedStop.location_id).maybeSingle(),
                supabase
                    .from('orders')
                    .select(
                        'id, tracking_number, reference_code, status, pickup_time_start, pickup_time_end, delivery_time_start, delivery_time_end, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone'
                    )
                    .eq('id', updatedStop.order_id)
                    .maybeSingle(),
            ]);

            if (locationRes.error) throw new Error(locationRes.error.message);
            if (orderRes.error) throw new Error(orderRes.error.message);

            const dto = mapStopToDto(updatedStop, locationRes.data ?? null, orderRes.data ?? null);

            res.json({ stop: dto, message: 'Stop completed' });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: message });
        }
    });

    router.post('/tracking/ping', requireAuth, async (_req: AuthedRequest, res: Response) => {
        // NOTE: Tracking persistence is optional; keep API contract stable.
        res.json({ success: true, message: 'ok' });
    });

    router.post('/sync/outbox', requireAuth, async (req: AuthedRequest, res: Response) => {
        try {
            if (!isSupabaseEnabled()) {
                res.status(501).json({ success: false, error: 'Supabase is not configured on backend' });
                return;
            }

            const supabase = createSupabaseAdminClient();
            const driver = await getDriverByUserId(req.authUserId!);
            if (!driver) {
                res.status(404).json({ success: false, error: 'Driver not found' });
                return;
            }

            const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];
            const processed: Array<{ id: string; success: boolean; error: string | null }> = [];

            const normalizeType = (t: any): string =>
                String(t ?? '')
                    .trim()
                    .replace(/\s+/g, '_')
                    .replace(/-/g, '_')
                    .toUpperCase();

            const parsePayload = (payload: any): any => {
                if (payload === null || payload === undefined) return null;
                if (typeof payload === 'string') {
                    // payload is a JSON string (because mobile sends it as string field)
                    return payload.trim() ? JSON.parse(payload) : null;
                }
                // tolerate accidental object payload
                return payload;
            };

            for (const action of actions) {
                const id = String(action?.id ?? '');
                if (!id) {
                    processed.push({ id: id || 'unknown', success: false, error: 'Missing action id' });
                    continue;
                }

                try {
                    const type = normalizeType(action?.type);
                    const payloadObj = parsePayload(action?.payload);

                    if (!payloadObj) {
                        processed.push({ id, success: false, error: 'Missing payload' });
                        continue;
                    }

                    if (type === 'START_ROUTE') {
                        const routeId = String(payloadObj.routeId ?? '');
                        const reqObj = payloadObj.request ?? {};
                        const startedAt = reqObj.started_at ?? reqObj.startedAt;

                        if (!routeId || !startedAt) {
                            processed.push({ id, success: false, error: 'routeId/started_at is required' });
                            continue;
                        }

                        const { data: route, error: routeErr } = await supabase
                            .from('routes')
                            .select('id, driver_id')
                            .eq('id', routeId)
                            .maybeSingle();
                        if (routeErr) throw new Error(routeErr.message);
                        if (!route) {
                            processed.push({ id, success: false, error: 'Route not found' });
                            continue;
                        }
                        if (route.driver_id !== driver.id) {
                            processed.push({ id, success: false, error: 'Access denied' });
                            continue;
                        }

                        const { error: updErr } = await supabase
                            .from('routes')
                            .update({ status: 'in_progress', actual_start_time: startedAt })
                            .eq('id', routeId);
                        if (updErr) throw new Error(updErr.message);

                        processed.push({ id, success: true, error: null });
                        continue;
                    }

                    if (type === 'COMPLETE_ROUTE') {
                        const routeId = String(payloadObj.routeId ?? '');
                        const reqObj = payloadObj.request ?? {};
                        const completedAt = reqObj.completed_at ?? reqObj.completedAt;

                        if (!routeId || !completedAt) {
                            processed.push({ id, success: false, error: 'routeId/completed_at is required' });
                            continue;
                        }

                        const { data: route, error: routeErr } = await supabase
                            .from('routes')
                            .select('id, driver_id')
                            .eq('id', routeId)
                            .maybeSingle();
                        if (routeErr) throw new Error(routeErr.message);
                        if (!route) {
                            processed.push({ id, success: false, error: 'Route not found' });
                            continue;
                        }
                        if (route.driver_id !== driver.id) {
                            processed.push({ id, success: false, error: 'Access denied' });
                            continue;
                        }

                        const { error: updErr } = await supabase
                            .from('routes')
                            .update({ status: 'completed', actual_end_time: completedAt })
                            .eq('id', routeId);
                        if (updErr) throw new Error(updErr.message);

                        processed.push({ id, success: true, error: null });
                        continue;
                    }

                    if (type === 'COMPLETE_STOP') {
                        const routeId = String(payloadObj.routeId ?? '');
                        const stopId = String(payloadObj.stopId ?? '');
                        const reqObj = payloadObj.request ?? {};
                        const completedAt = reqObj.completed_at ?? reqObj.completedAt;
                        const notes = reqObj.notes ?? null;

                        if (!routeId || !stopId || !completedAt) {
                            processed.push({ id, success: false, error: 'routeId/stopId/completed_at is required' });
                            continue;
                        }

                        const { data: route, error: routeErr } = await supabase
                            .from('routes')
                            .select('id, driver_id')
                            .eq('id', routeId)
                            .maybeSingle();
                        if (routeErr) throw new Error(routeErr.message);
                        if (!route) {
                            processed.push({ id, success: false, error: 'Route not found' });
                            continue;
                        }
                        if (route.driver_id !== driver.id) {
                            processed.push({ id, success: false, error: 'Access denied' });
                            continue;
                        }

                        const { data: stop, error: stopErr } = await supabase
                            .from('route_stops')
                            .select('id, route_id, order_id, stop_type')
                            .eq('id', stopId)
                            .maybeSingle();
                        if (stopErr) throw new Error(stopErr.message);
                        if (!stop) {
                            processed.push({ id, success: false, error: 'Stop not found' });
                            continue;
                        }
                        if (stop.route_id !== routeId) {
                            processed.push({ id, success: false, error: 'Stop does not belong to route' });
                            continue;
                        }

                        // 1. Complete the stop
                        const { error: updErr } = await supabase
                            .from('route_stops')
                            .update({
                                is_completed: true,
                                completion_notes: notes,
                                actual_arrival_time: completedAt,
                                actual_departure_time: completedAt,
                            })
                            .eq('id', stopId);
                        if (updErr) throw new Error(updErr.message);

                        // 2. Check if order should be marked as completed
                        // An order is completed when BOTH its pickup and delivery stops are completed
                        const orderId = stop.order_id;
                        
                        // Get all stops for this order
                        const { data: orderStops, error: orderStopsErr } = await supabase
                            .from('route_stops')
                            .select('id, stop_type, is_completed')
                            .eq('order_id', orderId);
                        
                        if (orderStopsErr) throw new Error(orderStopsErr.message);
                        
                        // Check if both pickup and delivery are completed
                        const pickupStop = orderStops?.find(s => s.stop_type === 'pickup');
                        const deliveryStop = orderStops?.find(s => s.stop_type === 'delivery');
                        
                        const bothStopsCompleted = pickupStop?.is_completed === true && deliveryStop?.is_completed === true;
                        
                        // Update order status if both stops are completed
                        if (bothStopsCompleted) {
                            const { error: orderUpdateErr } = await supabase
                                .from('orders')
                                .update({
                                    status: 'completed',
                                    delivered_at: completedAt
                                })
                                .eq('id', orderId);
                            
                            if (orderUpdateErr) {
                                console.error('Error updating order status:', orderUpdateErr);
                                // Don't fail the request if order update fails
                            }
                        } else if (pickupStop?.is_completed === true && deliveryStop?.is_completed !== true) {
                            // If pickup is completed but delivery is not, set status to 'in_transit'
                            const { error: orderUpdateErr } = await supabase
                                .from('orders')
                                .update({
                                    status: 'in_transit',
                                    picked_up_at: completedAt
                                })
                                .eq('id', orderId);
                            
                            if (orderUpdateErr) {
                                console.error('Error updating order status to in_transit:', orderUpdateErr);
                            }
                        }

                        processed.push({ id, success: true, error: null });
                        continue;
                    }

                    // Unknown action type
                    processed.push({ id, success: false, error: `Unsupported action type: ${type}` });
                } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    processed.push({ id, success: false, error: message });
                }
            }

            res.json({ processed, message: 'ok' });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: message });
        }
    });

    return router;
}
