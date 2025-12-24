"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Order } from "@/lib/redux/services/orderApi";

interface OrdersMapProps {
    orders: Order[];
    selectedOrderIds: string[];
}

export const OrdersMap: React.FC<OrdersMapProps> = ({ orders, selectedOrderIds }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);

    useEffect(() => {
        const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!token || !mapContainer.current) return;

        mapboxgl.accessToken = token;

        if (!mapRef.current) {
            mapRef.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: "mapbox://styles/mapbox/streets-v12",
                center: [105.8194, 21.0227], // Default to Hanoi
                zoom: 11,
            });
        }

        return () => {
            // Cleanup if needed, but keeping map alive is usually fine in this context
        };
    }, []);

    // Update markers when orders change
    useEffect(() => {
        if (!mapRef.current) return;

        // Clear existing markers
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        const bounds = new mapboxgl.LngLatBounds();
        let hasCoords = false;

        const getStatusInfo = (status: string) => {
            switch (status) {
                case "delivered": return { color: "#22c55e", label: "Hoàn thành" };
                case "failed":
                case "cancelled": return { color: "#ef4444", label: "Thất bại/Hủy" };
                case "assigned": return { color: "#eab308", label: "Đã gán" };
                case "in_transit": return { color: "#3b82f6", label: "Đang giao" };
                default: return { color: "#9ca3af", label: "Chờ xử lý" };
            }
        };

        const getPopupHtml = (order: Order, type: 'pickup' | 'delivery') => {
            const isPickup = type === 'pickup';
            const address = isPickup ? order.pickup_address : order.delivery_address;
            const title = isPickup ? 'Điểm lấy hàng' : 'Điểm giao hàng';
            const statusInfo = getStatusInfo(order.status);

            return `
                <div class="p-1 min-w-[200px] max-w-[250px] font-sans">
                    <div class="flex items-center justify-between mb-2 gap-2">
                        <span class="font-bold text-sm text-gray-900 truncate">${order.tracking_number}</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded-full text-white whitespace-nowrap" style="background-color: ${statusInfo.color}">
                            ${statusInfo.label}
                        </span>
                    </div>
                    <div class="mb-1">
                        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wide">${title}</span>
                    </div>
                    <div class="text-xs text-gray-700 mb-2 leading-relaxed">
                        ${address}
                    </div>
                    <div class="flex items-center gap-1 text-xs text-gray-500 border-t border-gray-100 pt-2 mt-1">
                        <span class="w-4 text-center">👤</span>
                        <span class="truncate font-medium">${order.delivery_contact_name}</span>
                    </div>
                    ${order.priority === 'urgent' ? `
                    <div class="mt-1 flex justify-end">
                        <span class="text-[10px] text-red-600 font-bold border border-red-200 bg-red-50 px-1 rounded">Hỏa tốc</span>
                    </div>` : ''}
                </div>
            `;
        };

        orders.forEach((order) => {
            // Pickup Marker
            if (order.pickup_latitude && order.pickup_longitude) {
                const el = document.createElement("div");
                el.className = "w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-110 transition-transform";
                el.style.backgroundColor = selectedOrderIds.includes(order.id)
                    ? "#2563eb" // blue-600
                    : "#6b7280"; // gray-500

                const pickupMarker = new mapboxgl.Marker({ element: el })
                    .setLngLat([order.pickup_longitude, order.pickup_latitude])
                    .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(getPopupHtml(order, 'pickup')))
                    .addTo(mapRef.current!);

                markersRef.current.push(pickupMarker);
                bounds.extend([order.pickup_longitude, order.pickup_latitude]);
                hasCoords = true;
            }

            // Delivery Marker
            if (order.delivery_latitude && order.delivery_longitude) {
                const el = document.createElement("div");
                el.className = "w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-110 transition-transform";
                el.style.backgroundColor = selectedOrderIds.includes(order.id)
                    ? "#16a34a" // green-600
                    : "#10b981"; // emerald-500

                const deliveryMarker = new mapboxgl.Marker({ element: el })
                    .setLngLat([order.delivery_longitude, order.delivery_latitude])
                    .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(getPopupHtml(order, 'delivery')))
                    .addTo(mapRef.current!);

                markersRef.current.push(deliveryMarker);
                bounds.extend([order.delivery_longitude, order.delivery_latitude]);
                hasCoords = true;
            }
        });

        if (hasCoords) {
            mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        }
    }, [orders, selectedOrderIds]);

    return <div ref={mapContainer} className="w-full h-full min-h-[500px] rounded-lg overflow-hidden" />;
};
