package com.pikasonix.wayo.data.model

/**
 * Đại diện cho kết quả địa điểm từ geocoding/search API
 */
data class PlaceResult(
    val id: String,
    val name: String,
    val fullAddress: String,
    val address: String,
    val location: LocationPoint
)
