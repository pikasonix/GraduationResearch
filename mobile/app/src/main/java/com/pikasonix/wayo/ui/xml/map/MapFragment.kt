package com.pikasonix.wayo.ui.xml.map

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.mapbox.geojson.LineString
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import android.graphics.Color
import com.mapbox.geojson.Feature
import com.mapbox.geojson.FeatureCollection
import com.mapbox.maps.Style
import com.mapbox.maps.extension.style.layers.addLayer
import com.mapbox.maps.extension.style.layers.generated.circleLayer
import com.mapbox.maps.extension.style.layers.generated.lineLayer
import com.mapbox.maps.extension.style.layers.generated.symbolLayer
import com.mapbox.maps.extension.style.layers.properties.generated.TextAnchor
import com.mapbox.maps.extension.style.layers.properties.generated.LineJoin
import com.mapbox.maps.extension.style.layers.properties.generated.LineCap
import com.mapbox.maps.extension.style.sources.addSource
import com.mapbox.maps.extension.style.sources.generated.geoJsonSource
import com.mapbox.maps.plugin.locationcomponent.location
import com.mapbox.maps.plugin.gestures.addOnMapClickListener
import com.mapbox.maps.ScreenCoordinate
import com.mapbox.maps.RenderedQueryOptions
import com.mapbox.maps.RenderedQueryGeometry
import com.pikasonix.wayo.BuildConfig
import com.pikasonix.wayo.R
import com.pikasonix.wayo.databinding.FragmentMapBinding
import com.pikasonix.wayo.ui.xml.map.MapViewModel
import com.pikasonix.wayo.data.remote.MapboxService
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.model.Order
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.pikasonix.wayo.ui.xml.map.adapter.MapStopListAdapter
import androidx.recyclerview.widget.LinearLayoutManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MapFragment : Fragment(R.layout.fragment_map) {

    private val viewModel: MapViewModel by viewModels()
    
    @Inject
    lateinit var mapboxService: MapboxService

    private var binding: FragmentMapBinding? = null
    
    // Cache for routing results
    private val routingCache = mutableMapOf<String, List<Point>>()
    
    // Enable real road routing (set to false for straight lines)
    private val useRealRouting = true
    
    // Store current stops for popup
    private var currentStops: List<Stop> = emptyList()
    
    // Stop list adapter and selection state
    private var stopListAdapter: MapStopListAdapter? = null
    private var selectedStopIndex: Int = -1
    private var showAllMode: Boolean = true

    private val locationPermissionRequest = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        when {
            permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true -> {
                enableLocationComponent()
            }
            else -> {
                Toast.makeText(
                    requireContext(),
                    "Cần cấp quyền vị trí để hiển thị vị trí của bạn trên bản đồ",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FragmentMapBinding.bind(view)

        setupMap()
        setupStopList()
        setupClickListeners()
        observeRouteData()
    }

    private fun setupMap() {
        binding?.mapView?.apply {
            // Set camera to Hai Bà Trưng, Hà Nội
            mapboxMap.setCamera(
                CameraOptions.Builder()
                    .center(Point.fromLngLat(105.8194, 21.0227))
                    .zoom(15.0)
                    .build()
            )

            // Check and request location permissions
            checkLocationPermission()
        }
    }

    private fun checkLocationPermission() {
        when {
            ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED -> {
                enableLocationComponent()
            }
            else -> {
                locationPermissionRequest.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
        }
    }

    private fun enableLocationComponent() {
        binding?.mapView?.location?.apply {
            enabled = true
            pulsingEnabled = true
        }
    }

    private fun setupClickListeners() {
        binding?.apply {
            btnShowAll.setOnClickListener {
                toggleShowAllMode()
            }
        }
    }
    
    private fun setupStopList() {
        binding?.apply {
            stopListAdapter = MapStopListAdapter { stop, position ->
                onStopSelected(position)
            }
            
            rvStops.apply {
                adapter = stopListAdapter
                layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
            }
        }
    }
    
    private fun onStopSelected(position: Int) {
        if (selectedStopIndex == position) {
            // Deselect if clicking same stop
            return
        }
        
        selectedStopIndex = position
        stopListAdapter?.selectedPosition = position
        showAllMode = false
        
        // Update button text
        binding?.btnShowAll?.text = "Xem tất cả"
        
        // Redraw map with filtered view
        val state = viewModel.uiState.value
        if (state.route != null && state.stops.isNotEmpty()) {
            displayRouteOnMap(state)
        }
    }
    
    private fun toggleShowAllMode() {
        showAllMode = !showAllMode
        
        if (showAllMode) {
            selectedStopIndex = -1
            stopListAdapter?.selectedPosition = -1
            binding?.btnShowAll?.text = "Xem từng đoạn"
        } else {
            // Select first stop if nothing selected
            if (selectedStopIndex == -1 && currentStops.isNotEmpty()) {
                selectedStopIndex = 0
                stopListAdapter?.selectedPosition = 0
            }
            binding?.btnShowAll?.text = "Xem tất cả"
        }
        
        // Redraw map
        val state = viewModel.uiState.value
        if (state.route != null && state.stops.isNotEmpty()) {
            displayRouteOnMap(state)
        }
    }

    private fun observeRouteData() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    // Update loading indicator
                    binding?.loadingIndicator?.visibility = if (state.isLoading) View.VISIBLE else View.GONE
                    
                    if (state.route != null && state.stops.isNotEmpty()) {
                        displayRouteOnMap(state)
                    } else if (state.error != null) {
                        Toast.makeText(requireContext(), state.error, Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        viewModel.loadActiveRoute()
    }

    private fun displayRouteOnMap(state: MapViewModel.UiState) {
        // Store current stops for popup
        currentStops = state.stops
        
        // Update stop list adapter
        stopListAdapter?.submitList(state.stops.sortedBy { it.sequence })
        binding?.stopListContainer?.visibility = if (state.stops.isNotEmpty()) View.VISIBLE else View.GONE
        
        binding?.mapView?.mapboxMap?.loadStyle(Style.MAPBOX_STREETS) { style ->
            // Thu thập tất cả điểm stop
            val stopPoints = mutableListOf<Point>()
            val features = mutableListOf<Feature>()
            
            val stopsList = state.stops.sortedBy { it.sequence }

            // Create features for each stop
            stopsList.forEachIndexed { index, stop ->
                val point = Point.fromLngLat(stop.longitude, stop.latitude)
                stopPoints.add(point)
                
                val feature = Feature.fromGeometry(point)
                feature.addStringProperty("sequence", stop.sequence.toString())
                feature.addStringProperty("type", stop.type)
                feature.addStringProperty("name", stop.locationName)
                feature.addStringProperty("status", stop.status)
                
                // Determine if this stop should be dimmed
                val shouldDim = if (showAllMode || selectedStopIndex == -1) {
                    false // Show all stops normally
                } else {
                    // Dim stops not in the selected range
                    val startIndex = maxOf(0, selectedStopIndex - 1)
                    val endIndex = selectedStopIndex
                    index < startIndex || index > endIndex
                }
                feature.addBooleanProperty("dimmed", shouldDim)
                
                features.add(feature)
            }

            // BƯớc 1: Vẽ route polyline TRƯỚC (layer dưới cùng) với routing thật
            if (stopPoints.size >= 2) {
                // Xác định điểm nào cần vẽ dựa trên chế độ
                val routePointsToDraw = if (showAllMode || selectedStopIndex == -1) {
                    // Hiển thị tất cả các stop
                    stopPoints
                } else {
                    // Chỉ hiển thị từ stop trước đến stop được chọn
                    val startIndex = maxOf(0, selectedStopIndex - 1)
                    val endIndex = minOf(stopPoints.size - 1, selectedStopIndex)
                    stopPoints.subList(startIndex, endIndex + 1)
                }
                
                if (routePointsToDraw.size >= 2) {
                    if (useRealRouting) {
                        // Sử dụng routing theo đường thật qua Mapbox Directions API
                        viewLifecycleOwner.lifecycleScope.launch {
                            try {
                                // Convert sang định dạng waypoints cho API
                                val waypoints = routePointsToDraw.map { 
                                    Pair(it.longitude(), it.latitude()) 
                                }
                                
                                // Tạo cache key
                                val cacheKey = waypoints.joinToString("|") { "${it.first},${it.second}" }
                                
                                // Kiểm tra cache trước
                                val routeCoordinates = if (routingCache.containsKey(cacheKey)) {
                                    routingCache[cacheKey]!!
                                } else {
                                    // Fetch routing thật từ Mapbox
                                    val realCoords = mapboxService.getRealRouteCoordinates(waypoints)
                                    val points = realCoords.map { Point.fromLngLat(it.first, it.second) }
                                    routingCache[cacheKey] = points
                                    points
                                }
                            
                            // Vẽ đường route
                            val lineString = LineString.fromLngLats(routeCoordinates)
                            
                            // Xóa layer và source cũ nếu tồn tại
                            try {
                                if (style.styleLayerExists("route-layer")) {
                                    style.removeStyleLayer("route-layer")
                                }
                                if (style.styleSourceExists("route-source")) {
                                    style.removeStyleSource("route-source")
                                }
                            } catch (e: Exception) {
                                // Ignore
                            }
                            
                            // Thêm source và layer mới
                            style.addSource(
                                geoJsonSource("route-source") {
                                    geometry(lineString)
                                }
                            )
                            
                            style.addLayer(
                                lineLayer("route-layer", "route-source") {
                                    lineColor("#3b82f6")
                                    lineWidth(4.0)
                                    lineOpacity(0.8)
                                    lineJoin(LineJoin.ROUND)
                                    lineCap(LineCap.ROUND)
                                }
                            )
                        } catch (e: Exception) {
                            // Fallback về đường thẳng
                            drawStraightRoute(style, routePointsToDraw)
                        }
                    }
                } else {
                    // Sử dụng đường thẳng giữa các stop
                    drawStraightRoute(style, routePointsToDraw)
                }
            }
        }
            
            // BƯớc 2: Thêm depot marker (layer giữa)
            if (stopPoints.isNotEmpty()) {
                val depotPoint = stopPoints[0]
                val depotFeature = Feature.fromGeometry(depotPoint)
                depotFeature.addStringProperty("type", "depot")
                depotFeature.addStringProperty("name", "Kho (Depot)")
                
                style.addSource(
                    geoJsonSource("depot-source") {
                        featureCollection(FeatureCollection.fromFeatures(listOf(depotFeature)))
                    }
                )
                
                // Bóng depot
                style.addLayer(
                    circleLayer("depot-shadow-layer", "depot-source") {
                        circleRadius(18.0)
                        circleColor("#000000")
                        circleOpacity(0.25)
                        circleBlur(0.8)
                        circleTranslate(listOf(0.0, 3.0))
                    }
                )
                
                // Depot marker (hình tròn đỏ viền trắng)
                style.addLayer(
                    circleLayer("depot-border-layer", "depot-source") {
                        circleRadius(16.0)
                        circleColor("#ffffff")
                        circleOpacity(1.0)
                    }
                )
                
                style.addLayer(
                    circleLayer("depot-layer", "depot-source") {
                        circleRadius(13.0)
                        circleColor("#dc2626")
                        circleOpacity(1.0)
                    }
                )
            }

            // STEP 3: Add stop markers LAST (top layer)
            if (features.isNotEmpty()) {
                
                val featureCollection = FeatureCollection.fromFeatures(features)
                
                // Add source
                style.addSource(
                    geoJsonSource("stops-source") {
                        featureCollection(featureCollection)
                    }
                )
                
                // Add shadow layer (like Google Maps)
                style.addLayer(
                    circleLayer("stops-shadow-layer", "stops-source") {
                        circleRadius(16.0)
                        circleColor("#000000")
                        circleOpacity(
                            com.mapbox.maps.extension.style.expressions.dsl.generated.switchCase {
                                get { literal("dimmed") }
                                literal(0.1) // Very faint shadow for dimmed stops
                                literal(0.2) // Normal shadow
                            }
                        )
                        circleBlur(0.8)
                        circleTranslate(listOf(0.0, 2.0))
                    }
                )
                
                // Add white border layer
                style.addLayer(
                    circleLayer("stops-border-layer", "stops-source") {
                        circleRadius(14.0)
                        circleColor("#ffffff")
                        circleOpacity(
                            com.mapbox.maps.extension.style.expressions.dsl.generated.switchCase {
                                get { literal("dimmed") }
                                literal(0.3) // Dimmed opacity for unselected stops
                                literal(1.0) // Full opacity for selected stops
                            }
                        )
                    }
                )
                
                // Add main colored circle layer (color based on status)
                style.addLayer(
                    circleLayer("stops-circle-layer", "stops-source") {
                        circleRadius(11.0)
                        circleColor(
                            com.mapbox.maps.extension.style.expressions.dsl.generated.match {
                                get { literal("status") }
                                stop {
                                    literal("completed")
                                    literal("#10b981") // green for completed
                                }
                                stop {
                                    literal("in_progress")
                                    literal("#f59e0b") // orange for in_progress
                                }
                                stop {
                                    literal("pending")
                                    literal("#3b82f6") // blue for pending
                                }
                                literal("#3b82f6") // default color (blue)
                            }
                        )
                        circleOpacity(
                            com.mapbox.maps.extension.style.expressions.dsl.generated.switchCase {
                                get { literal("dimmed") }
                                literal(0.3) // Dimmed opacity for unselected stops
                                literal(1.0) // Full opacity for selected stops
                            }
                        )
                    }
                )
                
                // Add inner white dot (Google Maps style)
                style.addLayer(
                    circleLayer("stops-inner-layer", "stops-source") {
                        circleRadius(4.0)
                        circleColor("#ffffff")
                        circleOpacity(
                            com.mapbox.maps.extension.style.expressions.dsl.generated.switchCase {
                                get { literal("dimmed") }
                                literal(0.3) // Dimmed opacity for unselected stops
                                literal(0.9) // Full opacity for selected stops
                            }
                        )
                    }
                )
                
                // Add text layer for sequence numbers (positioned above the marker)
                style.addLayer(
                    symbolLayer("stops-text-layer", "stops-source") {
                        textField("{sequence}")
                        textSize(10.0)
                        textColor("#3b82f6")
                        textHaloColor("#ffffff")
                        textHaloWidth(1.5)
                        textAnchor(TextAnchor.CENTER)
                        textOffset(listOf(0.0, -1.8))
                        textOpacity(
                            com.mapbox.maps.extension.style.expressions.dsl.generated.switchCase {
                                get { literal("dimmed") }
                                literal(0.3) // Dimmed opacity for unselected stops
                                literal(1.0) // Full opacity for selected stops
                            }
                        )
                    }
                )
                

                // Add click listener for stop markers
                binding?.mapView?.mapboxMap?.addOnMapClickListener { point ->
                    val screenCoordinate = binding?.mapView?.mapboxMap?.pixelForCoordinate(point)
                    if (screenCoordinate != null) {
                        binding?.mapView?.mapboxMap?.queryRenderedFeatures(
                            RenderedQueryGeometry(screenCoordinate),
                            RenderedQueryOptions(listOf("stops-circle-layer"), null)
                        ) { result ->
                            if (result.isValue && result.value != null) {
                                val features = result.value!!
                                if (features.isNotEmpty()) {
                                    val feature = features[0].queriedFeature.feature
                                    val sequenceStr = feature.getStringProperty("sequence")
                                    val sequence = sequenceStr?.toIntOrNull()
                                    if (sequence != null) {
                                        val stop = currentStops.find { it.sequence == sequence }
                                        if (stop != null) {
                                            showStopDetailPopup(stop)
                                        }
                                    }
                                }
                            }
                        }
                        return@addOnMapClickListener true
                    }
                    false
                }
            }

            // Adjust camera to show all points or selected segment
            if (stopPoints.isNotEmpty()) {
                val pointsToFocus = if (showAllMode || selectedStopIndex == -1) {
                    stopPoints // Show all points
                } else {
                    // Focus on selected segment
                    val startIndex = maxOf(0, selectedStopIndex - 1)
                    val endIndex = minOf(stopPoints.size - 1, selectedStopIndex)
                    stopPoints.subList(startIndex, endIndex + 1)
                }
                
                val bounds = calculateBounds(pointsToFocus)
                binding?.mapView?.mapboxMap?.setCamera(
                    CameraOptions.Builder()
                        .center(bounds.center)
                        .zoom(bounds.zoom)
                        .build()
                )
            }
        }
    }
    
    private fun drawStraightRoute(style: Style, points: List<Point>) {
        val lineString = LineString.fromLngLats(points)
        
        // Remove existing layer and source if they exist
        try {
            if (style.styleLayerExists("route-layer")) {
                style.removeStyleLayer("route-layer")
            }
            if (style.styleSourceExists("route-source")) {
                style.removeStyleSource("route-source")
            }
        } catch (e: Exception) {
            // Ignore
        }
        
        style.addSource(
            geoJsonSource("route-source") {
                geometry(lineString)
            }
        )
        
        style.addLayer(
            lineLayer("route-layer", "route-source") {
                lineColor("#3b82f6")
                lineWidth(4.0)
                lineOpacity(0.8)
                lineJoin(LineJoin.ROUND)
                lineCap(LineCap.ROUND)
            }
        )

    }
    
    private fun showStopDetailPopup(stop: Stop) {
        val bottomSheetDialog = BottomSheetDialog(requireContext())
        val bottomSheetView = layoutInflater.inflate(R.layout.bottom_sheet_stop_detail, null)
        bottomSheetDialog.setContentView(bottomSheetView)
        
        // Populate data
        bottomSheetView.findViewById<android.widget.TextView>(R.id.tvSequence).text = stop.sequence.toString()
        bottomSheetView.findViewById<android.widget.TextView>(R.id.tvStopType).text = when(stop.type) {
            "pickup" -> "Lấy hàng"
            "delivery" -> "Giao hàng"
            else -> stop.type
        }
        bottomSheetView.findViewById<android.widget.TextView>(R.id.tvLocationName).text = stop.locationName
        bottomSheetView.findViewById<android.widget.TextView>(R.id.tvStopStatus).text = when(stop.status) {
            "pending" -> "Đang chờ"
            "in_progress" -> "Đang thực hiện"
            "completed" -> "Đã hoàn thành"
            "skipped" -> "Đã bỏ qua"
            else -> stop.status
        }
        
        // Orders list
        val ordersText = if (stop.orders.isNotEmpty()) {
            stop.orders.joinToString("\n") { order ->
                "• ${order.orderNumber} - ${order.customerName} (${order.itemsCount} món)"
            }
        } else {
            "Không có đơn hàng"
        }
        bottomSheetView.findViewById<android.widget.TextView>(R.id.tvOrdersList).text = ordersText
        
        // Button actions
        val btnClose = bottomSheetView.findViewById<android.widget.ImageButton>(R.id.btnClose)
        val btnCancel = bottomSheetView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnCancel)
        val btnComplete = bottomSheetView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnComplete)
        
        btnClose.setOnClickListener { bottomSheetDialog.dismiss() }
        btnCancel.setOnClickListener { bottomSheetDialog.dismiss() }
        
        // Disable complete button if already completed
        if (stop.status == "completed") {
            btnComplete.isEnabled = false
            btnComplete.text = "Đã hoàn thành"
        } else {
            btnComplete.setOnClickListener {
                // Complete the stop
                viewModel.completeStop(
                    stopId = stop.id,
                    latitude = stop.latitude,
                    longitude = stop.longitude,
                    notes = "Hoàn thành từ bản đồ"
                )
                Toast.makeText(requireContext(), "Đã đánh dấu hoàn thành", Toast.LENGTH_SHORT).show()
                bottomSheetDialog.dismiss()
            }
        }
        
        bottomSheetDialog.show()
    }

    private data class MapBounds(
        val center: Point,
        val zoom: Double
    )

    private fun calculateBounds(points: List<Point>): MapBounds {
        if (points.isEmpty()) {
            return MapBounds(
                center = Point.fromLngLat(105.8194, 21.0227),
                zoom = 15.0
            )
        }

        var minLat = points[0].latitude()
        var maxLat = points[0].latitude()
        var minLng = points[0].longitude()
        var maxLng = points[0].longitude()

        points.forEach { point ->
            minLat = minOf(minLat, point.latitude())
            maxLat = maxOf(maxLat, point.latitude())
            minLng = minOf(minLng, point.longitude())
            maxLng = maxOf(maxLng, point.longitude())
        }

        val centerLat = (minLat + maxLat) / 2
        val centerLng = (minLng + maxLng) / 2

        // Calculate zoom level based on bounds
        val latDiff = maxLat - minLat
        val lngDiff = maxLng - minLng
        val maxDiff = maxOf(latDiff, lngDiff)
        
        val zoom = when {
            maxDiff > 0.1 -> 11.0
            maxDiff > 0.05 -> 12.0
            maxDiff > 0.02 -> 13.0
            maxDiff > 0.01 -> 14.0
            else -> 15.0
        }

        return MapBounds(
            center = Point.fromLngLat(centerLng, centerLat),
            zoom = zoom
        )
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
