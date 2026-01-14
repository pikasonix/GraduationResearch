package com.pikasonix.wayo.data.remote.backend.dto

import com.squareup.moshi.Json

data class DriverProfileResponse(
    @Json(name = "id") val id: String,
    @Json(name = "user_id") val userId: String,
    @Json(name = "full_name") val fullName: String,
    @Json(name = "phone") val phone: String?,
    @Json(name = "avatar_url") val avatarUrl: String?,
    @Json(name = "rating") val rating: Double?,
    @Json(name = "total_deliveries") val totalDeliveries: Int?,
    @Json(name = "status") val status: String,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "updated_at") val updatedAt: String
)

data class AssignedRoutesResponse(
    @Json(name = "routes") val routes: List<AssignedRouteDto>
)

data class AssignedRouteDto(
    @Json(name = "id") val id: String,
    @Json(name = "driver_id") val driverId: String,
    @Json(name = "vehicle_id") val vehicleId: String?,
    @Json(name = "status") val status: String,
    @Json(name = "scheduled_date") val scheduledDate: String,
    @Json(name = "started_at") val startedAt: String?,
    @Json(name = "completed_at") val completedAt: String?,
    @Json(name = "total_stops") val totalStops: Int,
    @Json(name = "completed_stops") val completedStops: Int,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "updated_at") val updatedAt: String
)

data class RouteDetailsResponse(
    @Json(name = "route") val route: AssignedRouteDto,
    @Json(name = "stops") val stops: List<RouteStopDto>
)

data class RouteStopDto(
    @Json(name = "id") val id: String,
    @Json(name = "route_id") val routeId: String,
    @Json(name = "sequence") val sequence: Int,
    @Json(name = "location_name") val locationName: String,
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    @Json(name = "type") val type: String, // "pickup" or "delivery"
    @Json(name = "status") val status: String, // "pending", "completed"
    @Json(name = "scheduled_time") val scheduledTime: String?,
    @Json(name = "time_window_start") val timeWindowStart: String?,
    @Json(name = "time_window_end") val timeWindowEnd: String?,
    @Json(name = "completed_at") val completedAt: String?,
    @Json(name = "orders") val orders: List<OrderDto>
)

data class OrderDto(
    @Json(name = "id") val id: String,
    @Json(name = "order_number") val orderNumber: String,
    @Json(name = "customer_name") val customerName: String,
    @Json(name = "customer_phone") val customerPhone: String?,
    @Json(name = "items_count") val itemsCount: Int,
    @Json(name = "status") val status: String
)

data class StartRouteRequest(
    @Json(name = "started_at") val startedAt: String,
    @Json(name = "latitude") val latitude: Double?,
    @Json(name = "longitude") val longitude: Double?
)

data class StartRouteResponse(
    @Json(name = "route") val route: AssignedRouteDto,
    @Json(name = "message") val message: String
)

data class CompleteRouteRequest(
    @Json(name = "completed_at") val completedAt: String,
    @Json(name = "latitude") val latitude: Double?,
    @Json(name = "longitude") val longitude: Double?
)

data class CompleteRouteResponse(
    @Json(name = "route") val route: AssignedRouteDto,
    @Json(name = "message") val message: String
)

data class CompleteStopRequest(
    @Json(name = "completed_at") val completedAt: String,
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    @Json(name = "notes") val notes: String?
)

data class CompleteStopResponse(
    @Json(name = "stop") val stop: RouteStopDto,
    @Json(name = "message") val message: String
)

data class TrackingPingRequest(
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    @Json(name = "accuracy") val accuracy: Float?,
    @Json(name = "speed") val speed: Float?,
    @Json(name = "bearing") val bearing: Float?,
    @Json(name = "timestamp") val timestamp: String
)

data class TrackingPingResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "message") val message: String
)

data class SyncOutboxRequest(
    @Json(name = "actions") val actions: List<PendingActionDto>
)

data class PendingActionDto(
    @Json(name = "id") val id: String,
    @Json(name = "type") val type: String,
    @Json(name = "payload") val payload: String,
    @Json(name = "created_at") val createdAt: String
)

data class SyncOutboxResponse(
    @Json(name = "processed") val processed: List<ProcessedActionDto>,
    @Json(name = "message") val message: String
)

data class ProcessedActionDto(
    @Json(name = "id") val id: String,
    @Json(name = "success") val success: Boolean,
    @Json(name = "error") val error: String?
)

data class ApiErrorResponse(
    @Json(name = "error") val error: String,
    @Json(name = "message") val message: String,
    @Json(name = "status") val status: Int
)
