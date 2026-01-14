package com.pikasonix.wayo.ui.common

import com.pikasonix.wayo.data.model.Route
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.model.DriverProfile

/**
 * View states cho các màn hình khác nhau trong ứng dụng.
 * 
 * Mỗi data class đại diện cho UI state của 1 màn hình cụ thể.
 * Chứa tất cả dữ liệu cần hiển thị + trạng thái loading/error.
 */

/**
 * State cho màn hình xác thực (Login/Sign Up)
 *
 * @property email Email người dùng
 * @property password Password người dùng
 * @property fullName Tên đầy đủ (cho Sign Up)
 * @property isLoading Đang xử lý authentication
 * @property error Thông báo lỗi (nếu có)
 * @property isLoggedIn Đã đăng nhập thành công
 */
data class AuthViewState(
    val email: String = "",
    val password: String = "",
    val fullName: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false
)

/**
 * State cho màn hình danh sách routes
 *
 * @property routes Danh sách tuyến đường được giao
 * @property isLoading Đang load lần đầu tiên
 * @property isRefreshing Đang pull-to-refresh
 * @property error Thông báo lỗi
 * @property isOffline Thiết bị offline (hiển thị banner)
 * @property pendingSyncCount Số hành động chờ sync
 */
data class RouteListViewState(
    val routes: List<Route> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val isOffline: Boolean = false,
    val pendingSyncCount: Int = 0
)

/**
 * State cho màn hình chi tiết route
 *
 * @property route Thông tin tuyến đường
 * @property stops Danh sách các điểm dừng
 * @property isLoading Đang load dữ liệu
 * @property error Thông báo lỗi
 * @property isOffline Thiết bị offline
 * @property canStartRoute Có thể bắt đầu tuyến (chưa start)
 * @property canCompleteRoute Có thể hoàn thành tuyến (tất cả stops đã xong)
 */
data class RouteDetailsViewState(
    val route: Route? = null,
    val stops: List<Stop> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val isOffline: Boolean = false,
    val canStartRoute: Boolean = false,
    val canCompleteRoute: Boolean = false
)
data class MapViewState(
    val activeRoute: Route? = null,
    val currentLocation: LocationData? = null,
    val isTracking: Boolean = false,
    val isOffline: Boolean = false,
    val error: String? = null
)

data class LocationData(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float? = null,
    val bearing: Float? = null,
    val speed: Float? = null
)

/**
 * Profile screen state
 */
data class ProfileViewState(
    val profile: DriverProfile? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isOffline: Boolean = false
)
