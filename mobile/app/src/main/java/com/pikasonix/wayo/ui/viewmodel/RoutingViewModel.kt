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
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.*

/**
 * Map style options
 */
enum class MapStyle(val id: String, val label: String) {
    STREETS("mapbox://styles/mapbox/streets-v12", "Đường phố"),
    OUTDOORS("mapbox://styles/mapbox/outdoors-v12", "Ngoài trời"),
    LIGHT("mapbox://styles/mapbox/light-v11", "Sáng"),
    DARK("mapbox://styles/mapbox/dark-v11", "Tối"),
    SATELLITE("mapbox://styles/mapbox/satellite-streets-v12", "Vệ tinh"),
    TRAFFIC_DAY("mapbox://styles/mapbox/navigation-day-v1", "Giao thông (ngày)"),
    TRAFFIC_NIGHT("mapbox://styles/mapbox/navigation-night-v1", "Giao thông (đêm)")
}

/**
 * Congestion level for route segments
 */
enum class CongestionLevel(val color: Long, val label: String) {
    UNKNOWN(0xFF94A3B8, "Không rõ"),
    LOW(0xFF22C55E, "Thông thoáng"),
    MODERATE(0xFFFACC15, "Đông đúc"),
    HEAVY(0xFFF97316, "Kẹt xe"),
    SEVERE(0xFFDC2626, "Rất kẹt")
}

/**
 * Simulation state for route playback
 */
