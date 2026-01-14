package com.pikasonix.wayo.data.local.dao

import androidx.room.*
import com.pikasonix.wayo.data.local.entity.RouteEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RoutesDao {
    
    @Query("SELECT * FROM routes WHERE driver_id = :driverId AND status IN ('assigned', 'in_progress') ORDER BY scheduled_date")
    fun observeAssignedRoutes(driverId: String): Flow<List<RouteEntity>>
    
    @Query("SELECT * FROM routes WHERE id = :routeId")
    fun observeRouteById(routeId: String): Flow<RouteEntity?>
    
    @Query("SELECT * FROM routes WHERE id = :routeId")
    suspend fun getById(routeId: String): RouteEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(routes: List<RouteEntity>)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(route: RouteEntity)
    
    @Update
    suspend fun update(route: RouteEntity)
    
    @Query("DELETE FROM routes WHERE driver_id = :driverId AND status = 'completed' AND completed_at < :olderThan")
    suspend fun deleteOldCompleted(driverId: String, olderThan: Long)
}
