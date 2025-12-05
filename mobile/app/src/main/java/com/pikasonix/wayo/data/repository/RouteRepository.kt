package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.data.model.LocationPoint
import com.pikasonix.wayo.data.model.PlaceResult
import com.pikasonix.wayo.data.model.RouteInfo
import com.pikasonix.wayo.data.model.RouteResult
import com.pikasonix.wayo.data.remote.MapboxService
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for routing operations
 */
@Singleton
class RouteRepository @Inject constructor(
    private val mapboxService: MapboxService
) {
    
    /**
     * Get route between origin and destination
     */
    suspend fun getRoute(
        origin: LocationPoint,
        destination: LocationPoint,
        profile: String = "driving-traffic"
    ): RouteResult {
        return try {
            val route = mapboxService.getRoute(origin, destination, profile)
            if (route != null) {
                RouteResult.Success(listOf(route))
            } else {
                RouteResult.Error("Không tìm thấy tuyến đường")
            }
        } catch (e: Exception) {
            RouteResult.Error(e.message ?: "Lỗi khi tìm tuyến đường")
        }
    }
    
    /**
     * Get route with multiple waypoints
     */
    suspend fun getRouteWithWaypoints(
        origin: LocationPoint,
        destination: LocationPoint,
        waypoints: List<LocationPoint>,
        profile: String = "driving-traffic"
    ): RouteResult {
        // For now, just get direct route
        // TODO: Implement waypoint routing
        return getRoute(origin, destination, profile)
    }
    
    /**
     * Search for places by query
     */
    suspend fun searchPlaces(
        query: String,
        proximity: LocationPoint? = null,
        limit: Int = 5
    ): List<PlaceResult> {
        return try {
            mapboxService.searchPlaces(query, proximity, limit)
        } catch (e: Exception) {
            emptyList()
        }
    }
    
    /**
     * Reverse geocode a location to get address
     */
    suspend fun reverseGeocode(location: LocationPoint): PlaceResult? {
        return try {
            mapboxService.reverseGeocode(location)
        } catch (e: Exception) {
            null
        }
    }
}
