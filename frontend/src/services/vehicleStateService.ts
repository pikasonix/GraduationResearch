/**
 * Vehicle State Service
 * 
 * Provides functions to fetch real-time vehicle states for dynamic routing/reoptimization.
 * This includes GPS positions from vehicle_tracking and picked-up order IDs from route_stops.
 */

import { supabase } from '@/supabase/client';
import type { VehicleState } from './solverService';

interface VehicleTrackingRecord {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  route_id: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
}

interface RouteStopRecord {
  id: string;
  route_id: string;
  order_id: string;
  stop_type: string; // 'pickup' | 'delivery'
  is_completed: boolean;
  actual_arrival_time: string | null;
  actual_departure_time: string | null;
}

interface RouteRecord {
  id: string;
  vehicle_id: string;
  status: string;
}

/**
 * Fetch the latest GPS position for each active vehicle
 */
export async function getLatestVehiclePositions(
  vehicleIds: string[]
): Promise<Map<string, VehicleTrackingRecord>> {
  if (vehicleIds.length === 0) {
    return new Map();
  }

  // For each vehicle, get the most recent tracking record
  const { data, error } = await supabase
    .from('vehicle_tracking')
    .select('*')
    .in('vehicle_id', vehicleIds)
    .order('recorded_at', { ascending: false });

  if (error) {
    console.error('[vehicleStateService] Error fetching vehicle tracking:', error);
    return new Map();
  }

  // Group by vehicle_id and take only the most recent
  const latestByVehicle = new Map<string, VehicleTrackingRecord>();
  for (const record of data || []) {
    if (!latestByVehicle.has(record.vehicle_id)) {
      latestByVehicle.set(record.vehicle_id, record);
    }
  }

  return latestByVehicle;
}

/**
 * Get orders that have been picked up but not yet delivered for active routes
 */
export async function getPickedUpOrderIds(
  organizationId: string,
  vehicleIds: string[]
): Promise<Map<string, string[]>> {
  if (vehicleIds.length === 0) {
    return new Map();
  }

  // First, get active routes for these vehicles
  const { data: routes, error: routesError } = await supabase
    .from('routes')
    .select('id, vehicle_id, status')
    .eq('organization_id', organizationId)
    .in('vehicle_id', vehicleIds)
    .in('status', ['assigned', 'in_progress']);

  if (routesError) {
    console.error('[vehicleStateService] Error fetching routes:', routesError);
    return new Map();
  }

  if (!routes || routes.length === 0) {
    return new Map();
  }

  const routeIdToVehicleId = new Map<string, string>();
  for (const route of routes) {
    if (route.vehicle_id) {
      routeIdToVehicleId.set(route.id, route.vehicle_id);
    }
  }

  // Get route stops for these routes
  const routeIds = routes.map(r => r.id);
  const { data: stops, error: stopsError } = await supabase
    .from('route_stops')
    .select('route_id, order_id, stop_type, is_completed')
    .in('route_id', routeIds);

  if (stopsError) {
    console.error('[vehicleStateService] Error fetching route stops:', stopsError);
    return new Map();
  }

  // Group stops by route_id
  const stopsByRoute = new Map<string, RouteStopRecord[]>();
  for (const stop of stops || []) {
    const existing = stopsByRoute.get(stop.route_id) || [];
    existing.push(stop as RouteStopRecord);
    stopsByRoute.set(stop.route_id, existing);
  }

  // Determine picked-up orders for each vehicle
  // An order is "picked up but not delivered" if:
  // - The pickup stop (stop_type = 'pickup') is completed
  // - The delivery stop (stop_type = 'delivery') is NOT completed
  const pickedByVehicle = new Map<string, string[]>();

  for (const [routeId, routeStops] of stopsByRoute.entries()) {
    const vehicleId = routeIdToVehicleId.get(routeId);
    if (!vehicleId) continue;

    const pickupsByOrder = new Map<string, boolean>();
    const deliveriesByOrder = new Map<string, boolean>();

    for (const stop of routeStops) {
      if (stop.stop_type === 'pickup') {
        pickupsByOrder.set(stop.order_id, stop.is_completed);
      } else if (stop.stop_type === 'delivery') {
        deliveriesByOrder.set(stop.order_id, stop.is_completed);
      }
    }

    const pickedUpOrderIds: string[] = [];
    for (const [orderId, isPickedUp] of pickupsByOrder.entries()) {
      const isDelivered = deliveriesByOrder.get(orderId) || false;
      if (isPickedUp && !isDelivered) {
        pickedUpOrderIds.push(orderId);
      }
    }

    if (pickedUpOrderIds.length > 0) {
      const existing = pickedByVehicle.get(vehicleId) || [];
      pickedByVehicle.set(vehicleId, [...existing, ...pickedUpOrderIds]);
    }
  }

  return pickedByVehicle;
}

