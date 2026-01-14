package com.pikasonix.wayo.ui.xml.routes

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pikasonix.wayo.data.model.Stop
import com.pikasonix.wayo.databinding.ItemRouteStopBinding
import com.pikasonix.wayo.ui.xml.routes.RouteDetailsViewModel.UiRouteStopItem

class RouteStopsAdapter : ListAdapter<UiRouteStopItem, RouteStopsAdapter.VH>(Diff) {

    object Diff : DiffUtil.ItemCallback<UiRouteStopItem>() {
        override fun areItemsTheSame(oldItem: UiRouteStopItem, newItem: UiRouteStopItem): Boolean = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: UiRouteStopItem, newItem: UiRouteStopItem): Boolean = oldItem == newItem
    }

    inner class VH(private val b: ItemRouteStopBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: UiRouteStopItem) {
            when (item) {
                is UiRouteStopItem.Single -> bindSingle(item.stop)
                is UiRouteStopItem.Group -> bindGroup(item.mainStop, item.stops)
            }
        }

        private fun bindSingle(stop: Stop) {
            b.title.text = "${stop.sequence}. ${stop.locationName}"
            val ordersCount = stop.orders.size
            val ordersText = if (ordersCount > 0) "$ordersCount ${if (ordersCount == 1) "đơn" else "đơn"}" else "chưa có đơn"
            b.subtitle.text = "${stop.type} • $ordersText • ${stop.status}"
            val tw = formatTimeWindow(stop.timeWindowStart, stop.timeWindowEnd)
            b.timeWindow.text = tw
        }

        private fun bindGroup(mainStop: Stop, stops: List<Stop>) {
            val startSeq = stops.first().sequence
            val endSeq = stops.last().sequence
            b.title.text = "$startSeq-$endSeq. ${mainStop.locationName}"
            
            val totalOrders = stops.sumOf { it.orders.size }
            val ordersText = if (totalOrders > 0) "$totalOrders ${if (totalOrders == 1) "đơn" else "đơn"}" else "chưa có đơn"
            b.subtitle.text = "${mainStop.type} • $ordersText • ${mainStop.status}"
            
            // Use time window from the first stop as it's the primary constraint usually
            val tw = formatTimeWindow(mainStop.timeWindowStart, mainStop.timeWindowEnd)
            b.timeWindow.text = tw
        }
        
        private fun formatTimeWindow(start: String?, end: String?): String {
            if (start == null && end == null) return ""
            
            fun formatTime(isoString: String?): String {
                if (isoString == null) return ""
                return try {
                    val dateTime = java.time.ZonedDateTime.parse(isoString)
                    dateTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm dd/MM"))
                } catch (e: Exception) {
                    isoString.substringBefore("T")
                }
            }
            
            val startFormatted = formatTime(start)
            val endFormatted = formatTime(end)
            
            return when {
                startFormatted.isNotEmpty() && endFormatted.isNotEmpty() -> "TW: $startFormatted - $endFormatted"
                startFormatted.isNotEmpty() -> "TW: từ $startFormatted"
                endFormatted.isNotEmpty() -> "TW: đến $endFormatted"
                else -> ""
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val inflater = LayoutInflater.from(parent.context)
        return VH(ItemRouteStopBinding.inflate(inflater, parent, false))
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(getItem(position))
    }
}
