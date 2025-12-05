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
import com.pikasonix.wayo.ui.viewmodel.RoutingViewModel

// Constants for map layers and sources
private const val ROUTE_SOURCE_ID = "route-source"
private const val ROUTE_LAYER_ID = "route-layer"
private const val ORIGIN_SOURCE_ID = "origin-source"
private const val ORIGIN_LAYER_ID = "origin-layer"
private const val ORIGIN_OUTER_LAYER_ID = "origin-outer-layer"
private const val DESTINATION_SOURCE_ID = "destination-source"
private const val DESTINATION_LAYER_ID = "destination-layer"
private const val DESTINATION_OUTER_LAYER_ID = "destination-outer-layer"

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
    
    // Draw route on map when route changes
    LaunchedEffect(uiState.currentRoute, uiState.origin, uiState.destination) {
        mapView?.let { mv ->
            mv.mapboxMap.getStyle { style ->
                // Draw route polyline
                uiState.currentRoute?.let { route ->
                    drawRouteOnMap(style, route)
                    
                    // Fit camera to route bounds
                    fitCameraToRoute(mv, route, uiState.origin, uiState.destination)
                } ?: run {
                    // Clear route if no route
                    clearRouteFromMap(style)
                }
                
                // Draw markers for origin and destination
                drawMarkers(style, uiState.origin, uiState.destination)
            }
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
                onNavigateBack = onNavigateBack,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
        
        // Map Controls (right side)
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
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 16.dp)
        )
        
        // Bottom Sheet Content (only when not selecting on map)
        if (!isSelectingOnMap) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
            ) {
                // Route Info Card (shown when route is available)
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
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
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
                
                // Search Panel (always at bottom)
                AnimatedVisibility(
                    visible = !showInstructions,
                    enter = fadeIn(),
                    exit = fadeOut()
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
 * Top bar overlay with back button
 */
@Composable
fun TopBarOverlay(
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 48.dp, start = 16.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        FilledIconButton(
            onClick = onNavigateBack,
            colors = IconButtonDefaults.filledIconButtonColors(
                containerColor = Color.White
            ),
            modifier = Modifier.shadow(4.dp, CircleShape)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Quay lại",
                tint = Color(0xFF374151)
            )
        }
        
        Spacer(modifier = Modifier.weight(1f))
        
        // Title
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Text(
                text = "Chỉ đường",
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }
        
        Spacer(modifier = Modifier.weight(1f))
        
        // Placeholder for symmetry
        Spacer(modifier = Modifier.size(48.dp))
    }
}

/**
 * Map controls column (zoom, location, etc.)
 */
@Composable
fun MapControlsColumn(
    onMyLocation: () -> Unit,
    onZoomIn: () -> Unit,
    onZoomOut: () -> Unit,
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
        
        // Zoom controls
        Card(
            shape = RoundedCornerShape(8.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Column {
                IconButton(onClick = onZoomIn) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Phóng to",
                        tint = Color(0xFF374151)
                    )
                }
                HorizontalDivider(color = Color(0xFFE5E7EB))
                IconButton(onClick = onZoomOut) {
                    Icon(
                        imageVector = Icons.Default.Remove,
                        contentDescription = "Thu nhỏ",
                        tint = Color(0xFF374151)
                    )
                }
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
 * Route info card showing distance, duration, and actions
 */
@Composable
fun RouteInfoCard(
    route: RouteInfo,
    formatDuration: (Double) -> String,
    formatDistance: (Double) -> String,
    onShowInstructions: () -> Unit,
    onStartNavigation: () -> Unit,
    onClearRoute: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.shadow(8.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            // Duration and distance
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        text = formatDuration(route.duration),
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF2563EB)
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Route,
                            contentDescription = null,
                            tint = Color(0xFF6B7280),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = formatDistance(route.distance),
                            fontSize = 14.sp,
                            color = Color(0xFF6B7280)
                        )
                    }
                }
                
                // Close button
                IconButton(onClick = onClearRoute) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng",
                        tint = Color(0xFF9CA3AF)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Details button
                OutlinedButton(
                    onClick = onShowInstructions,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD1D5DB))
                ) {
                    Icon(
                        imageVector = Icons.Default.List,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Chi tiết",
                        fontWeight = FontWeight.Medium
                    )
                }
                
                // Start navigation button
                Button(
                    onClick = onStartNavigation,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF22C55E)
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Navigation,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Bắt đầu",
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
