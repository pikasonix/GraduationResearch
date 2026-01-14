package com.pikasonix.wayo.data.model

/**
 * Data model xe khớp với schema Supabase
 */
data class Vehicle(
    val id: String,
    val organizationId: String,
    val licensePlate: String,
    val vehicleType: String, // xe máy, xe van, xe tải nhỏ, xe tải vừa, xe tải lớn
    val capacityWeight: Int,
    val capacityVolume: Int? = null,
    val fuelConsumption: Double? = null,
    val costPerKm: Double? = null,
    val costPerHour: Double? = null,
    val fixedCost: Double? = null,
    val isActive: Boolean = true,
    val notes: String? = null,
    val defaultDriverId: String? = null,
    val driverName: String? = null, // Join từ bảng drivers
    val createdAt: String? = null,
    val updatedAt: String? = null
)
