package com.pikasonix.wayo.ui.xml.profile

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import kotlinx.coroutines.launch
import com.google.android.material.snackbar.Snackbar
import com.pikasonix.wayo.R
import com.pikasonix.wayo.databinding.FragmentProfileBinding
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class ProfileFragment : Fragment(R.layout.fragment_profile) {

    private var binding: FragmentProfileBinding? = null
    private val viewModel: ProfileViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FragmentProfileBinding.bind(view)

        binding?.apply {
            toolbar.setNavigationOnClickListener { findNavController().popBackStack() }

            // Observe user data
            viewLifecycleOwner.lifecycleScope.launch {
                viewModel.user.collect { user ->
                    if (user != null) {
                        tvFullName.text = user.fullName ?: "Tài xế"
                        tvEmail.text = user.email
                        tvPhone.text = user.phone ?: "Chưa cập nhật"
                        tvStatus.text = "Đang hoạt động"
                        
                        // Load avatar
                        com.bumptech.glide.Glide.with(requireContext())
                            .load(user.avatarUrl)
                            .placeholder(R.mipmap.ic_launcher_round)
                            .error(R.mipmap.ic_launcher_round)
                            .circleCrop()
                            .into(ivAvatar)
                    } else {
                        tvFullName.text = "Khách"
                        tvEmail.text = ""
                        tvPhone.text = ""
                        tvStatus.text = "Ngoại tuyến"
                        ivAvatar.setImageResource(R.mipmap.ic_launcher_round)
                    }
                }
            }

            logoutButton.setOnClickListener {
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        viewModel.logout()
                        findNavController().navigate(R.id.action_profile_to_login)
                        Snackbar.make(root, getString(R.string.action_logout), Snackbar.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Snackbar.make(root, "Đăng xuất thất bại: ${e.message}", Snackbar.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
