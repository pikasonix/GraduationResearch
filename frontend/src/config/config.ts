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
        num_routes: Number(process.env.NEXT_PUBLIC_DEFAULT_NUM_ROUTES) || 7,
        ants: Number(process.env.NEXT_PUBLIC_DEFAULT_ANTS) || 10,
        iterations: Number(process.env.NEXT_PUBLIC_DEFAULT_ITERATIONS) || 20,
        alpha: Number(process.env.NEXT_PUBLIC_DEFAULT_ALPHA) || 2.0,
        beta: Number(process.env.NEXT_PUBLIC_DEFAULT_BETA) || 5.0,
        rho: Number(process.env.NEXT_PUBLIC_DEFAULT_RHO) || 0.1,
        tau_max: Number(process.env.NEXT_PUBLIC_DEFAULT_TAU_MAX) || 50.0,
        tau_min: Number(process.env.NEXT_PUBLIC_DEFAULT_TAU_MIN) || 0.01,
        greedy_bias: Number(process.env.NEXT_PUBLIC_DEFAULT_GREEDY_BIAS) || 0.85,
        elite_solutions: Number(process.env.NEXT_PUBLIC_DEFAULT_ELITE_SOLUTIONS) || 4,
        local_search_prob: Number(process.env.NEXT_PUBLIC_DEFAULT_LOCAL_SEARCH_PROB) || 0.7,
        restart_threshold: Number(process.env.NEXT_PUBLIC_DEFAULT_RESTART_THRESHOLD) || 2,
    }
};

export default config;
