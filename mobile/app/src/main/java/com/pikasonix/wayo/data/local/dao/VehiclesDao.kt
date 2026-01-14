package com.pikasonix.wayo.data.local.dao

import androidx.room.*
import com.pikasonix.wayo.data.local.entity.VehicleEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface VehiclesDao {
    
    @Query("SELECT * FROM vehicles WHERE status = 'available' ORDER BY license_plate")
    fun observeAvailableVehicles(): Flow<List<VehicleEntity>>
    
    @Query("SELECT * FROM vehicles WHERE current_driver_id = :driverId LIMIT 1")
    fun observeDriverVehicle(driverId: String): Flow<VehicleEntity?>
    
    @Query("SELECT * FROM vehicles WHERE id = :vehicleId")
    suspend fun getById(vehicleId: String): VehicleEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(vehicles: List<VehicleEntity>)
    
    @Update
    suspend fun update(vehicle: VehicleEntity)
    
    @Query("DELETE FROM vehicles")
    suspend fun deleteAll()
}
