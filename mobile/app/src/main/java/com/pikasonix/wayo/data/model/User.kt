package com.pikasonix.wayo.data.model

/**
 * User model representing authenticated user data
 */
data class User(
    val id: String,
    val email: String,
    val fullName: String? = null,
    val phone: String? = null,
    val avatarUrl: String? = null,
    val createdAt: String? = null
)

/**
 * Login credentials for authentication
 */
data class LoginCredentials(
    val email: String,
    val password: String,
    val rememberMe: Boolean = false
)

/**
 * Authentication result wrapper
 */
sealed class AuthResult {
    data class Success(val user: User) : AuthResult()
    data class Error(val message: String) : AuthResult()
    data object Loading : AuthResult()
}
