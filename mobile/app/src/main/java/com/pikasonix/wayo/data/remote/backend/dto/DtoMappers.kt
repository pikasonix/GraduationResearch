package com.pikasonix.wayo.data.remote.backend.dto

import com.pikasonix.wayo.data.local.entity.*
import com.pikasonix.wayo.data.model.*
import com.pikasonix.wayo.data.util.DateUtils

// DTO -> Entity mappers
fun DriverProfileResponse.toEntity(): DriverProfileEntity {
    return DriverProfileEntity(
        id = id,
        userId = userId,
        fullName = fullName,
        phone = phone,
        avatarUrl = avatarUrl,
        rating = rating,
        totalDeliveries = totalDeliveries,
        status = status,
        createdAt = DateUtils.isoToEpochMillis(createdAt) ?: DateUtils.now(),
        updatedAt = DateUtils.isoToEpochMillis(updatedAt) ?: DateUtils.now(),
        syncedAt = DateUtils.now()
    )
}

fun AssignedRouteDto.toEntity(): RouteEntity {
    return RouteEntity(
        id = id,
        driverId = driverId,
        vehicleId = vehicleId,
        status = status,
        scheduledDate = DateUtils.isoToEpochMillis(scheduledDate) ?: DateUtils.now(),
        startedAt = DateUtils.isoToEpochMillis(startedAt),
        completedAt = DateUtils.isoToEpochMillis(completedAt),
        totalStops = totalStops,
        completedStops = completedStops,
        createdAt = DateUtils.isoToEpochMillis(createdAt) ?: DateUtils.now(),
        updatedAt = DateUtils.isoToEpochMillis(updatedAt) ?: DateUtils.now(),
        syncedAt = DateUtils.now()
    )
}

fun RouteStopDto.toEntity(): RouteStopEntity {
    return RouteStopEntity(
        id = id,
        routeId = routeId,
        sequence = sequence,
        locationName = locationName,
        latitude = latitude,
        longitude = longitude,
        type = type,
        status = status,
        scheduledTime = DateUtils.isoToEpochMillis(scheduledTime),
        timeWindowStart = DateUtils.isoToEpochMillis(timeWindowStart),
        timeWindowEnd = DateUtils.isoToEpochMillis(timeWindowEnd),
        completedAt = DateUtils.isoToEpochMillis(completedAt),
        notes = null,
        createdAt = DateUtils.now(),
        updatedAt = DateUtils.now(),
        syncedAt = DateUtils.now()
    )
}

fun OrderDto.toEntity(stopId: String): OrderEntity {
    return OrderEntity(
        id = id,
        stopId = stopId,
        orderNumber = orderNumber,
        customerName = customerName,
        customerPhone = customerPhone,
        itemsCount = itemsCount,
        status = status,
        createdAt = DateUtils.now(),
        updatedAt = DateUtils.now(),
        syncedAt = DateUtils.now()
    )
}

// Entity -> Model mappers
fun DriverProfileEntity.toModel(): DriverProfile {
    return DriverProfile(
        id = id,
        userId = userId,
        fullName = fullName,
        phone = phone,
        avatarUrl = avatarUrl,
        rating = rating ?: 0.0,
        totalDeliveries = totalDeliveries ?: 0,
        status = status
    )
}

fun RouteEntity.toModel(): Route {
    return Route(
        id = id,
        driverId = driverId,
        vehicleId = vehicleId,
        status = status,
        scheduledDate = DateUtils.epochMillisToIso(scheduledDate) ?: "",
        startedAt = DateUtils.epochMillisToIso(startedAt),
        completedAt = DateUtils.epochMillisToIso(completedAt),
        totalStops = totalStops,
        completedStops = completedStops
    )
}

fun RouteStopEntity.toModel(): Stop {
    return Stop(
        id = id,
        routeId = routeId,
        sequence = sequence,
        locationName = locationName,
        latitude = latitude,
        longitude = longitude,
        type = type,
        status = status,
        scheduledTime = DateUtils.epochMillisToIso(scheduledTime),
        timeWindowStart = DateUtils.epochMillisToIso(timeWindowStart),
        timeWindowEnd = DateUtils.epochMillisToIso(timeWindowEnd),
        completedAt = DateUtils.epochMillisToIso(completedAt),
        orders = emptyList() // Will be populated by repository
    )
}

fun OrderEntity.toModel(): Order {
    return Order(
        id = id,
        orderNumber = orderNumber,
        customerName = customerName,
        customerPhone = customerPhone,
        itemsCount = itemsCount,
        status = status
    )
}

// Model -> Request DTOs
fun Stop.toCompleteStopRequest(notes: String? = null): CompleteStopRequest {
    return CompleteStopRequest(
        completedAt = DateUtils.nowIso(),
        latitude = latitude,
        longitude = longitude,
        notes = notes
    )
}
