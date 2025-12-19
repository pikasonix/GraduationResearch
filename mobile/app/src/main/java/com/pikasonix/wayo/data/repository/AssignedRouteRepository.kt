package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.data.model.AssignedRoute
import com.pikasonix.wayo.data.model.AssignedRouteWithSolution
import com.pikasonix.wayo.data.model.RouteStatus
import com.pikasonix.wayo.data.remote.SupabaseClientProvider
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.JsonObject

/**
 * Repository for fetching and managing assigned routes from Supabase
 */
class AssignedRouteRepository {
    private val supabase = SupabaseClientProvider.client

    /**
     * Get all routes assigned to a specific driver
     */
    suspend fun getAssignedRoutes(driverId: String): List<AssignedRoute> {
        return try {
            supabase.postgrest["routes"]
                .select {
                    filter {
                        eq("driver_id", driverId)
                        neq("status", "completed")
                        neq("status", "cancelled")
                    }
                }
                .decodeList()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    /**
     * Get route with solution data for navigation
     */
    suspend fun getRouteWithSolution(routeId: String): AssignedRouteWithSolution? {
        return try {
            val route = supabase.postgrest["routes"]
                .select {
                    filter {
                        eq("id", routeId)
                    }
                }
                .decodeSingle<AssignedRoute>()

            // Get solution data if exists
            val solutionData = route.solutionId?.let { solutionId ->
                try {
                    supabase.postgrest["optimization_solutions"]
                        .select(Columns.raw("solution_data")) {
                            filter {
                                eq("id", solutionId)
                            }
                        }
                        .decodeSingleOrNull<SolutionDataWrapper>()
                        ?.solutionData
                } catch (e: Exception) {
                    null
                }
            }

            AssignedRouteWithSolution(route, solutionData)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Update route status
     */
    suspend fun updateRouteStatus(routeId: String, status: RouteStatus): Boolean {
        return try {
            supabase.postgrest["routes"]
                .update({
                    set("status", status.name.lowercase())
                }) {
                    filter {
                        eq("id", routeId)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Mark route as in progress
     */
    suspend fun startRoute(routeId: String): Boolean {
        return updateRouteStatus(routeId, RouteStatus.IN_PROGRESS)
    }

    /**
     * Mark route as completed
     */
    suspend fun completeRoute(routeId: String): Boolean {
        return updateRouteStatus(routeId, RouteStatus.COMPLETED)
    }

    /**
     * Flow to observe assigned routes (for realtime updates)
     */
    fun observeAssignedRoutes(driverId: String): Flow<List<AssignedRoute>> = flow {
        emit(getAssignedRoutes(driverId))
    }
}

@kotlinx.serialization.Serializable
private data class SolutionDataWrapper(
    @kotlinx.serialization.SerialName("solution_data")
    val solutionData: JsonObject?
)
