package com.pikasonix.wayo.domain.usecase.auth

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.AuthResult
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.data.repository.DriverProfileRepository
import kotlinx.coroutines.withContext
import javax.inject.Inject

// Login UseCase
// Authenticates user (Supabase) + fetch driver profile
// online

class LoginUseCase @Inject constructor(
    private val authRepository: AuthRepository,
    private val driverProfileRepository: DriverProfileRepository,
    private val dispatchers: DispatcherProvider
) {
    suspend operator fun invoke(
        email: String,
        password: String
    ): AppResult<String> = withContext(dispatchers.io) {
        // Validate inputs
        if (email.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Email is required"))
        }
        if (password.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Password is required"))
        }
        
        // Login (Supabase)
        when (val loginResult = authRepository.login(email, password)) {
            is AuthResult.Success -> {
                val userId = loginResult.user.id
                
                // Fetch and cache driver profile
                val profileResult = driverProfileRepository.refreshDriverProfile(userId)
                if (profileResult is AppResult.Error) {
                    // Login succeeded but profile fetch failed - still return success
                    // Profile will be synced later
                    return@withContext AppResult.Success(userId)
                }
                
                AppResult.Success(userId)
            }
            is AuthResult.Error -> {
                AppResult.Error(AppError.Authentication(loginResult.message))
            }
            is AuthResult.Loading -> {
                AppResult.Error(AppError.Unknown("Unexpected loading state"))
            }
        }
    }
}
