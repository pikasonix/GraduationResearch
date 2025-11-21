/**
 * IMPORTANT NOTE: TRACK ASIA DOES NOT HAVE TRAFFIC API!
 * 
 * Track Asia only provides:
 * ✅ Maps JavaScript API
 * ✅ Geocoding API  
 * ✅ Routing API
 * ✅ Autocomplete API
 * ❌ NO Traffic API
 * 
 * This service integrates with EXTERNAL traffic APIs:
 * - Mapbox Traffic API (requires token)
 * - HERE Traffic API (requires API key)
 * - Sample data generation (free fallback)
 * 
 * For real traffic data in Vietnam, you need to:
 * 1. Get Mapbox token: https://mapbox.com/pricing
 * 2. Or get HERE API key: https://developer.here.com/pricing
 * 3. Or use sample data for demo purposes
 */

// TrafficAPI Service - Integrates with REAL traffic data sources for Vietnam

class TrafficAPIService {
    constructor() {
        // Real traffic APIs that work in Vietnam
        this.mapboxToken = import.meta.env?.REACT_APP_MAPBOX_TOKEN || window.env?.REACT_APP_MAPBOX_TOKEN;
        this.hereAPIKey = import.meta.env?.REACT_APP_HERE_API_KEY || window.env?.REACT_APP_HERE_API_KEY;
        this.hereAppId = import.meta.env?.REACT_APP_HERE_APP_ID || window.env?.REACT_APP_HERE_APP_ID;
        this.useSampleTraffic = import.meta.env?.REACT_APP_USE_SAMPLE_TRAFFIC === 'true';

        console.log('TrafficAPIService initialized:');
        console.log('- HERE API Key:', this.hereAPIKey ? '✅ Available' : '❌ Missing');
        console.log('- HERE App ID:', this.hereAppId ? '✅ Available' : '❌ Missing');
        console.log('- Mapbox Token:', this.mapboxToken ? '✅ Available' : '❌ Missing');
        console.log('- Use Sample Traffic:', this.useSampleTraffic);

        // Vietnam traffic data sources
        this.vietnamAPIs = {
            mapbox: 'https://api.mapbox.com/traffic/v1',
            here: 'https://traffic.ls.hereapi.com/traffic/6.3',
            tomtom: 'https://api.tomtom.com/traffic/services/4'
        };
    }

