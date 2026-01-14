package com.pikasonix.wayo.domain.usecase.stop

import com.pikasonix.wayo.MainCoroutineRule
import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.data.repository.StopRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.*

/**
 * Unit test for CompleteStopUseCase - validates GPS and offline queuing
 */
@ExperimentalCoroutinesApi
class CompleteStopUseCaseTest {

    @get:Rule
    val mainCoroutineRule = MainCoroutineRule()

    private lateinit var stopRepository: StopRepository
    private lateinit var dispatchers: DispatcherProvider
    private lateinit var useCase: CompleteStopUseCase

    @Before
    fun setup() {
        stopRepository = mock()
        val testDispatcher = StandardTestDispatcher()
        dispatchers = object : DispatcherProvider {
            override val main = testDispatcher
            override val io = testDispatcher
            override val default = testDispatcher
            override val unconfined = testDispatcher
        }
        useCase = CompleteStopUseCase(stopRepository, dispatchers)
    }

    @Test
    fun `invoke with empty routeId returns validation error`() = runTest {
        // When
        val result = useCase("", "stop-1", 10.0, 106.0, "Delivered")

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Validation)
        assertEquals("Route ID không được để trống", error.message)
        verifyNoInteractions(stopRepository)
    }

    @Test
    fun `invoke with empty stopId returns validation error`() = runTest {
        // When
        val result = useCase("route-1", "", 10.0, 106.0, "Delivered")

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Validation)
        assertEquals("Stop ID không được để trống", error.message)
        verifyNoInteractions(stopRepository)
    }

    @Test
    fun `invoke with invalid latitude returns validation error`() = runTest {
        // When - latitude out of range
        val result = useCase("route-1", "stop-1", -91.0, 106.0, null)

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Validation)
        assertEquals("Latitude không hợp lệ (phải từ -90 đến 90)", error.message)
    }

    @Test
    fun `invoke with invalid longitude returns validation error`() = runTest {
        // When - longitude out of range
        val result = useCase("route-1", "stop-1", 10.0, 181.0, null)

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Validation)
        assertEquals("Longitude không hợp lệ (phải từ -180 đến 180)", error.message)
    }

    @Test
    fun `invoke with valid params returns success`() = runTest {
        // Given
        val routeId = "route-123"
        val stopId = "stop-456"
        val latitude = 10.762622
        val longitude = 106.660172
        val notes = "Package delivered to customer"
        
        val completedStop = Stop(
            id = stopId,
            routeId = routeId,
            sequence = 1,
            locationName = "123 Nguyen Hue, District 1",
            latitude = latitude,
            longitude = longitude,
            type = "delivery",
            status = "completed",
            scheduledTime = "2026-01-15T10:00:00Z",
            timeWindowStart = "2026-01-15T09:00:00Z",
            timeWindowEnd = "2026-01-15T11:00:00Z",
            completedAt = "2026-01-15T10:15:00Z",
            orders = emptyList()
        )
        
        whenever(stopRepository.completeStop(routeId, stopId, latitude, longitude, notes))
            .thenReturn(AppResult.Success(completedStop))

        // When
        val result = useCase(routeId, stopId, latitude, longitude, notes)

        // Then
        assertTrue(result is AppResult.Success)
        val stop = (result as AppResult.Success).data
        assertEquals(stopId, stop.id)
        assertEquals("completed", stop.status)
        assertNotNull(stop.completedAt)
        verify(stopRepository).completeStop(routeId, stopId, latitude, longitude, notes)
    }

    @Test
    fun `invoke without notes still succeeds`() = runTest {
        // Given
        val routeId = "route-123"
        val stopId = "stop-456"
        val latitude = 10.762622
        val longitude = 106.660172
        
        val completedStop = Stop(
            id = stopId,
            routeId = routeId,
            sequence = 1,
            locationName = "456 Le Loi, District 1",
            latitude = latitude,
            longitude = longitude,
            type = "pickup",
            status = "completed",
            scheduledTime = "2026-01-15T14:00:00Z",
            timeWindowStart = null,
            timeWindowEnd = null,
            completedAt = "2026-01-15T14:10:00Z",
            orders = emptyList()
        )
        
        whenever(stopRepository.completeStop(routeId, stopId, latitude, longitude, null))
            .thenReturn(AppResult.Success(completedStop))

        // When
        val result = useCase(routeId, stopId, latitude, longitude, null)

        // Then
        assertTrue(result is AppResult.Success)
        verify(stopRepository).completeStop(routeId, stopId, latitude, longitude, null)
    }

    @Test
    fun `invoke when offline still succeeds with optimistic update`() = runTest {
        // Given - simulate offline scenario where repository queues action
        val routeId = "route-123"
        val stopId = "stop-789"
        val latitude = 10.776889
        val longitude = 106.700806
        
        val queuedStop = Stop(
            id = stopId,
            routeId = routeId,
            sequence = 3,
            locationName = "789 Tran Hung Dao, District 5",
            latitude = latitude,
            longitude = longitude,
            type = "delivery",
            status = "completed", // Optimistic update
            scheduledTime = "2026-01-15T16:00:00Z",
            timeWindowStart = "2026-01-15T15:30:00Z",
            timeWindowEnd = "2026-01-15T16:30:00Z",
            completedAt = "2026-01-15T16:05:00Z",
            orders = emptyList()
        )
        
        whenever(stopRepository.completeStop(routeId, stopId, latitude, longitude, "Offline completion"))
            .thenReturn(AppResult.Success(queuedStop))

        // When
        val result = useCase(routeId, stopId, latitude, longitude, "Offline completion")

        // Then - should succeed even when offline (queued in outbox)
        assertTrue(result is AppResult.Success)
        val stop = (result as AppResult.Success).data
        assertEquals("completed", stop.status)
    }

    @Test
    fun `invoke with repository error returns error`() = runTest {
        // Given
        val routeId = "route-123"
        val stopId = "stop-999"
        val errorResult = AppResult.Error(
            AppError.Database("Failed to update stop in database")
        )
        
        whenever(stopRepository.completeStop(routeId, stopId, 10.0, 106.0, null))
            .thenReturn(errorResult)

        // When
        val result = useCase(routeId, stopId, 10.0, 106.0, null)

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Database)
    }
}
