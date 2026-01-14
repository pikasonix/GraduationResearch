package com.pikasonix.wayo.domain.usecase.profile

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.DriverProfile
import com.pikasonix.wayo.data.repository.DriverProfileRepository
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Update Driver Profile UseCase
 * 
 * Updates driver profile locally.
 * Changes are synced to backend in background.
 */
class UpdateDriverProfileUseCase @Inject constructor(
    private val driverProfileRepository: DriverProfileRepository,
    private val dispatchers: DispatcherProvider
) {
    suspend operator fun invoke(profile: DriverProfile): AppResult<Unit> = withContext(dispatchers.io) {
        // Validate inputs
        if (profile.fullName.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Full name is required"))
        }
        
        // Update profile
        driverProfileRepository.updateDriverProfile(profile)
    }
}
