package com.pikasonix.wayo.domain.usecase.auth

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.AuthResult
import com.pikasonix.wayo.data.repository.AuthRepository
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Sign Up UseCase
 * 
 * Creates new user account with Supabase.
 * Requires online connectivity.
 */
class SignUpUseCase @Inject constructor(
    private val authRepository: AuthRepository,
    private val dispatchers: DispatcherProvider
) {
    suspend operator fun invoke(
        email: String,
        password: String,
        fullName: String
    ): AppResult<String> = withContext(dispatchers.io) {
        // Validate inputs
        if (email.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Email is required"))
        }
        if (password.length < 6) {
            return@withContext AppResult.Error(AppError.Validation("Password must be at least 6 characters"))
        }
        if (fullName.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Full name is required"))
        }
        
        // Sign up with Supabase
        when (val result = authRepository.signUp(email, password, fullName)) {
            is AuthResult.Success -> {
                AppResult.Success(result.user.id)
            }
            is AuthResult.Error -> {
                AppResult.Error(AppError.Authentication(result.message))
            }
            is AuthResult.Loading -> {
                AppResult.Error(AppError.Unknown("Unexpected loading state"))
            }
        }
    }
}
