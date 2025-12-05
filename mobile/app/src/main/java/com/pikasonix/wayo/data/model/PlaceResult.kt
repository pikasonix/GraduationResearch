package com.pikasonix.wayo.data.model

/**
 * Represents a place result from geocoding/search API
 */
data class PlaceResult(
    val id: String,
    val name: String,
    val fullAddress: String,
    val address: String,
    val location: LocationPoint
)
