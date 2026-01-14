package com.pikasonix.wayo.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "route_stops",
    foreignKeys = [
        ForeignKey(
            entity = RouteEntity::class,
            parentColumns = ["id"],
            childColumns = ["route_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("route_id"), Index("sequence")]
)
data class RouteStopEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,
    
    @ColumnInfo(name = "route_id")
    val routeId: String,
    
    @ColumnInfo(name = "sequence")
    val sequence: Int,
    
    @ColumnInfo(name = "location_name")
    val locationName: String,
    
    @ColumnInfo(name = "latitude")
    val latitude: Double,
    
    @ColumnInfo(name = "longitude")
    val longitude: Double,
    
    @ColumnInfo(name = "type")
    val type: String, // "pickup" or "delivery"
    
    @ColumnInfo(name = "status")
    val status: String, // "pending", "in_progress", "completed", "failed"
    
    @ColumnInfo(name = "scheduled_time")
    val scheduledTime: Long?,
    
    @ColumnInfo(name = "time_window_start")
    val timeWindowStart: Long?,
    
    @ColumnInfo(name = "time_window_end")
    val timeWindowEnd: Long?,
    
    @ColumnInfo(name = "completed_at")
    val completedAt: Long?,
    
    @ColumnInfo(name = "notes")
    val notes: String?,
    
    @ColumnInfo(name = "created_at")
    val createdAt: Long,
    
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,
    
    @ColumnInfo(name = "synced_at")
    val syncedAt: Long
)
