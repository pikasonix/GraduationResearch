package com.pikasonix.wayo.domain.usecase.profile

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.DriverProfile
import com.pikasonix.wayo.data.repository.DriverProfileRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Get Driver Profile UseCase
 * 
 * Fetches driver profile (offline-first).
 * Returns cached data immediately, syncs in background.
 */
class GetDriverProfileUseCase @Inject constructor(
    private val driverProfileRepository: DriverProfileRepository,
    private val dispatchers: DispatcherProvider
) {
    /**
     * Observe driver profile (offline-first)
     */
    fun observe(userId: String): Flow<DriverProfile?> {
        return driverProfileRepository.observeDriverProfile(userId)
    }
    
    /**
     * Get driver profile from cache
     */
    suspend fun getFromCache(userId: String): AppResult<DriverProfile> = withContext(dispatchers.io) {
        driverProfileRepository.getDriverProfile(userId)
    }
    
    /**
     * Refresh driver profile from backend (online)
     */
    suspend fun refresh(userId: String): AppResult<DriverProfile> = withContext(dispatchers.io) {
        driverProfileRepository.refreshDriverProfile(userId)
    }
}
