package com.pikasonix.wayo.ui.xml.routes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.data.model.AssignedRoute
import com.pikasonix.wayo.data.repository.AssignedRouteRepository
import com.pikasonix.wayo.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State cho màn hình danh sách routes được giao.
 *
 * @property isLoading Đang load routes từ backend
 * @property error Thông báo lỗi (nếu có)
 * @property routes Danh sách routes được giao cho driver
 */
data class AssignedRoutesUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val routes: List<AssignedRoute> = emptyList()
)

/**
 * ViewModel cho màn hình danh sách routes được giao.
 * 
 * Tự động load routes của driver hiện tại khi gọi load().
 * Xử lý:
 * - Lấy driverId từ user hiện tại (qua AuthRepository)
 * - Fetch routes từ AssignedRouteRepository
 * - Update UI state với kết quả hoặc lỗi
 *
 * @property authRepository Repository quản lý authentication
 * @property assignedRouteRepository Repository quản lý assigned routes
 */
@HiltViewModel
class AssignedRoutesViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val assignedRouteRepository: AssignedRouteRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AssignedRoutesUiState())
    val uiState: StateFlow<AssignedRoutesUiState> = _uiState.asStateFlow()

    fun load() {
        val user = authRepository.getCurrentUser()
        val userId = user?.id
        val userEmail = user?.email
        
        if (userId.isNullOrBlank()) {
            _uiState.value = AssignedRoutesUiState(error = "Chưa đăng nhập")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            try {
                val routes = assignedRouteRepository.getAssignedRoutes(userId, userEmail)
                _uiState.value = AssignedRoutesUiState(isLoading = false, routes = routes)
            } catch (e: Exception) {
                _uiState.value = AssignedRoutesUiState(isLoading = false, error = e.message)
            }
        }
    }
}
