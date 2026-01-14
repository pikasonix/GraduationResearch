package com.pikasonix.wayo.ui.xml.routes

import android.os.Bundle
import android.view.View
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavOptions
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.snackbar.Snackbar
import com.pikasonix.wayo.R
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.databinding.FragmentAssignedRoutesBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class AssignedRoutesFragment : Fragment(R.layout.fragment_assigned_routes) {

    private var binding: FragmentAssignedRoutesBinding? = null
    private val viewModel: AssignedRoutesViewModel by viewModels()

    @Inject
    lateinit var authRepository: AuthRepository

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FragmentAssignedRoutesBinding.bind(view)

        val adapter = AssignedRoutesAdapter { route ->
            findNavController().navigate(
                R.id.action_assignedRoutes_to_routeDetails,
                bundleOf("routeId" to route.id)
            )
        }

        binding?.apply {
            recyclerView.layoutManager = LinearLayoutManager(requireContext())
            recyclerView.adapter = adapter

            goToVehiclesButton.setOnClickListener {
                // Go to the vehicle claim screen (tab Xe)
                findNavController().navigate(R.id.routeSelectionFragment)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.uiState.collect { state ->
                        val b = binding ?: return@collect
                        
                        b.loading.visibility = if (state.isLoading) View.VISIBLE else View.GONE
                        
                        // Hiển thị empty state nếu không có routes
                        if (!state.isLoading && state.routes.isEmpty() && state.error == null) {
                            b.emptyState.visibility = View.VISIBLE
                            b.goToVehiclesButton.visibility = View.VISIBLE
                            b.recyclerView.visibility = View.GONE
                        } else {
                            b.emptyState.visibility = View.GONE
                            b.goToVehiclesButton.visibility = View.GONE
                            b.recyclerView.visibility = View.VISIBLE
                        }
                        
                        adapter.submitList(state.routes)
                        
                        if (state.error != null) {
                            Snackbar.make(b.root, state.error, Snackbar.LENGTH_LONG).show()
                        }
                    }
                }
            }
        }

        viewModel.load()
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
