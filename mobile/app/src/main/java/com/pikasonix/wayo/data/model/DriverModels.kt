package com.pikasonix.wayo.data.model

/**
 * Domain model profile tài xế
 */
data class DriverProfile(
    val id: String,
    val userId: String,
    val fullName: String,
    val phone: String?,
    val avatarUrl: String?,
    val rating: Double,
    val totalDeliveries: Int,
    val status: String // "active", "inactive", "suspended"
)

/**
 * Assigned route domain model
 */
data class Route(
    val id: String,
    val driverId: String,
    val vehicleId: String?,
    val status: String, // "assigned", "in_progress", "completed", "cancelled"
    val scheduledDate: String,
    val startedAt: String?,
    val completedAt: String?,
    val totalStops: Int,
    val completedStops: Int
)

/**
 * Route stop domain model
 */
data class Stop(
    val id: String,
    val routeId: String,
    val sequence: Int,
    val locationName: String,
    val latitude: Double,
    val longitude: Double,
    val type: String, // "pickup", "delivery"
    val status: String, // "pending", "in_progress", "completed", "skipped"
    val scheduledTime: String?,
    val timeWindowStart: String?,
    val timeWindowEnd: String?,
    val completedAt: String?,
    val orders: List<Order>
)

/**
 * Order domain model
 */
data class Order(
    val id: String,
    val orderNumber: String,
    val customerName: String,
    val customerPhone: String?,
    val itemsCount: Int,
    val status: String // "pending", "picked", "delivered", "cancelled"
)
