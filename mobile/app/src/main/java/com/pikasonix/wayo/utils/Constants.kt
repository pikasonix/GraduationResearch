package com.pikasonix.wayo.utils

import com.pikasonix.wayo.BuildConfig

/**
 * Application constants and configuration
 * Sensitive values are loaded from local.properties via BuildConfig
 */
object Constants {
    
    // Supabase Configuration (from BuildConfig)
    val SUPABASE_URL: String = BuildConfig.SUPABASE_URL
    val SUPABASE_ANON_KEY: String = BuildConfig.SUPABASE_ANON_KEY
    
    // Mapbox Configuration (from BuildConfig)
    val MAPBOX_ACCESS_TOKEN: String = BuildConfig.MAPBOX_ACCESS_TOKEN
    
    // Default Map Center (Hanoi, Vietnam - matching frontend config)
    const val DEFAULT_CENTER_LAT = 21.0227
    const val DEFAULT_CENTER_LNG = 105.8194
    const val DEFAULT_ZOOM = 12.0
    
    // API Endpoints
    const val MAPBOX_DIRECTIONS_API = "https://api.mapbox.com/directions/v5/mapbox"
    
    // Route Profiles
    object RouteProfile {
        const val DRIVING_TRAFFIC = "driving-traffic"
        const val DRIVING = "driving"
        const val WALKING = "walking"
        const val CYCLING = "cycling"
    }
    
    // Navigation
    object Nav {
        const val LOGIN = "login"
        const val ROUTING = "routing"
        const val SIGNUP = "signup"
        const val FORGOT_PASSWORD = "forgot_password"
        const val PROFILE = "profile"
    }
}
