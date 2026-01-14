package com.pikasonix.wayo.domain.usecase.sync

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.repository.SyncRepository
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Sync Pending Actions UseCase
 * 
 * Synchronizes all pending actions with backend.
 * Called by OutboxSyncWorker or manually by user.
 * Requires online connectivity.
 */
class SyncPendingActionsUseCase @Inject constructor(
    private val syncRepository: SyncRepository,
    private val dispatchers: DispatcherProvider
) {
    /**
     * Sync all pending actions
     * @return Number of successfully synced actions
     */
    suspend operator fun invoke(): AppResult<Int> = withContext(dispatchers.io) {
        // Sync pending actions
        val result = syncRepository.syncPendingActions()
        
        // Cleanup old actions after successful sync
        if (result is AppResult.Success) {
            syncRepository.cleanupOldActions()
        }
        
        result
    }
}
