package com.pikasonix.wayo.domain.usecase.order

import com.pikasonix.wayo.core.dispatcher.DispatcherProvider
import com.pikasonix.wayo.core.result.AppError
import com.pikasonix.wayo.core.result.AppResult
import com.pikasonix.wayo.data.model.Order
import com.pikasonix.wayo.data.repository.OrderRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Update Order Status UseCase
 * 
 * Updates order status locally (for UI feedback).
 * Actual sync happens via CompleteStopUseCase.
 */
class UpdateOrderStatusUseCase @Inject constructor(
    private val orderRepository: OrderRepository,
    private val dispatchers: DispatcherProvider
) {
    /**
     * Observe orders for a stop
     */
    fun observeByStop(stopId: String): Flow<List<Order>> {
        return orderRepository.observeOrdersByStop(stopId)
    }
    
    /**
     * Get order by ID
     */
    suspend fun getById(orderId: String): AppResult<Order> = withContext(dispatchers.io) {
        orderRepository.getOrderById(orderId)
    }
    
    /**
     * Update order status locally
     */
    suspend fun updateStatus(
        orderId: String,
        status: String
    ): AppResult<Unit> = withContext(dispatchers.io) {
        // Validate inputs
        if (orderId.isBlank()) {
            return@withContext AppResult.Error(AppError.Validation("Order ID is required"))
        }
        if (status !in listOf("pending", "delivered", "failed")) {
            return@withContext AppResult.Error(AppError.Validation("Invalid status"))
        }
        
        orderRepository.updateOrderStatus(orderId, status)
    }
}
