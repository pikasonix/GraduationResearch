package com.pikasonix.wayo.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.data.model.AuthResult
import com.pikasonix.wayo.data.model.User
import com.pikasonix.wayo.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State for Login Screen
 */
data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val rememberMe: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false,
    val user: User? = null,
    val verificationMessage: String? = null
)

/**
 * ViewModel for Login Screen
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()
    
    init {
        // Check if already logged in
        checkCurrentUser()
    }
    
    private fun checkCurrentUser() {
        val user = authRepository.getCurrentUser()
        if (user != null) {
            _uiState.value = _uiState.value.copy(
                isLoggedIn = true,
                user = user
            )
        }
    }
    
    fun updateEmail(email: String) {
        _uiState.value = _uiState.value.copy(email = email, error = null)
    }
    
    fun updatePassword(password: String) {
        _uiState.value = _uiState.value.copy(password = password, error = null)
    }
    
    fun updateRememberMe(rememberMe: Boolean) {
        _uiState.value = _uiState.value.copy(rememberMe = rememberMe)
    }
    
    fun login() {
        val state = _uiState.value
        
        if (state.email.isBlank()) {
            _uiState.value = state.copy(error = "Vui lòng nhập email")
            return
        }
        
        if (state.password.isBlank()) {
            _uiState.value = state.copy(error = "Vui lòng nhập mật khẩu")
            return
        }
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            when (val result = authRepository.login(state.email, state.password)) {
                is AuthResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        user = result.user
                    )
                }
                is AuthResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                AuthResult.Loading -> {
                    // Already handled
                }
            }
        }
    }
    
    fun logout() {
        viewModelScope.launch {
            authRepository.signOut()
            _uiState.value = LoginUiState()
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