data class SimulationState(
    val isPlaying: Boolean = false,
    val speed: Float = 1f, // 0.5x, 1x, 2x
    val followVehicle: Boolean = true,
    val currentIndex: Int = 0,
    val currentPosition: LocationPoint? = null,
    val currentBearing: Float = 0f,
    val remainingDistance: Double = 0.0,
    val remainingDuration: Double = 0.0,
    val distanceToNextStep: Double = 0.0,
    val currentStepIndex: Int = 0
)

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
    val isSelectingDestinationOnMap: Boolean = false,
    // Map display options
    val mapStyle: MapStyle = MapStyle.STREETS,
    val showTrafficLayer: Boolean = true,
    val showCongestionColors: Boolean = true,
    val is3DMode: Boolean = false,
    val mapPitch: Float = 0f, // Camera tilt angle (0-60)
    // Simulation
    val simulation: SimulationState = SimulationState(),
    // Guidance mode (turn-by-turn navigation)
    val guidanceMode: Boolean = false,
    val currentStepIndex: Int = 0
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
    
    // ==================== Map Display Controls ====================
    
    fun setMapStyle(style: MapStyle) {
        _uiState.value = _uiState.value.copy(mapStyle = style)
    }
    
    fun toggleTrafficLayer() {
        _uiState.value = _uiState.value.copy(
            showTrafficLayer = !_uiState.value.showTrafficLayer
        )
    }
    
    fun toggleCongestionColors() {
        _uiState.value = _uiState.value.copy(
            showCongestionColors = !_uiState.value.showCongestionColors
        )
    }
    
    fun toggle3DMode() {
        val current3D = _uiState.value.is3DMode
        _uiState.value = _uiState.value.copy(
            is3DMode = !current3D,
            mapPitch = if (current3D) 0f else 45f
        )
    }
    
    fun setMapPitch(pitch: Float) {
        _uiState.value = _uiState.value.copy(
            mapPitch = pitch.coerceIn(0f, 60f),
            is3DMode = pitch > 0f
        )
    }
    
    // ==================== Simulation Controls ====================
    
    private var simulationJob: Job? = null
    
    fun toggleSimulation() {
        val sim = _uiState.value.simulation
        if (sim.isPlaying) {
            pauseSimulation()
        } else {
            startSimulation()
        }
    }
    
    fun startSimulation() {
        val route = _uiState.value.currentRoute ?: return
        if (route.geometry.isEmpty()) return
        
        _uiState.value = _uiState.value.copy(
            simulation = _uiState.value.simulation.copy(
                isPlaying = true,
                currentPosition = route.geometry.first()
            )
        )
        
        simulationJob?.cancel()
        simulationJob = viewModelScope.launch {
            val geometry = route.geometry
            var currentIndex = _uiState.value.simulation.currentIndex
            val totalPoints = geometry.size
            
            while (isActive && currentIndex < totalPoints - 1) {
                val speed = _uiState.value.simulation.speed
                val currentPoint = geometry[currentIndex]
                val nextPoint = geometry[currentIndex + 1]
                
                // Calculate bearing between points
                val bearing = calculateBearing(currentPoint, nextPoint)
                
                // Calculate remaining distance
                val remainingDist = calculateRemainingDistance(geometry, currentIndex)
                val remainingDur = (remainingDist / route.distance) * route.duration
                
                // Find current step
                val currentStepIdx = findCurrentStep(route, currentIndex)
                val distToNextStep = calculateDistanceToNextStep(route, currentIndex, currentStepIdx)
                
                _uiState.value = _uiState.value.copy(
                    simulation = _uiState.value.simulation.copy(
                        currentIndex = currentIndex,
                        currentPosition = currentPoint,
                        currentBearing = bearing,
                        remainingDistance = remainingDist,
                        remainingDuration = remainingDur,
                        distanceToNextStep = distToNextStep,
                        currentStepIndex = currentStepIdx
                    )
                )
                
                // Move to next point - speed affects delay
                val delayMs = (100 / speed).toLong().coerceAtLeast(16)
                delay(delayMs)
                currentIndex++
            }
            
            // Simulation completed
            _uiState.value = _uiState.value.copy(
                simulation = _uiState.value.simulation.copy(
                    isPlaying = false,
                    currentIndex = totalPoints - 1,
                    currentPosition = geometry.lastOrNull()
                )
            )
        }
    }
    
    fun pauseSimulation() {
        simulationJob?.cancel()
        _uiState.value = _uiState.value.copy(
            simulation = _uiState.value.simulation.copy(isPlaying = false)
        )
    }
    
    fun resetSimulation() {
        simulationJob?.cancel()
        val route = _uiState.value.currentRoute
        _uiState.value = _uiState.value.copy(
            simulation = SimulationState(
                currentPosition = route?.geometry?.firstOrNull(),
                remainingDistance = route?.distance ?: 0.0,
                remainingDuration = route?.duration ?: 0.0
            )
        )
    }
    
    fun setSimulationSpeed(speed: Float) {
        _uiState.value = _uiState.value.copy(
            simulation = _uiState.value.simulation.copy(speed = speed)
        )
    }
    
    fun toggleSimulationFollow() {
        _uiState.value = _uiState.value.copy(
            simulation = _uiState.value.simulation.copy(
                followVehicle = !_uiState.value.simulation.followVehicle
            )
        )
    }
    
    // ==================== Guidance Mode ====================
    
    fun startGuidanceMode() {
        if (_uiState.value.currentRoute != null) {
            _uiState.value = _uiState.value.copy(
                guidanceMode = true,
                currentStepIndex = 0,
                is3DMode = true,
                mapPitch = 60f
            )
        }
    }
    
    fun stopGuidanceMode() {
        _uiState.value = _uiState.value.copy(
            guidanceMode = false,
            is3DMode = false,
            mapPitch = 0f
        )
    }
    
    fun nextStep() {
        val route = _uiState.value.currentRoute ?: return
        val maxSteps = route.steps.size
        if (_uiState.value.currentStepIndex < maxSteps - 1) {
            _uiState.value = _uiState.value.copy(
                currentStepIndex = _uiState.value.currentStepIndex + 1
            )
        }
    }
    
    fun previousStep() {
        if (_uiState.value.currentStepIndex > 0) {
            _uiState.value = _uiState.value.copy(
                currentStepIndex = _uiState.value.currentStepIndex - 1
            )
        }
    }
    
    // ==================== Helper Functions ====================
    
    private fun calculateBearing(from: LocationPoint, to: LocationPoint): Float {
        val lat1 = Math.toRadians(from.latitude)
        val lat2 = Math.toRadians(to.latitude)
        val dLon = Math.toRadians(to.longitude - from.longitude)
        
        val y = sin(dLon) * cos(lat2)
        val x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        
        return ((Math.toDegrees(atan2(y, x)) + 360) % 360).toFloat()
    }
    
    private fun calculateRemainingDistance(geometry: List<LocationPoint>, fromIndex: Int): Double {
        var distance = 0.0
        for (i in fromIndex until geometry.size - 1) {
            distance += haversineDistance(geometry[i], geometry[i + 1])
        }
        return distance
    }
    
    private fun haversineDistance(p1: LocationPoint, p2: LocationPoint): Double {
        val R = 6371000.0 // Earth radius in meters
        val lat1 = Math.toRadians(p1.latitude)
        val lat2 = Math.toRadians(p2.latitude)
        val dLat = Math.toRadians(p2.latitude - p1.latitude)
        val dLon = Math.toRadians(p2.longitude - p1.longitude)
        
        val a = sin(dLat / 2).pow(2) + cos(lat1) * cos(lat2) * sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        return R * c
    }
    
    private fun findCurrentStep(route: RouteInfo, pointIndex: Int): Int {
        // Simple approximation based on distance ratio
        val totalPoints = route.geometry.size
        val ratio = pointIndex.toFloat() / totalPoints
        return (ratio * route.steps.size).toInt().coerceIn(0, route.steps.size - 1)
    }
    
    private fun calculateDistanceToNextStep(route: RouteInfo, pointIndex: Int, currentStepIdx: Int): Double {
        if (currentStepIdx >= route.steps.size - 1) return 0.0
        
        // Calculate based on remaining portion of current step
        val stepProgress = (pointIndex.toFloat() / route.geometry.size) * route.steps.size - currentStepIdx
        val currentStep = route.steps[currentStepIdx]
        return currentStep.distance * (1 - stepProgress).coerceIn(0f, 1f)
    }
}
