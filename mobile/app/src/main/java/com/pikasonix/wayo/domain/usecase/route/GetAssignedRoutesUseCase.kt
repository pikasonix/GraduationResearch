package com.pikasonix.wayo.domain.usecase.route

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Route
import com.pikasonix.wayo.data.repository.BackendRouteRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Use case lấy danh sách tuyến đường được giao cho tài xế.
 * 
 * Áp dụng chiến lược offline-first:
 * - observe(): Trả về dữ liệu cache ngay lập tức (từ Room), update real-time khi có thay đổi
 * - refresh(): Fetch từ backend và update cache (chỉ khi online)
 *
 * @property routeRepository Repository quản lý dữ liệu routes
 * @property dispatchers Cung cấp dispatcher cho IO operations
 */
class GetAssignedRoutesUseCase @Inject constructor(
    private val routeRepository: BackendRouteRepository,
    private val dispatchers: DispatcherProvider
) {
    /**
     * Observe danh sách routes của tài xế (offline-first).
     * Flow tự động emit khi Room database có thay đổi.
     *
     * @param driverId ID của tài xế
     * @return Flow emit List<Route> mỗi khi có update
     */
    fun observe(driverId: String): Flow<List<Route>> {
        return routeRepository.observeAssignedRoutes(driverId)
    }
    
    /**
     * Refresh routes từ backend (yêu cầu online).
     * Kết quả sẽ được cache vào Room để observe() tự động update.
     *
     * @param driverId ID của tài xế
     * @return AppResult chứa List<Route> hoặc lỗi
     */
    suspend fun refresh(driverId: String): AppResult<List<Route>> = withContext(dispatchers.io) {
        routeRepository.refreshAssignedRoutes(driverId)
    }
}
