package com.pikasonix.wayo.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pikasonix.wayo.data.location.LocationService
import com.pikasonix.wayo.data.model.LocationPoint
import com.pikasonix.wayo.data.model.PlaceResult
import com.pikasonix.wayo.data.model.RouteInfo
import com.pikasonix.wayo.data.model.RouteResult
import com.pikasonix.wayo.data.repository.RouteRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State for Routing Screen
 */
data class RoutingUiState(
    val origin: LocationPoint? = null,
    val destination: LocationPoint? = null,
    val originText: String = "",
    val destinationText: String = "",
    val currentRoute: RouteInfo? = null,
    val routes: List<RouteInfo> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedProfile: String = "driving-traffic",
    val userLocation: LocationPoint? = null,
    val isNavigating: Boolean = false,
    // Search results
    val originSearchResults: List<PlaceResult> = emptyList(),
    val destinationSearchResults: List<PlaceResult> = emptyList(),
    val isSearchingOrigin: Boolean = false,
    val isSearchingDestination: Boolean = false,
    val showOriginSuggestions: Boolean = false,
    val showDestinationSuggestions: Boolean = false,
    // Point selection mode
    val isSelectingOriginOnMap: Boolean = false,
    val isSelectingDestinationOnMap: Boolean = false
)

/**
 * ViewModel for Routing Screen
 */
