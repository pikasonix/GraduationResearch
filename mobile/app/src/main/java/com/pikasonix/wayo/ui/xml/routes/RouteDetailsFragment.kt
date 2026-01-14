package com.pikasonix.wayo.ui.xml.routes

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
import com.pikasonix.wayo.databinding.FragmentRouteDetailsBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class RouteDetailsFragment : Fragment(R.layout.fragment_route_details) {

    private var binding: FragmentRouteDetailsBinding? = null
    private val viewModel: RouteDetailsViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FragmentRouteDetailsBinding.bind(view)

        val routeId = requireArguments().getString("routeId").orEmpty()

        val stopsAdapter = RouteStopsAdapter()

        binding?.apply {
            toolbar.setNavigationOnClickListener { findNavController().popBackStack() }
            tvRouteId.text = routeId

            rvStops.adapter = stopsAdapter

            swipeRefresh.setOnRefreshListener {
                viewModel.refresh(routeId)
            }

            fabComplete.setOnClickListener {
                viewModel.completeRoute(routeId)
                Snackbar.make(root, getString(R.string.action_complete_route), Snackbar.LENGTH_SHORT).show()
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    val b = binding ?: return@collect
                    b.progressBar.visibility = if (state.isLoading) View.VISIBLE else View.GONE
                    b.swipeRefresh.isRefreshing = state.isLoading

                    b.tvOfflineIndicator.visibility = if (state.isOffline) View.VISIBLE else View.GONE

                    val route = state.route
                    b.tvRouteStatus.text = route?.status ?: ""
                    if (route != null) {
                        b.tvStopsProgress.text = "${route.completedStops}/${route.totalStops} stops"
                    } else {
                        b.tvStopsProgress.text = ""
                    }

                    stopsAdapter.submitList(state.stops.sortedBy { it.sequence })

                    state.error?.let { Snackbar.make(b.root, it, Snackbar.LENGTH_LONG).show() }
                }
            }
        }

        viewModel.load(routeId)
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
