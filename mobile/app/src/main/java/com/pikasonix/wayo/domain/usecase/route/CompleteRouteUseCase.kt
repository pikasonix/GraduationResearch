package com.pikasonix.wayo.domain.usecase.route

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Route
import com.pikasonix.wayo.data.repository.BackendRouteRepository
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Complete Route UseCase
 * 
 * Completes a route with optional GPS coordinates.
 * Works offline (optimistic update + queued sync).
 */
class CompleteRouteUseCase @Inject constructor(
    private val routeRepository: BackendRouteRepository,
    private val dispatchers: DispatcherProvider
) {
    suspend operator fun invoke(
        routeId: String,
        latitude: Double? = null,
        longitude: Double? = null
    ): AppResult<Route> = withContext(dispatchers.io) {
        // Validate route ID
        if (routeId.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Route ID is required"))
        }
        
        // Complete route (optimistic update + queue sync)
        routeRepository.completeRoute(routeId, latitude, longitude)
    }
}
