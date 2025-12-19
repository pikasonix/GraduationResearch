package com.pikasonix.wayo.ui.components

import androidx.compose.animation.*
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pikasonix.wayo.ui.viewmodel.MapStyle

/**
 * Map settings panel with style, traffic, 3D mode controls
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapSettingsPanel(
    currentStyle: MapStyle,
    showTrafficLayer: Boolean,
    showCongestionColors: Boolean,
    is3DMode: Boolean,
    onStyleChange: (MapStyle) -> Unit,
    onToggleTraffic: () -> Unit,
    onToggleCongestion: () -> Unit,
    onToggle3D: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .width(280.dp)
            .shadow(12.dp, RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Cài đặt bản đồ",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1F2937)
                )
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng",
                        tint = Color(0xFF6B7280)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Toggle options
            Text(
                text = "Hiển thị",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF6B7280)
            )
            Spacer(modifier = Modifier.height(8.dp))
            
            ToggleOption(
                icon = Icons.Default.Traffic,
                label = "Giao thông",
                isEnabled = showTrafficLayer,
                onClick = onToggleTraffic
            )
            
            ToggleOption(
                icon = Icons.Default.ShowChart,
                label = "Màu tắc đường",
                isEnabled = showCongestionColors,
                onClick = onToggleCongestion
            )
            
            ToggleOption(
                icon = Icons.Default.ViewInAr,
                label = "Chế độ 3D",
                isEnabled = is3DMode,
                onClick = onToggle3D
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider(color = Color(0xFFE5E7EB))
            Spacer(modifier = Modifier.height(16.dp))
            
            // Map styles
            Text(
                text = "Kiểu bản đồ",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF6B7280)
            )
            Spacer(modifier = Modifier.height(8.dp))
            
            MapStyle.entries.forEach { style ->
                StyleOption(
                    style = style,
                    isSelected = currentStyle == style,
                    onClick = { onStyleChange(style) }
                )
            }
        }
    }
}

@Composable
private fun ToggleOption(
    icon: ImageVector,
    label: String,
    isEnabled: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isEnabled) Color(0xFF2563EB) else Color(0xFF9CA3AF),
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = label,
                fontSize = 14.sp,
                color = Color(0xFF374151)
            )
        }
        
        Switch(
            checked = isEnabled,
            onCheckedChange = { onClick() },
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Color(0xFF2563EB),
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = Color(0xFFD1D5DB)
            )
        )
    }
}

@Composable
private fun StyleOption(
    style: MapStyle,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(if (isSelected) Color(0xFFEFF6FF) else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Style icon/indicator
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(getStyleColor(style)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = getStyleIcon(style),
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
        }
        
        Text(
            text = style.label,
            fontSize = 14.sp,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (isSelected) Color(0xFF2563EB) else Color(0xFF374151),
            modifier = Modifier.weight(1f)
        )
        
        if (isSelected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = null,
                tint = Color(0xFF2563EB),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

private fun getStyleIcon(style: MapStyle): ImageVector {
    return when (style) {
        MapStyle.STREETS -> Icons.Default.Map
        MapStyle.OUTDOORS -> Icons.Default.Terrain
        MapStyle.LIGHT -> Icons.Default.LightMode
        MapStyle.DARK -> Icons.Default.DarkMode
        MapStyle.SATELLITE -> Icons.Default.Satellite
        MapStyle.TRAFFIC_DAY -> Icons.Default.Traffic
        MapStyle.TRAFFIC_NIGHT -> Icons.Default.NightsStay
    }
}

private fun getStyleColor(style: MapStyle): Color {
    return when (style) {
        MapStyle.STREETS -> Color(0xFF3B82F6)
        MapStyle.OUTDOORS -> Color(0xFF22C55E)
        MapStyle.LIGHT -> Color(0xFFF59E0B)
        MapStyle.DARK -> Color(0xFF6366F1)
        MapStyle.SATELLITE -> Color(0xFF059669)
        MapStyle.TRAFFIC_DAY -> Color(0xFFEF4444)
        MapStyle.TRAFFIC_NIGHT -> Color(0xFF8B5CF6)
    }
}

/**
 * Quick map controls floating button bar
 */
@Composable
fun QuickMapControls(
    showTrafficLayer: Boolean,
    is3DMode: Boolean,
    onToggleTraffic: () -> Unit,
    onToggle3D: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Traffic toggle
        QuickControlButton(
            icon = Icons.Default.Traffic,
            isActive = showTrafficLayer,
            onClick = onToggleTraffic,
            contentDescription = "Giao thông"
        )
        
        // 3D toggle
        QuickControlButton(
            icon = Icons.Default.ViewInAr,
            isActive = is3DMode,
            onClick = onToggle3D,
            contentDescription = "3D"
        )
        
        // Settings
        QuickControlButton(
            icon = Icons.Default.Layers,
            isActive = false,
            onClick = onOpenSettings,
            contentDescription = "Cài đặt"
        )
    }
}

@Composable
private fun QuickControlButton(
    icon: ImageVector,
    isActive: Boolean,
    onClick: () -> Unit,
    contentDescription: String
) {
    FilledIconButton(
        onClick = onClick,
        colors = IconButtonDefaults.filledIconButtonColors(
            containerColor = if (isActive) Color(0xFF2563EB) else Color.White
        ),
        modifier = Modifier
            .size(44.dp)
            .shadow(4.dp, CircleShape)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = if (isActive) Color.White else Color(0xFF374151)
        )
    }
}
