package com.pikasonix.wayo.domain.usecase.route

import com.pikasonix.wayo.MainCoroutineRule
import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Route
import com.pikasonix.wayo.data.repository.BackendRouteRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.*

/**
 * Unit test for GetAssignedRoutesUseCase
 */
@ExperimentalCoroutinesApi
class GetAssignedRoutesUseCaseTest {

    @get:Rule
    val mainCoroutineRule = MainCoroutineRule()

    private lateinit var routeRepository: BackendRouteRepository
    private lateinit var dispatchers: DispatcherProvider
    private lateinit var useCase: GetAssignedRoutesUseCase

    @Before
    fun setup() {
        routeRepository = mock()
        val testDispatcher = StandardTestDispatcher()
        dispatchers = object : DispatcherProvider {
            override val main = testDispatcher
            override val io = testDispatcher
            override val default = testDispatcher
            override val unconfined = testDispatcher
        }
        useCase = GetAssignedRoutesUseCase(routeRepository, dispatchers)
    }

    @Test
    fun `observe returns Flow of routes from repository`() = runTest {
        // Given
        val driverId = "driver-123"
        val routes = listOf(
            createTestRoute("route-1", "assigned"),
            createTestRoute("route-2", "in_progress")
        )
        whenever(routeRepository.observeAssignedRoutes(driverId))
            .thenReturn(flowOf(routes))

        // When
        val flow = useCase.observe(driverId)
        var result: List<Route>? = null
        flow.collect { result = it }

        // Then
        assertNotNull(result)
        assertEquals(2, result?.size)
        assertEquals("route-1", result?.get(0)?.id)
        assertEquals("route-2", result?.get(1)?.id)
        verify(routeRepository).observeAssignedRoutes(driverId)
    }

    @Test
    fun `observe returns empty list when no routes`() = runTest {
        // Given
        val driverId = "driver-456"
        whenever(routeRepository.observeAssignedRoutes(driverId))
            .thenReturn(flowOf(emptyList()))

        // When
        val flow = useCase.observe(driverId)
        var result: List<Route>? = null
        flow.collect { result = it }

        // Then
        assertNotNull(result)
        assertTrue(result?.isEmpty() == true)
    }

    @Test
    fun `refresh with valid driverId returns success`() = runTest {
        // Given
        val driverId = "driver-123"
        val routes = listOf(
            createTestRoute("route-1", "assigned"),
            createTestRoute("route-2", "assigned")
        )
        whenever(routeRepository.refreshAssignedRoutes(driverId))
            .thenReturn(AppResult.Success(routes))

        // When
        val result = useCase.refresh(driverId)

        // Then
        assertTrue(result is AppResult.Success)
        val data = (result as AppResult.Success).data
        assertEquals(2, data.size)
        verify(routeRepository).refreshAssignedRoutes(driverId)
    }

    @Test
    fun `refresh with network error returns error`() = runTest {
        // Given
        val driverId = "driver-123"
        val errorResult = AppResult.Error(
            AppError.Network("No internet connection")
        )
        whenever(routeRepository.refreshAssignedRoutes(driverId))
            .thenReturn(errorResult)

        // When
        val result = useCase.refresh(driverId)

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Network)
        assertEquals("No internet connection", error.message)
    }

    @Test
    fun `refresh with empty response returns success with empty list`() = runTest {
        // Given
        val driverId = "driver-new"
        whenever(routeRepository.refreshAssignedRoutes(driverId))
            .thenReturn(AppResult.Success(emptyList()))

        // When
        val result = useCase.refresh(driverId)

        // Then
        assertTrue(result is AppResult.Success)
        val data = (result as AppResult.Success).data
        assertTrue(data.isEmpty())
    }

    // Helper function
    private fun createTestRoute(id: String, status: String): Route {
        return Route(
            id = id,
            driverId = "driver-123",
            vehicleId = "vehicle-1",
            status = status,
            scheduledDate = "2026-01-15T08:00:00Z",
            startedAt = null,
            completedAt = null,
            totalStops = 10,
            completedStops = 0
        )
    }
}
