package com.pikasonix.wayo.ui.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pikasonix.wayo.data.model.RouteStep
import com.pikasonix.wayo.ui.viewmodel.SimulationState
import java.text.SimpleDateFormat
import java.util.*

/**
 * Navigation bottom bar for route simulation/navigation
 * Compact design with swipe-up for route details
 */
@Composable
fun SimulationPanel(
    simulation: SimulationState,
    canSimulate: Boolean,
    onTogglePlay: () -> Unit,
    onReset: () -> Unit,
    onToggleFollow: () -> Unit,
    onSpeedChange: (Float) -> Unit,
    formatDistance: (Double) -> String,
    formatDuration: (Double) -> String,
    routeSteps: List<RouteStep> = emptyList(),
    modifier: Modifier = Modifier
) {
    var currentTime by remember { mutableStateOf(getCurrentTime()) }
    var isExpanded by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        while (true) {
            currentTime = getCurrentTime()
            kotlinx.coroutines.delay(1000)
        }
    }
    
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937))
    ) {
        Column {
            // Handle bar for swipe
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .pointerInput(Unit) {
                        detectVerticalDragGestures { _, dragAmount ->
                            if (dragAmount < -20) isExpanded = true
                            if (dragAmount > 20) isExpanded = false
                        }
                    }
                    .clickable { isExpanded = !isExpanded }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color(0xFF4B5563))
                )
            }
            
            // Main content
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                // Top row: Speed, Time, Play button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Speed indicator
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFF59E0B)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "0",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Black
                            )
                            Text(
                                text = "km/h",
                                fontSize = 8.sp,
                                color = Color.Black
                            )
                        }
                    }
                    
                    // Time and ETA
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = currentTime,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Icon(
                                imageVector = Icons.Default.VolumeUp,
                                contentDescription = null,
                                tint = Color(0xFF6B7280),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Text(
                            text = "${formatDuration(simulation.remainingDuration)} • ${formatDistance(simulation.remainingDistance)}",
                            fontSize = 13.sp,
                            color = Color(0xFF9CA3AF)
                        )
                    }
                    
                    // Play/Pause
                    FilledIconButton(
                        onClick = onTogglePlay,
                        enabled = canSimulate,
                        colors = IconButtonDefaults.filledIconButtonColors(
                            containerColor = if (simulation.isPlaying) Color(0xFFCA8A04) else Color(0xFF3B82F6)
                        ),
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = if (simulation.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(12.dp))
                
                // Bottom row: Controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Search
                    IconButton(
                        onClick = { },
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF374151))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    
                    // Speed selector
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF374151))
                            .padding(horizontal = 4.dp, vertical = 2.dp),
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        listOf(0.5f, 1f, 2f).forEach { speed ->
                            val isSelected = simulation.speed == speed
                            Text(
                                text = "${speed}x",
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) Color(0xFF3B82F6) else Color(0xFF9CA3AF),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { onSpeedChange(speed) }
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                    
                    // Reset
                    IconButton(
                        onClick = onReset,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF374151))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Replay,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
            
            // Expanded route list
            AnimatedVisibility(
                visible = isExpanded && routeSteps.isNotEmpty(),
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Column {
                    HorizontalDivider(color = Color(0xFF374151))
                    
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 300.dp)
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        itemsIndexed(routeSteps) { index, step ->
                            RouteStepItem(
                                step = step,
                                stepNumber = index + 1,
                                formatDistance = formatDistance,
                                isActive = index == simulation.currentStepIndex
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RouteStepItem(
    step: RouteStep,
    stepNumber: Int,
    formatDistance: (Double) -> String,
    isActive: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (isActive) Color(0xFF374151) else Color.Transparent)
            .padding(vertical = 8.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Step number
        Box(
            modifier = Modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(if (isActive) Color(0xFF3B82F6) else Color(0xFF4B5563)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "$stepNumber",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
        
        // Instruction
        Text(
            text = step.instruction.ifBlank { "Tiếp tục" },
            fontSize = 13.sp,
            color = Color.White,
            modifier = Modifier.weight(1f)
        )
        
        // Distance
        Text(
            text = formatDistance(step.distance),
            fontSize = 12.sp,
            color = Color(0xFF9CA3AF)
        )
    }
}

private fun getCurrentTime(): String {
    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
    return sdf.format(Date())
}
