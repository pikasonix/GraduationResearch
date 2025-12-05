package com.pikasonix.wayo.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.pikasonix.wayo.ui.viewmodel.SignUpViewModel

/**
 * Sign Up Screen composable - matching frontend design
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignUpScreen(
    onSignUpSuccess: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: SignUpViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    
    // Navigate on successful signup
    LaunchedEffect(uiState.isSignUpSuccess) {
        if (uiState.isSignUpSuccess) {
            onSignUpSuccess()
        }
    }
    
    // Background matching frontend auth-bg
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC)) // Light gray background like frontend
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(60.dp))
            
            // Logo and App Name - matching frontend
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                // Logo box
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF1E88E5)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "W",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                
                Spacer(modifier = Modifier.width(12.dp))
                
                Text(
                    text = "WAYO",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF1F2937)
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Title
            Text(
                text = "Tạo tài khoản mới",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF1F2937)
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Subtitle
            Text(
                text = "Tham gia cộng đồng và bắt đầu ngay hôm nay",
                fontSize = 14.sp,
                color = Color(0xFF6B7280),
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // Sign Up Form Card - matching frontend style
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE5E7EB))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp)
                ) {
                    // Error message
                    uiState.error?.let { error ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = Color(0xFFFEF2F2)
                            ),
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFECACA))
                        ) {
                            Text(
                                text = error,
                                color = Color(0xFFDC2626),
                                fontSize = 14.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }
                    
                    // Email field
                    Text(
                        text = "Email",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF374151),
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                    OutlinedTextField(
                        value = uiState.email,
                        onValueChange = viewModel::updateEmail,
                        placeholder = { 
                            Text(
                                "Nhập email của bạn",
                                color = Color(0xFF9CA3AF)
                            ) 
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF3B82F6),
                            unfocusedBorderColor = Color(0xFFD1D5DB)
                        )
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Phone field
                    Text(
                        text = "Số điện thoại",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF374151),
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                    OutlinedTextField(
                        value = uiState.phone,
                        onValueChange = viewModel::updatePhone,
                        placeholder = { 
                            Text(
                                "Nhập số điện thoại của bạn",
                                color = Color(0xFF9CA3AF)
                            ) 
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Phone,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF3B82F6),
                            unfocusedBorderColor = Color(0xFFD1D5DB)
                        )
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Password field
                    Text(
                        text = "Mật khẩu",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF374151),
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                    OutlinedTextField(
                        value = uiState.password,
                        onValueChange = viewModel::updatePassword,
                        placeholder = { 
                            Text(
                                "Tạo mật khẩu",
                                color = Color(0xFF9CA3AF)
                            ) 
                        },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = if (passwordVisible) "Ẩn mật khẩu" else "Hiện mật khẩu",
                                    tint = Color(0xFF6B7280)
                                )
                            }
                        },
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF3B82F6),
                            unfocusedBorderColor = Color(0xFFD1D5DB)
                        )
                    )
                    Text(
                        text = "Phải có ít nhất 8 ký tự",
                        fontSize = 12.sp,
                        color = Color(0xFF6B7280),
                        modifier = Modifier.padding(top = 4.dp)
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Confirm Password field
                    Text(
                        text = "Xác nhận mật khẩu",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF374151),
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                    OutlinedTextField(
                        value = uiState.confirmPassword,
                        onValueChange = viewModel::updateConfirmPassword,
                        placeholder = { 
                            Text(
                                "Xác nhận mật khẩu của bạn",
                                color = Color(0xFF9CA3AF)
                            ) 
                        },
                        trailingIcon = {
                            IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                                Icon(
                                    imageVector = if (confirmPasswordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = if (confirmPasswordVisible) "Ẩn mật khẩu" else "Hiện mật khẩu",
                                    tint = Color(0xFF6B7280)
                                )
                            }
                        },
                        visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.signUp()
                            }
                        ),
                        singleLine = true,
                        isError = uiState.passwordError != null,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF3B82F6),
                            unfocusedBorderColor = Color(0xFFD1D5DB),
                            errorBorderColor = Color(0xFFDC2626)
                        )
                    )
                    uiState.passwordError?.let { error ->
                        Text(
                            text = error,
                            fontSize = 12.sp,
                            color = Color(0xFFDC2626),
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Terms checkbox
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = uiState.agreeTerms,
                            onCheckedChange = viewModel::updateAgreeTerms,
                            colors = CheckboxDefaults.colors(
                                checkedColor = Color(0xFF2563EB)
                            )
                        )
                        
                        val annotatedString = buildAnnotatedString {
                            append("Tôi đồng ý với ")
                            pushStringAnnotation(tag = "terms", annotation = "terms")
                            withStyle(
                                style = SpanStyle(
                                    color = Color(0xFF2563EB),
                                    textDecoration = TextDecoration.Underline
                                )
                            ) {
                                append("Điều khoản dịch vụ")
                            }
                            pop()
                            append(" và ")
                            pushStringAnnotation(tag = "privacy", annotation = "privacy")
                            withStyle(
                                style = SpanStyle(
                                    color = Color(0xFF2563EB),
                                    textDecoration = TextDecoration.Underline
                                )
                            ) {
                                append("Chính sách bảo mật")
                            }
                            pop()
                        }
                        
                        ClickableText(
                            text = annotatedString,
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color(0xFF374151)
                            ),
                            onClick = { offset ->
                                annotatedString.getStringAnnotations(tag = "terms", start = offset, end = offset)
                                    .firstOrNull()?.let {
                                        // TODO: Navigate to terms
                                    }
                                annotatedString.getStringAnnotations(tag = "privacy", start = offset, end = offset)
                                    .firstOrNull()?.let {
                                        // TODO: Navigate to privacy
                                    }
                            }
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Sign Up button - matching frontend style
                    Button(
                        onClick = viewModel::signUp,
                        enabled = !uiState.isLoading && uiState.agreeTerms,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF2563EB),
                            disabledContainerColor = Color(0xFF93C5FD)
                        )
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = "Tạo tài khoản",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // Login link - matching frontend
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Đã có tài khoản? ",
                    color = Color(0xFF6B7280),
                    fontSize = 14.sp
                )
                TextButton(
                    onClick = onNavigateToLogin,
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text(
                        text = "Đăng nhập",
                        color = Color(0xFF2563EB),
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        textDecoration = TextDecoration.Underline
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
