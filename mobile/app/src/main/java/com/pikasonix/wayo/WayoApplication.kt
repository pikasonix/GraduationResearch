package com.pikasonix.wayo

import android.app.Application
import com.mapbox.common.MapboxOptions
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class WayoApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize Mapbox with access token from BuildConfig
        val mapboxToken = BuildConfig.MAPBOX_ACCESS_TOKEN
        if (mapboxToken.isNotBlank()) {
            MapboxOptions.accessToken = mapboxToken
        }
    }
}