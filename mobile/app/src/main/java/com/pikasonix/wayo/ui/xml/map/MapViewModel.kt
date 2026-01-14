package com.pikasonix.wayo.ui.xml.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.core.network.ConnectivityObserver
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Route
import com.pikasonix.wayo.data.model.RouteStatus
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.repository.AssignedRouteRepository
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.domain.usecase.route.GetRouteDetailsUseCase
import com.pikasonix.wayo.domain.usecase.stop.CompleteStopUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel cho tab Bản đồ.
 * Load route đang hoạt động của driver và hiển thị lên bản đồ.
 */
@HiltViewModel
class MapViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val assignedRouteRepository: AssignedRouteRepository,
    private val getRouteDetailsUseCase: GetRouteDetailsUseCase,
    private val completeStopUseCase: CompleteStopUseCase,
    private val connectivityObserver: ConnectivityObserver
) : ViewModel() {

    data class UiState(
        val isLoading: Boolean = false,
        val error: String? = null,
        val isOffline: Boolean = false,
        val route: Route? = null,
        val stops: List<Stop> = emptyList()
    )

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    /**
     * Load route đang hoạt động của driver (assigned hoặc in_progress)
     */
    fun loadActiveRoute() {
        val user = authRepository.getCurrentUser()
        val userId = user?.id
        val userEmail = user?.email
        
        if (userId.isNullOrBlank()) {
            _uiState.value = UiState(error = "Chưa đăng nhập")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            val online = connectivityObserver.isCurrentlyConnected()
            _uiState.value = _uiState.value.copy(isOffline = !online)
            
            try {
                val routes = assignedRouteRepository.getAssignedRoutes(userId, userEmail)
                
                if (routes.isEmpty()) {
                    _uiState.value = UiState(
                        isLoading = false,
                        error = "Chưa có tuyến đường được giao"
                    )
                    return@launch
                }
                
                val activeRoute = routes.firstOrNull { 
                    it.status == RouteStatus.ASSIGNED || it.status == RouteStatus.IN_PROGRESS 
                } ?: routes.first()
                
                when (val result = getRouteDetailsUseCase.refresh(activeRoute.id)) {
                    is AppResult.Success -> {
                        val (route, stops) = result.data
                        _uiState.value = UiState(
                            isLoading = false,
                            route = route,
                            stops = stops
                        )
                    }
                    is AppResult.Error -> {
                        _uiState.value = UiState(
                            isLoading = false,
                            error = result.error.message
                        )
                    }
                }
                
            } catch (e: Exception) {
                _uiState.value = UiState(
                    isLoading = false,
                    error = e.message ?: "Lỗi không xác định"
                )
            }
        }
    }

    fun refresh() {
        loadActiveRoute()
    }
    
    /**
     * Hoàn thành một stop và cập nhật UI
     */
    fun completeStop(stopId: String, latitude: Double, longitude: Double, notes: String? = null) {
        val currentRoute = _uiState.value.route ?: return
        
        viewModelScope.launch {
            try {
                when (val result = completeStopUseCase.execute(
                    routeId = currentRoute.id,
                    stopId = stopId,
                    latitude = latitude,
                    longitude = longitude,
                    notes = notes
                )) {
                    is AppResult.Success -> {
                        refresh()
                    }
                    is AppResult.Error -> {
                        _uiState.value = _uiState.value.copy(
                            error = result.error.message
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = e.message ?: "Lỗi không xác định"
                )
            }
        }
    }
}
