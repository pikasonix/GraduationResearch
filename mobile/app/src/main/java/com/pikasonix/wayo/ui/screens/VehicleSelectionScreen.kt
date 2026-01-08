package com.pikasonix.wayo.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import com.pikasonix.wayo.data.model.Vehicle
import com.pikasonix.wayo.data.repository.VehicleRepository
import kotlinx.coroutines.launch

/**
 * Screen for driver to select their default vehicle
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VehicleSelectionScreen(
    driverId: String,
    organizationId: String,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val repository = remember { VehicleRepository() }
    val scope = rememberCoroutineScope()
    
    var vehicles by remember { mutableStateOf<List<Vehicle>>(emptyList()) }
    var currentVehicle by remember { mutableStateOf<Vehicle?>(null) }
    var selectedVehicleId by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }
    var showSuccessDialog by remember { mutableStateOf(false) }
    
    // Load vehicles on first composition
    LaunchedEffect(driverId, organizationId) {
        isLoading = true
        error = null
        try {
            val available = repository.getAvailableVehicles(organizationId)
            val current = repository.getDriverVehicle(driverId)
            vehicles = available
            currentVehicle = current
            selectedVehicleId = current?.id
        } catch (e: Exception) {
            error = "Không thể tải danh sách xe: ${e.message}"
        } finally {
            isLoading = false
        }
    }
    
    fun handleAssignVehicle() {
        val vehicleId = selectedVehicleId ?: return
        scope.launch {
            isSubmitting = true
            try {
                repository.assignDriverToVehicle(
                    vehicleId = vehicleId,
                    driverId = driverId,
                    organizationId = organizationId
                )
                currentVehicle = repository.getDriverVehicle(driverId)
                showSuccessDialog = true
            } catch (e: Exception) {
                error = "Không thể gán xe: ${e.message}"
            } finally {
                isSubmitting = false
            }
        }
    }
    
    fun handleUnassignVehicle() {
        scope.launch {
            isSubmitting = true
            try {
                repository.unassignDriverFromVehicle(
                    driverId = driverId,
                    organizationId = organizationId
                )
                currentVehicle = null
                selectedVehicleId = null
                showSuccessDialog = true
            } catch (e: Exception) {
                error = "Không thể bỏ gán xe: ${e.message}"
            } finally {
                isSubmitting = false
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Chọn Phương Tiện",
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
                            vehicles = repository.getAvailableVehicles(organizationId)
                            currentVehicle = repository.getDriverVehicle(driverId)
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
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                
                error != null -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = Color(0xFFEF4444),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            error ?: "",
                            color = Color(0xFF6B7280),
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onNavigateBack) {
                            Text("Quay lại")
                        }
                    }
                }
                
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Current Vehicle Card (if exists)
                        currentVehicle?.let { vehicle ->
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(
                                        containerColor = Color(0xFFDCFCE7)
                                    ),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(16.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.Top
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    "Xe hiện tại của bạn",
                                                    style = MaterialTheme.typography.labelMedium,
                                                    color = Color(0xFF059669)
                                                )
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    vehicle.licensePlate,
                                                    style = MaterialTheme.typography.headlineSmall,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color(0xFF047857)
                                                )
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    "${vehicle.getVehicleTypeLabel()} • ${vehicle.capacityWeight}kg",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = Color(0xFF065F46)
                                                )
                                            }
                                            
                                            TextButton(
                                                onClick = { handleUnassignVehicle() },
                                                enabled = !isSubmitting
                                            ) {
                                                Text(
                                                    "Bỏ gán",
                                                    color = Color(0xFFDC2626)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Section Header
                        item {
                            Text(
                                "Chọn xe mặc định",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF111827),
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }
                        
                        // Vehicle List
                        if (vehicles.isEmpty()) {
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(
                                        containerColor = Color.White
                                    )
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(32.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Icon(
                                            Icons.Default.Info,
                                            contentDescription = null,
                                            tint = Color(0xFF9CA3AF),
                                            modifier = Modifier.size(48.dp)
                                        )
                                        Spacer(modifier = Modifier.height(16.dp))
                                        Text(
                                            "Không có xe khả dụng",
                                            style = MaterialTheme.typography.bodyLarge,
                                            color = Color(0xFF6B7280)
                                        )
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            "Vui lòng liên hệ quản lý để được gán xe",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF9CA3AF)
                                        )
                                    }
                                }
                            }
                        } else {
                            items(vehicles) { vehicle ->
                                VehicleCard(
                                    vehicle = vehicle,
                                    isSelected = selectedVehicleId == vehicle.id,
                                    isCurrent = currentVehicle?.id == vehicle.id,
                                    isOccupied = vehicle.defaultDriverId != null && vehicle.defaultDriverId != driverId,
                                    onClick = {
                                        if (vehicle.defaultDriverId == null || vehicle.defaultDriverId == driverId) {
                                            selectedVehicleId = vehicle.id
                                        }
                                    }
                                )
                            }
                        }
                        
                        // Confirm Button (if selection changed)
                        if (selectedVehicleId != null && selectedVehicleId != currentVehicle?.id) {
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(
                                        containerColor = Color.White
                                    ),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(16.dp)
                                    ) {
                                        Text(
                                            "Xác nhận gán xe mặc định?",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            "Xe ${vehicles.find { it.id == selectedVehicleId }?.licensePlate} sẽ được ưu tiên khi dispatcher gán tuyến đường",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF6B7280)
                                        )
                                        Spacer(modifier = Modifier.height(16.dp))
                                        Button(
                                            onClick = { handleAssignVehicle() },
                                            modifier = Modifier.fillMaxWidth(),
                                            enabled = !isSubmitting
                                        ) {
                                            if (isSubmitting) {
                                                CircularProgressIndicator(
                                                    modifier = Modifier.size(20.dp),
                                                    color = Color.White,
                                                    strokeWidth = 2.dp
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text("Đang gán...")
                                            } else {
                                                Icon(
                                                    Icons.Default.Check,
                                                    contentDescription = null,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text("Xác nhận")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Success Dialog
    if (showSuccessDialog) {
        AlertDialog(
            onDismissRequest = { showSuccessDialog = false },
            icon = {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = Color(0xFF10B981),
                    modifier = Modifier.size(48.dp)
                )
            },
            title = { Text("Thành công") },
            text = { Text("Đã cập nhật phương tiện của bạn") },
            confirmButton = {
                TextButton(onClick = { showSuccessDialog = false }) {
                    Text("OK")
                }
            }
        )
    }
}

@Composable
private fun VehicleCard(
    vehicle: Vehicle,
    isSelected: Boolean,
    isCurrent: Boolean,
    isOccupied: Boolean,
    onClick: () -> Unit
) {
    val (bgColor, borderColor, iconColor) = when (vehicle.vehicleType) {
        "motorcycle" -> Triple(Color(0xFFFEF3C7), Color(0xFFF59E0B), Color(0xFFD97706))
        "van" -> Triple(Color(0xFFDBEAFE), Color(0xFF3B82F6), Color(0xFF2563EB))
        "truck_small" -> Triple(Color(0xFFD1FAE5), Color(0xFF10B981), Color(0xFF059669))
        "truck_medium" -> Triple(Color(0xFFE9D5FF), Color(0xFF9333EA), Color(0xFF7C3AED))
        "truck_large" -> Triple(Color(0xFFFECDD3), Color(0xFFEF4444), Color(0xFFDC2626))
        else -> Triple(Color(0xFFF3F4F6), Color(0xFF6B7280), Color(0xFF4B5563))
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (!isOccupied) {
                    Modifier.clickable(onClick = onClick)
                } else {
                    Modifier
                }
            )
            .border(
                width = if (isSelected) 3.dp else 1.dp,
                color = if (isSelected) Color(0xFF3B82F6) else Color(0xFFE5E7EB),
                shape = RoundedCornerShape(12.dp)
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Color(0xFFEFF6FF) else Color.White
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                // Vehicle Icon
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.LocalShipping,
                        contentDescription = null,
                        tint = iconColor,
                        modifier = Modifier.size(32.dp)
                    )
                }
                
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp)
                ) {
                    // Badges
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (isCurrent) {
                            Badge(
                                containerColor = Color(0xFF10B981),
                                contentColor = Color.White
                            ) {
                                Text("Đang dùng", fontSize = 10.sp)
                            }
                        }
                        if (isSelected) {
                            Badge(
                                containerColor = Color(0xFF3B82F6),
                                contentColor = Color.White
                            ) {
                                Text("Đã chọn", fontSize = 10.sp)
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    // License Plate
                    Text(
                        vehicle.licensePlate,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF111827)
                    )
                    
                    // Vehicle Type
                    Text(
                        vehicle.getVehicleTypeLabel(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = iconColor
                    )
                    
                    // Capacity
                    Text(
                        "Tải trọng: ${vehicle.capacityWeight}kg",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF6B7280)
                    )
                    
                    // Occupied Status
                    if (isOccupied && vehicle.driverName != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Surface(
                            color = Color(0xFFFEF3C7),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                "Đã gán cho: ${vehicle.driverName}",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF92400E)
                            )
                        }
                    }
                }
                
                // Selection Icon
                if (isSelected && !isOccupied) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = "Đã chọn",
                        tint = Color(0xFF3B82F6),
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}

// Extension function for vehicle type label
private fun Vehicle.getVehicleTypeLabel(): String = when (vehicleType) {
    "motorcycle" -> "Xe máy"
    "van" -> "Van"
    "truck_small" -> "Xe tải nhỏ"
    "truck_medium" -> "Xe tải vừa"
    "truck_large" -> "Xe tải lớn"
    else -> vehicleType
}
