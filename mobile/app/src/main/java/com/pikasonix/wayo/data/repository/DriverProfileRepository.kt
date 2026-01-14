package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.local.dao.DriverProfileDao
import com.pikasonix.wayo.data.model.DriverProfile
import com.pikasonix.wayo.data.remote.backend.BackendApiService
import com.pikasonix.wayo.data.remote.backend.dto.toEntity
import com.pikasonix.wayo.data.remote.backend.dto.toModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DriverProfileRepository @Inject constructor(
    private val backendApi: BackendApiService,
    private val driverProfileDao: DriverProfileDao,
    private val dispatchers: DispatcherProvider
) {
    
    /**
     * Observe driver profile from local database (offline-first)
     */
    fun observeDriverProfile(userId: String): Flow<DriverProfile?> {
        return driverProfileDao.observeByUserId(userId).map { entity ->
            entity?.toModel()
        }
    }
    
    /**
     * Get driver profile (from cache)
     */
    suspend fun getDriverProfile(userId: String): AppResult<DriverProfile> = withContext(dispatchers.io) {
        try {
            val entity = driverProfileDao.getByUserId(userId)
            if (entity != null) {
                AppResult.Success(entity.toModel())
            } else {
                AppResult.Error(AppError.NotFound("Driver profile not found"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Refresh driver profile from backend and cache locally
     */
    suspend fun refreshDriverProfile(userId: String): AppResult<DriverProfile> = withContext(dispatchers.io) {
        try {
            val response = backendApi.getDriverProfile()
            if (!response.isSuccessful || response.body() == null) {
                return@withContext AppResult.Error(AppError.ServerError("Failed to fetch profile"))
            }
            
            val profileDto = response.body()!!
            val entity = profileDto.toEntity()
            
            // Cache to local database
            driverProfileDao.insert(entity)
            
            AppResult.Success(entity.toModel())
        } catch (e: IOException) {
            AppResult.Error(AppError.Network("Network error: ${e.message}"))
        } catch (e: HttpException) {
            when (e.code()) {
                401 -> AppResult.Error(AppError.Authentication("Authentication required"))
                403 -> AppResult.Error(AppError.Authorization("Access denied"))
                404 -> AppResult.Error(AppError.NotFound("Driver profile not found"))
                else -> AppResult.Error(AppError.ServerError("Server error: ${e.code()}"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Unknown(e.message ?: "Unknown error"))
        }
    }
    
    /**
     * Update driver profile in local cache (for optimistic updates)
     */
    suspend fun updateDriverProfile(profile: DriverProfile): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            val entity = driverProfileDao.getByUserId(profile.userId)
            if (entity != null) {
                val updated = entity.copy(
                    fullName = profile.fullName,
                    phone = profile.phone,
                    avatarUrl = profile.avatarUrl,
                    rating = profile.rating,
                    totalDeliveries = profile.totalDeliveries,
                    status = profile.status,
                    updatedAt = System.currentTimeMillis()
                )
                driverProfileDao.update(updated)
                AppResult.Success(Unit)
            } else {
                AppResult.Error(AppError.NotFound("Driver profile not found in cache"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Clear cached driver profile
     */
    suspend fun clearCache(): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            driverProfileDao.deleteAll()
            AppResult.Success(Unit)
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
}
