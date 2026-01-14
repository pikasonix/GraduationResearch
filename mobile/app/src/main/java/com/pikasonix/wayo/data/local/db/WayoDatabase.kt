package com.pikasonix.wayo.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.pikasonix.wayo.data.local.dao.*
import com.pikasonix.wayo.data.local.entity.*

@Database(
    entities = [
        DriverProfileEntity::class,
        VehicleEntity::class,
        RouteEntity::class,
        RouteStopEntity::class,
        OrderEntity::class,
        PendingActionEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class WayoDatabase : RoomDatabase() {
    
    abstract fun driverProfileDao(): DriverProfileDao
    abstract fun vehiclesDao(): VehiclesDao
    abstract fun routesDao(): RoutesDao
    abstract fun routeStopsDao(): RouteStopsDao
    abstract fun ordersDao(): OrdersDao
    abstract fun pendingActionsDao(): PendingActionsDao
    
    companion object {
        const val DATABASE_NAME = "wayo_database"
    }
}
