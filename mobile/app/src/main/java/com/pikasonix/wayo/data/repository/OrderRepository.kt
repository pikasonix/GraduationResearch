package com.pikasonix.wayo.data.repository

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.local.dao.OrdersDao
import com.pikasonix.wayo.data.model.Order
import com.pikasonix.wayo.data.remote.backend.dto.toModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrderRepository @Inject constructor(
    private val ordersDao: OrdersDao,
    private val dispatchers: DispatcherProvider
) {
    
    /**
     * Observe orders for a specific stop (offline-first)
     */
    fun observeOrdersByStop(stopId: String): Flow<List<Order>> {
        return ordersDao.observeOrdersByStop(stopId).map { entities ->
            entities.map { it.toModel() }
        }
    }
    
    /**
     * Get a single order by ID
     */
    suspend fun getOrderById(orderId: String): AppResult<Order> = withContext(dispatchers.io) {
        try {
            val entity = ordersDao.getById(orderId)
            if (entity != null) {
                AppResult.Success(entity.toModel())
            } else {
                AppResult.Error(AppError.NotFound("Order not found"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
    
    /**
     * Update order status locally
     */
    suspend fun updateOrderStatus(orderId: String, status: String): AppResult<Unit> = withContext(dispatchers.io) {
        try {
            val entity = ordersDao.getById(orderId)
            if (entity != null) {
                val updated = entity.copy(status = status)
                ordersDao.update(updated)
                AppResult.Success(Unit)
            } else {
                AppResult.Error(AppError.NotFound("Order not found"))
            }
        } catch (e: Exception) {
            AppResult.Error(AppError.Database(e.message ?: "Database error"))
        }
    }
}
