package com.pikasonix.wayo.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pikasonix.wayo.data.model.AssignedRoute
import com.pikasonix.wayo.data.model.RouteStatus
import com.pikasonix.wayo.data.repository.AssignedRouteRepository
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * Screen showing list of routes assigned to the current driver
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssignedRoutesScreen(
    driverId: String,
    onRouteSelected: (routeId: String) -> Unit,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val repository = remember { AssignedRouteRepository() }
    val scope = rememberCoroutineScope()
    
    var routes by remember { mutableStateOf<List<AssignedRoute>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    
    // Load routes on first composition
    LaunchedEffect(driverId) {
        isLoading = true
        error = null
        try {
            routes = repository.getAssignedRoutes(driverId)
        } catch (e: Exception) {
            error = "Không thể tải danh sách tuyến đường"
        } finally {
            isLoading = false
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Tuyến đường của tôi",
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Quay lại")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        scope.launch {
                            isLoading = true
                            routes = repository.getAssignedRoutes(driverId)
                            isLoading = false
                        }
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Làm mới")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1F2937),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        modifier = modifier
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Color(0xFFF3F4F6))
        ) {
            when {
                isLoading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = Color(0xFF3B82F6)
                    )
                }
                
                error != null -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = Color(0xFFEF4444),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            error!!,
                            color = Color(0xFF6B7280)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                scope.launch {
                                    isLoading = true
                                    error = null
                                    routes = repository.getAssignedRoutes(driverId)
                                    isLoading = false
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF3B82F6)
                            )
                        ) {
                            Text("Thử lại")
                        }
                    }
                }
                
                routes.isEmpty() -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Route,
                            contentDescription = null,
                            tint = Color(0xFF9CA3AF),
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "Chưa có tuyến đường nào",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF6B7280)
                        )
                        Text(
                            "Các tuyến đường được gán sẽ hiển thị ở đây",
                            fontSize = 14.sp,
                            color = Color(0xFF9CA3AF)
                        )
                    }
                }
                
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(routes) { route ->
                            RouteCard(
                                route = route,
                                onClick = { onRouteSelected(route.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RouteCard(
    route: AssignedRoute,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF3B82F6)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Route,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    
                    Column {
                        Text(
                            "Tuyến #${route.id.take(8)}",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                            color = Color(0xFF1F2937)
                        )
                        Text(
                            formatDate(route.createdAt),
                            fontSize = 12.sp,
                            color = Color(0xFF9CA3AF)
                        )
                    }
                }
                
                StatusChip(status = route.status)
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Metrics row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                MetricItem(
                    icon = Icons.Default.Straighten,
                    value = route.totalDistanceKm?.let { "%.1f km".format(it) } ?: "--",
                    label = "Khoảng cách"
                )
                MetricItem(
                    icon = Icons.Default.Schedule,
                    value = route.totalDurationHours?.let { 
                        val hours = it.toInt()
                        val minutes = ((it - hours) * 60).toInt()
                        if (hours > 0) "${hours}h ${minutes}m" else "${minutes} phút"
                    } ?: "--",
                    label = "Thời gian"
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Action button
            Button(
                onClick = onClick,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = when (route.status) {
                        RouteStatus.ASSIGNED -> Color(0xFF3B82F6)
                        RouteStatus.IN_PROGRESS -> Color(0xFFF59E0B)
                        else -> Color(0xFF6B7280)
                    }
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(
                    when (route.status) {
                        RouteStatus.ASSIGNED -> Icons.Default.PlayArrow
                        RouteStatus.IN_PROGRESS -> Icons.Default.Navigation
                        else -> Icons.Default.Visibility
                    },
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    when (route.status) {
                        RouteStatus.ASSIGNED -> "Bắt đầu tuyến"
                        RouteStatus.IN_PROGRESS -> "Tiếp tục điều hướng"
                        else -> "Xem chi tiết"
                    }
                )
            }
        }
    }
}

@Composable
private fun StatusChip(status: RouteStatus) {
    val (backgroundColor, textColor, text) = when (status) {
        RouteStatus.PLANNED -> Triple(Color(0xFFF3F4F6), Color(0xFF6B7280), "Đã lên kế hoạch")
        RouteStatus.ASSIGNED -> Triple(Color(0xFFDBEAFE), Color(0xFF3B82F6), "Đã gán")
        RouteStatus.IN_PROGRESS -> Triple(Color(0xFFFEF3C7), Color(0xFFF59E0B), "Đang thực hiện")
        RouteStatus.COMPLETED -> Triple(Color(0xFFD1FAE5), Color(0xFF10B981), "Hoàn thành")
        RouteStatus.CANCELLED -> Triple(Color(0xFFFEE2E2), Color(0xFFEF4444), "Đã hủy")
    }
    
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = backgroundColor
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = textColor
        )
    }
}

@Composable
private fun MetricItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = Color(0xFF9CA3AF),
            modifier = Modifier.size(20.dp)
        )
        Text(
            value,
            fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp,
            color = Color(0xFF1F2937)
        )
        Text(
            label,
            fontSize = 12.sp,
            color = Color(0xFF9CA3AF)
        )
    }
}

private fun formatDate(isoString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        val date = inputFormat.parse(isoString)
        date?.let { outputFormat.format(it) } ?: isoString
    } catch (e: Exception) {
        isoString.take(16)
    }
}
