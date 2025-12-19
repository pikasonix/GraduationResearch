package com.pikasonix.wayo.ui.screens

import android.Manifest
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import com.mapbox.geojson.Feature
import com.mapbox.geojson.FeatureCollection
import com.mapbox.geojson.LineString
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.EdgeInsets
import com.mapbox.maps.MapView
import com.mapbox.common.MapboxOptions
import com.mapbox.maps.Style
import com.mapbox.maps.extension.style.layers.addLayer
import com.mapbox.maps.extension.style.layers.generated.circleLayer
import com.mapbox.maps.extension.style.layers.generated.lineLayer
import com.mapbox.maps.extension.style.layers.generated.symbolLayer
import com.mapbox.maps.extension.style.layers.getLayer
import com.mapbox.maps.extension.style.layers.properties.generated.Visibility
import com.mapbox.maps.extension.style.sources.addSource
import com.mapbox.maps.extension.style.sources.generated.geoJsonSource
import com.mapbox.maps.extension.style.sources.getSource
import com.mapbox.maps.extension.style.sources.generated.GeoJsonSource
import com.mapbox.maps.plugin.gestures.addOnMapClickListener
import com.mapbox.maps.plugin.gestures.gestures
import com.pikasonix.wayo.BuildConfig
import com.pikasonix.wayo.data.model.LocationPoint
import com.pikasonix.wayo.data.model.PlaceResult
import com.pikasonix.wayo.data.model.RouteInfo
import com.pikasonix.wayo.data.model.RouteStep
import com.pikasonix.wayo.ui.components.GuidanceHUD
import com.pikasonix.wayo.ui.components.MapSettingsPanel
import com.pikasonix.wayo.ui.components.QuickMapControls
import com.pikasonix.wayo.ui.components.SimulationPanel
import com.pikasonix.wayo.ui.viewmodel.MapStyle
import com.pikasonix.wayo.ui.viewmodel.RoutingViewModel

// Constants for map layers and sources
private const val ROUTE_SOURCE_ID = "route-source"
private const val ROUTE_LAYER_ID = "route-layer"
private const val ROUTE_CONGESTION_SOURCE_ID = "route-congestion-source"
private const val ROUTE_CONGESTION_LAYER_ID = "route-congestion-layer"
private const val ORIGIN_SOURCE_ID = "origin-source"
private const val ORIGIN_LAYER_ID = "origin-layer"
private const val ORIGIN_OUTER_LAYER_ID = "origin-outer-layer"
private const val DESTINATION_SOURCE_ID = "destination-source"
private const val DESTINATION_LAYER_ID = "destination-layer"
private const val DESTINATION_OUTER_LAYER_ID = "destination-outer-layer"
private const val VEHICLE_SOURCE_ID = "vehicle-source"
private const val VEHICLE_LAYER_ID = "vehicle-layer"

// Congestion colors
private val CONGESTION_LOW = Color(0xFF22C55E)      // Green - low traffic
private val CONGESTION_MODERATE = Color(0xFFFBBF24) // Yellow - moderate traffic
private val CONGESTION_HEAVY = Color(0xFFF97316)    // Orange - heavy traffic
private val CONGESTION_SEVERE = Color(0xFFEF4444)   // Red - severe traffic
private val CONGESTION_UNKNOWN = Color(0xFF3B82F6)  // Blue - unknown

