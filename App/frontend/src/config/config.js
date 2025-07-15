// src/config/config.js
const config = {
    api: {
        baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
        basePath: import.meta.env.VITE_API_BASE_PATH || '/api'
    },
    map: {
        tileUrl: import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    defaultParams: {
        num_routes: Number(import.meta.env.VITE_DEFAULT_NUM_ROUTES) || 7,
        ants: Number(import.meta.env.VITE_DEFAULT_ANTS) || 10,
        iterations: Number(import.meta.env.VITE_DEFAULT_ITERATIONS) || 20,
        alpha: Number(import.meta.env.VITE_DEFAULT_ALPHA) || 2.0,
        beta: Number(import.meta.env.VITE_DEFAULT_BETA) || 5.0,
        rho: Number(import.meta.env.VITE_DEFAULT_RHO) || 0.1,
        tau_max: Number(import.meta.env.VITE_DEFAULT_TAU_MAX) || 50.0,
        tau_min: Number(import.meta.env.VITE_DEFAULT_TAU_MIN) || 0.01,
        greedy_bias: Number(import.meta.env.VITE_DEFAULT_GREEDY_BIAS) || 0.85,
        elite_solutions: Number(import.meta.env.VITE_DEFAULT_ELITE_SOLUTIONS) || 4,
        local_search_prob: Number(import.meta.env.VITE_DEFAULT_LOCAL_SEARCH_PROB) || 0.7,
        restart_threshold: Number(import.meta.env.VITE_DEFAULT_RESTART_THRESHOLD) || 2,
    }
};

export default config;
