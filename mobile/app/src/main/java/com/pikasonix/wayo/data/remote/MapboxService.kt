package com.pikasonix.wayo.data.remote

import com.pikasonix.wayo.BuildConfig
import com.pikasonix.wayo.data.model.LocationPoint
import com.pikasonix.wayo.data.model.PlaceResult
import com.pikasonix.wayo.data.model.RouteAnnotation
import com.pikasonix.wayo.data.model.RouteInfo
import com.pikasonix.wayo.data.model.RouteLeg
import com.pikasonix.wayo.data.model.RouteStep
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Cấu hình Mapbox
 * Giá trị được load từ local.properties qua BuildConfig
 */
object MapboxConfig {
    val ACCESS_TOKEN: String = BuildConfig.MAPBOX_ACCESS_TOKEN
    const val DIRECTIONS_API_URL = "https://api.mapbox.com/directions/v5/mapbox"
    const val GEOCODING_API_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"
}

/**
 * Service để fetch routes từ Mapbox Directions API
 */
@Singleton
class MapboxService @Inject constructor() {
    
    private val client = OkHttpClient()
    
    /**
     * Lấy route giữa hai điểm
     */
    suspend fun getRoute(
        origin: LocationPoint,
        destination: LocationPoint,
        profile: String = "driving-traffic"
    ): RouteInfo? = withContext(Dispatchers.IO) {
        try {
            val coordinates = "${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}"
            val url = "${MapboxConfig.DIRECTIONS_API_URL}/$profile/$coordinates" +
                    "?alternatives=true" +
                    "&geometries=geojson" +
                    "&language=vi" +
                    "&overview=full" +
                    "&steps=true" +
                    "&annotations=congestion,speed,duration" +
                    "&access_token=${MapboxConfig.ACCESS_TOKEN}"
            
            val request = Request.Builder()
                .url(url)
                .build()
            
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: return@withContext null
            
            parseRouteResponse(body, origin, destination)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
    
    private fun parseRouteResponse(
        json: String,
        origin: LocationPoint,
        destination: LocationPoint
    ): RouteInfo? {
        return try {
            val jsonObject = JSONObject(json)
            val routes = jsonObject.getJSONArray("routes")
            
            if (routes.length() == 0) return null
            
            val route = routes.getJSONObject(0)
            val distance = route.getDouble("distance")
            val duration = route.getDouble("duration")
            
            // Parse geometry
            val geometry = route.getJSONObject("geometry")
            val coordinates = geometry.getJSONArray("coordinates")
            val geometryPoints = mutableListOf<LocationPoint>()
            
            for (i in 0 until coordinates.length()) {
                val coord = coordinates.getJSONArray(i)
                geometryPoints.add(
                    LocationPoint(
                        longitude = coord.getDouble(0),
                        latitude = coord.getDouble(1)
                    )
                )
            }
            
            // Parse legs with steps and annotations
            val legsJson = route.getJSONArray("legs")
            val legs = mutableListOf<RouteLeg>()
            val allSteps = mutableListOf<RouteStep>()
            
            for (i in 0 until legsJson.length()) {
                val leg = legsJson.getJSONObject(i)
                val legSteps = mutableListOf<RouteStep>()
                val legStepsJson = leg.getJSONArray("steps")
                
                for (j in 0 until legStepsJson.length()) {
                    val step = legStepsJson.getJSONObject(j)
                    val maneuver = step.getJSONObject("maneuver")
                    
                    val routeStep = RouteStep(
                        instruction = maneuver.optString("instruction", ""),
                        distance = step.getDouble("distance"),
                        duration = step.getDouble("duration"),
                        maneuver = maneuver.optString("type", "")
                    )
                    legSteps.add(routeStep)
                    allSteps.add(routeStep)
                }
                
                // Parse annotation if available
                val annotation = if (leg.has("annotation")) {
                    val annotationJson = leg.getJSONObject("annotation")
                    
                    val congestion = mutableListOf<String>()
                    if (annotationJson.has("congestion")) {
                        val congestionArray = annotationJson.getJSONArray("congestion")
                        for (j in 0 until congestionArray.length()) {
                            congestion.add(congestionArray.optString(j, "unknown"))
                        }
                    }
                    
                    val speed = mutableListOf<Double>()
                    if (annotationJson.has("speed")) {
                        val speedArray = annotationJson.getJSONArray("speed")
                        for (j in 0 until speedArray.length()) {
                            speed.add(speedArray.optDouble(j, 0.0))
                        }
                    }
                    
                    val durationList = mutableListOf<Double>()
                    if (annotationJson.has("duration")) {
                        val durationArray = annotationJson.getJSONArray("duration")
                        for (j in 0 until durationArray.length()) {
                            durationList.add(durationArray.optDouble(j, 0.0))
                        }
                    }
                    
                    RouteAnnotation(
                        congestion = congestion,
                        speed = speed,
                        duration = durationList
                    )
                } else null
                
                legs.add(
                    RouteLeg(
                        distance = leg.getDouble("distance"),
                        duration = leg.getDouble("duration"),
                        steps = legSteps,
                        annotation = annotation,
                        summary = leg.optString("summary") ?: ""
                    )
                )
            }
            
            RouteInfo(
                origin = origin,
                destination = destination,
                distance = distance,
                duration = duration,
                geometry = geometryPoints,
                steps = allSteps,
                legs = legs
            )
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
    
    /**
     * Search for places by query (Geocoding API)
     * @param query Search query string
     * @param proximity Optional center point for proximity bias
     * @param limit Maximum number of results
     */
    suspend fun searchPlaces(
        query: String,
        proximity: LocationPoint? = null,
        limit: Int = 5
    ): List<PlaceResult> = withContext(Dispatchers.IO) {
        try {
            val encodedQuery = java.net.URLEncoder.encode(query, "UTF-8")
            var url = "${MapboxConfig.GEOCODING_API_URL}/$encodedQuery.json" +
                    "?access_token=${MapboxConfig.ACCESS_TOKEN}" +
                    "&language=vi" +
                    "&limit=$limit" +
                    "&types=address,poi,place,locality,neighborhood"
            
            // Add proximity bias if available
            proximity?.let {
                url += "&proximity=${it.longitude},${it.latitude}"
            }
            
            val request = Request.Builder()
                .url(url)
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: return@withContext emptyList()
            
            val json = JSONObject(responseBody)
            val features = json.optJSONArray("features") ?: return@withContext emptyList()
            
            val results = mutableListOf<PlaceResult>()
            for (i in 0 until features.length()) {
                val feature = features.getJSONObject(i)
                val geometry = feature.getJSONObject("geometry")
                val coordinates = geometry.getJSONArray("coordinates")
                
                val placeName = feature.optString("place_name", "")
                val text = feature.optString("text", "")
                
                // Get context for address parts
                val context = feature.optJSONArray("context")
                var address = ""
                if (context != null) {
                    val parts = mutableListOf<String>()
                    for (j in 0 until context.length()) {
                        val contextItem = context.getJSONObject(j)
                        parts.add(contextItem.optString("text", ""))
                    }
                    address = parts.joinToString(", ")
                }
                
                results.add(
                    PlaceResult(
                        id = feature.optString("id", ""),
                        name = text,
                        fullAddress = placeName,
                        address = address,
                        location = LocationPoint(
                            latitude = coordinates.getDouble(1),
                            longitude = coordinates.getDouble(0)
                        )
                    )
                )
            }
            
            results
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }
    
    /**
     * Reverse geocoding - convert coordinates to address
     * @param location The location to reverse geocode
     */
    suspend fun reverseGeocode(location: LocationPoint): PlaceResult? = withContext(Dispatchers.IO) {
        try {
            val url = "${MapboxConfig.GEOCODING_API_URL}/${location.longitude},${location.latitude}.json" +
                    "?access_token=${MapboxConfig.ACCESS_TOKEN}" +
                    "&language=vi" +
                    "&types=address,poi,place,locality,neighborhood"
            
            val request = Request.Builder()
                .url(url)
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: return@withContext null
            
            val json = JSONObject(responseBody)
            val features = json.optJSONArray("features") ?: return@withContext null
            
            if (features.length() == 0) return@withContext null
            
            val feature = features.getJSONObject(0)
            val placeName = feature.optString("place_name", "")
            val text = feature.optString("text", "")
            
            // Get context for address parts
            val context = feature.optJSONArray("context")
            var address = ""
            if (context != null) {
                val parts = mutableListOf<String>()
                for (j in 0 until context.length()) {
                    val contextItem = context.getJSONObject(j)
                    parts.add(contextItem.optString("text", ""))
                }
                address = parts.joinToString(", ")
            }
            
            PlaceResult(
                id = feature.optString("id", ""),
                name = text,
                fullAddress = placeName,
                address = address,
                location = location
            )
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
    
    /**
     * Get real road routing coordinates for multiple waypoints
     * Returns list of coordinates that follow actual roads
     * @param waypoints List of coordinates [lng, lat]
     * @return List of coordinates following roads, or original waypoints if API fails
     */
    suspend fun getRealRouteCoordinates(
        waypoints: List<Pair<Double, Double>>
    ): List<Pair<Double, Double>> = withContext(Dispatchers.IO) {
        if (waypoints.size < 2) return@withContext waypoints
        
        try {
            // Mapbox Directions API limits to 25 waypoints per request
            val maxWaypoints = 25
            
            if (waypoints.size <= maxWaypoints) {
                // Single request
                return@withContext fetchRouteSegment(waypoints)
            } else {
                // Chunk and merge
                val allCoords = mutableListOf<Pair<Double, Double>>()
                
                var i = 0
                while (i < waypoints.size) {
                    val end = minOf(i + maxWaypoints, waypoints.size)
                    val chunk = waypoints.subList(i, end)
                    
                    if (chunk.size < 2) break
                    
                    val chunkCoords = fetchRouteSegment(chunk)
                    
                    // Skip first point if not first chunk to avoid duplicates
                    if (allCoords.isNotEmpty() && chunkCoords.isNotEmpty()) {
                        allCoords.addAll(chunkCoords.drop(1))
                    } else {
                        allCoords.addAll(chunkCoords)
                    }
                    
                    // Move forward, overlapping by 1 point
                    i += maxWaypoints - 1
                }
                
                return@withContext if (allCoords.isNotEmpty()) allCoords else waypoints
            }
        } catch (e: Exception) {
            e.printStackTrace()
            // Fallback to straight lines
            return@withContext waypoints
        }
    }
    
    private suspend fun fetchRouteSegment(
        waypoints: List<Pair<Double, Double>>
    ): List<Pair<Double, Double>> = withContext(Dispatchers.IO) {
        try {
            val coordStr = waypoints.joinToString(";") { "${it.first},${it.second}" }
            val url = "${MapboxConfig.DIRECTIONS_API_URL}/driving/$coordStr" +
                    "?overview=full" +
                    "&geometries=geojson" +
                    "&access_token=${MapboxConfig.ACCESS_TOKEN}"
            
            val request = Request.Builder()
                .url(url)
                .build()
            
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: return@withContext waypoints
            
            val jsonObject = JSONObject(body)
            val routes = jsonObject.getJSONArray("routes")
            
            if (routes.length() == 0) return@withContext waypoints
            
            val route = routes.getJSONObject(0)
            val geometry = route.getJSONObject("geometry")
            val coordinates = geometry.getJSONArray("coordinates")
            
            val result = mutableListOf<Pair<Double, Double>>()
            for (i in 0 until coordinates.length()) {
                val coord = coordinates.getJSONArray(i)
                result.add(Pair(coord.getDouble(0), coord.getDouble(1)))
            }
            
            return@withContext if (result.isNotEmpty()) result else waypoints
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext waypoints
        }
    }
}