/**
 * Routing Screen composable with map and navigation features
 * Optimized for mobile with bottom sheet UI pattern
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoutingScreen(
    onNavigateBack: () -> Unit,
    viewModel: RoutingViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var mapView by remember { mutableStateOf<MapView?>(null) }
    var showInstructions by remember { mutableStateOf(false) }
    var showSearchPanel by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    
    // Default center: Hanoi, Vietnam
    val defaultCenter = remember { LocationPoint(21.0227, 105.8194, "Hà Nội") }
    
    // Location permission launcher
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        
        if (fineLocationGranted || coarseLocationGranted) {
            viewModel.refreshCurrentLocation()
        }
    }
    
    // Request location permission on first launch
    LaunchedEffect(Unit) {
        if (!viewModel.hasLocationPermission()) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }
    
    // Ensure Mapbox token is set
    LaunchedEffect(Unit) {
        val token = BuildConfig.MAPBOX_ACCESS_TOKEN
        if (token.isNotBlank() && MapboxOptions.accessToken != token) {
            MapboxOptions.accessToken = token
        }
    }
    
    // Whether we're in map selection mode
    val isSelectingOnMap = uiState.isSelectingOriginOnMap || uiState.isSelectingDestinationOnMap
    
    // Auto-zoom to current location when available (only if no route)
    LaunchedEffect(uiState.userLocation, uiState.currentRoute) {
        if (uiState.currentRoute == null) {
            uiState.userLocation?.let { location ->
                mapView?.mapboxMap?.setCamera(
                    CameraOptions.Builder()
                        .center(Point.fromLngLat(location.longitude, location.latitude))
                        .zoom(15.0)
                        .build()
                )
            }
        }
    }
    
    // Draw route on map when route changes
    LaunchedEffect(uiState.currentRoute, uiState.origin, uiState.destination, uiState.showCongestionColors) {
        mapView?.let { mv ->
            mv.mapboxMap.getStyle { style ->
                // Draw route polyline
                uiState.currentRoute?.let { route ->
                    if (uiState.showCongestionColors) {
                        drawRouteWithCongestion(style, route)
                    } else {
                        drawRouteOnMap(style, route)
                    }
                } ?: run {
                    // Clear route if no route
                    clearRouteFromMap(style)
                }
                
                // Draw markers for origin and destination
                drawMarkers(style, uiState.origin, uiState.destination)
            }
            
            // Fit camera to route bounds (outside getStyle callback)
            uiState.currentRoute?.let { route ->
                if (!uiState.isNavigating) {
                    fitCameraToRoute(mv, route, uiState.origin, uiState.destination)
                }
            }
        }
    }
    
    // Handle map style changes (traffic layer)
    LaunchedEffect(uiState.mapStyle, uiState.showTrafficLayer) {
        mapView?.let { mv ->
            val styleUri = when (uiState.mapStyle) {
                MapStyle.SATELLITE -> if (uiState.showTrafficLayer) Style.SATELLITE_STREETS else Style.SATELLITE
                MapStyle.DARK -> if (uiState.showTrafficLayer) Style.TRAFFIC_NIGHT else Style.DARK
                MapStyle.LIGHT -> if (uiState.showTrafficLayer) Style.TRAFFIC_DAY else Style.LIGHT
                else -> if (uiState.showTrafficLayer) Style.TRAFFIC_DAY else Style.MAPBOX_STREETS
            }
            
            mv.mapboxMap.loadStyle(styleUri) { style ->
                // Re-initialize route layers after style change
                initializeRouteLayers(style)
                
                // Re-draw route and markers
                uiState.currentRoute?.let { route ->
                    if (uiState.showCongestionColors) {
                        drawRouteWithCongestion(style, route)
                    } else {
                        drawRouteOnMap(style, route)
                    }
                }
                drawMarkers(style, uiState.origin, uiState.destination)
            }
        }
    }
    
    // Handle 3D mode changes
    LaunchedEffect(uiState.is3DMode) {
        mapView?.let { mv ->
            if (uiState.is3DMode) {
                mv.mapboxMap.setCamera(
                    CameraOptions.Builder()
                        .pitch(60.0)
                        .build()
                )
            } else {
                mv.mapboxMap.setCamera(
                    CameraOptions.Builder()
                        .pitch(0.0)
                        .build()
                )
            }
        }
    }
    
    // Handle simulation - update vehicle position on map
    val simulation = uiState.simulation
    LaunchedEffect(simulation.currentPosition, simulation.followVehicle, uiState.isNavigating) {
        mapView?.let { mv ->
            mv.mapboxMap.getStyle { style ->
                simulation.currentPosition?.let { position ->
                    updateVehiclePosition(style, position)
                    
                    // Follow vehicle when navigating
                    if (uiState.isNavigating && simulation.followVehicle) {
                        mv.mapboxMap.setCamera(
                            CameraOptions.Builder()
                                .center(Point.fromLngLat(position.longitude, position.latitude))
                                .zoom(17.0) // Zoom in more for navigation
                                .bearing(simulation.currentBearing.toDouble()) // Rotate map to direction
                                .pitch(45.0) // Slight tilt for 3D effect
                                .build()
                        )
                    }
                }
            }
        }
    }
    
    // Initial zoom when starting navigation
    LaunchedEffect(uiState.isNavigating) {
        if (uiState.isNavigating && uiState.origin != null) {
            mapView?.mapboxMap?.setCamera(
                CameraOptions.Builder()
                    .center(Point.fromLngLat(uiState.origin!!.longitude, uiState.origin!!.latitude))
                    .zoom(17.0)
                    .pitch(45.0)
                    .build()
            )
        }
    }
    
    Box(modifier = Modifier.fillMaxSize()) {
        // Map Layer
        AndroidView(
            factory = { ctx ->
                val token = BuildConfig.MAPBOX_ACCESS_TOKEN
                if (token.isNotBlank()) {
                    MapboxOptions.accessToken = token
                }
                
                MapView(ctx).also { mv ->
                    mapView = mv
                    mv.mapboxMap.loadStyle(Style.MAPBOX_STREETS) { style ->
                        mv.mapboxMap.setCamera(
                            CameraOptions.Builder()
                                .center(Point.fromLngLat(defaultCenter.longitude, defaultCenter.latitude))
                                .zoom(13.0)
                                .build()
                        )
                        
                        // Initialize route source and layer
                        initializeRouteLayers(style)
                    }
                    
                    // Add map click listener for point selection
                    mv.gestures.addOnMapClickListener { point ->
                        val location = LocationPoint(
                            latitude = point.latitude(),
                            longitude = point.longitude()
                        )
                        viewModel.onMapTapped(location)
                        true
                    }
                }
            },
            modifier = Modifier.fillMaxSize()
        )
        
        // Map selection mode overlay
        if (isSelectingOnMap) {
            MapSelectionOverlay(
                isSelectingOrigin = uiState.isSelectingOriginOnMap,
                onCancel = viewModel::cancelMapSelection,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
        
        // Top Bar Overlay (only when not selecting on map)
        if (!isSelectingOnMap) {
            TopBarOverlay(
                onNavigateBack = {
                    if (showSearchPanel) {
                        showSearchPanel = false
                    } else if (uiState.currentRoute != null) {
                        viewModel.clearRoute()
                    } else {
                        onNavigateBack()
                    }
                },
                onMenuClick = { /* TODO: Open menu drawer */ },
                hasRoute = uiState.currentRoute != null || showSearchPanel,
                originText = uiState.originText,
                destinationText = uiState.destinationText,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
        
        // Guidance HUD (shown when navigating/simulating)
        uiState.currentRoute?.let { route ->
            val steps = route.legs.firstOrNull()?.steps ?: route.steps
            val currentStep = steps.getOrNull(uiState.currentStepIndex)
            GuidanceHUD(
                visible = uiState.isNavigating,
                currentStep = currentStep,
                stepIndex = uiState.currentStepIndex,
                totalSteps = steps.size,
                distanceToStep = simulation.distanceToNextStep,
                onPrevious = viewModel::previousStep,
                onNext = viewModel::nextStep,
                onStop = viewModel::stopNavigation,
                formatDistance = viewModel::formatDistance,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 32.dp)
            )
        }
        
        // Map Settings Panel state
        var showMapSettings by remember { mutableStateOf(false) }
        
        // My Location button (left side, shown on home screen)
        AnimatedVisibility(
            visible = uiState.currentRoute == null && !showSearchPanel && !isSelectingOnMap,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, bottom = 180.dp)
        ) {
            FilledIconButton(
                onClick = {
                    if (viewModel.hasLocationPermission()) {
                        viewModel.useCurrentLocationAsOrigin()
                    } else {
                        locationPermissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }
                },
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = Color(0xFF1F2937)
                ),
                modifier = Modifier
                    .size(48.dp)
                    .shadow(6.dp, CircleShape)
            ) {
                Icon(
                    imageVector = Icons.Default.MyLocation,
                    contentDescription = "Vị trí của tôi",
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
        
        // Map Controls (right side - hidden on home screen)
        AnimatedVisibility(
            visible = uiState.currentRoute != null || showSearchPanel,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 16.dp)
        ) {
            MapControlsColumn(
                onMyLocation = { 
                    if (viewModel.hasLocationPermission()) {
                        viewModel.useCurrentLocationAsOrigin()
                    } else {
                        locationPermissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }
                },
                onZoomIn = { /* TODO: Zoom in */ },
                onZoomOut = { /* TODO: Zoom out */ },
                onMapSettings = { showMapSettings = !showMapSettings }
            )
        }
        
        // Simulation Panel (shown when navigating - at bottom)
        AnimatedVisibility(
            visible = uiState.isNavigating && uiState.currentRoute != null,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            val steps = uiState.currentRoute?.legs?.firstOrNull()?.steps ?: uiState.currentRoute?.steps ?: emptyList()
            SimulationPanel(
                simulation = simulation,
                canSimulate = uiState.currentRoute != null,
                onTogglePlay = viewModel::toggleSimulation,
                onReset = viewModel::resetSimulation,
                onToggleFollow = viewModel::toggleSimulationFollow,
                onSpeedChange = viewModel::setSimulationSpeed,
                formatDistance = viewModel::formatDistance,
                formatDuration = viewModel::formatDuration,
                routeSteps = steps,
                modifier = Modifier.fillMaxWidth()
            )
        }
        
        // Map Settings Panel (left side)
        AnimatedVisibility(
            visible = showMapSettings,
            enter = slideInHorizontally(initialOffsetX = { -it }) + fadeIn(),
            exit = slideOutHorizontally(targetOffsetX = { -it }) + fadeOut(),
            modifier = Modifier.align(Alignment.CenterStart)
        ) {
            MapSettingsPanel(
                currentStyle = uiState.mapStyle,
                showTrafficLayer = uiState.showTrafficLayer,
                showCongestionColors = uiState.showCongestionColors,
                is3DMode = uiState.is3DMode,
                onStyleChange = viewModel::setMapStyle,
                onToggleTraffic = viewModel::toggleTrafficLayer,
                onToggleCongestion = viewModel::toggleCongestionColors,
                onToggle3D = viewModel::toggle3DMode,
                onDismiss = { showMapSettings = false },
                modifier = Modifier.padding(start = 16.dp)
            )
        }
        
        // Bottom Sheet Content (only when not selecting on map and not navigating)
        if (!isSelectingOnMap && !uiState.isNavigating) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
            ) {
                // Route Info Card (shown when route is available but not navigating)
                AnimatedVisibility(
                    visible = uiState.currentRoute != null && !showInstructions,
                    enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                    exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
                ) {
                    uiState.currentRoute?.let { route ->
                        RouteInfoCard(
                            route = route,
                            formatDuration = viewModel::formatDuration,
                            formatDistance = viewModel::formatDistance,
                            onShowInstructions = { showInstructions = true },
                            onStartNavigation = viewModel::startNavigation,
                            onClearRoute = viewModel::clearRoute,
                            originName = uiState.originText.take(15).ifEmpty { "Vị trí của bạn" },
                            destinationName = uiState.destinationText,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
                
                // Instructions Panel (shown when user taps "Chi tiết")
                AnimatedVisibility(
                    visible = showInstructions && uiState.currentRoute != null,
                    enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                    exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
                ) {
                    uiState.currentRoute?.let { route ->
                        InstructionsPanel(
                            route = route,
                            formatDistance = viewModel::formatDistance,
                            onClose = { showInstructions = false },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
                
                // Home Bottom Bar (shown when no route and not searching)
                AnimatedVisibility(
                    visible = uiState.currentRoute == null && !showSearchPanel && !showInstructions,
                    enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                    exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
                ) {
                    HomeBottomBar(
                        selectedProfile = uiState.selectedProfile,
                        onProfileChange = viewModel::updateProfile,
                        onSearchClick = { showSearchPanel = true },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                
                // Search Panel (shown when searching)
                AnimatedVisibility(
                    visible = showSearchPanel && uiState.currentRoute == null,
                    enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                    exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
                ) {
                    SearchPanel(
                        originText = uiState.originText,
                        destinationText = uiState.destinationText,
                        selectedProfile = uiState.selectedProfile,
                        isLoading = uiState.isLoading,
                        error = uiState.error,
                        originSearchResults = uiState.originSearchResults,
                        destinationSearchResults = uiState.destinationSearchResults,
                        showOriginSuggestions = uiState.showOriginSuggestions,
                        showDestinationSuggestions = uiState.showDestinationSuggestions,
                        isSearchingOrigin = uiState.isSearchingOrigin,
                        isSearchingDestination = uiState.isSearchingDestination,
                        onOriginChange = viewModel::updateOriginText,
                        onDestinationChange = viewModel::updateDestinationText,
                        onProfileChange = viewModel::updateProfile,
                        onSwap = viewModel::swapOriginDestination,
                        onMyLocation = viewModel::useCurrentLocationAsOrigin,
                        onFindRoute = {
                            focusManager.clearFocus()
                            viewModel.findRoute()
                            showSearchPanel = false
                        },
                        onSelectOriginFromSearch = viewModel::selectOriginFromSearch,
                        onSelectDestinationFromSearch = viewModel::selectDestinationFromSearch,
                        onSelectOriginOnMap = viewModel::startSelectingOriginOnMap,
                        onSelectDestinationOnMap = viewModel::startSelectingDestinationOnMap,
                        onHideOriginSuggestions = viewModel::hideOriginSuggestions,
                        onHideDestinationSuggestions = viewModel::hideDestinationSuggestions,
                        hasRoute = uiState.currentRoute != null,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

/**
 * Overlay shown when user is selecting a point on the map
 */
@Composable
fun MapSelectionOverlay(
    isSelectingOrigin: Boolean,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 48.dp, start = 16.dp, end = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.TouchApp,
                    contentDescription = null,
                    tint = Color(0xFF2563EB),
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (isSelectingOrigin) "Chọn điểm xuất phát" else "Chọn điểm đến",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Chạm vào bản đồ để chọn vị trí",
                    fontSize = 14.sp,
                    color = Color(0xFF6B7280)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = onCancel,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Hủy")
                }
            }
        }
    }
}

/**
 * Top bar overlay - shows menu button on home screen, route header when has route
 */
@Composable
fun TopBarOverlay(
    onNavigateBack: () -> Unit,
    onMenuClick: () -> Unit = {},
    hasRoute: Boolean = false,
    originText: String = "",
    destinationText: String = "",
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(if (hasRoute) Color(0xFF1F2937) else Color.Transparent)
            .padding(top = 48.dp, start = 16.dp, end = 16.dp, bottom = if (hasRoute) 12.dp else 0.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (hasRoute) {
            // Back button
            IconButton(
                onClick = onNavigateBack,
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Quay lại",
                    tint = Color.White
                )
            }
            
            Spacer(modifier = Modifier.width(8.dp))
            
            // Origin → Destination
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = originText.take(12).ifEmpty { "Vị trí của..." },
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                
                Text(
                    text = "  →  ",
                    fontSize = 14.sp,
                    color = Color(0xFF9CA3AF)
                )
                
                Text(
                    text = destinationText.take(25).ifEmpty { "Điểm đến" },
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
            }
        } else {
            // Menu button on home screen
            FilledIconButton(
                onClick = onMenuClick,
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = Color(0xFF1F2937)
                ),
                modifier = Modifier
                    .size(52.dp)
                    .shadow(8.dp, RoundedCornerShape(14.dp))
            ) {
                Icon(
                    imageVector = Icons.Default.Menu,
                    contentDescription = "Menu",
                    tint = Color.White,
                    modifier = Modifier.size(26.dp)
                )
            }
        }
    }
}

/**
 * Map controls column (location, settings, etc.)
 */
@Composable
fun MapControlsColumn(
    onMyLocation: () -> Unit,
    onZoomIn: () -> Unit = {},
    onZoomOut: () -> Unit = {},
    onMapSettings: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // My Location button
        FilledIconButton(
            onClick = onMyLocation,
            colors = IconButtonDefaults.filledIconButtonColors(
                containerColor = Color.White
            ),
            modifier = Modifier.shadow(4.dp, CircleShape)
        ) {
            Icon(
                imageVector = Icons.Default.MyLocation,
                contentDescription = "Vị trí của tôi",
                tint = Color(0xFF2563EB)
            )
        }
        
        // Map Settings button
        if (onMapSettings != null) {
            FilledIconButton(
                onClick = onMapSettings,
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = Color.White
                ),
                modifier = Modifier.shadow(4.dp, CircleShape)
            ) {
                Icon(
                    imageVector = Icons.Default.Layers,
                    contentDescription = "Cài đặt bản đồ",
                    tint = Color(0xFF6B7280)
                )
            }
        }
    }
}

/**
 * Search panel at bottom of screen
 */
@Composable
fun SearchPanel(
    originText: String,
    destinationText: String,
    selectedProfile: String,
    isLoading: Boolean,
    error: String?,
    originSearchResults: List<PlaceResult>,
    destinationSearchResults: List<PlaceResult>,
    showOriginSuggestions: Boolean,
    showDestinationSuggestions: Boolean,
    isSearchingOrigin: Boolean,
    isSearchingDestination: Boolean,
    onOriginChange: (String) -> Unit,
    onDestinationChange: (String) -> Unit,
    onProfileChange: (String) -> Unit,
    onSwap: () -> Unit,
    onMyLocation: () -> Unit,
    onFindRoute: () -> Unit,
    onSelectOriginFromSearch: (PlaceResult) -> Unit,
    onSelectDestinationFromSearch: (PlaceResult) -> Unit,
    onSelectOriginOnMap: () -> Unit,
    onSelectDestinationOnMap: () -> Unit,
    onHideOriginSuggestions: () -> Unit,
    onHideDestinationSuggestions: () -> Unit,
    hasRoute: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.shadow(8.dp, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)),
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            // Handle bar
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Color(0xFFE5E7EB))
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Location inputs
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                // Dots and line
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(end = 12.dp, top = 14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF22C55E))
                    )
                    Box(
                        modifier = Modifier
                            .width(2.dp)
                            .height(60.dp)
                            .background(Color(0xFFD1D5DB))
                    )
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFEF4444))
                    )
                }
                
                // Input fields with suggestions
                Column(modifier = Modifier.weight(1f)) {
                    // Origin input
                    Column {
                        OutlinedTextField(
                            value = originText,
                            onValueChange = onOriginChange,
                            placeholder = { Text("Điểm xuất phát", color = Color(0xFF9CA3AF)) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF2563EB),
                                unfocusedBorderColor = Color(0xFFE5E7EB),
                                focusedContainerColor = Color(0xFFF9FAFB),
                                unfocusedContainerColor = Color(0xFFF9FAFB)
                            ),
                            trailingIcon = {
                                Row {
                                    // Map selection button
                                    IconButton(onClick = onSelectOriginOnMap) {
                                        Icon(
                                            imageVector = Icons.Default.Map,
                                            contentDescription = "Chọn trên bản đồ",
                                            tint = Color(0xFF6B7280)
                                        )
                                    }
                                    // My location button
                                    IconButton(onClick = onMyLocation) {
                                        Icon(
                                            imageVector = Icons.Default.MyLocation,
                                            contentDescription = "Vị trí của tôi",
                                            tint = Color(0xFF2563EB)
                                        )
                                    }
                                }
                            }
                        )
                        
                        // Origin suggestions dropdown
                        AnimatedVisibility(
                            visible = showOriginSuggestions && (originSearchResults.isNotEmpty() || isSearchingOrigin)
                        ) {
                            SearchSuggestionsDropdown(
                                results = originSearchResults,
                                isLoading = isSearchingOrigin,
                                onSelect = onSelectOriginFromSearch,
                                onDismiss = onHideOriginSuggestions
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Destination input
                    Column {
                        OutlinedTextField(
                            value = destinationText,
                            onValueChange = onDestinationChange,
                            placeholder = { Text("Điểm đến", color = Color(0xFF9CA3AF)) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF2563EB),
                                unfocusedBorderColor = Color(0xFFE5E7EB),
                                focusedContainerColor = Color(0xFFF9FAFB),
                                unfocusedContainerColor = Color(0xFFF9FAFB)
                            ),
                            trailingIcon = {
                                // Map selection button
                                IconButton(onClick = onSelectDestinationOnMap) {
                                    Icon(
                                        imageVector = Icons.Default.Map,
                                        contentDescription = "Chọn trên bản đồ",
                                        tint = Color(0xFF6B7280)
                                    )
                                }
                            }
                        )
                        
                        // Destination suggestions dropdown
                        AnimatedVisibility(
                            visible = showDestinationSuggestions && (destinationSearchResults.isNotEmpty() || isSearchingDestination)
                        ) {
                            SearchSuggestionsDropdown(
                                results = destinationSearchResults,
                                isLoading = isSearchingDestination,
                                onSelect = onSelectDestinationFromSearch,
                                onDismiss = onHideDestinationSuggestions
                            )
                        }
                    }
                }
                
                // Swap button
                IconButton(
                    onClick = onSwap,
                    modifier = Modifier.padding(start = 8.dp, top = 24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.SwapVert,
                        contentDescription = "Đổi điểm",
                        tint = Color(0xFF6B7280)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Profile selection
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    ProfileChip(
                        icon = Icons.Default.DirectionsCar,
                        label = "Xe hơi",
                        selected = selectedProfile == "driving-traffic",
                        onClick = { onProfileChange("driving-traffic") }
                    )
                }
                item {
                    ProfileChip(
                        icon = Icons.Default.TwoWheeler,
                        label = "Xe máy",
                        selected = selectedProfile == "driving",
                        onClick = { onProfileChange("driving") }
                    )
                }
                item {
                    ProfileChip(
                        icon = Icons.AutoMirrored.Filled.DirectionsWalk,
                        label = "Đi bộ",
                        selected = selectedProfile == "walking",
                        onClick = { onProfileChange("walking") }
                    )
                }
                item {
                    ProfileChip(
                        icon = Icons.Default.DirectionsBike,
                        label = "Xe đạp",
                        selected = selectedProfile == "cycling",
                        onClick = { onProfileChange("cycling") }
                    )
                }
            }
            
            // Error message
            error?.let {
                Spacer(modifier = Modifier.height(12.dp))
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Error,
                            contentDescription = null,
                            tint = Color(0xFFDC2626),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = it,
                            color = Color(0xFFDC2626),
                            fontSize = 13.sp
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Find route button
            Button(
                onClick = onFindRoute,
                enabled = !isLoading && originText.isNotBlank() && destinationText.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF2563EB),
                    disabledContainerColor = Color(0xFF93C5FD)
                )
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Route,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Tìm đường",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

/**
 * Profile selection chip
 */
@Composable
fun ProfileChip(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    FilterChip(
        onClick = onClick,
        label = { 
            Text(
                text = label,
                fontSize = 13.sp,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
            )
        },
        selected = selected,
        leadingIcon = {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
        },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = Color(0xFF2563EB),
            selectedLabelColor = Color.White,
            selectedLeadingIconColor = Color.White,
            containerColor = Color(0xFFF3F4F6),
            labelColor = Color(0xFF374151),
            iconColor = Color(0xFF374151)
        ),
        border = FilterChipDefaults.filterChipBorder(
            borderColor = Color.Transparent,
            selectedBorderColor = Color.Transparent,
            enabled = true,
            selected = selected
        )
    )
}

