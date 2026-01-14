package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.local.dao.OrdersDao
import com.pikasonix.wayo.data.local.dao.PendingActionsDao
import com.pikasonix.wayo.data.local.dao.RouteStopsDao
import com.pikasonix.wayo.data.local.entity.PendingActionEntity
import com.pikasonix.wayo.data.model.Order
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.remote.backend.BackendApiService
import com.pikasonix.wayo.data.remote.backend.dto.CompleteStopRequest
import com.pikasonix.wayo.data.remote.backend.dto.toEntity
import com.pikasonix.wayo.data.remote.backend.dto.toModel
import com.pikasonix.wayo.data.util.DateUtils
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException
import java.util.UUID
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StopRepository @Inject constructor(
    private val backendApi: BackendApiService,
    private val routeStopsDao: RouteStopsDao,
    private val ordersDao: OrdersDao,
    private val pendingActionsDao: PendingActionsDao,
    private val dispatchers: DispatcherProvider
) {
    
    /**
     * Observe stops for a route with their orders (offline-first)
     */
    fun observeStopsByRoute(routeId: String): Flow<List<Stop>> {
        val stopsFlow = routeStopsDao.observeStopsByRoute(routeId)
        return stopsFlow.map { stopEntities ->
            stopEntities.map { stopEntity ->
                val orderEntities = ordersDao.getOrdersByStop(stopEntity.id)
                stopEntity.toModel().copy(
                    orders = orderEntities.map { it.toModel() }
                )
            }
        }
    }
    
    /**
     * Get a single stop by ID with its orders
     */
    suspend fun getStopById(stopId: String): AppResult<Stop> = withContext(dispatchers.io) {
        try {
            val stopEntity = routeStopsDao.getById(stopId)
            if (stopEntity != null) {
                val orderEntities = ordersDao.getOrdersByStop(stopId)
                val stop = stopEntity.toModel().copy(
                    orders = orderEntities.map { it.toModel() }
                )
                AppResult.Success(stop)
            } else {
                AppResult.Error(AppError.NotFound("Stop not found"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Complete a stop (optimistic update + queue for sync)
     */
    suspend fun completeStop(
        routeId: String,
        stopId: String,
        latitude: Double,
        longitude: Double,
        notes: String? = null
    ): AppResult<Stop> = withContext(dispatchers.io) {
        try {
            val stopEntity = routeStopsDao.getById(stopId)
            if (stopEntity == null) {
                return@withContext AppResult.Error(AppError.NotFound("Stop not found"))
            }
            
            val completedAtMillis = System.currentTimeMillis()
            
            // Optimistic update local database
            val updatedStop = stopEntity.copy(
                status = "completed",
                completedAt = completedAtMillis
            )
            routeStopsDao.update(updatedStop)
            
            // Thử sync ngay nếu online
            try {
                val request = CompleteStopRequest(
                    completedAt = DateUtils.epochMillisToIso(completedAtMillis) ?: DateUtils.nowIso(),
                    latitude = latitude,
                    longitude = longitude,
                    notes = notes
                )
                
                val response = backendApi.completeStop(stopId, request)
                if (response.isSuccessful && response.body() != null) {
                    // Cập nhật với response từ server
                    val responseBody = response.body()!!
                    val serverStopEntity = responseBody.stop.toEntity()
                    routeStopsDao.update(serverStopEntity)
                    
                    // Cập nhật orders từ server response
                    responseBody.stop.orders.forEach { orderDto ->
                        val orderEntity = orderDto.toEntity(stopId)
                        ordersDao.update(orderEntity)
                    }
                    
                    val orderEntities = ordersDao.getOrdersByStop(stopId)
                    val stop = serverStopEntity.toModel().copy(
                        orders = orderEntities.map { it.toModel() }
                    )
                    return@withContext AppResult.Success(stop)
                } else {
                    throw Exception("Server returned error")
                }
            } catch (e: Exception) {
                // Xếp hàng cho background sync nếu immediate sync thất bại
                val request = CompleteStopRequest(
                    completedAt = DateUtils.epochMillisToIso(completedAtMillis) ?: DateUtils.nowIso(),
                    latitude = latitude,
                    longitude = longitude,
                    notes = notes
                )

                val payload = JSONObject().apply {
                    put("routeId", routeId)
                    put("stopId", stopId)
                    put(
                        "request",
                        JSONObject().apply {
                            put("completed_at", request.completedAt)
                            put("latitude", request.latitude)
                            put("longitude", request.longitude)
                            put("notes", request.notes ?: JSONObject.NULL)
                        }
                    )
                }.toString()
                
                val pendingAction = PendingActionEntity(
                    id = UUID.randomUUID().toString(),
                    type = "COMPLETE_STOP",
                    payloadJson = payload,
                    status = "PENDING",
                    attemptCount = 0,
                    createdAt = System.currentTimeMillis(),
                    lastAttemptAt = null,
                    lastError = null,
                    idempotencyKey = UUID.randomUUID().toString()
                )
                pendingActionsDao.insert(pendingAction)
                android.util.Log.d("StopRepository", "📝 Queued for background sync")
            }
            
            // Return updated stop from local DB
            val orderEntities = ordersDao.getOrdersByStop(stopId)
            val stop = updatedStop.toModel().copy(
                orders = orderEntities.map { it.toModel() }
            )
            AppResult.Success(stop)
        } catch (e: Exception) {
            android.util.Log.e("StopRepository", "❌ Error completing stop: ${e.message}", e)
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Update stop status locally
     */
    suspend fun updateStopStatus(stopId: String, status: String): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            val stopEntity = routeStopsDao.getById(stopId)
            if (stopEntity != null) {
                val updated = stopEntity.copy(status = status)
                routeStopsDao.update(updated)
                AppResult.Success(Unit)
            } else {
                AppResult.Error(AppError.NotFound("Stop not found"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Sync completed stop with backend (called by SyncWorker)
     */
    suspend fun syncCompleteStop(routeId: String, stopId: String, request: CompleteStopRequest): AppResult<Stop> = 
        withContext(dispatchers.io) {
            try {
                val response = backendApi.completeStop(stopId, request)
                if (!response.isSuccessful || response.body() == null) {
                    return@withContext AppResult.Error(AppError.ServerError("Failed to complete stop"))
                }
                
                val responseBody = response.body()!!
                val stopEntity = responseBody.stop.toEntity()
                
                // Update local database
                routeStopsDao.update(stopEntity)
                
                // Update orders if provided
                responseBody.stop.orders.forEach { orderDto ->
                    val orderEntity = orderDto.toEntity(stopId)
                    ordersDao.update(orderEntity)
                }
                
                val orderEntities = ordersDao.getOrdersByStop(stopId)
                val stop = stopEntity.toModel().copy(
                    orders = orderEntities.map { it.toModel() }
                )
                AppResult.Success(stop)
            } catch (e: IOException) {
                AppResult.Error(AppError.Network("Network error: ${e.message}"))
            } catch (e: HttpException) {
                when (e.code()) {
                    401 -> AppResult.Error(AppError.Authentication("Authentication required"))
                    403 -> AppResult.Error(AppError.Authorization("Access denied"))
                    404 -> AppResult.Error(AppError.NotFound("Stop not found"))
                    else -> AppResult.Error(AppError.ServerError("Server error: ${e.code()}"))
                }
            } catch (e: Exception) {
                AppResult.Error(AppError.Unknown(e.message ?: "Unknown error"))
            }
        }
    
}
