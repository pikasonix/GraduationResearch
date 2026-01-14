package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.local.dao.PendingActionsDao
import com.pikasonix.wayo.data.local.entity.PendingActionEntity
import com.pikasonix.wayo.data.remote.backend.BackendApiService
import com.pikasonix.wayo.data.remote.backend.dto.PendingActionDto
import com.pikasonix.wayo.data.remote.backend.dto.SyncOutboxRequest
import com.pikasonix.wayo.data.util.DateUtils
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncRepository @Inject constructor(
    private val backendApi: BackendApiService,
    private val pendingActionsDao: PendingActionsDao,
    private val dispatchers: DispatcherProvider
) {
    
    /**
     * Enqueue a pending action for later sync
     */
    suspend fun enqueuePendingAction(
        type: String,
        payload: String
    ): AppResult<String> = withContext(dispatchers.io) {
        try {
            val actionId = UUID.randomUUID().toString()
            val entity = PendingActionEntity(
                id = actionId,
                type = type,
                payloadJson = payload,
                status = "PENDING",
                attemptCount = 0,
                createdAt = System.currentTimeMillis(),
                lastAttemptAt = null,
                lastError = null,
                idempotencyKey = UUID.randomUUID().toString()
            )
            pendingActionsDao.insert(entity)
            AppResult.Success(actionId)
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Observe pending actions count
     */
    fun observePendingCount(): Flow<Int> {
        return pendingActionsDao.observePendingCount()
    }
    
    /**
     * Get all pending actions
     */
    suspend fun getPendingActions(): AppResult<List<PendingActionEntity>> = withContext(dispatchers.io) {
        try {
            val actions = pendingActionsDao.getPendingActions()
            AppResult.Success(actions)
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Sync all pending actions with backend
     */
    suspend fun syncPendingActions(): AppResult<Int> = withContext(dispatchers.io) {
        try {
            val pendingActions = pendingActionsDao.getPendingActions()
            
            if (pendingActions.isEmpty()) {
                return@withContext AppResult.Success(0)
            }
            
            // Mark actions as in-flight to avoid duplicate concurrent sync
            pendingActions.forEach { entity ->
                pendingActionsDao.update(
                    entity.copy(
                        status = "IN_FLIGHT",
                        lastAttemptAt = System.currentTimeMillis(),
                        attemptCount = entity.attemptCount + 1
                    )
                )
            }

            // Convert to DTOs
            val actionDtos = pendingActions.map { entity ->
                PendingActionDto(
                    id = entity.id,
                    type = entity.type,
                    payload = entity.payloadJson,
                    createdAt = DateUtils.epochMillisToIso(entity.createdAt) ?: DateUtils.nowIso()
                )
            }
            
            // Send to backend
            val request = SyncOutboxRequest(actions = actionDtos)
            val idempotencyKey = pendingActions.firstOrNull()?.idempotencyKey ?: UUID.randomUUID().toString()
            val response = backendApi.syncOutbox(request, idempotencyKey)
            if (!response.isSuccessful || response.body() == null) {
                return@withContext AppResult.Error(AppError.ServerError("Sync failed"))
            }
            
            val responseBody = response.body()!!
            
            var successCount = 0
            
            // Process results
            responseBody.processed.forEach { processed ->
                val entity = pendingActions.find { it.id == processed.id }
                if (entity != null) {
                    if (processed.success) {
                        // Mark as done and delete
                        pendingActionsDao.deleteById(processed.id)
                        successCount++
                    } else {
                        // Mark as failed and increment retry count
                        val updated = entity.copy(
                            status = "FAILED",
                            attemptCount = entity.attemptCount + 1,
                            lastError = processed.error,
                            lastAttemptAt = System.currentTimeMillis()
                        )
                        pendingActionsDao.update(updated)
                    }
                }
            }

            // Any actions not returned by backend are treated as failed (defensive)
            val processedIds = responseBody.processed.map { it.id }.toSet()
            pendingActions.filter { it.id !in processedIds }.forEach { missing ->
                pendingActionsDao.update(
                    missing.copy(
                        status = "FAILED",
                        attemptCount = missing.attemptCount + 1,
                        lastError = "Backend did not return processing result",
                        lastAttemptAt = System.currentTimeMillis()
                    )
                )
            }
            
            AppResult.Success(successCount)
        } catch (e: IOException) {
            AppResult.Error(AppError.Network("Network error: ${e.message}"))
        } catch (e: HttpException) {
            when (e.code()) {
                401 -> AppResult.Error(AppError.Authentication("Authentication required"))
                else -> AppResult.Error(AppError.ServerError("Server error: ${e.code()}"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Unknown(e.message ?: "Unknown error"))
        }
    }
    
    /**
     * Mark action as failed
     */
    suspend fun markActionFailed(actionId: String, error: String): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            val entity = pendingActionsDao.getPendingActions().find { it.id == actionId }
            if (entity != null) {
                val updated = entity.copy(
                    status = "FAILED",
                    attemptCount = entity.attemptCount + 1,
                    lastError = error,
                    lastAttemptAt = System.currentTimeMillis()
                )
                pendingActionsDao.update(updated)
                AppResult.Success(Unit)
            } else {
                AppResult.Error(AppError.NotFound("Action not found"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Delete action by ID
     */
    suspend fun deleteAction(actionId: String): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            pendingActionsDao.deleteById(actionId)
            AppResult.Success(Unit)
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Clean up old completed actions (older than 7 days)
     */
    suspend fun cleanupOldActions(): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            val sevenDaysAgo = System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000)
            pendingActionsDao.deleteOldDone(sevenDaysAgo)
            AppResult.Success(Unit)
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
}
