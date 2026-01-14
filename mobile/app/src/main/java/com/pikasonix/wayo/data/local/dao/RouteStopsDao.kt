package com.pikasonix.wayo.data.local.dao

import androidx.room.*
import com.pikasonix.wayo.data.local.entity.RouteStopEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RouteStopsDao {
    
    @Query("SELECT * FROM route_stops WHERE route_id = :routeId ORDER BY sequence")
    fun observeStopsByRoute(routeId: String): Flow<List<RouteStopEntity>>
    
    @Query("SELECT * FROM route_stops WHERE id = :stopId")
    suspend fun getById(stopId: String): RouteStopEntity?
    
    @Query("SELECT * FROM route_stops WHERE route_id = :routeId ORDER BY sequence")
    suspend fun getStopsByRoute(routeId: String): List<RouteStopEntity>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(stops: List<RouteStopEntity>)
    
    @Update
    suspend fun update(stop: RouteStopEntity)
    
    @Query("DELETE FROM route_stops WHERE route_id = :routeId")
    suspend fun deleteByRoute(routeId: String)
}
