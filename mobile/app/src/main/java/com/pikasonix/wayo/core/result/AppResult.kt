package com.pikasonix.wayo.core.result

/**
 * Wrapper generic cho kết quả các thao tác nghiệp vụ, có thể thành công hoặc thất bại.
 * 
 * Áp dụng Railway-Oriented Programming pattern để xử lý luồng thành công/lỗi một cách rõ ràng.
 * Giúp tránh null/exception, dễ dàng compose các thao tác tuần tự.
 *
 * @param T Kiểu dữ liệu trả về khi thành công
 */
sealed class AppResult<out T> {
    /** Trạng thái thành công với dữ liệu kết quả */
    data class Success<T>(val data: T) : AppResult<T>()
    
    /** Trạng thái thất bại với thông tin lỗi */
    data class Error(val error: AppError) : AppResult<Nothing>()

    val isSuccess: Boolean
        get() = this is Success

    val isError: Boolean
        get() = this is Error

    fun getOrNull(): T? = when (this) {
        is Success -> data
        is Error -> null
    }

    fun errorOrNull(): AppError? = when (this) {
        is Success -> null
        is Error -> error
    }

    /**
     * Biến đổi dữ liệu bên trong Success, giữ nguyên Error
     * @param transform Hàm chuyển đổi từ T sang R
     */
    inline fun <R> map(transform: (T) -> R): AppResult<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> this
    }

    /**
     * Chain nhiều thao tác AppResult, dừng lại ngay khi gặp Error
     * @param transform Hàm chuyển đổi từ T sang AppResult<R>
     */
    inline fun <R> flatMap(transform: (T) -> AppResult<R>): AppResult<R> = when (this) {
        is Success -> transform(data)
        is Error -> this
    }

    /**
     * Thực hiện action nếu là Success, không làm gì nếu là Error
     * @param action Callback nhận dữ liệu khi thành công
     */
    inline fun onSuccess(action: (T) -> Unit): AppResult<T> {
        if (this is Success) action(data)
        return this
    }

    /**
     * Thực hiện action nếu là Error, không làm gì nếu là Success
     * @param action Callback nhận lỗi khi thất bại
     */
    inline fun onError(action: (AppError) -> Unit): AppResult<T> {
        if (this is Error) action(error)
        return this
    }
}

/**
 * Extension chuyển đổi nullable thành AppResult
 */
fun <T> T?.toResult(errorMessage: String = "Value is null"): AppResult<T> =
    if (this != null) AppResult.Success(this)
    else AppResult.Error(AppError.Unknown(errorMessage))
