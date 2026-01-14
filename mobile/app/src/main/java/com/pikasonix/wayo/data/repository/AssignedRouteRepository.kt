package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.data.model.AssignedRoute
import com.pikasonix.wayo.data.model.AssignedRouteWithSolution
import com.pikasonix.wayo.data.model.RouteStatus
import com.pikasonix.wayo.data.remote.SupabaseClientProvider
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.*

/**
 * Repository quản lý routes được giao từ Supabase
 */
class AssignedRouteRepository {
    private val supabase = SupabaseClientProvider.client

    private data class DriverContext(
        val driverId: String,
        val organizationId: String
    )

    /**
     * Lấy thông tin driver từ bảng drivers dựa trên user_id
     */
    private suspend fun getDriverContextFromUserId(userId: String, userEmail: String?): DriverContext? {
        return try {
            val response = supabase.postgrest["drivers"]
                .select(columns = Columns.list("id", "organization_id")) {
                    filter {
                        eq("user_id", userId)
                    }
                }
                .decodeList<JsonObject>()
            
            if (response.isNotEmpty()) {
                val row = response[0]
                val driverId = row["id"]?.jsonPrimitive?.content
                val organizationId = row["organization_id"]?.jsonPrimitive?.content
                if (!driverId.isNullOrBlank() && !organizationId.isNullOrBlank()) {
                    return DriverContext(driverId = driverId, organizationId = organizationId)
                }
            }
            
            null
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Lấy tất cả routes được giao cho driver
     * @param userId Auth user ID từ Supabase auth
     * @param userEmail Email người dùng (dự phòng)
     */
    suspend fun getAssignedRoutes(userId: String, userEmail: String? = null): List<AssignedRoute> {
        return try {
            val ctx = getDriverContextFromUserId(userId, userEmail) ?: return emptyList()

            val assigned = supabase.postgrest["routes"]
                .select {
                    filter {
                        eq("driver_id", ctx.driverId)
                        neq("status", "completed")
                        neq("status", "cancelled")
                    }
                }
                .decodeList<AssignedRoute>()

            assigned
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    /**
     * Lấy route với dữ liệu solution để điều hướng
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
     * Cập nhật trạng thái route
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
     * Đánh dấu route đang thực hiện
     */
    suspend fun startRoute(routeId: String): Boolean {
        return updateRouteStatus(routeId, RouteStatus.IN_PROGRESS)
    }

    /**
     * Đánh dấu route hoàn thành
     */
    suspend fun completeRoute(routeId: String): Boolean {
        return updateRouteStatus(routeId, RouteStatus.COMPLETED)
    }

    /**
     * Flow để theo dõi routes được giao (cho realtime updates)
     */
    fun observeAssignedRoutes(driverId: String): Flow<List<AssignedRoute>> = flow {
        emit(getAssignedRoutes(driverId, null))
    }
}

@kotlinx.serialization.Serializable
private data class SolutionDataWrapper(
    @kotlinx.serialization.SerialName("solution_data")
    val solutionData: JsonObject?
)
