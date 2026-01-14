package com.pikasonix.wayo.ui.xml.drivervehicle

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.data.repository.DriverVehicleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DriverVehicleUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val driverId: String? = null,
    val organizationId: String? = null,
    val vehicles: List<DriverVehicleRepository.VehicleWithRoutes> = emptyList(),
    val currentVehicleId: String? = null
)

@HiltViewModel
class DriverVehicleViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val driverVehicleRepository: DriverVehicleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DriverVehicleUiState())
    val uiState: StateFlow<DriverVehicleUiState> = _uiState.asStateFlow()

    fun load() {
        val user = authRepository.getCurrentUser()
        val userId = user?.id
        if (userId.isNullOrBlank()) {
            _uiState.value = DriverVehicleUiState(error = "Chưa đăng nhập")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val ctx = driverVehicleRepository.getDriverContextByUserId(userId)
                    ?: run {
                        _uiState.value = DriverVehicleUiState(isLoading = false, error = "Không tìm thấy thông tin tài xế")
                        return@launch
                    }

                val vehicles = driverVehicleRepository.getVehiclesWithActiveRoutes(ctx.organizationId)

                val currentVehicleId = vehicles
                    .firstOrNull { v -> v.routes.any { it.driverId == ctx.driverId } }
                    ?.vehicle
                    ?.id

                _uiState.value = DriverVehicleUiState(
                    isLoading = false,
                    driverId = ctx.driverId,
                    organizationId = ctx.organizationId,
                    vehicles = vehicles,
                    currentVehicleId = currentVehicleId
                )
            } catch (e: Exception) {
                _uiState.value = DriverVehicleUiState(isLoading = false, error = e.message)
            }
        }
    }

    fun claim(vehicleId: String) {
        val state = _uiState.value
        val driverId = state.driverId ?: return
        val organizationId = state.organizationId ?: return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val claimedCount = driverVehicleRepository.claimVehicleRoutesAndGetCount(vehicleId, driverId, organizationId)
                if (claimedCount <= 0) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Không nhận được tuyến nào cho xe này. Có thể xe không có tuyến 'planned/assigned' hoặc bị chặn quyền (RLS) khi UPDATE routes."
                    )
                } else {
                    load()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun unclaim() {
        val state = _uiState.value
        val driverId = state.driverId ?: return
        val organizationId = state.organizationId ?: return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val unclaimed = driverVehicleRepository.unclaimVehicleRoutes(driverId, organizationId)
                if (unclaimed <= 0) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Không có tuyến nào để hủy nhận."
                    )
                } else {
                    load()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }
}
