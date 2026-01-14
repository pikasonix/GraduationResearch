package com.pikasonix.wayo.data.remote.backend

import com.pikasonix.wayo.data.remote.backend.dto.*
import retrofit2.Response
import retrofit2.http.*

/**
 * Backend API service interface cho các mobile endpoints.
 * Base URL nên được cấu hình trong DI module (vd: https://api.wayo.com)
 */
interface BackendApiService {

    /**
     * Lấy profile của tài xế hiện tại
     */
    @GET("/api/mobile/driver/me")
    suspend fun getDriverProfile(): Response<DriverProfileResponse>

    /**
     * Lấy các tuyến đường được gán cho tài xế hiện tại
     */
    @GET("/api/mobile/routes/assigned")
    suspend fun getAssignedRoutes(
        @Query("date") date: String? = null,
        @Query("status") status: String? = null
    ): Response<AssignedRoutesResponse>

    /**
     * Lấy thông tin chi tiết tuyến đường bao gồm các điểm dừng
     */
    @GET("/api/mobile/routes/{id}")
    suspend fun getRouteDetails(
        @Path("id") routeId: String
    ): Response<RouteDetailsResponse>

    /**
     * Bắt đầu một tuyến đường
     */
    @POST("/api/mobile/routes/{id}/start")
    suspend fun startRoute(
        @Path("id") routeId: String,
        @Body request: StartRouteRequest
    ): Response<StartRouteResponse>

    /**
     * Hoàn thành một tuyến đường
     */
    @POST("/api/mobile/routes/{id}/complete")
    suspend fun completeRoute(
        @Path("id") routeId: String,
        @Body request: CompleteRouteRequest
    ): Response<CompleteRouteResponse>

    /**
     * Đánh dấu một điểm dừng là đã hoàn thành
     */
    @POST("/api/mobile/stops/{id}/complete")
    suspend fun completeStop(
        @Path("id") stopId: String,
        @Body request: CompleteStopRequest
    ): Response<CompleteStopResponse>

    /**
     * Gửi ping theo dõi vị trí
     */
    @POST("/api/mobile/tracking/ping")
    suspend fun sendTrackingPing(
        @Body request: TrackingPingRequest
    ): Response<TrackingPingResponse>

    /**
     * Đồng bộ các hành động đang chờ (outbox pattern)
     */
    @POST("/api/mobile/sync/outbox")
    suspend fun syncOutbox(
        @Body request: SyncOutboxRequest,
        @Header("X-Idempotency-Key") idempotencyKey: String
    ): Response<SyncOutboxResponse>
}
