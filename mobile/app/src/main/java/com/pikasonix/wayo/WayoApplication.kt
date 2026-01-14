package com.pikasonix.wayo

import android.app.Application
import android.util.Log
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.mapbox.common.MapboxOptions
import com.pikasonix.wayo.workers.OutboxSyncWorker
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.net.InetAddress
import javax.inject.Inject

@HiltAndroidApp
class WayoApplication : Application(), Configuration.Provider {
    
    @Inject
    lateinit var workerFactory: HiltWorkerFactory
    
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    override fun onCreate() {
        super.onCreate()
        
        // Debug DNS resolution for Supabase (on background thread)
        if (BuildConfig.DEBUG) {
            debugDnsResolution()
        }
        
        // Initialize Mapbox with access token from BuildConfig
        val mapboxToken = BuildConfig.MAPBOX_ACCESS_TOKEN
        if (mapboxToken.isNotBlank()) {
            MapboxOptions.accessToken = mapboxToken
        }
        
        // Enqueue periodic outbox sync worker
        OutboxSyncWorker.enqueuePeriodicSync(this)
    }
    
    private fun debugDnsResolution() {
        applicationScope.launch {
            try {
                val host = "vabheijhjkreincnrfrq.supabase.co"
                Log.d("WayoApp", "Attempting to resolve: $host")
                val addresses = InetAddress.getAllByName(host)
                Log.d("WayoApp", "DNS Resolution successful:")
                addresses.forEach { 
                    Log.d("WayoApp", "  - ${it.hostAddress}")
                }
            } catch (e: Exception) {
                Log.e("WayoApp", "DNS Resolution failed", e)
            }
        }
    }
    
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}