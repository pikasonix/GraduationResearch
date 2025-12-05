package com.pikasonix.wayo.di

import com.pikasonix.wayo.data.remote.MapboxService
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.data.repository.RouteRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt module for providing app-wide dependencies
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    
    @Provides
    @Singleton
    fun provideAuthRepository(): AuthRepository {
        return AuthRepository()
    }
    
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
}
