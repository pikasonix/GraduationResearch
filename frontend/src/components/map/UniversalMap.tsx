"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Order } from "@/lib/redux/services/orderApi";
import config from "@/config/config";

// Generic node interface for add-instance mode
export interface MapNode {
    id: number;
    lat: number;
    lng: number;
    type?: 'depot' | 'pickup' | 'delivery' | 'none';
    deliveryId?: number;
    pickupId?: number;
    [key: string]: any;
}

export interface UniversalMapProps {
    // Orders mode (for /orders page)
    orders?: Order[];
    selectedOrderIds?: string[];
    onOrderSelect?: (orderId: string) => void;
    showOrderLines?: boolean;
    
    // Generic nodes mode (for /map, /add-instance)
    nodes?: MapNode[];
    onNodeClick?: (node: MapNode) => void;
    onMapClick?: (lat: number, lng: number) => void;
    showPairLines?: boolean;
    
    // Map settings
    center?: [number, number]; // [lng, lat]
    zoom?: number;
    interactive?: boolean;
    style?: string;
    height?: string;
    className?: string;
}

export const UniversalMap: React.FC<UniversalMapProps> = ({
    orders = [],
    selectedOrderIds = [],
    onOrderSelect,
    showOrderLines = true,
    nodes = [],
    onNodeClick,
    onMapClick,
    showPairLines = true,
    center = [105.8342, 21.0278], // Hanoi default [lng, lat]
    zoom = 13,
    interactive = true,
    style = "mapbox://styles/mapbox/streets-v12",
    height = "100%",
    className = "",
}) => {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
    const [mapReady, setMapReady] = useState(false);

    // Helper: Get status info for orders
    const getStatusInfo = useCallback((status: string) => {
        switch (status) {
            case "delivered": return { color: "#22c55e", label: "Hoàn thành" };
            case "failed":
            case "cancelled": return { color: "#ef4444", label: "Thất bại" };
            case "assigned": return { color: "#eab308", label: "Đã gán" };
            case "in_transit": return { color: "#3b82f6", label: "Đang giao" };
            case "pending": return { color: "#9ca3af", label: "Chờ xử lý" };
            default: return { color: "#9ca3af", label: "Chưa xác định" };
        }
    }, []);

    // Helper: Reverse geocoding
    const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
        try {
            const token = config.mapbox?.accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                return data.features[0].place_name;
            }
            return null;
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return null;
        }
    }, []);

    // Create order popup HTML
    const createOrderPopup = useCallback((order: Order, type: 'pickup' | 'delivery') => {
        const isPickup = type === 'pickup';
        const address = isPickup ? order.pickup_address : order.delivery_address;
        const contactName = isPickup ? order.pickup_contact_name : order.delivery_contact_name;
        const contactPhone = isPickup ? order.pickup_contact_phone : order.delivery_contact_phone;
        const title = isPickup ? '📦 Điểm lấy hàng' : '🎯 Điểm giao hàng';
        const statusInfo = getStatusInfo(order.status);

        const productHtml = order.product_name ? `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span>📦</span>
                <span style="color: #4b5563;">${order.product_name}</span>
            </div>` : '';
        
        const weightHtml = order.weight ? `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span>⚖️</span>
                <span style="color: #4b5563;">${order.weight} kg</span>
            </div>` : '';
        
        const urgentHtml = order.priority === 'urgent' ? `
            <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                <span style="font-size: 10px; color: #b91c1c; font-weight: bold; border: 2px solid #dc2626; background-color: #fef2f2; padding: 2px 8px; border-radius: 9999px;">
                    ⚡ HỎA TỐC
                </span>
            </div>` : '';

        const html = `
            <div style="padding: 8px; min-width: 220px; max-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px;">
                    <span style="font-weight: bold; font-size: 14px; color: #111827;">${order.tracking_number}</span>
                    <span style="font-size: 10px; padding: 2px 8px; border-radius: 9999px; color: white; white-space: nowrap; background-color: ${statusInfo.color};">
                        ${statusInfo.label}
                    </span>
                </div>
                <div style="margin-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 600; color: #374151;">${title}</span>
                </div>
                <div style="font-size: 12px; color: #4b5563; margin-bottom: 8px; line-height: 1.5;">
                    📍 ${address}
                </div>
                <div style="font-size: 12px; border-top: 1px solid #f3f4f6; padding-top: 8px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>👤</span>
                        <span style="font-weight: 500; color: #374151;">${contactName}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>📞</span>
                        <span style="color: #4b5563;">${contactPhone}</span>
                    </div>
                    ${productHtml}
                    ${weightHtml}
                </div>
                ${urgentHtml}
            </div>
        `;

        return html;
    }, [getStatusInfo]);

    // Initialize map
    useEffect(() => {
        if (typeof window === 'undefined' || !mapRef.current || mapInstance.current) return;

        const token = config.mapbox?.accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!token) {
            console.error("Missing Mapbox Access Token");
            return;
        }

        mapboxgl.accessToken = token;

        try {
            mapInstance.current = new mapboxgl.Map({
                container: mapRef.current,
                style: style,
                center: center,
                zoom: zoom,
                pitch: 0,
                bearing: 0,
                antialias: true,
                interactive: interactive,
            });

            if (interactive) {
                mapInstance.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
                mapInstance.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
                mapInstance.current.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }));
            }

            mapInstance.current.on('load', () => {
                setMapReady(true);
                
                // Add sources for lines
                if (!mapInstance.current?.getSource('order-lines-source')) {
                    mapInstance.current?.addSource('order-lines-source', {
                        type: 'geojson',
                        data: { type: 'FeatureCollection', features: [] }
                    });
                    mapInstance.current?.addLayer({
                        id: 'order-lines-layer',
                        type: 'line',
                        source: 'order-lines-source',
                        paint: {
                            'line-color': ['get', 'color'],
                            'line-width': ['get', 'width'],
                            'line-opacity': ['get', 'opacity'],
                            'line-dasharray': ['get', 'dasharray'],
                        }
                    });
                }

                if (!mapInstance.current?.getSource('pair-lines-source')) {
                    mapInstance.current?.addSource('pair-lines-source', {
                        type: 'geojson',
                        data: { type: 'FeatureCollection', features: [] }
                    });
                    mapInstance.current?.addLayer({
                        id: 'pair-lines-layer',
                        type: 'line',
                        source: 'pair-lines-source',
                        paint: {
                            'line-color': '#3b82f6',
                            'line-width': 2,
                            'line-opacity': 0.6,
                            'line-dasharray': [1, 0],
                        }
                    });
                }
            });

            // Map click handler
            mapInstance.current.on('click', (e) => {
                // Check if click was on a marker
                if (e.originalEvent) {
                    const target = e.originalEvent.target as HTMLElement;
                    if (target.closest('.mapboxgl-marker')) {
                        return;
                    }
                }

                const { lng, lat } = e.lngLat;
                if (onMapClick) {
                    onMapClick(lat, lng);
                }
            });

        } catch (error) {
            console.error("Error initializing Mapbox:", error);
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
                setMapReady(false);
            }
        };
    }, []); // Only run once

    // Update order lines
    useEffect(() => {
        if (!mapInstance.current || !mapReady || !showOrderLines || orders.length === 0) return;

        const features = orders
            .filter(order => 
                order.pickup_latitude &&
                order.pickup_longitude &&
                order.delivery_latitude &&
                order.delivery_longitude
            )
            .map(order => {
                const isSelected = selectedOrderIds.includes(order.id);
                const statusInfo = getStatusInfo(order.status);

                return {
                    type: 'Feature',
                    properties: {
                        orderId: order.id,
                        color: isSelected ? '#f59e0b' : statusInfo.color,
                        width: isSelected ? 4 : 2,
                        opacity: isSelected ? 0.9 : 0.5,
                        dasharray: [1, 0],
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [order.pickup_longitude, order.pickup_latitude],
                            [order.delivery_longitude, order.delivery_latitude],
                        ],
                    },
                };
            });

        const source = mapInstance.current.getSource('order-lines-source') as mapboxgl.GeoJSONSource;
        if (source) {
            source.setData({ type: 'FeatureCollection', features: features as any });
        }
    }, [orders, selectedOrderIds, mapReady, showOrderLines, getStatusInfo]);

    // Update pair lines for nodes
    useEffect(() => {
        if (!mapInstance.current || !mapReady || !showPairLines || nodes.length === 0) return;

        const features = nodes
            .filter(node => node.deliveryId !== undefined)
            .map(node => {
                const target = nodes.find(n => n.id === node.deliveryId);
                if (!target) return null;

                return {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [node.lng, node.lat],
                            [target.lng, target.lat],
                        ],
                    },
                };
            })
            .filter(Boolean);

        const source = mapInstance.current.getSource('pair-lines-source') as mapboxgl.GeoJSONSource;
        if (source) {
            source.setData({ type: 'FeatureCollection', features: features as any });
        }
    }, [nodes, mapReady, showPairLines]);

    // Update order markers
    useEffect(() => {
        if (!mapInstance.current || !mapReady || orders.length === 0) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current.clear();

        const bounds = new mapboxgl.LngLatBounds();
        let hasCoords = false;

        orders.forEach(order => {
            const isSelected = selectedOrderIds.includes(order.id);

            // Pickup Marker
            if (order.pickup_latitude && order.pickup_longitude) {
                const markerId = `pickup-${order.id}`;
                const el = document.createElement("div");
                el.className = `w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all ${
                    isSelected ? 'ring-4 ring-blue-400 scale-125' : 'hover:scale-110'
                }`;
                el.style.backgroundColor = isSelected ? "#2563eb" : "#6366f1";
                el.title = `Lấy hàng: ${order.tracking_number}`;

                const popupHtml = createOrderPopup(order, 'pickup');

                const popup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false,
                    maxWidth: '300px',
                }).setHTML(popupHtml);

                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat([order.pickup_longitude, order.pickup_latitude])
                    .setPopup(popup)
                    .addTo(mapInstance.current!);

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    marker.togglePopup();
                    if (onOrderSelect) {
                        onOrderSelect(order.id);
                    }
                });

                markersRef.current.set(markerId, marker);
                bounds.extend([order.pickup_longitude, order.pickup_latitude]);
                hasCoords = true;
            }

            // Delivery Marker
            if (order.delivery_latitude && order.delivery_longitude) {
                const markerId = `delivery-${order.id}`;
                const el = document.createElement("div");
                el.className = `w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all ${
                    isSelected ? 'ring-4 ring-green-400 scale-125' : 'hover:scale-110'
                }`;
                el.style.backgroundColor = isSelected ? "#16a34a" : "#22c55e";
                el.title = `Giao hàng: ${order.tracking_number}`;

                const popupHtml = createOrderPopup(order, 'delivery');

                const popup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false,
                    maxWidth: '300px',
                }).setHTML(popupHtml);

                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat([order.delivery_longitude, order.delivery_latitude])
                    .setPopup(popup)
                    .addTo(mapInstance.current!);

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    marker.togglePopup();
                    if (onOrderSelect) {
                        onOrderSelect(order.id);
                    }
                });

                markersRef.current.set(markerId, marker);
                bounds.extend([order.delivery_longitude, order.delivery_latitude]);
                hasCoords = true;
            }
        });

        // Fit bounds if we have coordinates
        if (hasCoords && !bounds.isEmpty()) {
            mapInstance.current.fitBounds(bounds, {
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
                maxZoom: 15,
                duration: 1000,
            });
        }
    }, [orders, selectedOrderIds, mapReady, onOrderSelect, createOrderPopup]);

    // Update node markers
    useEffect(() => {
        if (!mapInstance.current || !mapReady || nodes.length === 0 || orders.length > 0) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current.clear();

        const bounds = new mapboxgl.LngLatBounds();
        let hasCoords = false;

        nodes.forEach(node => {
            const markerId = `node-${node.id}`;
            
            // Color based on node type
            let color = '#3b82f6'; // default blue
            if (node.type === 'depot') color = '#ef4444'; // red
            else if (node.type === 'pickup') color = '#6366f1'; // indigo
            else if (node.type === 'delivery') color = '#22c55e'; // green

            const el = document.createElement("div");
            el.className = "w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-110 transition-transform";
            el.style.backgroundColor = color;
            el.title = `Node ${node.id} (${node.type || 'none'})`;

            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([node.lng, node.lat])
                .addTo(mapInstance.current!);

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onNodeClick) {
                    onNodeClick(node);
                }
            });

            markersRef.current.set(markerId, marker);
            bounds.extend([node.lng, node.lat]);
            hasCoords = true;
        });

        // Fit bounds
        if (hasCoords && !bounds.isEmpty()) {
            mapInstance.current.fitBounds(bounds, {
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
                maxZoom: 15,
            });
        }
    }, [nodes, mapReady, onNodeClick, orders.length]);

    return (
        <div
            ref={mapRef}
            className={`w-full rounded-lg overflow-hidden ${className}`}
            style={{ height }}
        />
    );
};

export default UniversalMap;
