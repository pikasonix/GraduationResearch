package com.pikasonix.wayo.domain.usecase.route

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Route
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.repository.BackendRouteRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Get Route Details UseCase
 * 
 * Fetches route with all stops and orders (offline-first).
 * Returns cached data immediately, syncs in background.
 */
class GetRouteDetailsUseCase @Inject constructor(
    private val routeRepository: BackendRouteRepository,
    private val dispatchers: DispatcherProvider
) {
    /**
     * Observe route by ID (offline-first)
     */
    fun observe(routeId: String): Flow<Route?> {
        return routeRepository.observeRouteById(routeId)
    }
    
    /**
     * Get route details from cache
     */
    suspend fun getFromCache(routeId: String): AppResult<Pair<Route, List<Stop>>> = withContext(dispatchers.io) {
        routeRepository.getRouteDetails(routeId)
    }
    
    /**
     * Refresh route details from backend (online)
     */
    suspend fun refresh(routeId: String): AppResult<Pair<Route, List<Stop>>> = withContext(dispatchers.io) {
        routeRepository.refreshRouteDetails(routeId)
    }
}
