package com.pikasonix.wayo.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "orders",
    foreignKeys = [
        ForeignKey(
            entity = RouteStopEntity::class,
            parentColumns = ["id"],
            childColumns = ["stop_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("stop_id"), Index("order_number")]
)
data class OrderEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,
    
    @ColumnInfo(name = "stop_id")
    val stopId: String,
    
    @ColumnInfo(name = "order_number")
    val orderNumber: String,
    
    @ColumnInfo(name = "customer_name")
    val customerName: String,
    
    @ColumnInfo(name = "customer_phone")
    val customerPhone: String?,
    
    @ColumnInfo(name = "items_count")
    val itemsCount: Int,
    
    @ColumnInfo(name = "status")
    val status: String, // "pending", "delivered", "failed"
    
    @ColumnInfo(name = "created_at")
    val createdAt: Long,
    
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,
    
    @ColumnInfo(name = "synced_at")
    val syncedAt: Long
)
