package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.local.dao.OrdersDao
import com.pikasonix.wayo.data.local.dao.PendingActionsDao
import com.pikasonix.wayo.data.local.dao.RouteStopsDao
import com.pikasonix.wayo.data.local.dao.RoutesDao
import com.pikasonix.wayo.data.local.entity.PendingActionEntity
import com.pikasonix.wayo.data.model.Route
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.remote.backend.BackendApiService
import com.pikasonix.wayo.data.remote.backend.dto.*
import com.pikasonix.wayo.data.util.DateUtils
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException
import java.util.UUID
import java.net.UnknownHostException
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for managing driver routes from Backend API with offline-first approach
 */
@Singleton
class BackendRouteRepository @Inject constructor(
    private val backendApi: BackendApiService,
    private val routesDao: RoutesDao,
    private val routeStopsDao: RouteStopsDao,
    private val ordersDao: OrdersDao,
    private val pendingActionsDao: PendingActionsDao,
    private val dispatchers: DispatcherProvider
) {
    
    /**
     * Observe assigned routes from local database (offline-first)
     */
    fun observeAssignedRoutes(driverId: String): Flow<List<Route>> {
        return routesDao.observeAssignedRoutes(driverId).map { entities ->
            entities.map { it.toModel() }
        }
    }
    
    /**
     * Observe a single route by ID
     */
    fun observeRouteById(routeId: String): Flow<Route?> {
        return routesDao.observeRouteById(routeId).map { entity ->
            entity?.toModel()
        }
    }
    
    /**
     * Get route from cache
     */
    suspend fun getRouteById(routeId: String): AppResult<Route> = withContext(dispatchers.io) {
        try {
            val entity = routesDao.getById(routeId)
            if (entity != null) {
                AppResult.Success(entity.toModel())
            } else {
                AppResult.Error(AppError.NotFound("Route not found"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Refresh assigned routes from backend and cache locally
     */
    suspend fun refreshAssignedRoutes(driverId: String): AppResult<List<Route>> = withContext(dispatchers.io) {
        try {
            val response = backendApi.getAssignedRoutes()
            if (!response.isSuccessful || response.body() == null) {
                return@withContext AppResult.Error(AppError.ServerError("Failed to fetch routes"))
            }
            
            val entities = response.body()!!.routes.map { it.toEntity() }
            
            // Cache to local database
            routesDao.insertAll(entities)
            
            // Clean up old completed routes (older than 7 days)
            val sevenDaysAgo = System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000)
            routesDao.deleteOldCompleted(driverId, sevenDaysAgo)
            
            AppResult.Success(entities.map { it.toModel() })
        } catch (e: UnknownHostException) {
            AppResult.Error(
                AppError.Network(
                    "Không resolve được host backend. Hãy cấu hình BACKEND_URL trong mobile/local.properties (vd: http://10.0.2.2:3001/ cho emulator, hoặc http://<IP-LAN>:3001/ cho máy thật). Chi tiết: ${e.message}",
                    e
                )
            )
        } catch (e: IOException) {
            AppResult.Error(AppError.Network("Network error: ${e.message}"))
        } catch (e: HttpException) {
            when (e.code()) {
                401 -> AppResult.Error(AppError.Authentication("Authentication required"))
                403 -> AppResult.Error(AppError.Authorization("Access denied"))
                else -> AppResult.Error(AppError.ServerError("Server error: ${e.code()}"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Unknown(e.message ?: "Unknown error"))
        }
    }
    
    /**
     * Get route details with stops and orders
     */
    suspend fun getRouteDetails(routeId: String): AppResult<Pair<Route, List<Stop>>> = withContext(dispatchers.io) {
        try {
            // Try to get from cache first
            val cachedRoute = routesDao.getById(routeId)
            val cachedStops = routeStopsDao.getStopsByRoute(routeId)
            
            if (cachedRoute != null && cachedStops.isNotEmpty()) {
                val stops = cachedStops.map { stopEntity ->
                    val orders = ordersDao.getOrdersByStop(stopEntity.id)
                    stopEntity.toModel().copy(orders = orders.map { it.toModel() })
                }
                return@withContext AppResult.Success(cachedRoute.toModel() to stops)
            }
            
            // If not in cache, fetch from backend
            refreshRouteDetails(routeId)
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Refresh route details from backend
     */
    suspend fun refreshRouteDetails(routeId: String): AppResult<Pair<Route, List<Stop>>> = withContext(dispatchers.io) {
        try {
            val response = backendApi.getRouteDetails(routeId)
            if (!response.isSuccessful || response.body() == null) {
                return@withContext AppResult.Error(AppError.ServerError("Failed to fetch route details"))
            }
            
            val responseBody = response.body()!!
            
            // Cache route
            val routeEntity = responseBody.route.toEntity()
            routesDao.insert(routeEntity)
            
            // Cache stops first (batch insert)
            val stopEntities = responseBody.stops.map { it.toEntity() }
            routeStopsDao.insertAll(stopEntities)
            
            // Build stop models with orders from API response
            val stops = responseBody.stops.map { stopDto ->
                // Cache orders for this stop
                val orderEntities = stopDto.orders.map { it.toEntity(stopDto.id) }
                if (orderEntities.isNotEmpty()) {
                    ordersDao.insertAll(orderEntities)
                }
                
                // Map to model with orders from DTO (not from DB query)
                val stopEntity = stopDto.toEntity()
                stopEntity.toModel().copy(orders = stopDto.orders.map { orderDto ->
                    orderDto.toEntity(stopDto.id).toModel()
                })
            }
            
            AppResult.Success(routeEntity.toModel() to stops)
        } catch (e: UnknownHostException) {
            AppResult.Error(
                AppError.Network(
                    "Không resolve được host backend. Hãy cấu hình BACKEND_URL trong mobile/local.properties (vd: http://10.0.2.2:3001/ cho emulator, hoặc http://<IP-LAN>:3001/ cho máy thật). Chi tiết: ${e.message}",
                    e
                )
            )
        } catch (e: IOException) {
            AppResult.Error(AppError.Network("Network error: ${e.message}"))
        } catch (e: HttpException) {
            when (e.code()) {
                401 -> AppResult.Error(AppError.Authentication("Authentication required"))
                403 -> AppResult.Error(AppError.Authorization("Access denied"))
                404 -> AppResult.Error(AppError.NotFound("Route not found"))
                else -> AppResult.Error(AppError.ServerError("Server error: ${e.code()}"))
            }
        }
    }
    
    /**
     * Start a route (optimistic update + queue for sync)
     */
    suspend fun startRoute(
        routeId: String,
        latitude: Double? = null,
        longitude: Double? = null
    ): AppResult<Route> = withContext(dispatchers.io) {
        try {
            val routeEntity = routesDao.getById(routeId)
            if (routeEntity == null) {
                return@withContext AppResult.Error(AppError.NotFound("Route not found"))
            }
            
            val startedAtMillis = System.currentTimeMillis()
            
            // Optimistic update
            val updatedRoute = routeEntity.copy(
                status = "in_progress",
                startedAt = startedAtMillis,
                updatedAt = System.currentTimeMillis()
            )
            routesDao.update(updatedRoute)
            
            // Queue for sync - request uses ISO format
            val request = StartRouteRequest(
                startedAt = DateUtils.epochMillisToIso(startedAtMillis) ?: DateUtils.nowIso(),
                latitude = latitude,
                longitude = longitude
            )

            val payload = JSONObject().apply {
                put("routeId", routeId)
                put(
                    "request",
                    JSONObject().apply {
                        put("started_at", request.startedAt)
                        put("latitude", request.latitude ?: JSONObject.NULL)
                        put("longitude", request.longitude ?: JSONObject.NULL)
                    }
                )
            }.toString()
            
            val pendingAction = PendingActionEntity(
                id = UUID.randomUUID().toString(),
                type = "START_ROUTE",
                payloadJson = payload,
                status = "PENDING",
                attemptCount = 0,
                createdAt = System.currentTimeMillis(),
                lastAttemptAt = null,
                lastError = null,
                idempotencyKey = UUID.randomUUID().toString()
            )
            pendingActionsDao.insert(pendingAction)
            
            AppResult.Success(updatedRoute.toModel())
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Complete a route (optimistic update + queue for sync)
     */
    suspend fun completeRoute(
        routeId: String,
        latitude: Double? = null,
        longitude: Double? = null
    ): AppResult<Route> = withContext(dispatchers.io) {
        try {
            val routeEntity = routesDao.getById(routeId)
            if (routeEntity == null) {
                return@withContext AppResult.Error(AppError.NotFound("Route not found"))
            }
            
            val completedAtMillis = System.currentTimeMillis()
            
            // Optimistic update
            val updatedRoute = routeEntity.copy(
                status = "completed",
                completedAt = completedAtMillis,
                updatedAt = System.currentTimeMillis()
            )
            routesDao.update(updatedRoute)
            
            // Queue for sync - request uses ISO format
            val request = CompleteRouteRequest(
                completedAt = DateUtils.epochMillisToIso(completedAtMillis) ?: DateUtils.nowIso(),
                latitude = latitude,
                longitude = longitude
            )

            val payload = JSONObject().apply {
                put("routeId", routeId)
                put(
                    "request",
                    JSONObject().apply {
                        put("completed_at", request.completedAt)
                        put("latitude", request.latitude ?: JSONObject.NULL)
                        put("longitude", request.longitude ?: JSONObject.NULL)
                    }
                )
            }.toString()
            
            val pendingAction = PendingActionEntity(
                id = UUID.randomUUID().toString(),
                type = "COMPLETE_ROUTE",
                payloadJson = payload,
                status = "PENDING",
                attemptCount = 0,
                createdAt = System.currentTimeMillis(),
                lastAttemptAt = null,
                lastError = null,
                idempotencyKey = UUID.randomUUID().toString()
            )
            pendingActionsDao.insert(pendingAction)
            
            AppResult.Success(updatedRoute.toModel())
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Sync start route with backend (called by SyncWorker)
     */
    suspend fun syncStartRoute(routeId: String, request: StartRouteRequest): AppResult<Route> = withContext(dispatchers.io) {
        try {
            val response = backendApi.startRoute(routeId, request)
            if (!response.isSuccessful || response.body() == null) {
                return@withContext AppResult.Error(AppError.ServerError("Failed to start route"))
            }
            
            val routeEntity = response.body()!!.route.toEntity()
            
            // Update local database
            routesDao.update(routeEntity)
            
            AppResult.Success(routeEntity.toModel())
        } catch (e: IOException) {
            AppResult.Error(AppError.Network("Network error: ${e.message}"))
        } catch (e: HttpException) {
            when (e.code()) {
                401 -> AppResult.Error(AppError.Authentication("Authentication required"))
                403 -> AppResult.Error(AppError.Authorization("Access denied"))
                404 -> AppResult.Error(AppError.NotFound("Route not found"))
                else -> AppResult.Error(AppError.ServerError("Server error: ${e.code()}"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Unknown(e.message ?: "Unknown error"))
        }
    }
    
    /**
     * Sync complete route with backend (called by SyncWorker)
     */
    suspend fun syncCompleteRoute(routeId: String, request: CompleteRouteRequest): AppResult<Route> = 
        withContext(dispatchers.io) {
            try {
                val response = backendApi.completeRoute(routeId, request)
                if (!response.isSuccessful || response.body() == null) {
                    return@withContext AppResult.Error(AppError.ServerError("Failed to complete route"))
                }
                
                val routeEntity = response.body()!!.route.toEntity()
                
                // Update local database
                routesDao.update(routeEntity)
                
                AppResult.Success(routeEntity.toModel())
            } catch (e: IOException) {
                AppResult.Error(AppError.Network("Network error: ${e.message}"))
            } catch (e: HttpException) {
                when (e.code()) {
                    401 -> AppResult.Error(AppError.Authentication("Authentication required"))
                    403 -> AppResult.Error(AppError.Authorization("Access denied"))
                    404 -> AppResult.Error(AppError.NotFound("Route not found"))
                    else -> AppResult.Error(AppError.ServerError("Server error: ${e.code()}"))
                }
            } catch (e: Exception) {
                AppResult.Error(AppError.Unknown(e.message ?: "Unknown error"))
            }
        }
    
}
