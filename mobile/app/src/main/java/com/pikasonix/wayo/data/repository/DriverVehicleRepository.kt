package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.data.model.Vehicle
import com.pikasonix.wayo.data.remote.SupabaseClientProvider
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Mirrors frontend /driver/vehicle flow:
 * - latest optimization solution for org
 * - routes (planned/assigned) with vehicle_id
 * - vehicles list + ability to claim/unclaim routes
 */
class DriverVehicleRepository(
    private val vehicleRepository: VehicleRepository = VehicleRepository()
) {
    private val supabase = SupabaseClientProvider.client

    data class DriverContext(
        val driverId: String,
        val organizationId: String
    )

    @Serializable
    private data class DriverRow(
        @SerialName("id") val id: String,
        @SerialName("organization_id") val organizationId: String
    )

    @Serializable
    private data class IdRow(
        @SerialName("id") val id: String
    )

    @Serializable
    data class RouteRow(
        @SerialName("id") val id: String,
        @SerialName("vehicle_id") val vehicleId: String? = null,
        @SerialName("driver_id") val driverId: String? = null,
        @SerialName("status") val status: String,
        @SerialName("route_number") val routeNumber: Int? = null,
        @SerialName("planned_distance_km") val plannedDistanceKm: Double? = null,
        @SerialName("planned_duration_hours") val plannedDurationHours: Double? = null,
        @SerialName("planned_cost") val plannedCost: Double? = null,
        @SerialName("solution_id") val solutionId: String? = null,
        @SerialName("organization_id") val organizationId: String? = null
    )

    data class VehicleWithRoutes(
        val vehicle: Vehicle,
        val routes: List<RouteRow>,
        val isOccupied: Boolean,
        val assignedDriverId: String?
    )

    suspend fun getDriverContextByUserId(userId: String): DriverContext? {
        val rows = supabase.postgrest["drivers"]
            .select(columns = Columns.list("id", "organization_id")) {
                filter { eq("user_id", userId) }
                limit(1)
            }
            .decodeList<DriverRow>()

        val row = rows.firstOrNull() ?: return null
        return DriverContext(driverId = row.id, organizationId = row.organizationId)
    }

    suspend fun getVehiclesWithActiveRoutes(organizationId: String): List<VehicleWithRoutes> {
        // latest solution
        val latestSolution = supabase.postgrest["optimization_solutions"]
            .select(columns = Columns.list("id")) {
                filter { eq("organization_id", organizationId) }
                order("created_at", order = Order.DESCENDING)
                limit(1)
            }
            .decodeList<IdRow>()
            .firstOrNull()
            ?: return emptyList()

        val allRoutes = supabase.postgrest["routes"]
            .select(
                columns = Columns.list(
                    "id",
                    "vehicle_id",
                    "driver_id",
                    "status",
                    "route_number",
                    "planned_distance_km",
                    "planned_duration_hours",
                    "planned_cost",
                    "solution_id",
                    "organization_id"
                )
            ) {
                filter {
                    eq("organization_id", organizationId)
                    eq("solution_id", latestSolution.id)
                }
            }
            .decodeList<RouteRow>()

        val activeRoutes = allRoutes.filter { r ->
            (r.status == "planned" || r.status == "assigned") && !r.vehicleId.isNullOrBlank()
        }

        if (activeRoutes.isEmpty()) return emptyList()

        val vehicleIds = activeRoutes.mapNotNull { it.vehicleId }.toSet()

        // Kotlin PostgREST DSL doesn't reliably support `in(...)` across versions,
        // so we load org vehicles and filter client-side.
        val vehicles = vehicleRepository.getAvailableVehicles(organizationId)
            .filter { it.id in vehicleIds }

        return vehicles.map { v ->
            val vehicleRoutes = activeRoutes.filter { it.vehicleId == v.id }
            val assignedDriverId = vehicleRoutes.firstOrNull { !it.driverId.isNullOrBlank() }?.driverId
            val isOccupied = assignedDriverId != null
            VehicleWithRoutes(
                vehicle = v,
                routes = vehicleRoutes,
                isOccupied = isOccupied,
                assignedDriverId = assignedDriverId
            )
        }
    }

    suspend fun claimVehicleRoutes(vehicleId: String, driverId: String, organizationId: String) {
        val candidateRoutes = supabase.postgrest["routes"]
            .select(columns = Columns.list("id", "driver_id", "status", "vehicle_id")) {
                filter {
                    eq("organization_id", organizationId)
                    eq("vehicle_id", vehicleId)
                }
            }
            .decodeList<RouteRow>()
            .filter { r ->
                (r.status == "planned" || r.status == "assigned") && r.driverId.isNullOrBlank() && r.vehicleId == vehicleId
            }

        for (route in candidateRoutes) {
            supabase.postgrest["routes"]
                .update({
                    set("driver_id", driverId)
                    set("status", "assigned")
                }) {
                    filter {
                        eq("id", route.id)
                        eq("organization_id", organizationId)
                    }
                }
        }

        // Note: we intentionally verify by reading back, because some environments return
        // 200 with 0 updated rows (or RLS silently blocks) depending on API gateway config.
    }

    /**
     * Claims all claimable routes for a vehicle.
     * @return number of routes that are now assigned to this driver for the vehicle.
     */
    suspend fun claimVehicleRoutesAndGetCount(vehicleId: String, driverId: String, organizationId: String): Int {
        claimVehicleRoutes(vehicleId, driverId, organizationId)

        val after = supabase.postgrest["routes"]
            .select(columns = Columns.list("id")) {
                filter {
                    eq("organization_id", organizationId)
                    eq("vehicle_id", vehicleId)
                    eq("driver_id", driverId)
                }
            }
            .decodeList<IdRow>()

        return after.size
    }

    suspend fun unclaimVehicleRoutes(driverId: String, organizationId: String): Int {
        val candidateRoutes = supabase.postgrest["routes"]
            .select(columns = Columns.list("id", "status", "driver_id")) {
                filter {
                    eq("organization_id", organizationId)
                    eq("driver_id", driverId)
                }
            }
            .decodeList<RouteRow>()
            .filter { it.status == "assigned" }

        if (candidateRoutes.isEmpty()) return 0

        for (route in candidateRoutes) {
            supabase.postgrest["routes"]
                .update({
                    set("driver_id", null as String?)
                    set("status", "planned")
                }) {
                    filter {
                        eq("id", route.id)
                        eq("organization_id", organizationId)
                    }
                }
        }

        return candidateRoutes.size
    }
}
