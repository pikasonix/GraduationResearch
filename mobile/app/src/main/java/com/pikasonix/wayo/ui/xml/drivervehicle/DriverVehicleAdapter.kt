package com.pikasonix.wayo.ui.xml.drivervehicle

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pikasonix.wayo.databinding.ItemVehicleWithRoutesBinding
import com.pikasonix.wayo.data.repository.DriverVehicleRepository

class DriverVehicleAdapter(
    private val onClaim: (vehicleId: String) -> Unit,
    private val onOpenAssignedRoutes: () -> Unit
) : ListAdapter<DriverVehicleRepository.VehicleWithRoutes, DriverVehicleAdapter.VH>(Diff) {

    var currentDriverId: String? = null

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemVehicleWithRoutesBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(getItem(position))
    }

    inner class VH(private val b: ItemVehicleWithRoutesBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: DriverVehicleRepository.VehicleWithRoutes) {
            val isMine = currentDriverId != null && item.assignedDriverId == currentDriverId

            b.licensePlate.text = item.vehicle.licensePlate
            
            // Translate vehicle type
            val vehicleTypeDisplay = when (item.vehicle.vehicleType) {
                "motorcycle" -> "Xe máy"
                "van" -> "Xe van"
                "truck_small" -> "Xe tải nhỏ"
                "truck_medium" -> "Xe tải trung"
                "truck_large" -> "Xe tải lớn"
                else -> item.vehicle.vehicleType
            }
            b.vehicleType.text = vehicleTypeDisplay
            
            // Routes count
            b.routesCount.text = "${item.routes.size}"
            
            // Calculate total distance (sum of all routes)
            val totalDistanceKm = item.routes.sumOf { it.plannedDistanceKm ?: 0.0 }
            b.totalDistance.text = String.format("%.1f km", totalDistanceKm)
            
            // Calculate total duration (sum of all routes)
            val totalDurationHours = item.routes.sumOf { it.plannedDurationHours ?: 0.0 }
            val hours = totalDurationHours.toInt()
            val minutes = ((totalDurationHours - hours) * 60).toInt()
            b.totalDuration.text = if (hours > 0) "${hours}h ${minutes}p" else "${minutes}p"

            // Status chip
            val (statusText, chipColor) = when {
                isMine -> "Bạn đang nhận" to com.google.android.material.R.attr.colorPrimaryContainer
                item.isOccupied -> "Đã có tài xế" to com.google.android.material.R.attr.colorErrorContainer
                else -> "Chưa có tài xế" to com.google.android.material.R.attr.colorSurfaceVariant
            }
            b.statusChip.text = statusText

            b.claimButton.isEnabled = !item.isOccupied || isMine
            b.claimButton.text = if (isMine) "Xem tuyến" else "Nhận xe"

            b.claimButton.setOnClickListener {
                if (isMine) onOpenAssignedRoutes() else onClaim(item.vehicle.id)
            }
        }
    }

    companion object {
        private val Diff = object : DiffUtil.ItemCallback<DriverVehicleRepository.VehicleWithRoutes>() {
            override fun areItemsTheSame(oldItem: DriverVehicleRepository.VehicleWithRoutes, newItem: DriverVehicleRepository.VehicleWithRoutes): Boolean {
                return oldItem.vehicle.id == newItem.vehicle.id
            }

            override fun areContentsTheSame(oldItem: DriverVehicleRepository.VehicleWithRoutes, newItem: DriverVehicleRepository.VehicleWithRoutes): Boolean {
                return oldItem == newItem
            }
        }
    }
}
