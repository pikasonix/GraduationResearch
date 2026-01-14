package com.pikasonix.wayo.ui.xml.login

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.google.android.material.snackbar.Snackbar
import com.pikasonix.wayo.R
import com.pikasonix.wayo.databinding.FragmentLoginBinding
import com.pikasonix.wayo.ui.viewmodel.LoginViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class LoginFragment : Fragment(R.layout.fragment_login) {

    private var binding: FragmentLoginBinding? = null
    private val viewModel: LoginViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FragmentLoginBinding.bind(view)

        binding?.apply {
            loginButton.setOnClickListener {
                viewModel.updateEmail(emailEditText.text?.toString().orEmpty())
                viewModel.updatePassword(passwordEditText.text?.toString().orEmpty())
                viewModel.login()
            }

            signUpLink.setOnClickListener {
                findNavController().navigate(R.id.action_loginFragment_to_signUpFragment)
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

                        if (state.isLoggedIn) {
                            findNavController().navigate(R.id.action_loginFragment_to_routeSelectionFragment)
                        }

                        if (state.verificationMessage != null) {
                            Snackbar.make(b.root, state.verificationMessage, Snackbar.LENGTH_LONG).show()
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
