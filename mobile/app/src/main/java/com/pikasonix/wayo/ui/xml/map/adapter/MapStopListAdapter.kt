package com.pikasonix.wayo.ui.xml.map.adapter

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pikasonix.wayo.R
import com.pikasonix.wayo.databinding.ItemMapStopBinding
import com.pikasonix.wayo.data.model.Stop

class MapStopListAdapter(
    private val onStopClick: (Stop, Int) -> Unit
) : ListAdapter<Stop, MapStopListAdapter.StopViewHolder>(StopDiffCallback()) {

    var selectedPosition: Int = -1
        set(value) {
            val oldPosition = field
            field = value
            if (oldPosition != -1) notifyItemChanged(oldPosition)
            if (value != -1) notifyItemChanged(value)
        }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StopViewHolder {
        val binding = ItemMapStopBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return StopViewHolder(binding)
    }

    override fun onBindViewHolder(holder: StopViewHolder, position: Int) {
        val stop = getItem(position)
        holder.bind(stop, position == selectedPosition)
    }

    inner class StopViewHolder(
        private val binding: ItemMapStopBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(stop: Stop, isSelected: Boolean) {
            binding.apply {
                // Sequence number
                tvSequence.text = stop.sequence.toString()

                // Location name
                tvLocationName.text = stop.locationName

                // Status badge
                val (statusText, statusColor) = when (stop.status.lowercase()) {
                    "completed" -> "HOÀN THÀNH" to Color.parseColor("#10b981")
                    "in_progress" -> "ĐANG LÀM" to Color.parseColor("#f59e0b")
                    "skipped" -> "BỎ QUA" to Color.parseColor("#6b7280")
                    else -> "CHỜ" to Color.parseColor("#3b82f6")
                }
                tvStatus.text = statusText
                badgeStatus.setCardBackgroundColor(statusColor)

                // Type and order count
                val typeText = when (stop.type.lowercase()) {
                    "pickup" -> "Lấy hàng"
                    "delivery" -> "Giao hàng"
                    else -> stop.type
                }
                val orderCount = stop.orders.size
                tvType.text = "$typeText • $orderCount đơn"

                // Type icon
                val iconRes = when (stop.type.lowercase()) {
                    "pickup" -> R.drawable.ic_package
                    "delivery" -> R.drawable.ic_delivery
                    else -> R.drawable.ic_location
                }
                iconType.setImageResource(iconRes)

                // Highlight selected item
                if (isSelected) {
                    cardStop.strokeWidth = 4
                    cardStop.strokeColor = ContextCompat.getColor(root.context, R.color.primaryColor)
                    cardStop.elevation = 8f
                } else {
                    cardStop.strokeWidth = 2
                    cardStop.strokeColor = Color.TRANSPARENT
                    cardStop.elevation = 2f
                }

                // Click listener
                root.setOnClickListener {
                    onStopClick(stop, bindingAdapterPosition)
                }
            }
        }
    }

    class StopDiffCallback : DiffUtil.ItemCallback<Stop>() {
        override fun areItemsTheSame(oldItem: Stop, newItem: Stop): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Stop, newItem: Stop): Boolean {
            return oldItem == newItem
        }
    }
}
