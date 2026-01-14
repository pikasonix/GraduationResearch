package com.pikasonix.wayo.data.local.dao

import androidx.room.*
import com.pikasonix.wayo.data.local.entity.OrderEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface OrdersDao {
    
    @Query("SELECT * FROM orders WHERE stop_id = :stopId")
    fun observeOrdersByStop(stopId: String): Flow<List<OrderEntity>>
    
    @Query("SELECT * FROM orders WHERE id = :orderId")
    suspend fun getById(orderId: String): OrderEntity?
    
    @Query("SELECT * FROM orders WHERE stop_id = :stopId")
    suspend fun getOrdersByStop(stopId: String): List<OrderEntity>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(orders: List<OrderEntity>)
    
    @Update
    suspend fun update(order: OrderEntity)
    
    @Query("DELETE FROM orders WHERE stop_id IN (SELECT id FROM route_stops WHERE route_id = :routeId)")
    suspend fun deleteByRoute(routeId: String)
}
