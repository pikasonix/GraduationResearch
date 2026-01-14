package com.pikasonix.wayo.domain.usecase.sync

import android.content.Context
import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.workers.OutboxSyncWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Enqueue Sync UseCase
 * 
 * Manually triggers immediate sync of pending actions.
 * Useful for "Sync Now" button in UI.
 */
class EnqueueSyncUseCase @Inject constructor(
    @ApplicationContext private val context: Context,
    private val dispatchers: DispatcherProvider
) {
    suspend operator fun invoke(): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            OutboxSyncWorker.enqueueImmediateSync(context)
            AppResult.Success(Unit)
        } catch (e: Exception) {
            AppResult.Error(com.pikasonix.wayo.core.result.AppError.Unknown(e.message ?: "Failed to enqueue sync"))
        }
    }
}
