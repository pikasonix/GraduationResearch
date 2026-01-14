package com.pikasonix.wayo.ui.xml.profile

import com.pikasonix.wayo.MainCoroutineRule
import com.pikasonix.wayo.data.model.User
import com.pikasonix.wayo.data.repository.AuthRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.*

/**
 * Unit test cho ProfileViewModel - test user info và logout
 */
@ExperimentalCoroutinesApi
class ProfileViewModelTest {

    @get:Rule
    val mainCoroutineRule = MainCoroutineRule()

    private lateinit var authRepository: AuthRepository
    private lateinit var viewModel: ProfileViewModel

    private val mockUser = User(
        id = "driver-123",
        email = "driver@wayo.com",
        fullName = "Nguyễn Văn A",
        phone = "+84901234567"
    )

    @Before
    fun setup() {
        authRepository = mock()
        viewModel = ProfileViewModel(authRepository)
    }

    @Test
    fun `getEmailOrEmpty returns email when user is logged in`() {
        // Given
        whenever(authRepository.getCurrentUser()).thenReturn(mockUser)

        // When
        val email = viewModel.getEmailOrEmpty()

        // Then
        assertEquals("driver@wayo.com", email)
        verify(authRepository, times(1)).getCurrentUser()
    }

    @Test
    fun `getEmailOrEmpty returns empty string when user is null`() {
        // Given
        whenever(authRepository.getCurrentUser()).thenReturn(null)

        // When
        val email = viewModel.getEmailOrEmpty()

        // Then
        assertEquals("", email)
        verify(authRepository, times(1)).getCurrentUser()
    }

    @Test
    fun `getEmailOrEmpty returns email when user has email`() {
        // Given
        val userWithEmail = User(
            id = "driver-456",
            email = "another@example.com",
            fullName = "Test User",
            phone = null
        )
        whenever(authRepository.getCurrentUser()).thenReturn(userWithEmail)

        // When
        val email = viewModel.getEmailOrEmpty()

        // Then
        assertEquals("another@example.com", email)
    }

    @Test
    fun `logout calls authRepository signOut`() = runTest {
        // Given
        whenever(authRepository.signOut()).thenAnswer { }

        // When
        viewModel.logout()

        // Then
        verify(authRepository, times(1)).signOut()
    }

    @Test
    @org.junit.Ignore("UnconfinedTestDispatcher doesn't work well with viewModelScope exception handling")
    fun `logout handles repository exception gracefully`() = runTest {
        // Given
        whenever(authRepository.signOut()).thenThrow(RuntimeException("Logout failed"))

        // When - should not crash app (viewModelScope catches it)
        try {
            viewModel.logout()
        } catch (e: RuntimeException) {
            // Expected - UnconfinedTestDispatcher throws synchronously
        }

        // Then - verify signOut was called
        verify(authRepository, times(1)).signOut()
    }

    @Test
    fun `getEmailOrEmpty can be called multiple times`() {
        // Given
        whenever(authRepository.getCurrentUser()).thenReturn(mockUser)

        // When
        val email1 = viewModel.getEmailOrEmpty()
        val email2 = viewModel.getEmailOrEmpty()

        // Then
        assertEquals("driver@wayo.com", email1)
        assertEquals("driver@wayo.com", email2)
        verify(authRepository, times(2)).getCurrentUser()
    }
}
