package com.pikasonix.wayo.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "pending_actions",
    indices = [Index("status"), Index("created_at")]
)
data class PendingActionEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,
    
    @ColumnInfo(name = "type")
    val type: String, // "start_route", "complete_route", "complete_stop", "tracking_ping"
    
    @ColumnInfo(name = "payload_json")
    val payloadJson: String,
    
    @ColumnInfo(name = "created_at")
    val createdAt: Long,
    
    @ColumnInfo(name = "attempt_count")
    val attemptCount: Int = 0,
    
    @ColumnInfo(name = "last_attempt_at")
    val lastAttemptAt: Long? = null,
    
    @ColumnInfo(name = "last_error")
    val lastError: String? = null,
    
    @ColumnInfo(name = "status")
    val status: String, // "PENDING", "IN_FLIGHT", "DONE", "FAILED"
    
    @ColumnInfo(name = "idempotency_key")
    val idempotencyKey: String
)