@HiltViewModel
class RoutingViewModel @Inject constructor(
    private val routeRepository: RouteRepository,
    private val locationService: LocationService
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(RoutingUiState())
    val uiState: StateFlow<RoutingUiState> = _uiState.asStateFlow()
    
    private val _originSearchQuery = MutableStateFlow("")
    private val _destinationSearchQuery = MutableStateFlow("")
    
    private var originSearchJob: Job? = null
    private var destinationSearchJob: Job? = null
    
    init {
        setupSearchDebounce()
        fetchCurrentLocation()
    }
    
    @OptIn(FlowPreview::class)
    private fun setupSearchDebounce() {
        // Debounce origin search
        viewModelScope.launch {
            _originSearchQuery
                .debounce(300)
                .distinctUntilChanged()
                .filter { it.length >= 2 }
                .collect { query ->
                    searchOriginPlaces(query)
                }
        }
        
        // Debounce destination search
        viewModelScope.launch {
            _destinationSearchQuery
                .debounce(300)
                .distinctUntilChanged()
                .filter { it.length >= 2 }
                .collect { query ->
                    searchDestinationPlaces(query)
                }
        }
    }
    
    private fun fetchCurrentLocation() {
        viewModelScope.launch {
            if (locationService.hasLocationPermission()) {
                val location = locationService.getCurrentLocation()
                    ?: locationService.getLastLocation()
                location?.let {
                    _uiState.value = _uiState.value.copy(userLocation = it)
                }
            }
        }
    }
    
    fun refreshCurrentLocation() {
        fetchCurrentLocation()
    }
    
    fun hasLocationPermission(): Boolean = locationService.hasLocationPermission()
    
    fun updateOriginText(text: String) {
        _uiState.value = _uiState.value.copy(
            originText = text, 
            error = null,
            showOriginSuggestions = text.length >= 2
        )
        _originSearchQuery.value = text
        
        // Clear origin if text is empty
        if (text.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                origin = null,
                originSearchResults = emptyList(),
                showOriginSuggestions = false
            )
        }
    }
    
    fun updateDestinationText(text: String) {
        _uiState.value = _uiState.value.copy(
            destinationText = text, 
            error = null,
            showDestinationSuggestions = text.length >= 2
        )
        _destinationSearchQuery.value = text
        
        // Clear destination if text is empty
        if (text.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                destination = null,
                destinationSearchResults = emptyList(),
                showDestinationSuggestions = false
            )
        }
    }
    
    private fun searchOriginPlaces(query: String) {
        originSearchJob?.cancel()
        originSearchJob = viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSearchingOrigin = true)
            
            val results = routeRepository.searchPlaces(
                query = query,
                proximity = _uiState.value.userLocation,
                limit = 5
            )
            
            _uiState.value = _uiState.value.copy(
                originSearchResults = results,
                isSearchingOrigin = false,
                showOriginSuggestions = results.isNotEmpty()
            )
        }
    }
    
    private fun searchDestinationPlaces(query: String) {
        destinationSearchJob?.cancel()
        destinationSearchJob = viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSearchingDestination = true)
            
            val results = routeRepository.searchPlaces(
                query = query,
                proximity = _uiState.value.userLocation,
                limit = 5
            )
            
            _uiState.value = _uiState.value.copy(
                destinationSearchResults = results,
                isSearchingDestination = false,
                showDestinationSuggestions = results.isNotEmpty()
            )
        }
    }
    
    fun selectOriginFromSearch(place: PlaceResult) {
        _uiState.value = _uiState.value.copy(
            origin = place.location.copy(name = place.name),
            originText = place.name,
            showOriginSuggestions = false,
            originSearchResults = emptyList()
        )
    }
    
    fun selectDestinationFromSearch(place: PlaceResult) {
        _uiState.value = _uiState.value.copy(
            destination = place.location.copy(name = place.name),
            destinationText = place.name,
            showDestinationSuggestions = false,
            destinationSearchResults = emptyList()
        )
    }
    
    fun hideOriginSuggestions() {
        _uiState.value = _uiState.value.copy(showOriginSuggestions = false)
    }
    
    fun hideDestinationSuggestions() {
        _uiState.value = _uiState.value.copy(showDestinationSuggestions = false)
    }
    
    // Map point selection mode
    fun startSelectingOriginOnMap() {
        _uiState.value = _uiState.value.copy(
            isSelectingOriginOnMap = true,
            isSelectingDestinationOnMap = false,
            showOriginSuggestions = false,
            showDestinationSuggestions = false
        )
    }
    
    fun startSelectingDestinationOnMap() {
        _uiState.value = _uiState.value.copy(
            isSelectingOriginOnMap = false,
            isSelectingDestinationOnMap = true,
            showOriginSuggestions = false,
            showDestinationSuggestions = false
        )
    }
    
    fun cancelMapSelection() {
        _uiState.value = _uiState.value.copy(
            isSelectingOriginOnMap = false,
            isSelectingDestinationOnMap = false
        )
    }
    
    fun onMapTapped(location: LocationPoint) {
        val state = _uiState.value
        
        when {
            state.isSelectingOriginOnMap -> {
                viewModelScope.launch {
                    // Reverse geocode to get address
                    val place = routeRepository.reverseGeocode(location)
                    val name = place?.name ?: "${location.latitude.format(5)}, ${location.longitude.format(5)}"
                    
                    _uiState.value = _uiState.value.copy(
                        origin = location.copy(name = name),
                        originText = place?.fullAddress ?: name,
                        isSelectingOriginOnMap = false
                    )
                }
            }
            state.isSelectingDestinationOnMap -> {
                viewModelScope.launch {
                    // Reverse geocode to get address
                    val place = routeRepository.reverseGeocode(location)
                    val name = place?.name ?: "${location.latitude.format(5)}, ${location.longitude.format(5)}"
                    
                    _uiState.value = _uiState.value.copy(
                        destination = location.copy(name = name),
                        destinationText = place?.fullAddress ?: name,
                        isSelectingDestinationOnMap = false
                    )
                }
            }
        }
    }
    
    private fun Double.format(digits: Int) = "%.${digits}f".format(this)

    fun setOrigin(location: LocationPoint) {
        _uiState.value = _uiState.value.copy(
            origin = location,
            originText = location.name ?: "${location.latitude}, ${location.longitude}"
        )
    }
    
    fun setDestination(location: LocationPoint) {
        _uiState.value = _uiState.value.copy(
            destination = location,
            destinationText = location.name ?: "${location.latitude}, ${location.longitude}"
        )
    }
    
    fun updateProfile(profile: String) {
        _uiState.value = _uiState.value.copy(selectedProfile = profile)
        // Re-fetch route if both points are set
        val state = _uiState.value
        if (state.origin != null && state.destination != null) {
            findRoute()
        }
    }
    
    fun updateUserLocation(location: LocationPoint) {
        _uiState.value = _uiState.value.copy(userLocation = location)
    }
    
    fun useCurrentLocationAsOrigin() {
        viewModelScope.launch {
            val userLocation = _uiState.value.userLocation
                ?: locationService.getCurrentLocation()
                ?: locationService.getLastLocation()
            
            if (userLocation != null) {
                // Reverse geocode to get address
                val place = routeRepository.reverseGeocode(userLocation)
                
                _uiState.value = _uiState.value.copy(
                    origin = userLocation.copy(name = "Vị trí của tôi"),
                    originText = place?.fullAddress ?: "Vị trí của tôi",
                    userLocation = userLocation
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    error = "Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí."
                )
            }
        }
    }
    
    fun swapOriginDestination() {
        val state = _uiState.value
        _uiState.value = state.copy(
            origin = state.destination,
            destination = state.origin,
            originText = state.destinationText,
            destinationText = state.originText,
            currentRoute = null,
            routes = emptyList()
        )
    }
    
    fun findRoute() {
        val state = _uiState.value
        
        if (state.origin == null) {
            _uiState.value = state.copy(error = "Vui lòng chọn điểm xuất phát")
            return
        }
        
        if (state.destination == null) {
            _uiState.value = state.copy(error = "Vui lòng chọn điểm đến")
            return
        }
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            when (val result = routeRepository.getRoute(
                origin = state.origin,
                destination = state.destination,
                profile = state.selectedProfile
            )) {
                is RouteResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        routes = result.routes,
                        currentRoute = result.routes.firstOrNull()
                    )
                }
                is RouteResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                RouteResult.Loading -> {
                    // Already handled
                }
            }
        }
    }
    
    fun startNavigation() {
        if (_uiState.value.currentRoute != null) {
            _uiState.value = _uiState.value.copy(isNavigating = true)
        }
    }
    
    fun stopNavigation() {
        _uiState.value = _uiState.value.copy(isNavigating = false)
    }
    
    fun clearRoute() {
        _uiState.value = _uiState.value.copy(
            currentRoute = null,
            routes = emptyList(),
            isNavigating = false
        )
    }
    
    fun clearAll() {
        _uiState.value = RoutingUiState(
            userLocation = _uiState.value.userLocation
        )
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
    
    /**
     * Format duration in seconds to human readable string
     */
    fun formatDuration(seconds: Double): String {
        val totalSeconds = seconds.toInt()
        val hours = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        
        return when {
            hours > 0 -> "$hours giờ $minutes phút"
            minutes > 0 -> "$minutes phút"
            else -> "< 1 phút"
        }
    }
    
    /**
     * Format distance in meters to human readable string
     */
    fun formatDistance(meters: Double): String {
        return when {
            meters >= 1000 -> String.format("%.1f km", meters / 1000)
            else -> String.format("%.0f m", meters)
        }
    }
}
