package com.pikasonix.wayo.ui.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pikasonix.wayo.data.model.RouteStep

/**
 * Compact Guidance HUD showing current navigation step
 */
@Composable
fun GuidanceHUD(
    visible: Boolean,
    currentStep: RouteStep?,
    stepIndex: Int,
    totalSteps: Int,
    distanceToStep: Double,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onStop: () -> Unit,
    formatDistance: (Double) -> String,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible && currentStep != null,
        enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut(),
        modifier = modifier
    ) {
        currentStep?.let { step ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(12.dp)
            ) {
                // Main instruction row
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Maneuver icon
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF22C55E)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = getManeuverIcon(step.maneuver),
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                    
                    // Instruction text
                    Column(
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = step.instruction.ifBlank { "Tiếp tục đi thẳng" },
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF1F2937),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Step indicator
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF3B82F6))
                            )
                            Text(
                                text = "Bước ${stepIndex + 1} / $totalSteps",
                                fontSize = 12.sp,
                                color = Color(0xFF6B7280)
                            )
                            
                            // Distance
                            Icon(
                                imageVector = Icons.Default.Straighten,
                                contentDescription = null,
                                tint = Color(0xFF6B7280),
                                modifier = Modifier.size(12.dp)
                            )
                            Text(
                                text = formatDistance(step.distance),
                                fontSize = 12.sp,
                                color = Color(0xFF6B7280)
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(10.dp))
                
                // Control buttons - compact
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Previous button
                    OutlinedButton(
                        onClick = onPrevious,
                        enabled = stepIndex > 0,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ChevronLeft,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Text("Trước", fontSize = 13.sp)
                    }
                    
                    // Next button
                    Button(
                        onClick = onNext,
                        enabled = stepIndex < totalSteps - 1,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        shape = RoundedCornerShape(20.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF3B82F6)
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Tiếp", fontSize = 13.sp)
                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    
                    // Stop button
                    Button(
                        onClick = onStop,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        shape = RoundedCornerShape(20.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFEF4444)
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Stop,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Text("Dừng", fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

/**
 * Get appropriate icon for maneuver type
 */
private fun getManeuverIcon(maneuver: String?): ImageVector {
    if (maneuver == null) return Icons.Default.ArrowUpward
    return when {
        maneuver.contains("left", ignoreCase = true) -> Icons.AutoMirrored.Filled.ArrowBack
        maneuver.contains("right", ignoreCase = true) -> Icons.AutoMirrored.Filled.ArrowForward
        maneuver.contains("straight", ignoreCase = true) -> Icons.Default.ArrowUpward
        maneuver.contains("uturn", ignoreCase = true) -> Icons.Default.Refresh
        maneuver.contains("arrive", ignoreCase = true) -> Icons.Default.Flag
        maneuver.contains("depart", ignoreCase = true) -> Icons.Default.NearMe
        maneuver.contains("roundabout", ignoreCase = true) -> Icons.Default.RotateRight
        maneuver.contains("merge", ignoreCase = true) -> Icons.Default.MergeType
        maneuver.contains("fork", ignoreCase = true) -> Icons.Default.CallSplit
        maneuver.contains("ramp", ignoreCase = true) -> Icons.Default.CallMade
        else -> Icons.Default.ArrowUpward
    }
}
