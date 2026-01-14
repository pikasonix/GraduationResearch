package com.pikasonix.wayo.data.model

/**
 * User model đại diện cho dữ liệu người dùng đã xác thực
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
 * Thông tin đăng nhập cho xác thực
 */
data class LoginCredentials(
    val email: String,
    val password: String,
    val rememberMe: Boolean = false
)

/**
 * Wrapper kết quả xác thực
 */
sealed class AuthResult {
    data class Success(val user: User) : AuthResult()
    data class Error(val message: String) : AuthResult()
    data object Loading : AuthResult()
}
