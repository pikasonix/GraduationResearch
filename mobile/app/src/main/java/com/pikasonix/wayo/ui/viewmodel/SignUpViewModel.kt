package com.pikasonix.wayo.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.data.model.AuthResult
import com.pikasonix.wayo.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State cho màn hình đăng ký tài khoản.
 *
 * @property email Email đăng ký
 * @property phone Số điện thoại (format +84 hoặc 0)
 * @property password Mật khẩu (≥ 8 ký tự)
 * @property confirmPassword Xác nhận lại mật khẩu
 * @property agreeTerms Đồng ý điều khoản sử dụng
 * @property isLoading Đang xử lý đăng ký
 * @property isSignUpSuccess Đăng ký thành công (trigger navigation)
 * @property error Lỗi chung (email trùng, server error...)
 * @property passwordError Lỗi riêng cho password/confirm password
 */
data class SignUpUiState(
    val email: String = "",
    val phone: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val agreeTerms: Boolean = false,
    val isLoading: Boolean = false,
    val isSignUpSuccess: Boolean = false,
    val error: String? = null,
    val passwordError: String? = null
)

/**
 * ViewModel cho màn hình đăng ký.
 * 
 * Validation rules:
 * - Email: không trống, format hợp lệ
 * - Phone: không trống, format +84 hoặc 0
 * - Password: ≥ 8 ký tự
 * - Confirm password: khớp với password
 * - Terms: phải đồng ý
 *
 * Sau khi đăng ký thành công, tự động login và lưu token.
 *
 * @property authRepository Repository xử lý authentication
 */
@HiltViewModel
class SignUpViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(SignUpUiState())
    val uiState: StateFlow<SignUpUiState> = _uiState.asStateFlow()
    
    fun updateEmail(email: String) {
        _uiState.update { it.copy(email = email, error = null) }
    }
    
    fun updatePhone(phone: String) {
        _uiState.update { it.copy(phone = phone, error = null) }
    }
    
    fun updatePassword(password: String) {
        _uiState.update { it.copy(password = password, error = null, passwordError = null) }
    }
    
    fun updateConfirmPassword(confirmPassword: String) {
        _uiState.update { it.copy(confirmPassword = confirmPassword, passwordError = null) }
    }
    
    fun updateAgreeTerms(agree: Boolean) {
        _uiState.update { it.copy(agreeTerms = agree) }
    }
    
    fun signUp() {
        val state = _uiState.value
        
        // Validate email
        if (state.email.isBlank()) {
            _uiState.update { it.copy(error = "Vui lòng nhập email") }
            return
        }
        
        // Validate phone
        if (state.phone.isBlank()) {
            _uiState.update { it.copy(error = "Vui lòng nhập số điện thoại") }
            return
        }
        
        // Validate password length
        if (state.password.length < 8) {
            _uiState.update { it.copy(passwordError = "Mật khẩu phải có ít nhất 8 ký tự") }
            return
        }
        
        // Validate passwords match
        if (state.password != state.confirmPassword) {
            _uiState.update { it.copy(passwordError = "Mật khẩu không khớp") }
            return
        }
        
        // Validate terms agreement
        if (!state.agreeTerms) {
            _uiState.update { it.copy(error = "Vui lòng đồng ý với điều khoản dịch vụ") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            when (val result = authRepository.signUp(
                email = state.email,
                password = state.password,
                fullName = "",
                phone = state.phone
            )) {
                is AuthResult.Success -> {
                    _uiState.update { 
                        it.copy(
                            isLoading = false,
                            isSignUpSuccess = true
                        )
                    }
                }
                is AuthResult.Error -> {
                    _uiState.update { 
                        it.copy(
                            isLoading = false,
                            error = result.message
                        )
                    }
                }
                is AuthResult.Loading -> {
                    // Đã đang loading
                }
            }
        }
    }
}