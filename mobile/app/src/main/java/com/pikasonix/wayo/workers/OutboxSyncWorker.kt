package com.pikasonix.wayo.workers

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.repository.SyncRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker đồng bộ các hành động pending trong outbox lên backend.
 * 
 * Chiến lược retry:
 * - Network/ServerError: Retry với exponential backoff (max 3 lần)
 * - AuthError: Fail ngay (yêu cầu đăng nhập lại)
 * - Success: Clean up các actions cũ đã hoàn thành
 *
 * Worker được schedule chạy định kỳ khi có network, hoặc trigger thủ công sau khi online.
 *
 * @property syncRepository Repository quản lý sync operations
 */
@HiltWorker
class OutboxSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncRepository: SyncRepository
) : CoroutineWorker(appContext, workerParams) {
    
    override suspend fun doWork(): Result {
        return try {
            when (val result = syncRepository.syncPendingActions()) {
                is AppResult.Success -> {
                    val syncedCount = result.data
                    
                    // Dọn dẹp các actions cũ đã hoàn thành
                    syncRepository.cleanupOldActions()
                    
                    Result.success()
                }
                is AppResult.Error -> {
                    // Retry với exponential backoff cho network/server errors
                    when (result.error) {
                        is com.pikasonix.wayo.core.result.AppError.Network,
                        is com.pikasonix.wayo.core.result.AppError.ServerError -> {
                            if (runAttemptCount < MAX_RETRY_ATTEMPTS) {
                                Result.retry()
                            } else {
                                Result.failure()
                            }
                        }
                        is com.pikasonix.wayo.core.result.AppError.Authentication -> {
                            // Không retry authentication errors
                            Result.failure()
                        }
                        else -> {
                            Result.failure()
                        }
                    }
                }
            }
        } catch (e: Exception) {
            if (runAttemptCount < MAX_RETRY_ATTEMPTS) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
    
    companion object {
        private const val TAG = "OutboxSyncWorker"
        private const val WORK_NAME = "outbox_sync"
        private const val MAX_RETRY_ATTEMPTS = 3
        
        // Sync intervals
        private const val PERIODIC_INTERVAL_MINUTES = 15L
        private const val INITIAL_BACKOFF_DELAY_SECONDS = 30L
        
        /**
         * Enqueue sync work định kỳ
         */
        fun enqueuePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            
            val periodicWorkRequest = PeriodicWorkRequestBuilder<OutboxSyncWorker>(
                PERIODIC_INTERVAL_MINUTES,
                TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    INITIAL_BACKOFF_DELAY_SECONDS,
                    TimeUnit.SECONDS
                )
                .build()
            
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                periodicWorkRequest
            )
        }
        
        /**
         * Enqueue sync ngay lập tức một lần
         */
        fun enqueueImmediateSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            
            val oneTimeWorkRequest = OneTimeWorkRequestBuilder<OutboxSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    INITIAL_BACKOFF_DELAY_SECONDS,
                    TimeUnit.SECONDS
                )
                .build()
            
            WorkManager.getInstance(context).enqueueUniqueWork(
                "${WORK_NAME}_immediate",
                ExistingWorkPolicy.REPLACE,
                oneTimeWorkRequest
            )
        }
        
        /**
         * Hủy tất cả sync work
         */
        fun cancelSync(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
