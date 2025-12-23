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

        orders.forEach((order) => {
            // Pickup Marker
            if (order.pickup_latitude && order.pickup_longitude) {
                const el = document.createElement("div");
                el.className = "w-4 h-4 rounded-full border-2 border-white shadow-md";
                el.style.backgroundColor = selectedOrderIds.includes(order.id)
                    ? "#2563eb" // blue-600
                    : "#6b7280"; // gray-500

                const pickupMarker = new mapboxgl.Marker({ element: el })
                    .setLngLat([order.pickup_longitude, order.pickup_latitude])
                    .setPopup(new mapboxgl.Popup().setHTML(`<b>Lấy hàng:</b> ${order.pickup_address}`))
                    .addTo(mapRef.current!);

                markersRef.current.push(pickupMarker);
                bounds.extend([order.pickup_longitude, order.pickup_latitude]);
                hasCoords = true;
            }

            // Delivery Marker
            if (order.delivery_latitude && order.delivery_longitude) {
                const el = document.createElement("div");
                el.className = "w-4 h-4 rounded-full border-2 border-white shadow-md";
                el.style.backgroundColor = selectedOrderIds.includes(order.id)
                    ? "#16a34a" // green-600
                    : "#10b981"; // emerald-500

                const deliveryMarker = new mapboxgl.Marker({ element: el })
                    .setLngLat([order.delivery_longitude, order.delivery_latitude])
                    .setPopup(new mapboxgl.Popup().setHTML(`<b>Giao hàng:</b> ${order.delivery_address}`))
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
