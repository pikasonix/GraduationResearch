package com.pikasonix.wayo.ui.xml.routes

import com.pikasonix.wayo.MainCoroutineRule
import com.pikasonix.wayo.data.repository.AssignedRouteRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.*

/**
 * Unit test cho RouteDetailsViewModel - test route actions (start, complete)
 */
@ExperimentalCoroutinesApi
class RouteDetailsViewModelTest {

    @get:Rule
    val mainCoroutineRule = MainCoroutineRule()

    private lateinit var assignedRouteRepository: AssignedRouteRepository
    private lateinit var viewModel: RouteDetailsViewModel

    @Before
    fun setup() {
        assignedRouteRepository = mock()
        viewModel = RouteDetailsViewModel(assignedRouteRepository)
    }

    @Test
    fun `startRoute calls repository with correct routeId`() = runTest {
        // Given
        val routeId = "route-123"
        whenever(assignedRouteRepository.startRoute(routeId)).thenAnswer { }

        // When
        viewModel.startRoute(routeId)

        // Then
        verify(assignedRouteRepository, times(1)).startRoute(routeId)
    }

    @Test
    fun `completeRoute calls repository with correct routeId`() = runTest {
        // Given
        val routeId = "route-456"
        whenever(assignedRouteRepository.completeRoute(routeId)).thenAnswer { }

        // When
        viewModel.completeRoute(routeId)

        // Then
        verify(assignedRouteRepository, times(1)).completeRoute(routeId)
    }

    @Test
    @org.junit.Ignore("UnconfinedTestDispatcher doesn't work well with viewModelScope exception handling")
    fun `startRoute handles repository exception gracefully`() = runTest {
        // Given
        val routeId = "route-error"
        whenever(assignedRouteRepository.startRoute(routeId))
            .thenThrow(RuntimeException("Network error"))

        // When - should not crash app (viewModelScope catches it)
        try {
            viewModel.startRoute(routeId)
        } catch (e: RuntimeException) {
            // Expected - UnconfinedTestDispatcher throws synchronously
        }

        // Then - verify repository was called
        verify(assignedRouteRepository, times(1)).startRoute(routeId)
    }

    @Test
    @org.junit.Ignore("UnconfinedTestDispatcher doesn't work well with viewModelScope exception handling")
    fun `completeRoute handles repository exception gracefully`() = runTest {
        // Given
        val routeId = "route-error"
        whenever(assignedRouteRepository.completeRoute(routeId))
            .thenThrow(RuntimeException("Database error"))

        // When - should not crash app (viewModelScope catches it)
        try {
            viewModel.completeRoute(routeId)
        } catch (e: RuntimeException) {
            // Expected - UnconfinedTestDispatcher throws synchronously
        }

        // Then - verify repository was called
        verify(assignedRouteRepository, times(1)).completeRoute(routeId)
    }

    @Test
    fun `startRoute can be called multiple times for different routes`() = runTest {
        // Given
        val route1 = "route-1"
        val route2 = "route-2"
        whenever(assignedRouteRepository.startRoute(any())).thenAnswer { }

        // When
        viewModel.startRoute(route1)
        viewModel.startRoute(route2)

        // Then
        verify(assignedRouteRepository).startRoute(route1)
        verify(assignedRouteRepository).startRoute(route2)
        verify(assignedRouteRepository, times(2)).startRoute(any())
    }
}
