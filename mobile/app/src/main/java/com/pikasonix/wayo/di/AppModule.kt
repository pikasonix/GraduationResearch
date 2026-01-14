package com.pikasonix.wayo.di

import android.content.Context
import androidx.room.Room
import com.pikasonix.wayo.BuildConfig
import com.pikasonix.wayo.core.dispatcher.DefaultDispatcherProvider
import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.data.local.db.WayoDatabase
import com.pikasonix.wayo.data.location.LocationService
import com.pikasonix.wayo.data.remote.MapboxService
import com.pikasonix.wayo.data.remote.backend.BackendApiService
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.data.repository.AssignedRouteRepository
import com.pikasonix.wayo.data.repository.DriverVehicleRepository
import com.pikasonix.wayo.data.repository.RouteRepository
import com.pikasonix.wayo.data.repository.VehicleRepository
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

/**
 * Hilt module cung cấp các dependencies toàn ứng dụng
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
        private fun normalizeBaseUrl(url: String): String {
            val trimmed = url.trim()
            if (trimmed.isEmpty()) return trimmed
            return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
        }

        private fun resolveBackendBaseUrl(): String {
            // Priority:
            // 1) Explicit BACKEND_URL in local.properties/CI
            // 2) Debug default for emulator
            // 3) Release fallback (production)
            val configured = BuildConfig.BACKEND_URL.trim()
            return when {
                configured.isNotEmpty() -> normalizeBaseUrl(configured)
                BuildConfig.DEBUG -> "http://10.0.2.2:3001/" // Android emulator -> host machine
                else -> "https://api.wayo.com/"
            }
        }
    
    // ========== Core Infrastructure ==========
    
    @Provides
    @Singleton
    fun provideDispatcherProvider(): DispatcherProvider {
        return DefaultDispatcherProvider()
    }

    // ========== Room Database ==========
    
    @Provides
    @Singleton
    fun provideWayoDatabase(
        @ApplicationContext context: Context
    ): WayoDatabase {
        return Room.databaseBuilder(
            context,
            WayoDatabase::class.java,
            WayoDatabase.DATABASE_NAME
        )
            .fallbackToDestructiveMigration() // For alpha/beta only
            .build()
    }
    
    @Provides
    @Singleton
    fun provideDriverProfileDao(database: WayoDatabase) = database.driverProfileDao()
    
    @Provides
    @Singleton
    fun provideVehiclesDao(database: WayoDatabase) = database.vehiclesDao()
    
    @Provides
    @Singleton
    fun provideRoutesDao(database: WayoDatabase) = database.routesDao()
    
    @Provides
    @Singleton
    fun provideRouteStopsDao(database: WayoDatabase) = database.routeStopsDao()
    
    @Provides
    @Singleton
    fun provideOrdersDao(database: WayoDatabase) = database.ordersDao()
    
    @Provides
    @Singleton
    fun providePendingActionsDao(database: WayoDatabase) = database.pendingActionsDao()
    
    // ========== Network - Moshi ==========
    
    @Provides
    @Singleton
    fun provideMoshi(): Moshi {
        return Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .build()
    }
    
    // ========== Network - OkHttp ==========
    
    @Provides
    @Singleton
    fun provideOkHttpClient(
        authRepository: AuthRepository
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val originalRequest = chain.request()
                val token = authRepository.getCurrentToken()
                
                val request = if (token != null) {
                    originalRequest.newBuilder()
                        .header("Authorization", "Bearer $token")
                        .build()
                } else {
                    originalRequest
                }
                
                chain.proceed(request)
            }
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = if (BuildConfig.DEBUG) {
                        HttpLoggingInterceptor.Level.BODY
                    } else {
                        HttpLoggingInterceptor.Level.NONE
                    }
                }
            )
            .build()
    }
    
    // ========== Network - Backend API ==========
    
    @Provides
    @Singleton
    fun provideBackendApiService(
        okHttpClient: OkHttpClient,
        moshi: Moshi
    ): BackendApiService {
        val baseUrl = resolveBackendBaseUrl()
        
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(BackendApiService::class.java)
    }
    
    // ========== Existing Providers ==========
    // AuthRepository uses @Inject constructor, no need for provider
    
    @Provides
    @Singleton
    fun provideMapboxService(): MapboxService {
        return MapboxService()
    }
    
    @Provides
    @Singleton
    fun provideRouteRepository(mapboxService: MapboxService): RouteRepository {
        return RouteRepository(mapboxService)
    }

    @Provides
    @Singleton
    fun provideAssignedRouteRepository(): AssignedRouteRepository {
        return AssignedRouteRepository()
    }

    @Provides
    @Singleton
    fun provideVehicleRepository(): VehicleRepository {
        return VehicleRepository()
    }

    @Provides
    @Singleton
    fun provideDriverVehicleRepository(vehicleRepository: VehicleRepository): DriverVehicleRepository {
        return DriverVehicleRepository(vehicleRepository)
    }

    @Provides
    @Singleton
    fun provideLocationService(@ApplicationContext context: Context): LocationService {
        return LocationService(context)
    }
    
    // ========== New Repositories (Phase 2) ==========
    
    // Note: DriverProfileRepository, StopRepository, OrderRepository, SyncRepository, 
    // and BackendRouteRepository are @Singleton classes with @Inject constructor,
    // so Hilt will provide them automatically without explicit provider methods.
}
