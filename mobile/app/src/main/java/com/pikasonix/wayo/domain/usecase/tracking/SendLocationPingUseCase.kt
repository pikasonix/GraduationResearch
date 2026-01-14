package com.pikasonix.wayo.domain.usecase.tracking

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.repository.TrackingRepository
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Send Location Ping UseCase
 * 
 * Sends driver's real-time location to backend during active routes.
 * Works offline (queued for later sync).
 */
class SendLocationPingUseCase @Inject constructor(
    private val trackingRepository: TrackingRepository,
    private val dispatchers: DispatcherProvider
) {
    suspend operator fun invoke(
        routeId: String,
        latitude: Double,
        longitude: Double,
        accuracy: Float? = null,
        speed: Float? = null,
        bearing: Float? = null
    ): AppResult<Unit> = withContext(dispatchers.io) {
        // Validate inputs
        if (routeId.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Route ID is required"))
        }
        if (latitude !in -90.0..90.0) {
            return@withContext AppResult.Error(AppError.Validation("Invalid latitude"))
        }
        if (longitude !in -180.0..180.0) {
            return@withContext AppResult.Error(AppError.Validation("Invalid longitude"))
        }
        
        // Send location ping
        trackingRepository.sendLocationPing(
            routeId = routeId,
            latitude = latitude,
            longitude = longitude,
            accuracy = accuracy,
            speed = speed,
            bearing = bearing
        )
    }
}
