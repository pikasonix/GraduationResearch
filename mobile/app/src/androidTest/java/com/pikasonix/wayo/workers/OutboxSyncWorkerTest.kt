package com.pikasonix.wayo.workers

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.repository.SyncRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.*

/**
 * Instrumentation test for OutboxSyncWorker
 * Tests worker execution with work-testing library
 */
@RunWith(AndroidJUnit4::class)
class OutboxSyncWorkerTest {

    private lateinit var context: Context
    private lateinit var syncRepository: SyncRepository

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        syncRepository = mock()
    }

    @Test
    fun `worker succeeds when sync is successful`() = runTest {
        // Given - successful sync of 5 actions
        whenever(syncRepository.syncPendingActions())
            .thenReturn(AppResult.Success(5))
        whenever(syncRepository.cleanupOldActions())
            .thenReturn(AppResult.Success(Unit))

        // When
        val worker = TestListenableWorkerBuilder<OutboxSyncWorker>(context)
            .build()
        
        // Inject mock repository
        val result = worker.doWork()

        // Then
        assertEquals(ListenableWorker.Result.success(), result)
        verify(syncRepository).syncPendingActions()
        verify(syncRepository).cleanupOldActions()
    }

    @Test
    fun `worker retries on network error`() = runTest {
        // Given - network error
        whenever(syncRepository.syncPendingActions())
            .thenReturn(AppResult.Error(AppError.Network("No internet connection")))

        // When
        val worker = TestListenableWorkerBuilder<OutboxSyncWorker>(context)
            .setRunAttemptCount(1) // First retry
            .build()
        
        val result = worker.doWork()

        // Then - should retry
        assertEquals(ListenableWorker.Result.retry(), result)
        verify(syncRepository).syncPendingActions()
        verify(syncRepository, never()).cleanupOldActions()
    }

    @Test
    fun `worker fails after max retry attempts`() = runTest {
        // Given - persistent network error
        whenever(syncRepository.syncPendingActions())
            .thenReturn(AppResult.Error(AppError.Network("Connection timeout")))

        // When - max retry attempts reached
        val worker = TestListenableWorkerBuilder<OutboxSyncWorker>(context)
            .setRunAttemptCount(3) // MAX_RETRY_ATTEMPTS
            .build()
        
        val result = worker.doWork()

        // Then - should fail (no more retries)
        assertEquals(ListenableWorker.Result.failure(), result)
    }

    @Test
    fun `worker fails immediately on authentication error`() = runTest {
        // Given - authentication error (non-retryable)
        whenever(syncRepository.syncPendingActions())
            .thenReturn(AppResult.Error(AppError.Authentication("Token expired")))

        // When
        val worker = TestListenableWorkerBuilder<OutboxSyncWorker>(context)
            .setRunAttemptCount(0)
            .build()
        
        val result = worker.doWork()

        // Then - should fail immediately without retry
        assertEquals(ListenableWorker.Result.failure(), result)
        verify(syncRepository).syncPendingActions()
    }

    @Test
    fun `worker retries on server error`() = runTest {
        // Given - server error (retryable)
        whenever(syncRepository.syncPendingActions())
            .thenReturn(AppResult.Error(AppError.ServerError("Internal server error", 500)))

        // When
        val worker = TestListenableWorkerBuilder<OutboxSyncWorker>(context)
            .setRunAttemptCount(1)
            .build()
        
        val result = worker.doWork()

        // Then
        assertEquals(ListenableWorker.Result.retry(), result)
    }

    @Test
    fun `worker succeeds when syncing zero actions`() = runTest {
        // Given - no pending actions
        whenever(syncRepository.syncPendingActions())
            .thenReturn(AppResult.Success(0))
        whenever(syncRepository.cleanupOldActions())
            .thenReturn(AppResult.Success(Unit))

        // When
        val worker = TestListenableWorkerBuilder<OutboxSyncWorker>(context)
            .build()
        
        val result = worker.doWork()

        // Then - still counts as success
        assertEquals(ListenableWorker.Result.success(), result)
        verify(syncRepository).cleanupOldActions()
    }

    @Test
    fun `worker handles exception with retry`() = runTest {
        // Given - unexpected exception
        whenever(syncRepository.syncPendingActions())
            .thenThrow(RuntimeException("Database connection failed"))

        // When
        val worker = TestListenableWorkerBuilder<OutboxSyncWorker>(context)
            .setRunAttemptCount(0)
            .build()
        
        val result = worker.doWork()

        // Then - should retry on unexpected errors
        assertEquals(ListenableWorker.Result.retry(), result)
    }

    @Test
    fun `worker fails after max retries on exception`() = runTest {
        // Given - persistent exception
        whenever(syncRepository.syncPendingActions())
            .thenThrow(RuntimeException("Persistent error"))

        // When
        val worker = TestListenableWorkerBuilder<OutboxSyncWorker>(context)
            .setRunAttemptCount(3)
            .build()
        
        val result = worker.doWork()

        // Then
        assertEquals(ListenableWorker.Result.failure(), result)
    }
}
