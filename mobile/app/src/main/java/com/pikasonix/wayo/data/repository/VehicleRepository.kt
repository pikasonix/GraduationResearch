package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.data.model.Vehicle
import com.pikasonix.wayo.data.remote.SupabaseClientProvider
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.json.JsonNull.content

/**
 * Repository for vehicle operations
 */
class VehicleRepository {
    private val supabase = SupabaseClientProvider.client

    /**
     * Get all available vehicles for an organization
     */
    suspend fun getAvailableVehicles(organizationId: String): List<Vehicle> {
        return try {
            supabase.from("vehicles")
                .select(
                    columns = Columns.raw("""
                        *,
                        driver:drivers!vehicles_default_driver_id_fkey(
                            id,
                            full_name
                        )
                    """.trimIndent())
                ) {
                    filter {
                        eq("organization_id", organizationId)
                        eq("is_active", true)
                    }
                    order("license_plate", ascending = true)
                }
                .decodeList<VehicleResponse>()
                .map { it.toVehicle() }
        } catch (e: Exception) {
            throw Exception("Failed to fetch vehicles: ${e.message}")
        }
    }

    /**
     * Get the vehicle assigned to a specific driver
     */
    suspend fun getDriverVehicle(driverId: String): Vehicle? {
        return try {
            val response = supabase.from("vehicles")
                .select(
                    columns = Columns.raw("""
                        *,
                        driver:drivers!vehicles_default_driver_id_fkey(
                            id,
                            full_name
                        )
                    """.trimIndent())
                ) {
                    filter {
                        eq("default_driver_id", driverId)
                        eq("is_active", true)
                    }
                    limit(1)
                }
                .decodeList<VehicleResponse>()

            response.firstOrNull()?.toVehicle()
        } catch (e: Exception) {
            throw Exception("Failed to fetch driver vehicle: ${e.message}")
        }
    }

    /**
     * Assign a driver to a vehicle as default
     */
    suspend fun assignDriverToVehicle(
        vehicleId: String,
        driverId: String,
        organizationId: String
    ) {
        try {
            // First, unassign driver from any other vehicle
            supabase.from("vehicles")
                .update({
                    set("default_driver_id", null)
                }) {
                    filter {
                        eq("default_driver_id", driverId)
                        eq("organization_id", organizationId)
                    }
                }

            // Then assign to new vehicle
            supabase.from("vehicles")
                .update({
                    set("default_driver_id", driverId)
                }) {
                    filter {
                        eq("id", vehicleId)
                        eq("organization_id", organizationId)
                    }
                }
        } catch (e: Exception) {
            throw Exception("Failed to assign driver to vehicle: ${e.message}")
        }
    }

    /**
     * Unassign a driver from their vehicle
     */
    suspend fun unassignDriverFromVehicle(
        driverId: String,
        organizationId: String
    ) {
        try {
            supabase.from("vehicles")
                .update({
                    set("default_driver_id", null)
                }) {
                    filter {
                        eq("default_driver_id", driverId)
                        eq("organization_id", organizationId)
                    }
                }
        } catch (e: Exception) {
            throw Exception("Failed to unassign driver from vehicle: ${e.message}")
        }
    }
}

/**
 * Response model for vehicle with nested driver data
 */
@kotlinx.serialization.Serializable
private data class VehicleResponse(
    val id: String,
    val organization_id: String,
    val license_plate: String,
    val vehicle_type: String,
    val capacity_weight: Int,
    val capacity_volume: Int? = null,
    val fuel_consumption: Double? = null,
    val cost_per_km: Double? = null,
    val cost_per_hour: Double? = null,
    val fixed_cost: Double? = null,
    val is_active: Boolean = true,
    val notes: String? = null,
    val default_driver_id: String? = null,
    val driver: DriverInfo? = null,
    val created_at: String? = null,
    val updated_at: String? = null
) {
    @kotlinx.serialization.Serializable
    data class DriverInfo(
        val id: String,
        val full_name: String
    )

    fun toVehicle() = Vehicle(
        id = id,
        organizationId = organization_id,
        licensePlate = license_plate,
        vehicleType = vehicle_type,
        capacityWeight = capacity_weight,
        capacityVolume = capacity_volume,
        fuelConsumption = fuel_consumption,
        costPerKm = cost_per_km,
        costPerHour = cost_per_hour,
        fixedCost = fixed_cost,
        isActive = is_active,
        notes = notes,
        defaultDriverId = default_driver_id,
        driverName = driver?.full_name,
        createdAt = created_at,
        updatedAt = updated_at
    )
}
