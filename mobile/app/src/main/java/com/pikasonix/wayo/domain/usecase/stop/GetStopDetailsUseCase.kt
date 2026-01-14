package com.pikasonix.wayo.domain.usecase.stop

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.repository.StopRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Get Stop Details UseCase
 * 
 * Fetches stop details with orders (offline-first).
 */
class GetStopDetailsUseCase @Inject constructor(
    private val stopRepository: StopRepository,
    private val dispatchers: DispatcherProvider
) {
    /**
     * Observe stops for a route (offline-first)
     */
    fun observeByRoute(routeId: String): Flow<List<Stop>> {
        return stopRepository.observeStopsByRoute(routeId)
    }
    
    /**
     * Get stop by ID from cache
     */
    suspend fun getById(stopId: String): AppResult<Stop> = withContext(dispatchers.io) {
        stopRepository.getStopById(stopId)
    }
}
