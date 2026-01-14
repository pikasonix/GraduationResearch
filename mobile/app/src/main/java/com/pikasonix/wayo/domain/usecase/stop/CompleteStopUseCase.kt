package com.pikasonix.wayo.domain.usecase.stop

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.repository.StopRepository
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Use case đánh dấu hoàn thành một điểm dừng với tọa độ GPS và ghi chú.
 * 
 * Hoạt động offline với chiến lược optimistic update:
 * 1. Update ngay trong Room database (UI phản hồi instant)
 * 2. Queue action vào outbox để sync lên backend sau
 * 3. WorkManager tự động sync khi có network
 *
 * Validation rules:
 * - routeId, stopId: bắt buộc
 * - latitude: [-90, 90]
 * - longitude: [-180, 180]
 * - notes: optional
 *
 * @property stopRepository Repository quản lý stops
 * @property dispatchers Cung cấp dispatcher cho IO operations
 */
class CompleteStopUseCase @Inject constructor(
    private val stopRepository: StopRepository,
    private val dispatchers: DispatcherProvider
) {
    /**
     * Đánh dấu stop hoàn thành.
     *
     * @param routeId ID của tuyến đường
     * @param stopId ID của điểm dừng
     * @param latitude Vĩ độ GPS (-90 đến 90)
     * @param longitude Kinh độ GPS (-180 đến 180)
     * @param notes Ghi chú bổ sung (optional)
     * @return AppResult<Stop> chứa stop đã update hoặc lỗi validation
     */
    suspend operator fun invoke(
        routeId: String,
        stopId: String,
        latitude: Double,
        longitude: Double,
        notes: String? = null
    ): AppResult<Stop> = withContext(dispatchers.io) {
        // Validate dữ liệu đầu vào
        if (routeId.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Route ID không được để trống"))
        }
        if (stopId.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Stop ID không được để trống"))
        }
        if (latitude !in -90.0..90.0) {
            return@withContext AppResult.Error(AppError.Validation("Latitude không hợp lệ (phải từ -90 đến 90)"))
        }
        if (longitude !in -180.0..180.0) {
            return@withContext AppResult.Error(AppError.Validation("Longitude không hợp lệ (phải từ -180 đến 180)"))
        }
        
        // Thực hiện complete stop (optimistic update + queue sync)
        stopRepository.completeStop(routeId, stopId, latitude, longitude, notes)
    }
    
    // Alias for invoke
    suspend fun execute(
        routeId: String,
        stopId: String,
        latitude: Double,
        longitude: Double,
        notes: String? = null
    ): AppResult<Stop> = invoke(routeId, stopId, latitude, longitude, notes)
}
