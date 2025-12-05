package com.pikasonix.wayo.data.model

/**
 * Location point on the map
 */
data class LocationPoint(
    val latitude: Double,
    val longitude: Double,
    val name: String? = null,
    val address: String? = null
)

/**
 * Route step containing navigation instructions
 */
data class RouteStep(
    val instruction: String,
    val distance: Double, // meters
    val duration: Double, // seconds
    val maneuver: String? = null,
    val name: String? = null, // street/road name
    val coordinates: List<LocationPoint> = emptyList()
)

/**
 * Route information from origin to destination
 */
data class RouteInfo(
    val origin: LocationPoint,
    val destination: LocationPoint,
    val waypoints: List<LocationPoint> = emptyList(),
    val distance: Double, // meters
    val duration: Double, // seconds
    val geometry: List<LocationPoint> = emptyList(),
    val steps: List<RouteStep> = emptyList(),
    val summary: String? = null
)

/**
 * Route result wrapper
 */
sealed class RouteResult {
    data class Success(val routes: List<RouteInfo>) : RouteResult()
    data class Error(val message: String) : RouteResult()
    data object Loading : RouteResult()
}
