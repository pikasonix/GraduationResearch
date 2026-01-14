package com.pikasonix.wayo.ui.xml.signup

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.pikasonix.wayo.R
import com.pikasonix.wayo.databinding.FragmentSignupBinding
import com.pikasonix.wayo.ui.viewmodel.SignUpViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class SignUpFragment : Fragment(R.layout.fragment_signup) {

    private var binding: FragmentSignupBinding? = null
    private val viewModel: SignUpViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FragmentSignupBinding.bind(view)

        binding?.apply {
            signUpButton.setOnClickListener {
                viewModel.updateEmail(emailEditText.text?.toString().orEmpty())
                viewModel.updatePhone(phoneEditText.text?.toString().orEmpty())
                viewModel.updatePassword(passwordEditText.text?.toString().orEmpty())
                viewModel.updateConfirmPassword(confirmPasswordEditText.text?.toString().orEmpty())
                viewModel.updateAgreeTerms(termsCheckBox.isChecked)
                viewModel.signUp()
            }

            loginLink.setOnClickListener {
                findNavController().navigate(R.id.action_signUpFragment_to_loginFragment)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.uiState.collect { state ->
                        val b = binding ?: return@collect
                        b.loading.visibility = if (state.isLoading) View.VISIBLE else View.GONE
                        b.errorText.visibility = if (state.error != null) View.VISIBLE else View.GONE
                        b.errorText.text = state.error

                        if (state.isSignUpSuccess) {
                            findNavController().navigate(R.id.action_signUpFragment_to_loginFragment)
                        }
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