/**
 * Route info card showing distance, duration, and actions - Dark theme
 */
@Composable
fun RouteInfoCard(
    route: RouteInfo,
    formatDuration: (Double) -> String,
    formatDistance: (Double) -> String,
    onShowInstructions: () -> Unit,
    onStartNavigation: () -> Unit,
    onClearRoute: () -> Unit,
    originName: String = "Vị trí của bạn",
    destinationName: String = "",
    modifier: Modifier = Modifier
) {
    // Get route description from first step
    val routeDescription = route.steps.firstOrNull()?.instruction?.take(50) ?: "Lộ trình tốt nhất"
    
    Card(
        modifier = modifier.shadow(12.dp, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)),
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937))
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            // Handle bar
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Color(0xFF4B5563))
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Duration and distance row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = formatDuration(route.duration),
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = formatDistance(route.distance),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF9CA3AF)
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Route description
            Text(
                text = routeDescription,
                fontSize = 15.sp,
                color = Color(0xFFD1D5DB),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            
            // Traffic info
            Text(
                text = "Lộ trình tốt nhất, Giao thông bình thường",
                fontSize = 13.sp,
                color = Color(0xFF9CA3AF)
            )
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Schedule button (Lên lịch trình)
                OutlinedButton(
                    onClick = onShowInstructions,
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    shape = RoundedCornerShape(26.dp),
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFF3B82F6)),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color(0xFF3B82F6)
                    )
                ) {
                    Text(
                        text = "Lên lịch trình",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                
                // Start navigation button
                Button(
                    onClick = onStartNavigation,
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    shape = RoundedCornerShape(26.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF3B82F6)
                    )
                ) {
                    Text(
                        text = "Bắt đầu",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

/**
 * Instructions panel showing turn-by-turn directions
 */
@Composable
fun InstructionsPanel(
    route: RouteInfo,
    formatDistance: (Double) -> String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxHeight(0.6f)
            .shadow(8.dp, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)),
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Hướng dẫn chi tiết",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = onClose) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng"
                    )
                }
            }
            
            HorizontalDivider(color = Color(0xFFE5E7EB))
            
            // Instructions list
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                itemsIndexed(route.steps) { index, step ->
                    InstructionItem(
                        step = step,
                        stepNumber = index + 1,
                        isLast = index == route.steps.lastIndex,
                        formatDistance = formatDistance
                    )
                }
            }
        }
    }
}

