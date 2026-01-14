package com.pikasonix.wayo.ui.xml.drivervehicle

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.snackbar.Snackbar
import com.pikasonix.wayo.R
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.databinding.FragmentDriverVehicleBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class DriverVehicleFragment : Fragment(R.layout.fragment_driver_vehicle) {

    private var binding: FragmentDriverVehicleBinding? = null
    private val viewModel: DriverVehicleViewModel by viewModels()

    @Inject
    lateinit var authRepository: AuthRepository

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FragmentDriverVehicleBinding.bind(view)

        val adapter = DriverVehicleAdapter(
            onClaim = { vehicleId -> viewModel.claim(vehicleId) },
            onOpenAssignedRoutes = { findNavController().navigate(R.id.action_vehicleSelection_to_assignedRoutes) }
        )

        binding?.apply {
            vehiclesRecyclerView.layoutManager = LinearLayoutManager(requireContext())
            vehiclesRecyclerView.adapter = adapter

            unclaimButton.setOnClickListener { viewModel.unclaim() }
            viewRoutesButton.setOnClickListener { findNavController().navigate(R.id.action_vehicleSelection_to_assignedRoutes) }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    val b = binding ?: return@collect
                    adapter.currentDriverId = state.driverId

                    b.loading.visibility = if (state.isLoading) View.VISIBLE else View.GONE

                    b.currentVehicleCard.visibility = if (state.currentVehicleId != null) View.VISIBLE else View.GONE
                    b.unclaimButton.visibility = if (state.currentVehicleId != null) View.VISIBLE else View.GONE
                    b.viewRoutesButton.visibility = if (state.currentVehicleId != null) View.VISIBLE else View.GONE

                    if (state.currentVehicleId != null) {
                        b.currentVehicleText.text = "Bạn đang nhận xe: ${state.currentVehicleId}"
                    }

                    b.emptyState.visibility = if (!state.isLoading && state.vehicles.isEmpty() && state.error == null) View.VISIBLE else View.GONE

                    adapter.submitList(state.vehicles)

                    state.error?.let { Snackbar.make(b.root, it, Snackbar.LENGTH_LONG).show() }
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
