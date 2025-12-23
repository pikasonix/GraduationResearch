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
    team_id: string | null;
    created_at: string;
}

export interface Vehicle {
    id: string;
    organization_id: string;
    license_plate: string;
    vehicle_type: 'motorcycle' | 'van' | 'truck_small' | 'truck_medium' | 'truck_large';
    capacity_weight: number;
    capacity_volume: number | null;
    fuel_consumption: number | null;
    cost_per_km: number | null;
    cost_per_hour: number | null;
    fixed_cost: number | null;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
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

export interface Team {
    id: string;
    organization_id: string;
    manager_id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface TeamWithDetails extends Team {
    drivers: Driver[];
    vehicles: Vehicle[];
    manager: {
        id: string;
        username: string;
        full_name: string | null;
    } | null;
}

export interface TeamStatistics {
    total_drivers: number;
    active_drivers: number;
    total_vehicles: number;
    active_vehicles: number;
}

/**
 * Fetch all drivers with their assigned vehicles
 */
export async function getDrivers(organizationId?: string, includeInactive: boolean = false): Promise<DriverWithVehicle[]> {
    let query = supabase
        .from('drivers')
        .select('*')
        .order('full_name');

    if (!includeInactive) {
        query = query.eq('is_active', true);
    }

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

// Fetch all active vehicles
export async function getVehicles(organizationId?: string, includeInactive: boolean = false): Promise<Vehicle[]> {
    let query = supabase
        .from('vehicles')
        .select('*');
    // .order('license_plate'); // Creating 400 error if column doesn't exist?

    if (!includeInactive) {
        query = query.eq('is_active', true);
    }

    if (organizationId) {
        query = query.eq('organization_id', organizationId);
    }


    const { data, error } = await query;

    if (error) {
        console.error('Error fetching vehicles:', error);
        console.error('Error details:', JSON.stringify(error, null, 2)); // Log full error details
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

/**
 * Get team managed by a specific manager
 */
export async function getManagerTeam(managerId: string): Promise<TeamWithDetails | null> {
    const { data: team, error: teamError } = await supabase
        .from('teams')
        .select(`
            *,
            manager:users!teams_manager_id_fkey (
                id,
                username,
                full_name
            )
        `)
        .eq('manager_id', managerId)
        .eq('is_active', true)
        .single();

    if (teamError) {
        if (teamError.code === 'PGRST116') {
            // No rows returned
            return null;
        }
        console.error('Error fetching manager team:', teamError);
        throw teamError;
    }

    if (!team) return null;

    // Fetch drivers and vehicles for this team
    const [driversData, vehiclesData] = await Promise.all([
        getDrivers(team.organization_id, true).then(drivers =>
            drivers.filter(d => d.team_id === team.id)
        ),
        // Vehicles are not linked to teams in the current schema
        getVehicles(team.organization_id, true)
    ]);

    return {
        ...team,
        drivers: driversData,
        vehicles: vehiclesData,
        manager: Array.isArray(team.manager) ? team.manager[0] : team.manager
    };
}

/**
 * Get statistics for a team
 */
export async function getTeamStatistics(teamId: string): Promise<TeamStatistics> {
    const [driversData, vehiclesData] = await Promise.all([
        supabase
            .from('drivers')
            .select('id, is_active')
            .eq('team_id', teamId),
        supabase
            .from('vehicles')
            .select('id, is_active')
            .eq('team_id', teamId)
    ]);

    const drivers = driversData.data || [];
    const vehicles = vehiclesData.data || [];

    return {
        total_drivers: drivers.length,
        active_drivers: drivers.filter(d => d.is_active).length,
        total_vehicles: vehicles.length,
        active_vehicles: vehicles.filter(v => v.is_active).length
    };
}

/**
 * Driver CRUD
 */
export async function createDriver(driver: Omit<Driver, "id" | "created_at">): Promise<Driver> {
    const { data, error } = await supabase
        .from('drivers')
        .insert(driver)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Check if email already has an account
 */
export async function checkEmailExists(email: string): Promise<{ exists: boolean; userId?: string }> {
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        console.error('Error checking email:', error);
        return { exists: false };
    }

    return {
        exists: !!data,
        userId: data?.id
    };
}

/**
 * Link existing user to driver
 */
export async function linkExistingUserToDriver(params: {
    user_id: string;
    full_name: string;
    phone: string;
    organization_id: string;
    team_id?: string | null;
    is_active: boolean;
}): Promise<Driver> {
    // Auto-generate driver_code
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const driver_code = `TX${timestamp}${random}`;

    const driverData: Omit<Driver, "id" | "created_at"> = {
        organization_id: params.organization_id,
        user_id: params.user_id,
        driver_code: driver_code,
        full_name: params.full_name,
        phone: params.phone,
        is_active: params.is_active,
        team_id: params.team_id || null,
    };

    const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .insert(driverData)
        .select()
        .single();

    if (driverError) {
        console.error('Error creating driver record:', driverError);
        throw new Error(`Không thể tạo hồ sơ tài xế: ${driverError.message}`);
    }

    return driver;
}

/**
 * Create driver with user account
 * Uses backend API with service role key to avoid logging out current user
 */
export async function createDriverWithAccount(params: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    organization_id: string;
    team_id?: string | null;
    is_active: boolean;
}): Promise<Driver> {
    try {
        // Call backend API to create user with service role (won't affect current session)
        const response = await fetch('/api/admin/create-driver-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: params.email,
                password: params.password,
                full_name: params.full_name,
                phone: params.phone,
                organization_id: params.organization_id,
                team_id: params.team_id,
                is_active: params.is_active,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Không thể tạo tài khoản tài xế');
        }

        return data.driver;
    } catch (error) {
        console.error('Error creating driver with account:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Có lỗi xảy ra khi tạo tài khoản tài xế');
    }
}

export async function updateDriver(id: string, updates: Partial<Driver>): Promise<Driver> {
    const { data, error } = await supabase
        .from('drivers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteDriver(id: string): Promise<void> {
    const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

/**
 * Vehicle CRUD
 */
export async function createVehicle(vehicle: Omit<Vehicle, "id" | "created_at" | "updated_at">): Promise<Vehicle> {
    const { data, error } = await supabase
        .from('vehicles')
        .insert(vehicle)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    const { data, error } = await supabase
        .from('vehicles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteVehicle(id: string): Promise<void> {
    const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
