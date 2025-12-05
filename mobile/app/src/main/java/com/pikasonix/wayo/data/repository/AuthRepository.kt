package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.data.model.AuthResult
import com.pikasonix.wayo.data.model.User
import com.pikasonix.wayo.data.remote.SupabaseClientProvider
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for authentication operations using Supabase
 */
@Singleton
class AuthRepository @Inject constructor() {
    
    private val supabase = SupabaseClientProvider.client
    
    /**
     * Login with email and password
     */
    suspend fun login(email: String, password: String): AuthResult {
        return try {
            supabase.auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            
            val session = supabase.auth.currentSessionOrNull()
            val supabaseUser = session?.user
            
            if (supabaseUser != null) {
                AuthResult.Success(
                    User(
                        id = supabaseUser.id,
                        email = supabaseUser.email ?: "",
                        fullName = supabaseUser.userMetadata?.get("full_name")?.toString(),
                        avatarUrl = supabaseUser.userMetadata?.get("avatar_url")?.toString(),
                        createdAt = supabaseUser.createdAt?.toString()
                    )
                )
            } else {
                AuthResult.Error("Đăng nhập thất bại")
            }
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Đăng nhập thất bại. Vui lòng thử lại.")
        }
    }
    
    /**
     * Sign up with email and password
     */
    suspend fun signUp(email: String, password: String, fullName: String? = null, phone: String? = null): AuthResult {
        return try {
            supabase.auth.signUpWith(Email) {
                this.email = email
                this.password = password
                data = buildJsonObject {
                    fullName?.let { put("full_name", it) }
                    phone?.let { put("phone", it) }
                }
            }
            
            AuthResult.Success(
                User(
                    id = "",
                    email = email,
                    fullName = fullName,
                    phone = phone
                )
            )
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Đăng ký thất bại. Vui lòng thử lại.")
        }
    }
    
    /**
     * Sign out current user
     */
    suspend fun signOut(): Result<Unit> {
        return try {
            supabase.auth.signOut()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get current logged in user
     */
    fun getCurrentUser(): User? {
        val supabaseUser = supabase.auth.currentUserOrNull()
        return supabaseUser?.let {
            User(
                id = it.id,
                email = it.email ?: "",
                fullName = it.userMetadata?.get("full_name")?.toString(),
                avatarUrl = it.userMetadata?.get("avatar_url")?.toString(),
                createdAt = it.createdAt?.toString()
            )
        }
    }
    
    /**
     * Check if user is logged in
     */
    fun isLoggedIn(): Boolean {
        return supabase.auth.currentSessionOrNull() != null
    }
    
    /**
     * Observe auth state changes
     */
    fun observeAuthState(): Flow<User?> = flow {
        supabase.auth.sessionStatus.collect { status ->
            val user = getCurrentUser()
            emit(user)
        }
    }
    
    /**
     * Send password reset email
     */
    suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
        return try {
            supabase.auth.resetPasswordForEmail(email)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
