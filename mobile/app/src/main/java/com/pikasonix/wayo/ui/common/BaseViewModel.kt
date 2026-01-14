package com.pikasonix.wayo.ui.common

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Base ViewModel chứa các chức năng dùng chung cho tất cả ViewModels.
 * 
 * Cung cấp helper functions để:
 * - Launch coroutines trong viewModelScope
 * - Chuyển đổi AppResult sang UiState
 * - Quản lý StateFlow tiện lợi hơn
 */
abstract class BaseViewModel : ViewModel() {
    
    /**
     * Launch coroutine trong viewModelScope với error handling tự động.
     * Coroutine sẽ bị cancel khi ViewModel bị clear.
     */
    protected fun launch(block: suspend CoroutineScope.() -> Unit) {
        viewModelScope.launch(block = block)
    }
    
    /**
     * Chuyển đổi AppResult (domain layer) sang UiState (presentation layer).
     * Tự động phát hiện offline để hiển thị UI phù hợp.
     */
    protected fun <T> AppResult<T>.toUiState(): UiState<T> = when (this) {
        is AppResult.Success -> UiState.Success(data)
        is AppResult.Error -> UiState.Error(
            message = error.message,
            isOffline = error is AppError.Offline || error is AppError.Network
        )
    }
    
    /**
     * Trích xuất thông báo lỗi từ AppError để hiển thị UI
     */
    protected fun AppError.toMessage(): String = message
    
    /**
     * Tạo MutableStateFlow với giá trị khởi tạo
     */
    protected fun <T> mutableStateFlow(initial: T): MutableStateFlow<T> =
        MutableStateFlow(initial)
    
    /**
     * Expose StateFlow dưới dạng read-only để Fragment/Activity chỉ observe, không modify
     */
    protected fun <T> MutableStateFlow<T>.asState(): StateFlow<T> = asStateFlow()
}
