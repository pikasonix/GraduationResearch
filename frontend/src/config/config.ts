// src/config/config.ts
const config = {
    api: {
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
        basePath: process.env.NEXT_PUBLIC_API_BASE_PATH || '/api'
    },
    mapbox: {
        // Support common env var names
        accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
        style: process.env.NEXT_PUBLIC_MAPBOX_STYLE
            || 'mapbox://styles/mapbox/streets-v12'
    },
    map: {
        tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    mapDefaults: {
        // support both NEXT_PUBLIC_ and NEXT_ env var names (Vite compatibility)
        defaultCenterLat: Number(process.env.NEXT_PUBLIC_DEFAULT_CENTER_LAT ?? 21.0227),
        defaultCenterLng: Number(process.env.NEXT_PUBLIC_DEFAULT_CENTER_LNG ?? 105.8194),
        defaultZoom: Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM ?? 12),
    },
    geocoding: {
        provider: process.env.NEXT_PUBLIC_GEOCODING_PROVIDER || 'goong',
        goongKey: process.env.NEXT_PUBLIC_GOONG_API_KEY || '',
    },
    defaultParams: {
        // LNS parameters
        iterations: Number(process.env.NEXT_PUBLIC_DEFAULT_ITERATIONS) || 100000,
        max_non_improving: Number(process.env.NEXT_PUBLIC_DEFAULT_MAX_NON_IMPROVING) || 20000,
        time_limit: Number(process.env.NEXT_PUBLIC_DEFAULT_TIME_LIMIT) || 300, // 5 minutes default
        min_destroy: Number(process.env.NEXT_PUBLIC_DEFAULT_MIN_DESTROY) || 0.1,
        max_destroy: Number(process.env.NEXT_PUBLIC_DEFAULT_MAX_DESTROY) || 0.4,
        min_destroy_count: Number(process.env.NEXT_PUBLIC_DEFAULT_MIN_DESTROY_COUNT) || -1,
        max_destroy_count: Number(process.env.NEXT_PUBLIC_DEFAULT_MAX_DESTROY_COUNT) || -1,
        acceptance: (process.env.NEXT_PUBLIC_DEFAULT_ACCEPTANCE as 'sa' | 'rtr' | 'greedy') || 'rtr',
        
        // General configuration
        seed: Number(process.env.NEXT_PUBLIC_DEFAULT_SEED) || 42,
        max_vehicles: Number(process.env.NEXT_PUBLIC_DEFAULT_MAX_VEHICLES) || 0,
        log_level: (process.env.NEXT_PUBLIC_DEFAULT_LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error') || 'info',
        authors: process.env.NEXT_PUBLIC_DEFAULT_AUTHORS || 'PDPTW Solver',
        reference: process.env.NEXT_PUBLIC_DEFAULT_REFERENCE || 'LNS with SA/RTR',
        
        // Instance format
        format: (process.env.NEXT_PUBLIC_DEFAULT_FORMAT as 'lilim' | 'sartori') || 'sartori',
    }
};

export default config;
