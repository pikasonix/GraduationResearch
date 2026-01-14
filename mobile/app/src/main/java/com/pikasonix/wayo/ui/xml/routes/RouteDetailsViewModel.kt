package com.pikasonix.wayo.ui.xml.routes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.core.network.ConnectivityObserver
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Route
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.repository.AssignedRouteRepository
import com.pikasonix.wayo.domain.usecase.route.GetRouteDetailsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel cho màn hình chi tiết route.
 * 
 * Cung cấp các actions:
 * - startRoute(): Bắt đầu tuyến (chuyển status từ ASSIGNED sang IN_PROGRESS)
 * - completeRoute(): Hoàn thành tuyến (chuyển status sang COMPLETED)
 *
 * Các thao tác chạy async và tự động sync lên backend (hoặc queue nếu offline).
 *
 * @property assignedRouteRepository Repository quản lý routes
 */
@HiltViewModel
class RouteDetailsViewModel @Inject constructor(
    private val assignedRouteRepository: AssignedRouteRepository,
    private val getRouteDetailsUseCase: GetRouteDetailsUseCase,
    private val connectivityObserver: ConnectivityObserver
) : ViewModel() {


    data class UiState(
        val isLoading: Boolean = false,
        val error: String? = null,
        val isOffline: Boolean = false,
        val route: Route? = null,
        val stops: List<UiRouteStopItem> = emptyList()
    )

    sealed class UiRouteStopItem {
        abstract val id: String
        abstract val sequence: Int
        
        data class Single(val stop: Stop) : UiRouteStopItem() {
            override val id: String get() = stop.id
            override val sequence: Int get() = stop.sequence
        }
        
        data class Group(
            val mainStop: Stop,
            val stops: List<Stop>
        ) : UiRouteStopItem() {
            override val id: String get() = mainStop.id + "_group"
            override val sequence: Int get() = mainStop.sequence
        }
    }

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    fun load(routeId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            val cached = getRouteDetailsUseCase.getFromCache(routeId)
            when (cached) {
                is AppResult.Success -> {
                    val (route, stops) = cached.data
                    _uiState.value = _uiState.value.copy(
                        route = route, 
                        stops = groupStops(stops)
                    )
                }
                is AppResult.Error -> {
                    // Tiếp tục; refresh có thể vẫn thành công
                }
            }

            refresh(routeId)
        }
    }

    fun refresh(routeId: String) {
        viewModelScope.launch {
            val online = connectivityObserver.isCurrentlyConnected()
            _uiState.value = _uiState.value.copy(isOffline = !online)

            if (!online) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val res = getRouteDetailsUseCase.refresh(routeId)) {
                is AppResult.Success -> {
                    val (route, stops) = res.data
                    val grouped = groupStops(stops)
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false, 
                        route = route, 
                        stops = grouped
                    )
                }
                is AppResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = res.error.message)
                }
            }
        }
    }

    private fun groupStops(stops: List<Stop>): List<UiRouteStopItem> {
        if (stops.isEmpty()) return emptyList()
        
        // Hiển thị từng stop riêng biệt (không group)
        return stops.map { stop ->
            UiRouteStopItem.Single(stop)
        }
    }
    
    private fun addStoppedGroupToResult(group: List<Stop>, result: MutableList<UiRouteStopItem>) {
        if (group.size == 1) {
            result.add(UiRouteStopItem.Single(group[0]))
        } else {
            result.add(UiRouteStopItem.Group(group[0], group.toList()))
        }
    }

    /**
     * Bắt đầu tuyến - chuyển status sang IN_PROGRESS.
     * Gọi khi driver nhấn nút "Bắt đầu" trên màn hình route details.
     *
     * @param routeId ID của tuyến cần bắt đầu
     */
    fun startRoute(routeId: String) {
        viewModelScope.launch {
            assignedRouteRepository.startRoute(routeId)
        }
    }

    /**
     * Hoàn thành tuyến - chuyển status sang COMPLETED.
     * Chỉ gọi khi tất cả stops đã được complete.
     *
     * @param routeId ID của tuyến cần hoàn thành
     */
    fun completeRoute(routeId: String) {
        viewModelScope.launch {
            assignedRouteRepository.completeRoute(routeId)
        }
    }
}
