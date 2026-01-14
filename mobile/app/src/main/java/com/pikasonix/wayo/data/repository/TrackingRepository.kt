package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.remote.backend.BackendApiService
import com.pikasonix.wayo.data.remote.backend.dto.TrackingPingRequest
import com.pikasonix.wayo.data.util.DateUtils
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tracking Repository
 * 
 * Handles real-time location tracking for active routes.
 * Sends location pings to backend for route monitoring.
 */
@Singleton
class TrackingRepository @Inject constructor(
    private val backendApi: BackendApiService,
    private val dispatchers: DispatcherProvider
) {
    /**
     * Send location ping to backend
     * Works online only - fails silently if offline
     */
    suspend fun sendLocationPing(
        routeId: String,
        latitude: Double,
        longitude: Double,
        accuracy: Float? = null,
        speed: Float? = null,
        bearing: Float? = null
    ): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            val request = TrackingPingRequest(
                latitude = latitude,
                longitude = longitude,
                accuracy = accuracy,
                speed = speed,
                bearing = bearing,
                timestamp = DateUtils.nowIso()
            )
            
            val response = backendApi.sendTrackingPing(request)
            if (!response.isSuccessful || response.body() == null) {
                return@withContext AppResult.Error(AppError.ServerError("Failed to send location ping"))
            }
            
            AppResult.Success(Unit)
        } catch (e: IOException) {
            // Network error - fail silently (location tracking is best-effort)
            AppResult.Error(AppError.Network("Network error: ${e.message}"))
        } catch (e: HttpException) {
            AppResult.Error(AppError.ServerError("Server error: ${e.message}"))
        } catch (e: Exception) {
            AppResult.Error(AppError.Unknown(e.message ?: "Unknown error"))
        }
    }
}
