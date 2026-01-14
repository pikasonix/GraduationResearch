package com.pikasonix.wayo.ui.viewmodel

import com.pikasonix.wayo.MainCoroutineRule
import com.pikasonix.wayo.data.model.AuthResult
import com.pikasonix.wayo.data.model.User
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
 * Unit test cho SignUpViewModel - test validation và signup flow
 */
@ExperimentalCoroutinesApi
class SignUpViewModelTest {

    @get:Rule
    val mainCoroutineRule = MainCoroutineRule()

    private lateinit var authRepository: AuthRepository
    private lateinit var viewModel: SignUpViewModel

    @Before
    fun setup() {
        authRepository = mock()
        viewModel = SignUpViewModel(authRepository)
    }

    @Test
    fun `signUp with empty email shows validation error`() = runTest {
        // Given - email empty, other fields valid
        viewModel.updateEmail("")
        viewModel.updatePhone("+84901234567")
        viewModel.updatePassword("password123")
        viewModel.updateConfirmPassword("password123")
        viewModel.updateAgreeTerms(true)

        // When
        viewModel.signUp()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertFalse(state.isLoading)
        assertEquals("Vui lòng nhập email", state.error)
        assertFalse(state.isSignUpSuccess)
        verifyNoInteractions(authRepository)
    }

    @Test
    fun `signUp with empty phone shows validation error`() = runTest {
        // Given - phone empty, other fields valid
        viewModel.updateEmail("test@example.com")
        viewModel.updatePhone("")
        viewModel.updatePassword("password123")
        viewModel.updateConfirmPassword("password123")
        viewModel.updateAgreeTerms(true)

        // When
        viewModel.signUp()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertEquals("Vui lòng nhập số điện thoại", state.error)
        verifyNoInteractions(authRepository)
    }

    @Test
    fun `signUp with short password shows validation error`() = runTest {
        // Given - password < 8 chars
        viewModel.updateEmail("test@example.com")
        viewModel.updatePhone("+84901234567")
        viewModel.updatePassword("pass")
        viewModel.updateConfirmPassword("pass")
        viewModel.updateAgreeTerms(true)

        // When
        viewModel.signUp()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertEquals("Mật khẩu phải có ít nhất 8 ký tự", state.passwordError)
        assertNull(state.error)
        verifyNoInteractions(authRepository)
    }

    @Test
    fun `signUp with mismatched passwords shows validation error`() = runTest {
        // Given - passwords don't match
        viewModel.updateEmail("test@example.com")
        viewModel.updatePhone("+84901234567")
        viewModel.updatePassword("password123")
        viewModel.updateConfirmPassword("password456")
        viewModel.updateAgreeTerms(true)

        // When
        viewModel.signUp()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertEquals("Mật khẩu không khớp", state.passwordError)
        verifyNoInteractions(authRepository)
    }

    @Test
    fun `signUp without agreeing to terms shows validation error`() = runTest {
        // Given - terms not agreed
        viewModel.updateEmail("test@example.com")
        viewModel.updatePhone("+84901234567")
        viewModel.updatePassword("password123")
        viewModel.updateConfirmPassword("password123")
        viewModel.updateAgreeTerms(false)

        // When
        viewModel.signUp()
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.first()
        assertEquals("Vui lòng đồng ý với điều khoản dịch vụ", state.error)
        verifyNoInteractions(authRepository)
    }

    @Test
    fun `signUp with valid data returns success`() = runTest {
        // Given - all fields valid
        val email = "newuser@example.com"
        val password = "securepass123"
        val phone = "+84901234567"
        val mockUser = User(
            id = "new-user-123",
            email = email,
            fullName = null,
            phone = phone
        )

        viewModel.updateEmail(email)
        viewModel.updatePhone(phone)
        viewModel.updatePassword(password)
        viewModel.updateConfirmPassword(password)
        viewModel.updateAgreeTerms(true)

        whenever(authRepository.signUp(email, password, "", phone))
            .thenReturn(AuthResult.Success(mockUser))

        // When
        viewModel.signUp()

        // Then - verify success state (UnconfinedTestDispatcher runs synchronously)
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.error)
        assertTrue(state.isSignUpSuccess)
        verify(authRepository, times(1)).signUp(email, password, "", phone)
    }

    @Test
    fun `signUp with duplicate email shows error`() = runTest {
        // Given
        val email = "existing@example.com"
        val password = "password123"
        val phone = "+84901234567"

        viewModel.updateEmail(email)
        viewModel.updatePhone(phone)
        viewModel.updatePassword(password)
        viewModel.updateConfirmPassword(password)
        viewModel.updateAgreeTerms(true)

        whenever(authRepository.signUp(email, password, "", phone))
            .thenReturn(AuthResult.Error("Đã bị trùng"))

        // When
        viewModel.signUp()

        // Then
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertEquals("Đã bị trùng", state.error)
        assertFalse(state.isSignUpSuccess)
    }

    @Test
    fun `updateEmail clears error state`() = runTest {
        // Given - state has error
        viewModel.signUp() // will set error
        
        var state = viewModel.uiState.value
        assertNotNull(state.error)

        // When
        viewModel.updateEmail("new@example.com")

        // Then
        state = viewModel.uiState.value
        assertNull(state.error)
    }

    @Test
    fun `updatePassword clears password error state`() = runTest {
        // Given - password too short
        viewModel.updateEmail("test@example.com")
        viewModel.updatePhone("+84901234567")
        viewModel.updatePassword("short")
        viewModel.updateConfirmPassword("short")
        viewModel.updateAgreeTerms(true)
        viewModel.signUp()
        
        var state = viewModel.uiState.value
        assertNotNull(state.passwordError)

        // When
        viewModel.updatePassword("longerpassword")

        // Then
        state = viewModel.uiState.value
        assertNull(state.passwordError)
    }
}
