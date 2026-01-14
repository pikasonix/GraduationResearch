package com.pikasonix.wayo.domain.usecase.sync

import com.pikasonix.wayo.data.local.entity.PendingActionEntity
import com.pikasonix.wayo.data.repository.SyncRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

/**
 * Observe Pending Actions UseCase
 * 
 * Observes pending actions count for UI indicators (badge, sync status).
 */
class ObservePendingActionsUseCase @Inject constructor(
    private val syncRepository: SyncRepository
) {
    /**
     * Observe count of pending actions
     */
    fun observeCount(): Flow<Int> {
        return syncRepository.observePendingCount()
    }
}
