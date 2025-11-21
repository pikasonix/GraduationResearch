/**
 * Track Asia Traffic Service - Dịch vụ theo dõi giao thông sử dụng Track Asia Maps API
 * 
 * Track Asia là giải pháp bản đồ số được phát triển tại Việt Nam, tối ưu cho khu vực Đông Nam Á
 * Website: https://track-asia.com/
 * Documentation: https://docs.track-asia.com/
 */

class TrackAsiaTrafficService {
    constructor() {
        // Get API key from environment variables (browser-compatible)
        this.apiKey = this.getApiKey();
        this.baseURL = 'https://api.track-asia.com';

        // Add cache-busting parameter to avoid cached 404 responses
        const cacheBuster = Date.now();
        this.mapStyleURL = `https://maps.track-asia.com/styles/v2/streets.json?v=${cacheBuster}`;
        this.satelliteStyleURL = `https://maps.track-asia.com/styles/v2/satellite.json?v=${cacheBuster}`;
        // Note: Traffic is overlaid on other styles, not a separate style

        // Track Asia GL JS instance
        this.map = null;
        this.trafficLayer = null;
        this.trafficVisible = true;
        this.markers = [];
        this.currentRoute = null;
        this.currentMapStyle = 'street';

        // Vietnamese city centers for quick navigation
        this.vietnamCities = [
            { name: 'Hồ Chí Minh', lat: 10.762622, lng: 106.660172 },
            { name: 'Hà Nội', lat: 21.028511, lng: 105.804817 },
            { name: 'Đà Nẵng', lat: 16.047079, lng: 108.206230 },
            { name: 'Cần Thơ', lat: 10.045162, lng: 105.746857 },
            { name: 'Hải Phòng', lat: 20.844912, lng: 106.687972 },
            { name: 'Nha Trang', lat: 12.238791, lng: 109.196749 },
            { name: 'Huế', lat: 16.463713, lng: 107.590866 },
            { name: 'Vũng Tàu', lat: 10.346212, lng: 107.084282 }
        ];
    }

