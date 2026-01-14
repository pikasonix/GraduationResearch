package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.data.model.Vehicle
import com.pikasonix.wayo.data.remote.SupabaseClientProvider
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order

/**
 * Repository cho các thao tác xe
 */
class VehicleRepository {
    private val supabase = SupabaseClientProvider.client

    /**
     * Lấy tất cả xe khả dụng của một tổ chức
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
                    order("license_plate", order = Order.ASCENDING)
                }
                .decodeList<VehicleResponse>()
                .map { it.toVehicle() }
        } catch (e: Exception) {
            throw Exception("Failed to fetch vehicles: ${e.message}")
        }
    }

    /**
     * Lấy xe được gán cho một tài xế cụ thể
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
     * Gán tài xế cho xe làm mặc định
     */
    suspend fun assignDriverToVehicle(
        vehicleId: String,
        driverId: String,
        organizationId: String
    ) {
        try {
            // Đầu tiên, bỏ gán tài xế khỏi các xe khác
            supabase.from("vehicles")
                .update({
                    set("default_driver_id", null as String?)
                }) {
                    filter {
                        eq("default_driver_id", driverId)
                        eq("organization_id", organizationId)
                    }
                }

            // Sau đó gán cho xe mới
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
     * Bỏ gán tài xế khỏi xe của họ
     */
    suspend fun unassignDriverFromVehicle(
        driverId: String,
        organizationId: String
    ) {
        try {
            supabase.from("vehicles")
                .update({
                    set("default_driver_id", null as String?)
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
 * Response model cho xe với dữ liệu tài xế lồng nhau
 */
@kotlinx.serialization.Serializable
private data class VehicleResponse(
    val id: String,
    val organization_id: String,
    val license_plate: String,
    val vehicle_type: String,
    val capacity_weight: Double? = null,
    val capacity_volume: Double? = null,
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
        capacityWeight = capacity_weight?.toInt() ?: 0,
        capacityVolume = capacity_volume?.toInt(),
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