/**
 * Single instruction item
 */
@Composable
fun InstructionItem(
    step: RouteStep,
    stepNumber: Int,
    isLast: Boolean,
    formatDistance: (Double) -> String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top
    ) {
        // Step number / icon
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(
                    if (isLast) Color(0xFFEF4444) else Color(0xFF2563EB)
                ),
            contentAlignment = Alignment.Center
        ) {
            if (isLast) {
                Icon(
                    imageVector = Icons.Default.Flag,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
            } else {
                Text(
                    text = "$stepNumber",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        
        Spacer(modifier = Modifier.width(12.dp))
        
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = step.instruction,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF1F2937)
            )
            
            step.name?.let { name ->
                if (name.isNotBlank()) {
                    Text(
                        text = name,
                        fontSize = 13.sp,
                        color = Color(0xFF6B7280),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
        
        // Distance
        Text(
            text = formatDistance(step.distance),
            fontSize = 13.sp,
            color = Color(0xFF6B7280),
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * Dropdown showing search suggestions
 */
@Composable
fun SearchSuggestionsDropdown(
    results: List<PlaceResult>,
    isLoading: Boolean,
    onSelect: (PlaceResult) -> Unit,
    onDismiss: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(vertical = 8.dp)
        ) {
            if (isLoading) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = Color(0xFF2563EB)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Đang tìm kiếm...",
                        fontSize = 14.sp,
                        color = Color(0xFF6B7280)
                    )
                }
            } else {
                results.forEach { result ->
                    SearchResultItem(
                        result = result,
                        onClick = { onSelect(result) }
                    )
                }
            }
        }
    }
}

/**
 * Single search result item
 */
@Composable
fun SearchResultItem(
    result: PlaceResult,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Location icon
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(Color(0xFFF3F4F6)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = null,
                tint = Color(0xFF2563EB),
                modifier = Modifier.size(20.dp)
            )
        }
        
        Spacer(modifier = Modifier.width(12.dp))
        
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = result.name,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF1F2937),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (result.address.isNotBlank()) {
                Text(
                    text = result.address,
                    fontSize = 13.sp,
                    color = Color(0xFF6B7280),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ============== Map Drawing Helper Functions ==============

/**
 * Initialize route and marker layers on the map
 */
private fun initializeRouteLayers(style: Style) {
    // Add route source if not exists
    if (style.getSource(ROUTE_SOURCE_ID) == null) {
        style.addSource(
            geoJsonSource(ROUTE_SOURCE_ID) {
                featureCollection(FeatureCollection.fromFeatures(emptyList()))
            }
        )
    }
    
    // Add route layer if not exists
    if (style.getLayer(ROUTE_LAYER_ID) == null) {
        style.addLayer(
            lineLayer(ROUTE_LAYER_ID, ROUTE_SOURCE_ID) {
                lineColor(Color(0xFF2563EB).toArgb())
                lineWidth(6.0)
                lineOpacity(0.8)
            }
        )
    }
    
    // Add origin marker source and layers
    if (style.getSource(ORIGIN_SOURCE_ID) == null) {
        style.addSource(
            geoJsonSource(ORIGIN_SOURCE_ID) {
                featureCollection(FeatureCollection.fromFeatures(emptyList()))
            }
        )
    }
    
    if (style.getLayer(ORIGIN_OUTER_LAYER_ID) == null) {
        style.addLayer(
            circleLayer(ORIGIN_OUTER_LAYER_ID, ORIGIN_SOURCE_ID) {
                circleRadius(14.0)
                circleColor(Color.White.toArgb())
                circleStrokeWidth(3.0)
                circleStrokeColor(Color(0xFF22C55E).toArgb())
            }
        )
    }
    
    if (style.getLayer(ORIGIN_LAYER_ID) == null) {
        style.addLayer(
            circleLayer(ORIGIN_LAYER_ID, ORIGIN_SOURCE_ID) {
                circleRadius(8.0)
                circleColor(Color(0xFF22C55E).toArgb())
            }
        )
    }
    
    // Add destination marker source and layers
    if (style.getSource(DESTINATION_SOURCE_ID) == null) {
        style.addSource(
            geoJsonSource(DESTINATION_SOURCE_ID) {
                featureCollection(FeatureCollection.fromFeatures(emptyList()))
            }
        )
    }
    
    if (style.getLayer(DESTINATION_OUTER_LAYER_ID) == null) {
        style.addLayer(
            circleLayer(DESTINATION_OUTER_LAYER_ID, DESTINATION_SOURCE_ID) {
                circleRadius(14.0)
                circleColor(Color.White.toArgb())
                circleStrokeWidth(3.0)
                circleStrokeColor(Color(0xFFEF4444).toArgb())
            }
        )
    }
    
    if (style.getLayer(DESTINATION_LAYER_ID) == null) {
        style.addLayer(
            circleLayer(DESTINATION_LAYER_ID, DESTINATION_SOURCE_ID) {
                circleRadius(8.0)
                circleColor(Color(0xFFEF4444).toArgb())
            }
        )
    }
}

/**
 * Draw route polyline on the map
 */
private fun drawRouteOnMap(style: Style, route: RouteInfo) {
    try {
        // Convert geometry points to Mapbox Points
        val points = route.geometry.map { point ->
            Point.fromLngLat(point.longitude, point.latitude)
        }
        
        if (points.isEmpty()) return
        
        // Create LineString from points
        val lineString = LineString.fromLngLats(points)
        
        // Update the source with new geometry
        val source = style.getSource(ROUTE_SOURCE_ID) as? GeoJsonSource
        source?.featureCollection(
            FeatureCollection.fromFeature(Feature.fromGeometry(lineString))
        )
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

/**
 * Clear route from map
 */
private fun clearRouteFromMap(style: Style) {
    try {
        val source = style.getSource(ROUTE_SOURCE_ID) as? GeoJsonSource
        source?.featureCollection(FeatureCollection.fromFeatures(emptyList()))
        
        // Also clear congestion layer
        val congestionSource = style.getSource(ROUTE_CONGESTION_SOURCE_ID) as? GeoJsonSource
        congestionSource?.featureCollection(FeatureCollection.fromFeatures(emptyList()))
        
        // Clear vehicle position
        val vehicleSource = style.getSource(VEHICLE_SOURCE_ID) as? GeoJsonSource
        vehicleSource?.featureCollection(FeatureCollection.fromFeatures(emptyList()))
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

/**
 * Draw route with congestion colors based on traffic data
 * Uses simple approach: color each segment individually
 */
private fun drawRouteWithCongestion(style: Style, route: RouteInfo) {
    try {
        // Get congestion data from the route legs
        val congestionData = route.legs.firstOrNull()?.annotation?.congestion ?: emptyList()
        val points = route.geometry.map { point ->
            Point.fromLngLat(point.longitude, point.latitude)
        }
        
        if (points.size < 2) return
        
        // If no congestion data, just draw normal route
        if (congestionData.isEmpty()) {
            drawRouteOnMap(style, route)
            return
        }
        
        // Group segments by congestion level
        val lowFeatures = mutableListOf<Feature>()
        val moderateFeatures = mutableListOf<Feature>()
        val heavyFeatures = mutableListOf<Feature>()
        val severeFeatures = mutableListOf<Feature>()
        val unknownFeatures = mutableListOf<Feature>()
        
        for (i in 0 until minOf(points.size - 1, congestionData.size)) {
            val startPoint = points[i]
            val endPoint = points[i + 1]
            val congestionLevel = congestionData.getOrNull(i) ?: "unknown"
            
            val lineString = LineString.fromLngLats(listOf(startPoint, endPoint))
            val feature = Feature.fromGeometry(lineString)
            
            when (congestionLevel.lowercase()) {
                "low" -> lowFeatures.add(feature)
                "moderate" -> moderateFeatures.add(feature)
                "heavy" -> heavyFeatures.add(feature)
                "severe" -> severeFeatures.add(feature)
                else -> unknownFeatures.add(feature)
            }
        }
        
        // Add remaining points as unknown
        if (points.size > congestionData.size + 1) {
            for (i in congestionData.size until points.size - 1) {
                val lineString = LineString.fromLngLats(listOf(points[i], points[i + 1]))
                val feature = Feature.fromGeometry(lineString)
                unknownFeatures.add(feature)
            }
        }
        
        // Helper function to add or update congestion layer
        fun addCongestionLayer(
            sourceId: String,
            layerId: String,
            features: List<Feature>,
            color: Color
        ) {
            if (features.isEmpty()) return
            
            var source = style.getSource(sourceId) as? GeoJsonSource
            if (source == null) {
                style.addSource(geoJsonSource(sourceId) {
                    featureCollection(FeatureCollection.fromFeatures(features))
                })
                style.addLayer(lineLayer(layerId, sourceId) {
                    lineWidth(8.0)
                    lineColor(color.toArgb())
                })
            } else {
                source.featureCollection(FeatureCollection.fromFeatures(features))
            }
        }
        
        // Add layers for each congestion level
        addCongestionLayer("${ROUTE_CONGESTION_SOURCE_ID}-low", "${ROUTE_CONGESTION_LAYER_ID}-low", lowFeatures, CONGESTION_LOW)
        addCongestionLayer("${ROUTE_CONGESTION_SOURCE_ID}-moderate", "${ROUTE_CONGESTION_LAYER_ID}-moderate", moderateFeatures, CONGESTION_MODERATE)
        addCongestionLayer("${ROUTE_CONGESTION_SOURCE_ID}-heavy", "${ROUTE_CONGESTION_LAYER_ID}-heavy", heavyFeatures, CONGESTION_HEAVY)
        addCongestionLayer("${ROUTE_CONGESTION_SOURCE_ID}-severe", "${ROUTE_CONGESTION_LAYER_ID}-severe", severeFeatures, CONGESTION_SEVERE)
        addCongestionLayer("${ROUTE_CONGESTION_SOURCE_ID}-unknown", "${ROUTE_CONGESTION_LAYER_ID}-unknown", unknownFeatures, CONGESTION_UNKNOWN)
        
        // Hide the normal route layer
        style.getLayer(ROUTE_LAYER_ID)?.visibility(Visibility.NONE)
        
    } catch (e: Exception) {
        e.printStackTrace()
        // Fallback to normal route
        drawRouteOnMap(style, route)
    }
}

/**
 * Update vehicle position on the map (for simulation)
 */
private fun updateVehiclePosition(style: Style, position: com.pikasonix.wayo.data.model.LocationPoint) {
    try {
        val point = Point.fromLngLat(position.longitude, position.latitude)
        
        // Check if vehicle source exists
        var vehicleSource = style.getSource(VEHICLE_SOURCE_ID) as? GeoJsonSource
        if (vehicleSource == null) {
            // Create vehicle source and layer
            style.addSource(geoJsonSource(VEHICLE_SOURCE_ID) {
                featureCollection(FeatureCollection.fromFeature(Feature.fromGeometry(point)))
            })
            
            // Add vehicle layer (outer circle)
            style.addLayer(circleLayer("${VEHICLE_LAYER_ID}-outer", VEHICLE_SOURCE_ID) {
                circleRadius(16.0)
                circleColor(Color(0xFF3B82F6).toArgb())
                circleOpacity(0.3)
            })
            
            // Add vehicle layer (inner circle)
            style.addLayer(circleLayer(VEHICLE_LAYER_ID, VEHICLE_SOURCE_ID) {
                circleRadius(10.0)
                circleColor(Color(0xFF3B82F6).toArgb())
                circleStrokeColor(Color.White.toArgb())
                circleStrokeWidth(3.0)
            })
        } else {
            vehicleSource.featureCollection(
                FeatureCollection.fromFeature(Feature.fromGeometry(point))
            )
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

/**
 * Draw origin and destination markers on the map
 */
private fun drawMarkers(style: Style, origin: LocationPoint?, destination: LocationPoint?) {
    try {
        // Update origin marker
        val originSource = style.getSource(ORIGIN_SOURCE_ID) as? GeoJsonSource
        if (origin != null) {
            val point = Point.fromLngLat(origin.longitude, origin.latitude)
            originSource?.featureCollection(
                FeatureCollection.fromFeature(Feature.fromGeometry(point))
            )
        } else {
            originSource?.featureCollection(FeatureCollection.fromFeatures(emptyList()))
        }
        
        // Update destination marker
        val destinationSource = style.getSource(DESTINATION_SOURCE_ID) as? GeoJsonSource
        if (destination != null) {
            val point = Point.fromLngLat(destination.longitude, destination.latitude)
            destinationSource?.featureCollection(
                FeatureCollection.fromFeature(Feature.fromGeometry(point))
            )
        } else {
            destinationSource?.featureCollection(FeatureCollection.fromFeatures(emptyList()))
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

/**
 * Fit camera to show the entire route
 */
private fun fitCameraToRoute(
    mapView: MapView,
    route: RouteInfo,
    origin: LocationPoint?,
    destination: LocationPoint?
) {
    try {
        val points = mutableListOf<Point>()
        
        // Add origin and destination
        origin?.let { points.add(Point.fromLngLat(it.longitude, it.latitude)) }
        destination?.let { points.add(Point.fromLngLat(it.longitude, it.latitude)) }
        
        // Add route geometry points
        route.geometry.forEach { point ->
            points.add(Point.fromLngLat(point.longitude, point.latitude))
        }
        
        if (points.size < 2) return
        
        // Calculate bounds
        var minLat = Double.MAX_VALUE
        var maxLat = Double.MIN_VALUE
        var minLng = Double.MAX_VALUE
        var maxLng = Double.MIN_VALUE
        
        points.forEach { point ->
            minLat = minOf(minLat, point.latitude())
            maxLat = maxOf(maxLat, point.latitude())
            minLng = minOf(minLng, point.longitude())
            maxLng = maxOf(maxLng, point.longitude())
        }
        
        // Calculate center and zoom
        val centerLat = (minLat + maxLat) / 2
        val centerLng = (minLng + maxLng) / 2
        
        // Calculate zoom level based on bounds
        val latDiff = maxLat - minLat
        val lngDiff = maxLng - minLng
        val maxDiff = maxOf(latDiff, lngDiff)
        
        val zoom = when {
            maxDiff > 1.0 -> 8.0
            maxDiff > 0.5 -> 9.0
            maxDiff > 0.2 -> 10.0
            maxDiff > 0.1 -> 11.0
            maxDiff > 0.05 -> 12.0
            maxDiff > 0.02 -> 13.0
            maxDiff > 0.01 -> 14.0
            else -> 15.0
        }
        
        // Set camera with padding for bottom sheet
        mapView.mapboxMap.setCamera(
            CameraOptions.Builder()
                .center(Point.fromLngLat(centerLng, centerLat))
                .zoom(zoom)
                .padding(EdgeInsets(100.0, 50.0, 350.0, 50.0)) // top, left, bottom, right padding
                .build()
        )
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

/**
 * Home screen bottom bar with vehicle selector and search bar
 */
@Composable
fun HomeBottomBar(
    selectedProfile: String,
    onProfileChange: (String) -> Unit,
    onSearchClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Vehicle type selector
        VehicleTypeSelector(
            selectedProfile = selectedProfile,
            onProfileChange = onProfileChange
        )
        
        // Simple search bar
        SimpleSearchBar(
            onClick = onSearchClick,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
        )
    }
}

/**
 * Vehicle type selector dropdown
 */
@Composable
fun VehicleTypeSelector(
    selectedProfile: String,
    onProfileChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    
    val vehicleTypes = listOf(
        "driving-traffic" to "Xe taxi",
        "driving" to "Xe máy",
        "walking" to "Đi bộ",
        "cycling" to "Xe đạp"
    )
    
    val selectedLabel = vehicleTypes.find { it.first == selectedProfile }?.second ?: "Xe taxi"
    
    Box(modifier = modifier) {
        // Selector button
        Button(
            onClick = { expanded = true },
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFF59E0B)
            ),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 10.dp),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
        ) {
            Text(
                text = selectedLabel,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
            Spacer(modifier = Modifier.width(6.dp))
            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
        }
        
        // Dropdown menu
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            vehicleTypes.forEach { (profile, label) ->
                DropdownMenuItem(
                    text = { 
                        Text(
                            text = label,
                            fontWeight = if (profile == selectedProfile) FontWeight.SemiBold else FontWeight.Normal
                        )
                    },
                    onClick = {
                        onProfileChange(profile)
                        expanded = false
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = when (profile) {
                                "driving-traffic" -> Icons.Default.LocalTaxi
                                "driving" -> Icons.Default.TwoWheeler
                                "walking" -> Icons.AutoMirrored.Filled.DirectionsWalk
                                "cycling" -> Icons.Default.DirectionsBike
                                else -> Icons.Default.DirectionsCar
                            },
                            contentDescription = null,
                            tint = if (profile == selectedProfile) Color(0xFFF59E0B) else Color(0xFF6B7280)
                        )
                    }
                )
            }
        }
    }
}

/**
 * Simple search bar for home screen
 */
@Composable
fun SimpleSearchBar(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .height(56.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937)),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = Color(0xFF9CA3AF),
                modifier = Modifier.size(24.dp)
            )
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Text(
                text = "Địa điểm tiếp theo?",
                fontSize = 16.sp,
                color = Color(0xFF9CA3AF),
                modifier = Modifier.weight(1f)
            )
            
            Icon(
                imageVector = Icons.Default.Mic,
                contentDescription = "Tìm kiếm bằng giọng nói",
                tint = Color(0xFF9CA3AF),
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

