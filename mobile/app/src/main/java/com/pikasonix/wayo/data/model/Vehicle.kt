package com.pikasonix.wayo.data.model

/**
 * Vehicle data model matching Supabase schema
 */
data class Vehicle(
    val id: String,
    val organizationId: String,
    val licensePlate: String,
    val vehicleType: String, // motorcycle, van, truck_small, truck_medium, truck_large
    val capacityWeight: Int,
    val capacityVolume: Int? = null,
    val fuelConsumption: Double? = null,
    val costPerKm: Double? = null,
    val costPerHour: Double? = null,
    val fixedCost: Double? = null,
    val isActive: Boolean = true,
    val notes: String? = null,
    val defaultDriverId: String? = null,
    val driverName: String? = null, // Joined from drivers table
    val createdAt: String? = null,
    val updatedAt: String? = null
)
