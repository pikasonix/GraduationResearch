package com.pikasonix.wayo.ui.xml.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel cho màn hình profile của driver.
 * 
 * Cung cấp:
 * - Lấy thông tin user hiện tại (email, tên, avatar...)
 * - Logout (clear tokens và navigate về login)
 *
 * @property authRepository Repository quản lý authentication
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    /**
     * User state flow
     */
    val user = authRepository.observeAuthState()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = authRepository.getCurrentUser()
        )

    /**
     * Lấy email của user hiện tại.
     * Trả về empty string nếu chưa đăng nhập.
     */
    fun getEmailOrEmpty(): String {
        return authRepository.getCurrentUser()?.email.orEmpty()
    }

    /**
     * Đăng xuất - clear tokens và navigate về login screen.
     * Tự động revoke session trên Supabase.
     */
    suspend fun logout() {
        authRepository.signOut()
    }
}
