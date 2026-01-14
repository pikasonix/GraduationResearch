package com.pikasonix.wayo.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * Represents a route assigned to a driver
 */
@Serializable
data class AssignedRoute(
    val id: String,
    @SerialName("organization_id")
    val organizationId: String,
    @SerialName("driver_id")
    val driverId: String? = null,
    @SerialName("vehicle_id")
    val vehicleId: String? = null,
    val status: RouteStatus,
    @SerialName("solution_id")
    val solutionId: String? = null,
    @SerialName("planned_distance_km")
    val plannedDistanceKm: Double? = null,
    @SerialName("planned_duration_hours")
    val plannedDurationHours: Double? = null,
    @SerialName("total_distance_km")
    val totalDistanceKm: Double? = null,
    @SerialName("total_duration_hours")
    val totalDurationHours: Double? = null,
    @SerialName("created_at")
    val createdAt: String = ""
)

@Serializable
enum class RouteStatus {
    @SerialName("planned")
    PLANNED,
    @SerialName("assigned")
    ASSIGNED,
    @SerialName("in_progress")
    IN_PROGRESS,
    @SerialName("completed")
    COMPLETED,
    @SerialName("cancelled")
    CANCELLED
}

/**
 * Route with solution data for navigation
 */
@Serializable
data class AssignedRouteWithSolution(
    val route: AssignedRoute,
    @SerialName("solution_data")
    val solutionData: JsonObject?
)
