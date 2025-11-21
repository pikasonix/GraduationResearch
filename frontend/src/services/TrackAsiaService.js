import MapboxTraffic from "mapbox-gl-traffic";

class TrackAsiaService {
    constructor() {
        this.apiKey = this.getApiKey();
        this.baseURL = 'https://api.track-asia.com';
        // Add cache-busting parameter to avoid cached 404 responses
        const cacheBuster = Date.now();
        this.mapStyleURL = `https://maps.track-asia.com/styles/v2/streets.json?v=${cacheBuster}`;
        this.satelliteStyleURL = `https://maps.track-asia.com/styles/v2/satellite.json?v=${cacheBuster}`;
        // Note: Traffic is overlaid on other styles, not a separate style
        this.map = null;
        this.traffic = null;
        this.trafficVisible = true;
        this.markers = [];
        this.currentRoute = null;
        this.currentMapStyle = 'street';
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

    getApiKey() {
        return import.meta.env?.NEXT_TRACK_ASIA_API_KEY ||
            (typeof window !== 'undefined' ? window.NEXT_TRACK_ASIA_API_KEY : undefined) ||
            (typeof process !== 'undefined' ? process.env?.NEXT_TRACK_ASIA_API_KEY : undefined) ||
            'public_key';
    }

    async initializeMap(containerId, options = {}) {
        try {
            if (typeof window.trackasiagl === 'undefined') {
                throw new Error('Track Asia GL JS library not loaded');
            }
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container with id '${containerId}' not found`);
            }
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
            this.map.addControl(new window.trackasiagl.NavigationControl(), 'top-right');
            this.map.addControl(new window.trackasiagl.ScaleControl(), 'bottom-left');
            this.map.addControl(new window.trackasiagl.FullscreenControl(), 'top-right');
            this.traffic = new MapboxTraffic({
                showTraffic: true,
                showIncidents: true,
                trafficSource: 'track-asia-traffic-v1'
            });
            this.map.addControl(this.traffic);
            return this.map;
        } catch (error) {
            console.error('Error initializing Track Asia Map:', error);
            throw error;
        }
    }

    toggleTrafficLayer() {
        if (!this.map) return false;
        // The mapbox-gl-traffic plugin handles the toggling internally.
        this.traffic.toggleTraffic();
        this.trafficVisible = !this.trafficVisible;
        return this.trafficVisible;
    }

    isTrafficVisible() {
        return this.trafficVisible;
    }

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

    displayRoute(route, options = {}) {
        if (!this.map || !route.geometry) return;
        this.clearRoute();
        const routeId = options.id || 'current-route';
        this.map.addSource(routeId, {
            type: 'geojson',
            data: route.geometry
        });
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
        if (options.fitBounds !== false) {
            this.fitToRoute(route);
        }
    }

    clearRoute() {
        if (!this.map || !this.currentRoute) return;
        try {
            this.map.removeLayer(`${this.currentRoute}-line`);
            this.map.removeSource(this.currentRoute);
        } catch (error) {
            // Route already removed or not found
        }
        this.currentRoute = null;
    }

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

    clearMarkers() {
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
    }

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
            const [trafficData, incidents, speedData] = await Promise.allSettled([
                TrafficAPIService.getTrafficData(bounds),
                TrafficAPIService.getTrafficIncidents(bounds),
                TrafficAPIService.getSpeedData([{ id: `segment_${lat}_${lng}`, coordinates: [[lng, lat], [lng + 0.001, lat + 0.001]] }])
            ]);
            const traffic = trafficData.status === 'fulfilled' ? trafficData.value : [];
            const incidentList = incidents.status === 'fulfilled' ? incidents.value : [];
            const speeds = speedData.status === 'fulfilled' ? speedData.value : [];
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

    getVietnameseCities() {
        return this.vietnamCities;
    }

    switchMapStyle(style) {
        if (!this.map) {
            console.warn('Cannot switch map style: map not initialized');
            return;
        }
        // For 'traffic' style, we keep the current base style and ensure traffic layers are visible
        if (style === 'traffic') {
            this.traffic.toggleTraffic();
            return;
        }
        // For other styles (street, satellite), switch the base map style
        const styleUrls = {
            street: `${this.mapStyleURL}?key=${this.apiKey}`,
            satellite: `${this.satelliteStyleURL}?key=${this.apiKey}`
        };
        if (!styleUrls[style]) {
            console.error(`Invalid map style: ${style}. Available styles:`, Object.keys(styleUrls));
            return;
        }
        this.currentMapStyle = style;
        try {
            this.map.setStyle(styleUrls[style]);
        } catch (error) {
            console.error('Error switching map style:', error);
        }
    }

    getCurrentMapStyle() {
        return this.currentMapStyle;
    }

    isValidStyle(style) {
        const validStyles = ['street', 'satellite', 'traffic'];
        return validStyles.includes(style);
    }

    destroy() {
        if (this.map) {
            this.clearMarkers();
            this.clearRoute();
            this.map.remove();
            this.map = null;
        }
    }
}

export default TrackAsiaService;
