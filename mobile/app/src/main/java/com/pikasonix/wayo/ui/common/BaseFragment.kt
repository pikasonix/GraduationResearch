package com.pikasonix.wayo.ui.common

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.viewbinding.ViewBinding

/**
 * Base Fragment hỗ trợ ViewBinding tự động.
 * 
 * Tự động quản lý lifecycle của ViewBinding:
 * - Tạo binding trong onCreateView
 * - Giải phóng binding trong onDestroyView để tránh memory leak
 *
 * Subclass chỉ cần implement getViewBinding() và dùng `binding` property.
 *
 * @param VB Kiểu ViewBinding của Fragment (VD: FragmentLoginBinding)
 */
abstract class BaseFragment<VB : ViewBinding> : Fragment() {
    
    /** ViewBinding internal, nullable để avoid leak */
    private var _binding: VB? = null
    
    /** ViewBinding public, safe to use trong lifecycle (onViewCreated -> onDestroyView) */
    protected val binding get() = _binding!!
    
    /**
     * Factory method tạo ViewBinding instance.
     * Implement trong subclass: `return FragmentXyzBinding.inflate(inflater, container, false)`
     */
    abstract fun getViewBinding(inflater: LayoutInflater, container: ViewGroup?): VB
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = getViewBinding(inflater, container)
        return binding.root
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
    
    /**
     * Hiển thị thông báo lỗi cho người dùng.
     * Override để custom (VD: dùng Snackbar thay vì Toast)
     *
     * @param message Nội dung lỗi cần hiển thị
     */
    protected open fun showError(message: String) {
        // Default: Toast LENGTH_LONG
        android.widget.Toast.makeText(requireContext(), message, android.widget.Toast.LENGTH_LONG).show()
    }
    
    /**
     * Hiển thị/ẩn loading state (VD: ProgressBar, Shimmer).
     * Override để tùy chỉnh UI loading của từng màn hình.
     *
     * @param isLoading true = hiển loading, false = ẩn loading
     */
    protected open fun showLoading(isLoading: Boolean) {
        // Default: không làm gì - override trong subclass nếu cần
    }
}
