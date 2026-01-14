package com.pikasonix.wayo.ui.xml.routes

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pikasonix.wayo.R
import com.pikasonix.wayo.data.model.AssignedRoute
import com.pikasonix.wayo.databinding.ItemAssignedRouteBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AssignedRoutesAdapter(
    private val onClick: (AssignedRoute) -> Unit
) : ListAdapter<AssignedRoute, AssignedRoutesAdapter.VH>(Diff) {

    object Diff : DiffUtil.ItemCallback<AssignedRoute>() {
        override fun areItemsTheSame(oldItem: AssignedRoute, newItem: AssignedRoute): Boolean =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: AssignedRoute, newItem: AssignedRoute): Boolean =
            oldItem == newItem
    }

    inner class VH(private val binding: ItemAssignedRouteBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: AssignedRoute) {
            // Route Title
            binding.routeTitle.text = "Tuyến #${item.id.take(8)}"
            
            // Route ID (full)
            binding.routeIdText.text = "ID: ${item.id.take(18)}..."
            
            // Status with color coding
            val (statusText, statusColor) = when (item.status.name.lowercase()) {
                "assigned" -> "CHỜ BẮT ĐẦU" to Color.parseColor("#3b82f6")
                "in_progress" -> "ĐANG GIAO" to Color.parseColor("#f59e0b")
                "completed" -> "HOÀN THÀNH" to Color.parseColor("#10b981")
                "cancelled" -> "ĐÃ HỦY" to Color.parseColor("#ef4444")
                else -> item.status.name.uppercase() to Color.parseColor("#6b7280")
            }
            
            binding.statusText.text = statusText
            binding.statusBadge.setCardBackgroundColor(statusColor)
            
            // Distance - use planned first, fallback to total
            val distance = (item.plannedDistanceKm ?: item.totalDistanceKm)?.let { 
                String.format("%.1f km", it) 
            } ?: "Chưa có dữ liệu"
            binding.distanceText.text = distance
            
            // Duration - use planned first, fallback to total
            val duration = (item.plannedDurationHours ?: item.totalDurationHours)?.let { hours ->
                if (hours < 1.0) {
                    String.format("%.0f phút", hours * 60)
                } else {
                    String.format("%.1f giờ", hours)
                }
            } ?: "Chưa có dữ liệu"
            binding.durationText.text = duration
            
            // Click listener
            binding.root.setOnClickListener { onClick(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val inflater = LayoutInflater.from(parent.context)
        return VH(ItemAssignedRouteBinding.inflate(inflater, parent, false))
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(getItem(position))
    }
}
