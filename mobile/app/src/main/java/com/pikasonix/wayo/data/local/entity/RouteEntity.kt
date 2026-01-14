package com.pikasonix.wayo.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "routes")
data class RouteEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,
    
    @ColumnInfo(name = "driver_id")
    val driverId: String,
    
    @ColumnInfo(name = "vehicle_id")
    val vehicleId: String?,
    
    @ColumnInfo(name = "status")
    val status: String, // "assigned", "in_progress", "completed", "cancelled"
    
    @ColumnInfo(name = "scheduled_date")
    val scheduledDate: Long,
    
    @ColumnInfo(name = "started_at")
    val startedAt: Long?,
    
    @ColumnInfo(name = "completed_at")
    val completedAt: Long?,
    
    @ColumnInfo(name = "total_stops")
    val totalStops: Int,
    
    @ColumnInfo(name = "completed_stops")
    val completedStops: Int,
    
    @ColumnInfo(name = "created_at")
    val createdAt: Long,
    
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,
    
    @ColumnInfo(name = "synced_at")
    val syncedAt: Long
)
