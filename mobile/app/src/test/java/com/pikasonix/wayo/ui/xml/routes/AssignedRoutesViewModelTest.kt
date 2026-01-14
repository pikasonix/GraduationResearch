package com.pikasonix.wayo.ui.xml.routes

import com.pikasonix.wayo.MainCoroutineRule
import com.pikasonix.wayo.data.model.AssignedRoute
import com.pikasonix.wayo.data.model.RouteStatus
import com.pikasonix.wayo.data.model.User
import com.pikasonix.wayo.data.repository.AssignedRouteRepository
import com.pikasonix.wayo.data.repository.AuthRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.*

/**
 * Unit test cho AssignedRoutesViewModel - test load routes và error handling
 */
@ExperimentalCoroutinesApi
class AssignedRoutesViewModelTest {

    @get:Rule
    val mainCoroutineRule = MainCoroutineRule()

    private lateinit var authRepository: AuthRepository
    private lateinit var assignedRouteRepository: AssignedRouteRepository
    private lateinit var viewModel: AssignedRoutesViewModel

    private val mockUser = User(
        id = "driver-123",
        email = "driver@wayo.com",
        fullName = "Test Driver",
        phone = "+84901234567"
    )

    @Before
    fun setup() {
        authRepository = mock()
        assignedRouteRepository = mock()
        viewModel = AssignedRoutesViewModel(authRepository, assignedRouteRepository)
    }

    @Test
    fun `load with valid user fetches routes successfully`() = runTest {
        // Given
        val mockRoutes = listOf(
            AssignedRoute(
                id = "route-1",
                organizationId = "org-1",
                driverId = "driver-123",
                vehicleId = "vehicle-1",
                status = RouteStatus.ASSIGNED,
                solutionId = "solution-1",
                totalDistanceKm = 25.5,
                totalDurationHours = 2.5,
                createdAt = "2026-01-13T08:00:00Z"
            ),
            AssignedRoute(
                id = "route-2",
                organizationId = "org-1",
                driverId = "driver-123",
                vehicleId = "vehicle-1",
                status = RouteStatus.IN_PROGRESS,
                solutionId = "solution-2",
                totalDistanceKm = 15.0,
                totalDurationHours = 1.5,
                createdAt = "2026-01-13T09:00:00Z"
            )
        )

        whenever(authRepository.getCurrentUser()).thenReturn(mockUser)
        whenever(assignedRouteRepository.getAssignedRoutes("driver-123", null)).thenReturn(mockRoutes)

        // When
        viewModel.load()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertFalse(state.isLoading)
        assertNull(state.error)
        assertEquals(2, state.routes.size)
        assertEquals("route-1", state.routes[0].id)
        assertEquals("route-2", state.routes[1].id)
    }

    @Test
    fun `load shows loading state then success`() = runTest {
        // Given
        val mockRoutes = listOf(
            AssignedRoute(
                id = "route-1",
                organizationId = "org-1",
                driverId = "driver-123",
                vehicleId = null,
                status = RouteStatus.ASSIGNED,
                solutionId = null,
                totalDistanceKm = null,
                totalDurationHours = null,
                createdAt = "2026-01-13T08:00:00Z"
            )
        )

        whenever(authRepository.getCurrentUser()).thenReturn(mockUser)
        whenever(assignedRouteRepository.getAssignedRoutes("driver-123", null)).thenReturn(mockRoutes)

        // When
        viewModel.load()

        // Then - verify success state (UnconfinedTestDispatcher runs synchronously)
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.error)
        assertEquals(1, state.routes.size)
    }

    @Test
    fun `load with repository error shows error message`() = runTest {
        // Given
        whenever(authRepository.getCurrentUser()).thenReturn(mockUser)
        whenever(assignedRouteRepository.getAssignedRoutes("driver-123", null))
            .thenThrow(RuntimeException("Network error"))

        // When
        viewModel.load()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertFalse(state.isLoading)
        assertEquals("Network error", state.error)
        assertTrue(state.routes.isEmpty())
    }

    @Test
    fun `load with null user shows not logged in error`() = runTest {
        // Given
        whenever(authRepository.getCurrentUser()).thenReturn(null)

        // When
        viewModel.load()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertFalse(state.isLoading)
        assertEquals("Chưa đăng nhập", state.error)
        assertTrue(state.routes.isEmpty())
        
        // Verify repository was never called
        verify(assignedRouteRepository, never()).getAssignedRoutes(any(), any())
    }

    @Test
    fun `load with empty routes list returns empty state successfully`() = runTest {
        // Given
        whenever(authRepository.getCurrentUser()).thenReturn(mockUser)
        whenever(assignedRouteRepository.getAssignedRoutes("driver-123", null)).thenReturn(emptyList())

        // When
        viewModel.load()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertFalse(state.isLoading)
        assertNull(state.error)
        assertTrue(state.routes.isEmpty())
    }
}
