package com.pikasonix.wayo.data.local.dao

import androidx.room.*
import com.pikasonix.wayo.data.local.entity.PendingActionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingActionsDao {
    
    @Query("SELECT * FROM pending_actions WHERE status = 'PENDING' ORDER BY created_at LIMIT :limit")
    suspend fun getPendingActions(limit: Int = 50): List<PendingActionEntity>
    
    @Query("SELECT * FROM pending_actions WHERE status IN ('PENDING', 'IN_FLIGHT') ORDER BY created_at")
    fun observeAllPending(): Flow<List<PendingActionEntity>>
    
    @Query("SELECT COUNT(*) FROM pending_actions WHERE status = 'PENDING'")
    fun observePendingCount(): Flow<Int>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(action: PendingActionEntity)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(actions: List<PendingActionEntity>)
    
    @Update
    suspend fun update(action: PendingActionEntity)
    
    @Query("DELETE FROM pending_actions WHERE id = :actionId")
    suspend fun deleteById(actionId: String)
    
    @Query("DELETE FROM pending_actions WHERE status = 'DONE' AND created_at < :olderThan")
    suspend fun deleteOldDone(olderThan: Long)
    
    @Query("UPDATE pending_actions SET status = 'FAILED', last_error = :error WHERE id = :actionId")
    suspend fun markAsFailed(actionId: String, error: String)
}