/**
 * Get the last completed stop info for each vehicle
 */
export async function getLastCompletedStops(
  organizationId: string,
  vehicleIds: string[]
): Promise<Map<string, { locationId: string; time: string }>> {
  if (vehicleIds.length === 0) {
    return new Map();
  }

  // Get active routes for these vehicles
  const { data: routes, error: routesError } = await supabase
    .from('routes')
    .select('id, vehicle_id')
    .eq('organization_id', organizationId)
    .in('vehicle_id', vehicleIds)
    .in('status', ['assigned', 'in_progress']);

  if (routesError || !routes || routes.length === 0) {
    return new Map();
  }

  const routeIdToVehicleId = new Map<string, string>();
  for (const route of routes) {
    if (route.vehicle_id) {
      routeIdToVehicleId.set(route.id, route.vehicle_id);
    }
  }

  // Get completed stops with actual departure time, ordered by time descending
  const routeIds = routes.map(r => r.id);
  const { data: stops, error: stopsError } = await supabase
    .from('route_stops')
    .select('route_id, location_id, actual_departure_time')
    .in('route_id', routeIds)
    .eq('is_completed', true)
    .not('actual_departure_time', 'is', null)
    .order('actual_departure_time', { ascending: false });

  if (stopsError || !stops) {
    return new Map();
  }

  // Group by vehicle and get the most recent
  const lastStopByVehicle = new Map<string, { locationId: string; time: string }>();
  for (const stop of stops) {
    const vehicleId = routeIdToVehicleId.get(stop.route_id);
    if (!vehicleId || lastStopByVehicle.has(vehicleId)) continue;
    
    lastStopByVehicle.set(vehicleId, {
      locationId: stop.location_id,
      time: stop.actual_departure_time,
    });
  }

  return lastStopByVehicle;
}

interface Vehicle {
  id: string;
  organization_id: string;
  license_plate: string;
  is_active: boolean;
}

/**
 * Build complete VehicleState array for reoptimization
 * 
 * This combines:
 * - Latest GPS positions from vehicle_tracking
 * - Picked-up order IDs from route_stops
 * - Last completed stop info
 * 
 * Vehicles without GPS data will use depot as fallback position.
 */
