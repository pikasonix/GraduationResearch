package com.pikasonix.wayo.core.result

/**
 * Định nghĩa các loại lỗi có thể xảy ra trong ứng dụng.
 * 
 * Phân loại lỗi rõ ràng giúp xử lý và hiển thị thông báo phù hợp cho từng trường hợp.
 * Các lỗi có thể retry (Network, ServerError) vs không retry (Authentication, Validation).
 */
sealed class AppError {
    /** Thông báo lỗi hiển thị cho người dùng */
    abstract val message: String
    
    /** Exception gốc gây ra lỗi (nếu có) */
    open val cause: Throwable? = null

    /** Lỗi kết nối mạng - có thể retry */
    data class Network(
        override val message: String = "Lỗi kết nối mạng",
        override val cause: Throwable? = null
    ) : AppError()

    /** Lỗi xác thực (sai email/password) - không retry, yêu cầu đăng nhập lại */
    data class Authentication(
        override val message: String = "Lỗi xác thực",
        override val cause: Throwable? = null
    ) : AppError()

    /** Lỗi phân quyền (không có quyền truy cập tài nguyên) - không retry */
    data class Authorization(
        override val message: String = "Không có quyền truy cập",
        override val cause: Throwable? = null
    ) : AppError()

    /** Lỗi validation dữ liệu đầu vào (email sai format, trường bắt buộc trống...) */
    data class Validation(
        override val message: String,
        val field: String? = null  // Tên trường bị lỗi (để focus vào input)
    ) : AppError()

    /** Lỗi không tìm thấy tài nguyên (route, stop...) - có thể đã bị xóa hoặc không tồn tại */
    data class NotFound(
        override val message: String = "Không tìm thấy dữ liệu",
        val resource: String? = null  // Loại tài nguyên (route, stop, driver...)
    ) : AppError()

    /** Lỗi từ server (5xx) - có thể retry với exponential backoff */
    data class ServerError(
        override val message: String = "Lỗi từ máy chủ",
        val code: Int? = null,  // HTTP status code (500, 502, 503...)
        override val cause: Throwable? = null
    ) : AppError()

    /** Thiết bị offline - queue action vào outbox để sync sau */
    data class Offline(
        override val message: String = "Không có kết nối mạng"
    ) : AppError()

    /** Lỗi thao tác database local (Room) */
    data class Database(
        override val message: String = "Lỗi cơ sở dữ liệu",
        override val cause: Throwable? = null
    ) : AppError()

    data class Unknown(
        override val message: String = "Đã xảy ra lỗi không xác định",
        override val cause: Throwable? = null
    ) : AppError()

    companion object {
        fun from(throwable: Throwable): AppError = when (throwable) {
            is java.net.UnknownHostException,
            is java.net.SocketTimeoutException,
            is java.io.IOException -> Network(cause = throwable)
            else -> Unknown(throwable.message ?: "Unknown error", throwable)
        }
    }
}