    /**
     * Get API key from environment variables with fallback
     */
    getApiKey() {
        // Prefer Vite env var (NEXT_TRACK_ASIA_API_KEY). Fall back to REACT_APP_* for legacy.
        try {
            if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.NEXT_TRACK_ASIA_API_KEY) {
                console.log('Using Track Asia API key from import.meta.env.NEXT_TRACK_ASIA_API_KEY');
                return import.meta.env.NEXT_TRACK_ASIA_API_KEY;
            }
        } catch (e) { /* ignore in non-Vite env */ }

        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.REACT_APP_TRACK_ASIA_API_KEY) {
            console.log('Using Track Asia API key from import.meta.env.REACT_APP_TRACK_ASIA_API_KEY');
            return import.meta.env.REACT_APP_TRACK_ASIA_API_KEY;
        }

        // Try window object (if set manually)
        if (typeof window !== 'undefined') {
            if (window.NEXT_TRACK_ASIA_API_KEY) {
                console.log('Using Track Asia API key from window.NEXT_TRACK_ASIA_API_KEY');
                return window.NEXT_TRACK_ASIA_API_KEY;
            }
            if (window.REACT_APP_TRACK_ASIA_API_KEY) {
                console.log('Using Track Asia API key from window.REACT_APP_TRACK_ASIA_API_KEY');
                return window.REACT_APP_TRACK_ASIA_API_KEY;
            }
        }

        // Server-side env fallback
        if (typeof process !== 'undefined' && process.env) {
            if (process.env.NEXT_TRACK_ASIA_API_KEY) {
                console.log('Using Track Asia API key from process.env.NEXT_TRACK_ASIA_API_KEY');
                return process.env.NEXT_TRACK_ASIA_API_KEY;
            }
            if (process.env.REACT_APP_TRACK_ASIA_API_KEY) {
                console.log('Using Track Asia API key from process.env.REACT_APP_TRACK_ASIA_API_KEY');
                return process.env.REACT_APP_TRACK_ASIA_API_KEY;
            }
        }

        // Fallback to public key for development/demo
        console.warn('Track Asia API key not found in environment variables, using public key for demo');
        return 'public_key';
    }

    /**
     * Initialize Track Asia Map
     */
    async initializeMap(containerId, options = {}) {
        try {
            // Check if Track Asia GL JS is loaded
            if (typeof window.trackasiagl === 'undefined') {
                throw new Error('Track Asia GL JS library not loaded');
            }

            // Ensure container exists and has dimensions
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container with id '${containerId}' not found`);
            }

            // Set container styles to ensure proper dimensions
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'relative';
            container.style.overflow = 'hidden';

            const defaultOptions = {
                container: containerId,
                style: `${this.mapStyleURL}?key=${this.apiKey}`,
                center: [105.8194, 21.0227], // Hai Bà Trưng, Hà Nội
                zoom: 10,
                pitch: 0,
                bearing: 0,
                // Add these options to ensure proper rendering
                preserveDrawingBuffer: true,
                antialias: true
            };

            const mapOptions = { ...defaultOptions, ...options };
            this.map = new window.trackasiagl.Map(mapOptions);

            // Wait for map to load
            await new Promise((resolve, reject) => {
                this.map.on('load', () => {
                    // Force resize after load to ensure proper dimensions
                    setTimeout(() => {
                        this.map.resize();
                        resolve();
                    }, 100);
                });
                this.map.on('error', reject);
            });

            // Add navigation controls
            this.map.addControl(new window.trackasiagl.NavigationControl(), 'top-right');

            // Add scale control
            this.map.addControl(new window.trackasiagl.ScaleControl(), 'bottom-left');

            // Add fullscreen control
            this.map.addControl(new window.trackasiagl.FullscreenControl(), 'top-right');

            console.log('Track Asia Map initialized successfully');
            return this.map;

        } catch (error) {
            console.error('Error initializing Track Asia Map:', error);
            throw error;
        }
    }

    /**
     * Add traffic layer to the map
     */
    async addTrafficLayer() {
        if (!this.map) {
            throw new Error('Map not initialized');
        }

        try {
            console.log('Initializing traffic layer system...');

            // Track Asia does not have traffic tiles
            // Traffic data will be loaded from HERE API and displayed as GeoJSON layers
            console.log('Traffic layer system ready - waiting for traffic data from HERE API');

            // Initially add demo traffic data for demonstration
            this.addDemoTrafficData();

        } catch (error) {
            console.error('Error initializing traffic layer:', error);
            this.addDemoTrafficData();
        }
    }

    /**
     * Add demo traffic data for demonstration
     */
    addDemoTrafficData() {
        if (!this.map) return;

        const demoRoutes = [
            {
                id: 'route-1',
                coordinates: [[105.810000, 21.020000], [105.830000, 21.030000]],
                congestion: 'heavy',
                name: 'Đường Nguyễn Trãi'
            },
            {
                id: 'route-2',
                coordinates: [[105.820000, 21.025000], [105.840000, 21.035000]],
                congestion: 'moderate',
                name: 'Đường Lê Duẩn'
            },
            {
                id: 'route-3',
                coordinates: [[105.815000, 21.015000], [105.835000, 21.025000]],
                congestion: 'light',
                name: 'Đường Hai Bà Trưng'
            },
            {
                id: 'route-4',
                coordinates: [[105.825000, 21.030000], [105.845000, 21.040000]],
                congestion: 'free',
                name: 'Đường Láng'
            }
        ];

        demoRoutes.forEach((route, index) => {
            this.map.addSource(`demo-traffic-${index}`, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {
                        congestion: route.congestion,
                        name: route.name
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: route.coordinates
                    }
                }
            });

            this.map.addLayer({
                id: `demo-traffic-layer-${index}`,
                type: 'line',
                source: `demo-traffic-${index}`,
                paint: {
                    'line-color': route.congestion === 'heavy' ? '#d73027' :
                        route.congestion === 'moderate' ? '#fc8d59' :
                            route.congestion === 'low' ? '#fee08b' : '#91bfdb',
                    'line-width': 6,
                    'line-opacity': 0.8
                }
            });
        });

        console.log('Demo traffic data added');
    }

    /**
     * Toggle traffic layer visibility
     */
    toggleTrafficLayer() {
        if (!this.map) return false;

        try {
            let hasTrafficLayers = false;
            const layers = this.map.getStyle().layers;

            // Toggle all traffic layers (both real and demo)
            layers.forEach(layer => {
                if (layer.id.includes('real-traffic-layer') ||
                    layer.id.includes('demo-traffic-layer') ||
                    layer.id === 'traffic-layer') {
                    hasTrafficLayers = true;
                    const visibility = this.map.getLayoutProperty(layer.id, 'visibility');
                    const newVisibility = visibility === 'none' ? 'visible' : 'none';
                    this.map.setLayoutProperty(layer.id, 'visibility', newVisibility);
                    this.trafficVisible = newVisibility === 'visible';
                }
            });

            if (hasTrafficLayers) {
                console.log('Traffic layers visibility:', this.trafficVisible ? 'visible' : 'hidden');
                return this.trafficVisible;
            } else {
                console.log('No traffic layers found, adding demo traffic');
                this.addDemoTrafficData();
                this.trafficVisible = true;
                return true;
            }

        } catch (error) {
            console.error('Error toggling traffic layer:', error);
            return false;
        }
    }

    /**
     * Check if traffic layers are visible
     */
    isTrafficVisible() {
        return this.trafficVisible;
    }

    /**
     * Force refresh traffic layers
     */
    async refreshTrafficLayers() {
        if (!this.map) return;

        console.log('Refreshing traffic layers...');

        // Remove existing traffic layers
        try {
            if (this.trafficLayer && this.map.getLayer(this.trafficLayer)) {
                this.map.removeLayer(this.trafficLayer);
                this.map.removeSource('traffic');
            }

            // Remove demo layers
            const layers = this.map.getStyle().layers;
            layers.forEach(layer => {
                if (layer.id.includes('demo-traffic-layer')) {
                    this.map.removeLayer(layer.id);
                    this.map.removeSource(layer.id.replace('demo-traffic-layer-', 'demo-traffic-'));
                }
            });
        } catch (error) {
            console.log('No existing traffic layers to remove');
        }

        // Re-add traffic layers
        await this.addTrafficLayer();
    }

    /**
     * Search for places using Track Asia Autocomplete API
     */
    async searchPlaces(query, options = {}) {
        try {
            const params = new URLSearchParams({
                q: query,
                key: this.apiKey,
                limit: options.limit || 5,
                country: 'VN', // Focus on Vietnam
                ...options
            });

            const response = await fetch(`${this.baseURL}/v2/autocomplete?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.features || [];

        } catch (error) {
            console.error('Error searching places:', error);
            // Return demo data for development
            return this.getDemoSearchResults(query);
        }
    }

    /**
     * Get demo search results for testing
     */
    getDemoSearchResults(query) {
        const demoResults = [
            {
                place_name: 'Quận 1, Thành phố Hồ Chí Minh',
                center: [106.700429, 10.776889],
                place_type: ['district']
            },
            {
                place_name: 'Sân bay Tân Sơn Nhất, Thành phố Hồ Chí Minh',
                center: [106.658889, 10.815833],
                place_type: ['airport']
            },
            {
                place_name: 'Chợ Bến Thành, Quận 1, Thành phố Hồ Chí Minh',
                center: [106.698394, 10.772479],
                place_type: ['market']
            }
        ];

        return demoResults.filter(result =>
            result.place_name.toLowerCase().includes(query.toLowerCase())
        );
    }

    /**
     * Calculate route between two points
     */
    async calculateRoute(start, end, options = {}) {
        try {
            const params = new URLSearchParams({
                key: this.apiKey,
                alternatives: options.alternatives || true,
                steps: true,
                geometries: 'geojson',
                annotations: 'duration,distance,speed'
            });

            const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
            const response = await fetch(`${this.baseURL}/v2/directions/driving/${coordinates}?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.routes || [];

        } catch (error) {
            console.error('Error calculating route:', error);
            // Return demo route for development
            return this.getDemoRoute(start, end);
        }
    }

    /**
     * Get demo route for testing
     */
    getDemoRoute(start, end) {
        return [{
            geometry: {
                type: 'LineString',
                coordinates: [
                    [start.lng, start.lat],
                    [(start.lng + end.lng) / 2, (start.lat + end.lat) / 2],
                    [end.lng, end.lat]
                ]
            },
            duration: 1800, // 30 minutes
            distance: 15000, // 15 km
            legs: [{
                duration: 1800,
                distance: 15000,
                summary: 'Demo route'
            }]
        }];
    }

    /**
     * Add route to map
     */
    displayRoute(route, options = {}) {
        if (!this.map || !route.geometry) return;

        // Remove existing route
        this.clearRoute();

        const routeId = options.id || 'current-route';

        // Add route source
        this.map.addSource(routeId, {
            type: 'geojson',
            data: route.geometry
        });

        // Add route layer
        this.map.addLayer({
            id: `${routeId}-line`,
            type: 'line',
            source: routeId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': options.color || '#007cbf',
                'line-width': options.width || 8,
                'line-opacity': 0.8
            }
        });

        this.currentRoute = routeId;

        // Fit map to route bounds
        if (options.fitBounds !== false) {
            this.fitToRoute(route);
        }
    }

    /**
     * Clear current route from map
     */
    clearRoute() {
        if (!this.map || !this.currentRoute) return;

        try {
            this.map.removeLayer(`${this.currentRoute}-line`);
            this.map.removeSource(this.currentRoute);
        } catch (error) {
            console.log('Route already removed or not found');
        }

        this.currentRoute = null;
    }

    /**
     * Fit map view to route bounds
     */
    fitToRoute(route) {
        if (!this.map || !route.geometry || !route.geometry.coordinates) return;

        const coordinates = route.geometry.coordinates;
        const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new window.trackasiagl.LngLatBounds(coordinates[0], coordinates[0]));

        this.map.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15
        });
    }

    /**
     * Add marker to map
     */
    addMarker(coordinates, options = {}) {
        if (!this.map) return null;

        const marker = new window.trackasiagl.Marker(options)
            .setLngLat([coordinates.lng, coordinates.lat])
            .addTo(this.map);

        if (options.popup) {
            const popup = new window.trackasiagl.Popup()
                .setHTML(options.popup);
            marker.setPopup(popup);
        }

        this.markers.push(marker);
        return marker;
    }

    /**
     * Clear all markers
     */
    clearMarkers() {
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
    }

    /**
     * Navigate to Vietnam city
     */
    navigateToCity(cityName) {
        const city = this.vietnamCities.find(c => c.name.toLowerCase().includes(cityName.toLowerCase()));
        if (city && this.map) {
            this.map.flyTo({
                center: [city.lng, city.lat],
                zoom: 12,
                duration: 2000
            });
            return city;
        }
        return null;
    }

    /**
     * Get current traffic conditions for a location
     */
    async getTrafficConditions(lat, lng) {
        try {
            // Import TrafficAPIService dynamically to avoid circular dependencies
            const TrafficAPIService = (await import('./TrafficAPIService')).default;

            // Define bounds around the location (roughly 1km radius)
            const bounds = [
                lat - 0.01, // south
                lng - 0.01, // west  
                lat + 0.01, // north
                lng + 0.01  // east
            ];

            // Get real traffic data from TrafficAPIService
            const [trafficData, incidents, speedData] = await Promise.allSettled([
                TrafficAPIService.getTrafficData(bounds),
                TrafficAPIService.getTrafficIncidents(bounds),
                TrafficAPIService.getSpeedData([{
                    id: `segment_${lat}_${lng}`,
                    coordinates: [[lng, lat], [lng + 0.001, lat + 0.001]]
                }])
            ]);

            // Process the results
            const traffic = trafficData.status === 'fulfilled' ? trafficData.value : [];
            const incidentList = incidents.status === 'fulfilled' ? incidents.value : [];
            const speeds = speedData.status === 'fulfilled' ? speedData.value : [];

            // Display traffic data on map if available
            if (traffic.length > 0) {
                console.log('Displaying traffic data on map:', traffic.length, 'segments');
                await this.addRealTrafficData(traffic);
            } else {
                console.log('No traffic data available, using demo data');
                this.addDemoTrafficData();
            }

            // Calculate average congestion and speed
            let congestionLevel = 'free';
            let currentSpeed = 50;
            let freeFlowSpeed = 60;

            if (traffic.length > 0) {
                // Get the first traffic segment data
                const segment = traffic[0];
                congestionLevel = segment.congestionLevel || 'free';
                currentSpeed = segment.currentSpeed || 50;
                freeFlowSpeed = segment.maxSpeed || 60;
            } else if (speeds.length > 0) {
                // Use speed data to determine congestion
                const speed = speeds[0].speed;
                if (speed !== null) {
                    currentSpeed = speed;
                    if (speed < 20) congestionLevel = 'heavy';
                    else if (speed < 35) congestionLevel = 'moderate';
                    else if (speed < 45) congestionLevel = 'light';
                    else congestionLevel = 'free';
                }
            }

            // Calculate travel time based on speed
            const currentTravelTime = freeFlowSpeed > 0 ? Math.round((3600 * freeFlowSpeed) / Math.max(currentSpeed, 5)) : 1800;
            const freeFlowTravelTime = 1200; // 20 minutes in free flow

            return {
                location: { lat, lng },
                congestion: congestionLevel,
                speed: {
                    current: Math.round(currentSpeed),
                    freeFlow: Math.round(freeFlowSpeed),
                    ratio: freeFlowSpeed > 0 ? (currentSpeed / freeFlowSpeed) : 1
                },
                travelTime: {
                    current: currentTravelTime,
                    freeFlow: freeFlowTravelTime
                },
                incidents: incidentList.map(incident => ({
                    type: incident.type,
                    description: incident.description,
                    severity: incident.severity
                })),
                lastUpdated: new Date().toISOString(),
                dataSource: 'TrafficAPIService'
            };

        } catch (error) {
            console.error('Error getting traffic conditions:', error);

            // Fallback to demo data only if API fails
            return {
                location: { lat, lng },
                congestion: 'moderate',
                speed: {
                    current: 25,
                    freeFlow: 40,
                    ratio: 0.625
                },
                travelTime: {
                    current: 1800,
                    freeFlow: 1200
                },
                incidents: [
                    {
                        type: 'construction',
                        description: 'Thông tin giao thông không khả dụng - sử dụng dữ liệu mẫu',
                        severity: 'moderate'
                    }
                ],
                lastUpdated: new Date().toISOString(),
                dataSource: 'demo'
            };
        }
    }

    /**
     * Get available Vietnam cities
     */
    getVietnameseCities() {
        return this.vietnamCities;
    }

    /**
     * Switch map style
     */
    switchMapStyle(style) {
        if (!this.map) {
            console.warn('Cannot switch map style: map not initialized');
            return;
        }

        console.log('Switching map style to:', style);

        // For 'traffic' style, we keep the current base style and ensure traffic layers are visible
        if (style === 'traffic') {
            console.log('Traffic mode activated - showing traffic layers on current base style');

            // Make sure traffic layers are visible
            this.trafficVisible = true;

            // Show main traffic layer if it exists
            if (this.trafficLayer && this.map.getLayer(this.trafficLayer)) {
                try {
                    this.map.setLayoutProperty(this.trafficLayer, 'visibility', 'visible');
                    console.log('Main traffic layer made visible');
                } catch (error) {
                    console.warn('Error showing main traffic layer:', error);
                }
            }

            // Show demo traffic layers if they exist
            try {
                const layers = this.map.getStyle().layers;
                let demoLayersFound = 0;

                layers.forEach(layer => {
                    if (layer.id.includes('demo-traffic-layer')) {
                        this.map.setLayoutProperty(layer.id, 'visibility', 'visible');
                        demoLayersFound++;
                    }
                });

                if (demoLayersFound > 0) {
                    console.log(`Made ${demoLayersFound} demo traffic layers visible`);
                } else {
                    console.log('No demo traffic layers found');
                }
            } catch (error) {
                console.warn('Error showing demo traffic layers:', error);
            }

            // Don't change the base map style - just return
            return;
        }

        // For other styles (street, satellite), switch the base map style
        const styleUrls = {
            street: `${this.mapStyleURL}?key=${this.apiKey}`,
            satellite: `${this.satelliteStyleURL}?key=${this.apiKey}`
        };

        // Ensure we only use valid styles
        if (!styleUrls[style]) {
            console.error(`Invalid map style: ${style}. Available styles:`, Object.keys(styleUrls));
            return;
        }

        console.log('Switching base map style to:', style, 'URL:', styleUrls[style]);
        this.currentMapStyle = style;

        // Store current traffic visibility state
        const wasTrafficVisible = this.trafficVisible;

        try {
            this.map.setStyle(styleUrls[style]);

            // Re-add traffic layers after style change
            this.map.once('styledata', () => {
                console.log('New style loaded, re-adding traffic layers...');
                setTimeout(() => {
                    this.addTrafficLayer().then(() => {
                        // Restore traffic visibility
                        if (!wasTrafficVisible) {
                            console.log('Restoring traffic visibility to hidden');
                            this.toggleTrafficLayer();
                        } else {
                            console.log('Traffic layers restored and visible');
                        }
                    }).catch(error => {
                        console.error('Error re-adding traffic layers:', error);
                    });
                }, 100);
            });
        } catch (error) {
            console.error('Error switching map style:', error);
        }
    }

    /**
     * Get current map style
     */
    getCurrentMapStyle() {
        return this.currentMapStyle;
    }

    /**
     * Check if style is valid
     */
    isValidStyle(style) {
        const validStyles = ['street', 'satellite', 'traffic'];
        return validStyles.includes(style);
    }

    /**
     * Destroy map instance
     */
    destroy() {
        if (this.map) {
            this.clearMarkers();
            this.clearRoute();
            this.map.remove();
            this.map = null;
        }
    }

    /**
     * Add traffic data from HERE API to the map
     */
    async addRealTrafficData(trafficData) {
        if (!this.map || !trafficData || trafficData.length === 0) {
            console.log('No traffic data to display');
            return;
        }

        try {
            console.log('Adding real traffic data to map:', trafficData.length, 'segments');

            // Clear existing traffic layers first
            this.clearTrafficLayers();

            trafficData.forEach((segment, index) => {
                if (!segment.coordinates || segment.coordinates.length < 2) {
                    console.warn('Invalid coordinates for segment:', segment);
                    return;
                }

                const sourceId = `real-traffic-${index}`;
                const layerId = `real-traffic-layer-${index}`;

                // Add traffic source
                this.map.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {
                            congestion: segment.congestionLevel || 'unknown',
                            name: segment.name || 'Unknown Road',
                            speed: segment.currentSpeed || 0,
                            maxSpeed: segment.maxSpeed || 50
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: segment.coordinates
                        }
                    }
                });

                // Add traffic layer
                this.map.addLayer({
                    id: layerId,
                    type: 'line',
                    source: sourceId,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': this.getTrafficColor(segment.congestionLevel),
                        'line-width': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            10, 3,
                            14, 6,
                            18, 12
                        ],
                        'line-opacity': 0.8
                    }
                });

                // Add popup on click
                this.map.on('click', layerId, (e) => {
                    const coordinates = e.lngLat;
                    const properties = e.features[0].properties;

                    const popupContent = `
                        <div class="traffic-popup">
                            <h3 style="margin: 0 0 8px 0; font-weight: bold;">${properties.name}</h3>
                            <p style="margin: 4px 0;"><strong>Tình trạng:</strong> ${this.getCongestionText(properties.congestion)}</p>
                            <p style="margin: 4px 0;"><strong>Tốc độ hiện tại:</strong> ${properties.speed} km/h</p>
                            <p style="margin: 4px 0;"><strong>Tốc độ tối đa:</strong> ${properties.maxSpeed} km/h</p>
                        </div>
                    `;

                    // Use the normalized global exposed by the loader (window.trackasiagl)
                    const PopupConstructor = (window.trackasiagl && window.trackasiagl.Popup) ? window.trackasiagl.Popup : (window.trackAsiaGL && window.trackAsiaGL.Popup) ? window.trackAsiaGL.Popup : null;
                    if (PopupConstructor) {
                        new PopupConstructor()
                            .setLngLat(coordinates)
                            .setHTML(popupContent)
                            .addTo(this.map);
                    } else {
                        console.warn('Popup constructor not available on global trackasia object');
                    }
                });

                // Change cursor on hover
                this.map.on('mouseenter', layerId, () => {
                    this.map.getCanvas().style.cursor = 'pointer';
                });

                this.map.on('mouseleave', layerId, () => {
                    this.map.getCanvas().style.cursor = '';
                });
            });

            this.trafficVisible = true;
            console.log('Real traffic data displayed successfully');

        } catch (error) {
            console.error('Error adding real traffic data:', error);
        }
    }

    /**
     * Get traffic color based on congestion level
     */
    getTrafficColor(congestionLevel) {
        const colors = {
            'free': '#4CAF50',      // Green - thông thoáng
            'light': '#FFC107',     // Yellow - chậm nhẹ
            'moderate': '#FF9800',  // Orange - tắc vừa  
            'heavy': '#F44336',     // Red - tắc nặng
            'unknown': '#9E9E9E'    // Gray - không xác định
        };
        return colors[congestionLevel] || colors['unknown'];
    }

    /**
     * Get congestion text in Vietnamese
     */
    getCongestionText(congestionLevel) {
        const texts = {
            'free': 'Thông thoáng',
            'light': 'Chậm nhẹ',
            'moderate': 'Tắc vừa',
            'heavy': 'Tắc nặng',
            'unknown': 'Không xác định'
        };
        return texts[congestionLevel] || texts['unknown'];
    }

    /**
     * Clear all traffic layers
     */
    clearTrafficLayers() {
        if (!this.map) return;

        try {
            const layers = this.map.getStyle().layers;
            const sources = this.map.getStyle().sources;

            // Remove real traffic layers
            layers.forEach(layer => {
                if (layer.id.includes('real-traffic-layer') ||
                    layer.id.includes('demo-traffic-layer') ||
                    layer.id === 'traffic-layer') {
                    try {
                        this.map.removeLayer(layer.id);
                    } catch (e) {
                        console.warn('Layer already removed:', layer.id);
                    }
                }
            });

            // Remove traffic sources
            Object.keys(sources).forEach(sourceId => {
                if (sourceId.includes('real-traffic') ||
                    sourceId.includes('demo-traffic') ||
                    sourceId === 'traffic') {
                    try {
                        this.map.removeSource(sourceId);
                    } catch (e) {
                        console.warn('Source already removed:', sourceId);
                    }
                }
            });

            console.log('Traffic layers cleared');
        } catch (error) {
            console.error('Error clearing traffic layers:', error);
        }
    }
}

export default TrackAsiaTrafficService;
