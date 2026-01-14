package com.pikasonix.wayo.domain.usecase.auth

import com.pikasonix.wayo.MainCoroutineRule
import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.AuthResult
import com.pikasonix.wayo.data.repository.AuthRepository
import com.pikasonix.wayo.data.repository.DriverProfileRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.*

/**
 * Unit test for LoginUseCase - validates basic authentication flow
 */
@ExperimentalCoroutinesApi
class LoginUseCaseTest {

    @get:Rule
    val mainCoroutineRule = MainCoroutineRule()

    private lateinit var authRepository: AuthRepository
    private lateinit var driverProfileRepository: DriverProfileRepository
    private lateinit var dispatchers: DispatcherProvider
    private lateinit var loginUseCase: LoginUseCase

    @Before
    fun setup() {
        authRepository = mock()
        driverProfileRepository = mock()
        val testDispatcher = StandardTestDispatcher()
        dispatchers = object : DispatcherProvider {
            override val main = testDispatcher
            override val io = testDispatcher
            override val default = testDispatcher
            override val unconfined = testDispatcher
        }
        loginUseCase = LoginUseCase(authRepository, driverProfileRepository, dispatchers)
    }

    @Test
    fun `invoke with empty email returns validation error`() = runTest {
        // When
        val result = loginUseCase("", "password123")

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Validation)
        assertEquals("Email is required", error.message)
        verifyNoInteractions(authRepository)
    }

    @Test
    fun `invoke with empty password returns validation error`() = runTest {
        // When
        val result = loginUseCase("test@example.com", "")

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Validation)
        assertEquals("Password is required", error.message)
        verifyNoInteractions(authRepository)
    }

    @Test
    fun `invoke with auth error returns authentication error`() = runTest {
        // Given
        val email = "driver@example.com"
        val password = "wrongpassword"
        whenever(authRepository.login(email, password))
            .thenReturn(AuthResult.Error("Invalid credentials"))

        // When
        val result = loginUseCase(email, password)

        // Then
        assertTrue(result is AppResult.Error)
        val error = (result as AppResult.Error).error
        assertTrue(error is AppError.Authentication)
        assertEquals("Invalid credentials", error.message)
        verify(authRepository).login(email, password)
        verifyNoInteractions(driverProfileRepository)
    }
}
