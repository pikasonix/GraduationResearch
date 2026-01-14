package com.pikasonix.wayo.ui.common

/**
 * Base UI State cho tất cả các màn hình.
 * 
 * Đóng gói các trạng thái:
 * - Initial: Khởi tạo, chưa load dữ liệu
 * - Loading: Đang fetch dữ liệu (hiển thị ProgressBar)
 * - Success: Có dữ liệu thành công
 * - Error: Lỗi xảy ra (với thông tin offline nếu cần)
 *
 * @param T Kiểu dữ liệu kết quả khi Success
 */
sealed class UiState<out T> {
    /** Trạng thái ban đầu, chưa bắt đầu load */
    data object Initial : UiState<Nothing>()
    
    /** Đang loading dữ liệu */
    data object Loading : UiState<Nothing>()
    
    /** Thành công với dữ liệu */
    data class Success<T>(val data: T) : UiState<T>()
    
    /** Lỗi xảy ra, với flag offline để hiển UI offline mode */
    data class Error(val message: String, val isOffline: Boolean = false) : UiState<Nothing>()
}

/**
 * Extension: Kiểm tra xem state có đang loading không
 */
val <T> UiState<T>.isLoading: Boolean
    get() = this is UiState.Loading

/**
 * Extension: Lấy dữ liệu nếu Success, null nếu không
 */
fun <T> UiState<T>.dataOrNull(): T? = when (this) {
    is UiState.Success -> data
    else -> null
}

/**
 * Extension: Lấy error message nếu Error, null nếu không
 */
fun <T> UiState<T>.errorOrNull(): String? = when (this) {
    is UiState.Error -> message
    else -> null
}
