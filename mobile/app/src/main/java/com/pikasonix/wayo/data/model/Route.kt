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
 * Route leg annotation containing traffic/congestion data
 */
data class RouteAnnotation(
    val congestion: List<String> = emptyList(), // low, moderate, heavy, severe, unknown
    val speed: List<Double> = emptyList(), // speeds in m/s for each segment
    val duration: List<Double> = emptyList() // duration in seconds for each segment
)

/**
 * Route leg from one waypoint to another
 */
data class RouteLeg(
    val distance: Double,
    val duration: Double,
    val steps: List<RouteStep> = emptyList(),
    val annotation: RouteAnnotation? = null,
    val summary: String? = null
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
    val legs: List<RouteLeg> = emptyList(),
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
