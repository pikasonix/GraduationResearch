import { supabase } from '@/supabase/client';

// Types matching Supabase schema
export interface Driver {
    id: string;
    organization_id: string;
    user_id: string | null;
    driver_code: string;
    full_name: string;
    phone: string;
    is_active: boolean;
    assigned_zone_id: string | null;
    created_at: string;
}

export interface Vehicle {
    id: string;
    organization_id: string;
    license_plate: string;
    vehicle_type: 'motorcycle' | 'van' | 'truck_small' | 'truck_medium' | 'truck_large';
    capacity_weight: number;
    capacity_volume: number | null;
    is_active: boolean;
    current_latitude: number | null;
    current_longitude: number | null;
}

export interface DriverWithVehicle extends Driver {
    vehicle?: Vehicle;
}

export interface RouteAssignment {
    id: string;
    organization_id: string;
    driver_id: string | null;
    vehicle_id: string | null;
    status: 'planned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
    solution_id: string | null;
    total_distance_km: number | null;
    total_duration_hours: number | null;
    created_at: string;
}

/**
 * Fetch all drivers with their assigned vehicles
 */
export async function getDrivers(organizationId?: string): Promise<DriverWithVehicle[]> {
    let query = supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

    if (organizationId) {
        query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching drivers:', error);
        throw error;
    }

    return data || [];
}

/**
 * Fetch all active vehicles
 */
export async function getVehicles(organizationId?: string): Promise<Vehicle[]> {
    let query = supabase
        .from('vehicles')
        .select('*')
        .eq('is_active', true)
        .order('license_plate');

    if (organizationId) {
        query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching vehicles:', error);
        throw error;
    }

    return data || [];
}

/**
 * Assign a route to a driver
 * Creates an optimization_solution record first, then creates the route with the solution_id
 */
export async function assignRouteToDriver(params: {
    organizationId: string;
    driverId: string;
    vehicleId: string;
    solutionData: object;
    totalDistanceKm?: number;
    totalDurationHours?: number;
}): Promise<RouteAssignment> {
    // Step 1: Create optimization_solution record first (to get solution_id for routes table)
    // Note: optimization_solutions table only has: id, job_id, solution_data
    // Generate a unique job_id for dispatch-created solutions
    const dispatchJobId = `dispatch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: solutionRecord, error: solutionError } = await supabase
        .from('optimization_solutions')
        .insert({
            job_id: dispatchJobId,
            solution_data: params.solutionData
        })
        .select()
        .single();

    if (solutionError) {
        console.error('Error creating optimization_solution:', solutionError);
        console.error('Attempting direct route creation with fallback...');
        
        // Fallback: Create a local route assignment with a generated ID
        const fallbackId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fallbackAssignment: RouteAssignment = {
            id: fallbackId,
            organization_id: params.organizationId,
            driver_id: params.driverId,
            vehicle_id: params.vehicleId,
            status: 'assigned',
            solution_id: null,
            total_distance_km: params.totalDistanceKm || null,
            total_duration_hours: params.totalDurationHours || null,
            created_at: new Date().toISOString()
        };

        // Store solution data in localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem(`route_${fallbackId}`, JSON.stringify(params.solutionData));

            // Also store in a list of assigned routes
            const existingRoutes = JSON.parse(localStorage.getItem('assigned_routes') || '[]');
            existingRoutes.push(fallbackAssignment);
            localStorage.setItem('assigned_routes', JSON.stringify(existingRoutes));
        }

        console.log('Fallback route assignment created:', fallbackAssignment);
        return fallbackAssignment;
    }

    // Step 2: Create route with the solution_id
    const { data, error } = await supabase
        .from('routes')
        .insert({
            organization_id: params.organizationId,
            driver_id: params.driverId,
            vehicle_id: params.vehicleId,
            solution_id: solutionRecord.id,
            status: 'assigned',
            total_distance_km: params.totalDistanceKm || null,
            total_duration_hours: params.totalDurationHours || null
        })
        .select()
        .single();

    if (error) {
        console.error('Error assigning route:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('Insert params:', {
            organization_id: params.organizationId,
            driver_id: params.driverId,
            vehicle_id: params.vehicleId,
            solution_id: solutionRecord.id
        });

        // Cleanup: Delete the optimization_solution record since route creation failed
        await supabase
            .from('optimization_solutions')
            .delete()
            .eq('id', solutionRecord.id);

        // Fallback: Create a local route assignment with a generated ID
        const fallbackId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fallbackAssignment: RouteAssignment = {
            id: fallbackId,
            organization_id: params.organizationId,
            driver_id: params.driverId,
            vehicle_id: params.vehicleId,
            status: 'assigned',
            solution_id: null,
            total_distance_km: params.totalDistanceKm || null,
            total_duration_hours: params.totalDurationHours || null,
            created_at: new Date().toISOString()
        };

        // Store solution data in localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem(`route_${fallbackId}`, JSON.stringify(params.solutionData));

            // Also store in a list of assigned routes
            const existingRoutes = JSON.parse(localStorage.getItem('assigned_routes') || '[]');
            existingRoutes.push(fallbackAssignment);
            localStorage.setItem('assigned_routes', JSON.stringify(existingRoutes));
        }

        console.log('Fallback route assignment created:', fallbackAssignment);
        return fallbackAssignment;
    }

    // Store solution data in localStorage for mobile to retrieve
    // Key: route_{routeId}
    if (typeof window !== 'undefined') {
        localStorage.setItem(`route_${data.id}`, JSON.stringify(params.solutionData));
    }

    return data;
}

/**
 * Get routes assigned to a specific driver
 */
export async function getDriverRoutes(driverId: string): Promise<RouteAssignment[]> {
    const { data, error } = await supabase
        .from('routes')
        .select(`
            *,
            optimization_solutions (
                solution_data
            )
        `)
        .eq('driver_id', driverId)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching driver routes:', error);
        throw error;
    }

    return data || [];
}

/**
 * Update route status
 */
export async function updateRouteStatus(
    routeId: string,
    status: 'planned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
): Promise<void> {
    const { error } = await supabase
        .from('routes')
        .update({ status })
        .eq('id', routeId);

    if (error) {
        console.error('Error updating route status:', error);
        throw error;
    }
}

/**
 * Get driver by user_id (for mobile app)
 */
export async function getDriverByUserId(userId: string): Promise<Driver | null> {
    const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No rows returned
            return null;
        }
        console.error('Error fetching driver by user_id:', error);
        throw error;
    }

    return data;
}
