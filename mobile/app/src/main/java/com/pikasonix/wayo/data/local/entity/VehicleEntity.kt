package com.pikasonix.wayo.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "vehicles")
data class VehicleEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,
    
    @ColumnInfo(name = "license_plate")
    val licensePlate: String,
    
    @ColumnInfo(name = "model")
    val model: String,
    
    @ColumnInfo(name = "capacity")
    val capacity: Double?,
    
    @ColumnInfo(name = "status")
    val status: String,
    
    @ColumnInfo(name = "current_driver_id")
    val currentDriverId: String?,
    
    @ColumnInfo(name = "created_at")
    val createdAt: Long,
    
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,
    
    @ColumnInfo(name = "synced_at")
    val syncedAt: Long
)
