package com.pikasonix.wayo.data.local.dao

import androidx.room.*
import com.pikasonix.wayo.data.local.entity.DriverProfileEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DriverProfileDao {
    
    @Query("SELECT * FROM driver_profile WHERE user_id = :userId LIMIT 1")
    fun observeByUserId(userId: String): Flow<DriverProfileEntity?>
    
    @Query("SELECT * FROM driver_profile WHERE user_id = :userId LIMIT 1")
    suspend fun getByUserId(userId: String): DriverProfileEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(profile: DriverProfileEntity)
    
    @Update
    suspend fun update(profile: DriverProfileEntity)
    
    @Query("DELETE FROM driver_profile")
    suspend fun deleteAll()
}
