package com.pikasonix.wayo.domain.usecase.auth

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.data.repository.DriverProfileRepository
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Sign Out UseCase
 * 
 * Signs out user from Supabase and clears local cache.
 * Works offline (clears local data even without network).
 */
class SignOutUseCase @Inject constructor(
    private val authRepository: AuthRepository,
    private val driverProfileRepository: DriverProfileRepository,
    private val dispatchers: DispatcherProvider
) {
    suspend operator fun invoke(): AppResult<Unit> = withContext(dispatchers.io) {
        // Sign out from Supabase (may fail offline)
        authRepository.signOut()
        
        // Clear local cache (always succeeds)
        driverProfileRepository.clearCache()
        
        AppResult.Success(Unit)
    }
}