export async function buildVehicleStates(
  organizationId: string,
  depotLat: number,
  depotLng: number
): Promise<VehicleState[]> {
  // Fetch active vehicles for this organization
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles')
    .select('id, organization_id, license_plate, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (vehiclesError) {
    console.error('[vehicleStateService] Error fetching vehicles:', vehiclesError);
    return [];
  }

  if (!vehicles || vehicles.length === 0) {
    console.warn('[vehicleStateService] No active vehicles found for organization');
    return [];
  }

  const vehicleIds = vehicles.map(v => v.id);

  // Fetch all data in parallel
  const [gpsPositions, pickedUpOrders, lastStops] = await Promise.all([
    getLatestVehiclePositions(vehicleIds),
    getPickedUpOrderIds(organizationId, vehicleIds),
    getLastCompletedStops(organizationId, vehicleIds),
  ]);

  // Build vehicle states
  const vehicleStates: VehicleState[] = [];

  for (const vehicle of vehicles) {
    const gps = gpsPositions.get(vehicle.id);
    const pickedIds = pickedUpOrders.get(vehicle.id) || [];
    const lastStop = lastStops.get(vehicle.id);

    // Use GPS position if available, otherwise use depot
    const lat = gps?.latitude ?? depotLat;
    const lng = gps?.longitude ?? depotLng;
    const bearing = gps?.heading ?? undefined;

    vehicleStates.push({
      vehicle_id: vehicle.id,
      lat,
      lng,
      bearing,
      last_stop_location_id: lastStop?.locationId,
      last_stop_time: lastStop?.time,
      picked_order_ids: pickedIds,
    });
  }

  return vehicleStates;
}

/**
 * Build vehicle states from explicit vehicle list (for dynamic routing mode)
 * Only includes vehicles that have tracking data or are assigned to active routes.
 */
export async function buildVehicleStatesForRouting(
  organizationId: string,
  depotLat: number,
  depotLng: number,
  options?: {
    /** Only include vehicles assigned to these route IDs */
    routeIds?: string[];
    /** Only include these specific vehicle IDs */
    vehicleIds?: string[];
    /** Include vehicles even without GPS data (use depot as fallback) */
    includeWithoutGps?: boolean;
  }
): Promise<VehicleState[]> {
  const { routeIds, vehicleIds: explicitVehicleIds, includeWithoutGps = true } = options || {};

  let vehicleIds: string[] = [];

  // If routeIds provided, get vehicles from those routes
  if (routeIds && routeIds.length > 0) {
    const { data: routes, error } = await supabase
      .from('routes')
      .select('vehicle_id')
      .in('id', routeIds)
      .not('vehicle_id', 'is', null);

    if (!error && routes) {
      vehicleIds = routes.map(r => r.vehicle_id).filter((id): id is string => !!id);
    }
  }

  // If explicit vehicle IDs provided, use those
  if (explicitVehicleIds && explicitVehicleIds.length > 0) {
    vehicleIds = [...new Set([...vehicleIds, ...explicitVehicleIds])];
  }

  // If no vehicles specified, get all active vehicles
  if (vehicleIds.length === 0) {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (!error && vehicles) {
      vehicleIds = vehicles.map(v => v.id);
    }
  }

  if (vehicleIds.length === 0) {
    return [];
  }

  // Fetch all data in parallel
  const [gpsPositions, pickedUpOrders, lastStops] = await Promise.all([
    getLatestVehiclePositions(vehicleIds),
    getPickedUpOrderIds(organizationId, vehicleIds),
    getLastCompletedStops(organizationId, vehicleIds),
  ]);

  // Build vehicle states
  const vehicleStates: VehicleState[] = [];

  for (const vehicleId of vehicleIds) {
    const gps = gpsPositions.get(vehicleId);
    
    // Skip vehicles without GPS if not including them
    if (!gps && !includeWithoutGps) {
      continue;
    }

    const pickedIds = pickedUpOrders.get(vehicleId) || [];
    const lastStop = lastStops.get(vehicleId);

    // Use GPS position if available, otherwise use depot
    const lat = gps?.latitude ?? depotLat;
    const lng = gps?.longitude ?? depotLng;
    const bearing = gps?.heading ?? undefined;

    vehicleStates.push({
      vehicle_id: vehicleId,
      lat,
      lng,
      bearing,
      last_stop_location_id: lastStop?.locationId,
      last_stop_time: lastStop?.time,
      picked_order_ids: pickedIds,
    });
  }

  return vehicleStates;
}

export default {
  getLatestVehiclePositions,
  getPickedUpOrderIds,
  getLastCompletedStops,
  buildVehicleStates,
  buildVehicleStatesForRouting,
};