    // Get traffic data for a specific area
    async getTrafficData(bounds) {
        try {
            console.log('Fetching traffic data for bounds:', bounds);

            // Check if we should use sample data
            if (this.useSampleTraffic) {
                console.log('Using sample traffic data (REACT_APP_USE_SAMPLE_TRAFFIC=true)');
                return this.generateSampleTrafficData(bounds);
            }

            // Try real APIs in order of preference
            const trafficSources = [];

            if (this.mapboxToken) {
                trafficSources.push(this.getMapboxTrafficData(bounds));
            }

            if (this.hereAPIKey) {
                trafficSources.push(this.getHereTrafficData(bounds));
            }

            if (trafficSources.length === 0) {
                console.warn('No traffic API keys configured, using sample data');
                return this.generateSampleTrafficData(bounds);
            }

            const results = await Promise.allSettled(trafficSources);

            const successfulResults = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value)
                .filter(data => data && data.length > 0);

            if (successfulResults.length > 0) {
                const mergedData = this.mergeTrafficData(successfulResults);
                console.log('Real traffic data fetched successfully:', mergedData.length, 'segments');
                return mergedData;
            } else {
                console.warn('All traffic APIs failed, using sample data');
                return this.generateSampleTrafficData(bounds);
            }

        } catch (error) {
            console.error('Error fetching traffic data:', error);
            return this.generateSampleTrafficData(bounds);
        }
    }

    // Mapbox Traffic API (REAL API - works in Vietnam)
    async getMapboxTrafficData(bounds) {
        if (!this.mapboxToken) {
            console.warn('Mapbox token not available');
            return [];
        }

        try {
            const response = await fetch(
                `https://api.mapbox.com/traffic/v1/traffic-tiles?access_token=${this.mapboxToken}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch Mapbox traffic data');
            }

            return await response.json();
        } catch (error) {
            console.warn('Mapbox traffic data unavailable:', error);
            return [];
        }
    }

    // HERE Traffic API (REAL API - excellent coverage for Vietnam)
    async getHereTrafficData(bounds) {
        if (!this.hereAPIKey) {
            console.warn('HERE API key not available');
            return [];
        }

        try {
            console.log('Fetching HERE traffic data for bounds:', bounds);
            const [south, west, north, east] = bounds;

            // HERE Traffic API v8 format for Vietnam
            const bbox = `${west},${south},${east},${north}`;
            const url = `https://traffic.ls.hereapi.com/traffic/6.3/flow.json?bbox=${bbox}&apikey=${this.hereAPIKey}`;

            console.log('HERE API URL:', url);

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HERE API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('HERE traffic data received:', data);
            return this.parseHereTrafficData(data);
        } catch (error) {
            console.warn('HERE traffic data unavailable:', error);
            return [];
        }
    }

    // Get traffic incidents
    async getTrafficIncidents(bounds) {
        try {
            console.log('Fetching traffic incidents for bounds:', bounds);

            const [incidents, roadworks] = await Promise.allSettled([
                this.getTrafficAccidents(bounds),
                this.getRoadworks(bounds)
            ]);

            const allIncidents = [
                ...(incidents.status === 'fulfilled' ? incidents.value : []),
                ...(roadworks.status === 'fulfilled' ? roadworks.value : [])
            ];

            console.log('Traffic incidents fetched:', allIncidents.length, 'incidents');
            return allIncidents;
        } catch (error) {
            console.error('Error fetching traffic incidents:', error);
            return [];
        }
    }

    // Get traffic accidents
    async getTrafficAccidents(bounds) {
        try {
            // In real implementation, integrate with local traffic authorities APIs
            // For Vietnam: CSGT, VTC, VTV, etc.
            const response = await fetch('/api/traffic/accidents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bounds })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch traffic accidents');
            }

            return await response.json();
        } catch (error) {
            console.warn('Traffic accidents data unavailable:', error);
            return this.generateSampleIncidents(bounds, 'accident');
        }
    }

    // Get roadworks information
    async getRoadworks(bounds) {
        try {
            const response = await fetch('/api/traffic/roadworks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bounds })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch roadworks data');
            }

            return await response.json();
        } catch (error) {
            console.warn('Roadworks data unavailable:', error);
            return this.generateSampleIncidents(bounds, 'roadwork');
        }
    }

    // Get real-time speed data
    async getSpeedData(roadSegments) {
        try {
            console.log('Fetching speed data for', roadSegments.length, 'segments');

            // Integrate with Track Asia, TomTom, or local traffic APIs
            const speedPromises = roadSegments.map(segment =>
                this.getSegmentSpeed(segment)
            );

            const speeds = await Promise.allSettled(speedPromises);
            const results = speeds.map((result, index) => ({
                segmentId: roadSegments[index].id,
                speed: result.status === 'fulfilled' ? result.value : null,
                timestamp: new Date(),
                status: result.status
            }));

            console.log('Speed data results:', results);
            return results;
        } catch (error) {
            console.error('Error fetching speed data:', error);
            return [];
        }
    }

    // Get speed for specific road segment
    async getSegmentSpeed(segment) {
        try {
            // Example: Using OSRM for route calculation and speed estimation
            const coordinates = segment.coordinates.map(coord => coord.reverse()).join(';');
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch segment speed');
            }

            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const speedKmh = (route.distance / 1000) / (route.duration / 3600);
                return Math.round(speedKmh);
            }

            return null;
        } catch (error) {
            console.warn('Segment speed unavailable:', error);
            return null;
        }
    }

    // Weather impact on traffic
    async getWeatherImpact(location) {
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lng}&appid=${process.env.REACT_APP_OPENWEATHER_API_KEY}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch weather data');
            }

            const weather = await response.json();
            return this.calculateWeatherImpact(weather);
        } catch (error) {
            console.warn('Weather data unavailable:', error);
            return { impact: 'none', severity: 0 };
        }
    }

    // Helper methods
    mergeTrafficData(dataSources) {
        const mergedData = [];
        const seenSegments = new Set();

        dataSources.forEach(source => {
            if (Array.isArray(source)) {
                source.forEach(segment => {
                    const segmentKey = `${segment.coordinates[0][0]}_${segment.coordinates[0][1]}`;
                    if (!seenSegments.has(segmentKey)) {
                        mergedData.push(segment);
                        seenSegments.add(segmentKey);
                    }
                });
            }
        });

        return mergedData;
    }

    parseHereTrafficData(data) {
        if (!data.RWS || !data.RWS[0] || !data.RWS[0].RW) {
            return [];
        }

        return data.RWS[0].RW.flatMap(roadway => {
            if (!roadway.FIS || !roadway.FIS[0] || !roadway.FIS[0].FI) {
                return [];
            }

            return roadway.FIS[0].FI.map(flowItem => ({
                id: `here_${flowItem.TMC.PC}`,
                name: flowItem.TMC.DE || 'Unknown Road',
                coordinates: this.parseHereGeometry(flowItem.SHP),
                currentSpeed: flowItem.CF ? flowItem.CF[0].SP : 0,
                maxSpeed: flowItem.CF ? flowItem.CF[0].SU : 50,
                congestionLevel: this.categorizeSpeed(
                    flowItem.CF ? flowItem.CF[0].SP : 0,
                    flowItem.CF ? flowItem.CF[0].SU : 50
                ),
                travelTime: flowItem.CF ? flowItem.CF[0].TY : 0,
                incidents: [],
                lastUpdate: new Date(),
                source: 'HERE'
            }));
        });
    }

    parseHereGeometry(shapePoints) {
        if (!shapePoints || !shapePoints[0] || !shapePoints[0].value) {
            return [];
        }

        const points = shapePoints[0].value[0].split(' ');
        const coordinates = [];

        for (let i = 0; i < points.length; i += 2) {
            if (points[i] && points[i + 1]) {
                coordinates.push([
                    parseFloat(points[i]),
                    parseFloat(points[i + 1])
                ]);
            }
        }

        return coordinates;
    }

    categorizeSpeed(currentSpeed, maxSpeed) {
        if (!currentSpeed || !maxSpeed) return 'unknown';

        const ratio = currentSpeed / maxSpeed;

        if (ratio >= 0.8) return 'free';
        if (ratio >= 0.6) return 'light';
        if (ratio >= 0.4) return 'moderate';
        return 'heavy';
    }

    calculateWeatherImpact(weather) {
        const conditions = weather.weather[0].main.toLowerCase();
        const visibility = weather.visibility / 1000; // Convert to km
        const windSpeed = weather.wind?.speed || 0;

        let impact = 'none';
        let severity = 0;

        if (conditions.includes('rain') || conditions.includes('storm')) {
            impact = 'rain';
            severity = 0.3;
        }

        if (conditions.includes('snow') || conditions.includes('blizzard')) {
            impact = 'snow';
            severity = 0.6;
        }

        if (conditions.includes('fog') || visibility < 1) {
            impact = 'fog';
            severity = Math.max(severity, 0.4);
        }

        if (windSpeed > 15) {
            impact = 'wind';
            severity = Math.max(severity, 0.2);
        }

        return { impact, severity };
    }

    generateSampleTrafficData(bounds) {
        console.log('Generating sample traffic data for bounds:', bounds);

        // Generate sample data for Vietnam major cities
        const vietnamRoads = [
            {
                id: 'vn_sample_1',
                name: 'Đại lộ Thăng Long',
                coordinates: [[bounds[1] + 0.001, bounds[0] + 0.001], [bounds[3] - 0.001, bounds[2] - 0.001]],
                currentSpeed: Math.round(25 + Math.random() * 20),
                maxSpeed: 60,
                congestionLevel: Math.random() > 0.5 ? 'moderate' : 'heavy',
                travelTime: Math.round(8 + Math.random() * 5),
                incidents: Math.random() > 0.7 ? ['construction'] : [],
                lastUpdate: new Date(),
                source: 'simulated'
            },
            {
                id: 'vn_sample_2',
                name: 'Phố Huế',
                coordinates: [[bounds[1] + 0.002, bounds[0] + 0.002], [bounds[3] - 0.002, bounds[2] - 0.002]],
                currentSpeed: Math.round(30 + Math.random() * 15),
                maxSpeed: 50,
                congestionLevel: Math.random() > 0.3 ? 'light' : 'free',
                travelTime: Math.round(6 + Math.random() * 3),
                incidents: [],
                lastUpdate: new Date(),
                source: 'simulated'
            },
            {
                id: 'vn_sample_3',
                name: 'Đường Lê Lợi',
                coordinates: [[bounds[1] + 0.003, bounds[0] + 0.003], [bounds[3] - 0.003, bounds[2] - 0.003]],
                currentSpeed: Math.round(15 + Math.random() * 25),
                maxSpeed: 45,
                congestionLevel: Math.random() > 0.6 ? 'moderate' : 'light',
                travelTime: Math.round(10 + Math.random() * 8),
                incidents: Math.random() > 0.8 ? ['accident'] : [],
                lastUpdate: new Date(),
                source: 'simulated'
            }
        ];

        console.log('Generated', vietnamRoads.length, 'sample traffic segments');
        return vietnamRoads;
    }

    generateSampleIncidents(bounds, type) {
        const incidents = [];
        const count = Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
            incidents.push({
                id: `incident_${type}_${i}`,
                type: type,
                location: {
                    lat: bounds[0] + Math.random() * (bounds[2] - bounds[0]),
                    lng: bounds[1] + Math.random() * (bounds[3] - bounds[1])
                },
                description: type === 'accident' ? 'Tai nạn giao thông' : 'Thi công đường',
                severity: Math.floor(Math.random() * 3) + 1,
                reportedAt: new Date(),
                estimatedClearTime: new Date(Date.now() + Math.random() * 3600000)
            });
        }

        return incidents;
    }
}

export default new TrafficAPIService();
