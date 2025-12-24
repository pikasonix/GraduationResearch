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
    const markersRef = useRef<
        Map<
            string,
            {
                marker: mapboxgl.Marker;
                popup?: mapboxgl.Popup;
                innerEl: HTMLDivElement;
                orderId?: string;
                kind?: "pickup" | "delivery";
            }
        >
    >(new Map());
    const [mapReady, setMapReady] = useState(false);
    const lastFitKeyRef = useRef<string | null>(null);
    const lastMarkersKeyRef = useRef<string | null>(null);
    const onOrderSelectRef = useRef<UniversalMapProps["onOrderSelect"]>(onOrderSelect);
    const activeOrderPopupRef = useRef<mapboxgl.Popup | null>(null);

    useEffect(() => {
        onOrderSelectRef.current = onOrderSelect;
    }, [onOrderSelect]);

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
        const title = isPickup ? 'Điểm lấy hàng' : 'Điểm giao hàng';
        const statusInfo = getStatusInfo(order.status);

        // Icons as SVG strings
        const icons = {
            user: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
            phone: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
            mapPin: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
            package: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22.08V12"/></svg>`,
            weight: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2"/><path d="M12 22v-2"/><path d="m17 20.66-1-1.73"/><path d="M11 10.27 7 3.34"/><path d="m20.66 17-1.73-1"/><path d="m3.34 7 1.73 1"/><path d="M14 12h8"/><path d="M2 12h2"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m17 3.34-1 1.73"/><path d="m7 20.66 1-1.73"/></svg>`,
            zap: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        };

        const productHtml = order.product_name ? `
            <div style="display: flex; align-items: center; gap: 6px; color: #4b5563;">
                <span style="color: #6b7280;">${icons.package}</span>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${order.product_name}</span>
            </div>` : '';

        const weightHtml = order.weight ? `
            <div style="display: flex; align-items: center; gap: 6px; color: #4b5563;">
                <span style="color: #6b7280;">${icons.weight}</span>
                <span>${order.weight} kg</span>
            </div>` : '';

        const urgentHtml = order.priority === 'urgent' ? `
            <div style="position: absolute; top: -6px; right: -6px; background-color: #ef4444; color: white; border-radius: 9999px; padding: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                ${icons.zap}
            </div>` : '';

        return `
            <div style="position: relative; padding: 2px; min-width: 200px; max-width: 240px; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 700; font-size: 14px; color: #1f2937;">${order.tracking_number}</span>
                    <span style="font-size: 10px; padding: 2px 8px; border-radius: 9999px; color: white; font-weight: 500; background-color: ${statusInfo.color};">
                        ${statusInfo.label}
                    </span>
                </div>
                
                <div style="margin-bottom: 8px;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 2px;">
                        ${title}
                    </div>
                    <div style="display: flex; gap: 6px; align-items: flex-start;">
                        <span style="color: #6b7280; margin-top: 2px; flex-shrink: 0;">${icons.mapPin}</span>
                        <div style="font-size: 12px; color: #374151; line-height: 1.4;">${address}</div>
                    </div>
                </div>

                <div style="border-top: 1px solid #f3f4f6; padding-top: 8px; font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
                    ${(contactName || contactPhone) ? `
                    <div style="display: flex; align-items: center; gap: 6px; color: #374151; font-weight: 500;">
                        <span style="color: #6b7280;">${icons.user}</span>
                        <span>${contactName}</span>
                        ${contactPhone ? `<span style="color: #9ca3af; font-weight: 400;">(${contactPhone})</span>` : ''}
                    </div>` : ''}
                    ${productHtml}
                    ${weightHtml}
                </div>
                ${urgentHtml}
            </div>
        `;
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

        const hasSelection = selectedOrderIds.length > 0;

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
                const isDimmed = hasSelection && !isSelected;

                return {
                    type: 'Feature',
                    properties: {
                        orderId: order.id,
                        color: isSelected ? '#f59e0b' : statusInfo.color,
                        width: isSelected ? 4 : isDimmed ? 1 : 2,
                        opacity: isSelected ? 0.95 : isDimmed ? 0.12 : 0.5,
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

    const applyOrderSelectionStyles = useCallback(
        (orderId: string | undefined, kind: "pickup" | "delivery" | undefined, innerEl: HTMLDivElement) => {
            if (!orderId || !kind) return;
            const hasSelection = selectedOrderIds.length > 0;
            const isSelected = selectedOrderIds.includes(orderId);
            const isDimmed = hasSelection && !isSelected;

            // IMPORTANT: Do not apply any CSS transform on the Mapbox marker root element.
            // Mapbox uses transform for positioning; overriding it causes visual offset.

            innerEl.style.transition = "box-shadow 120ms ease, background-color 120ms ease";
            innerEl.style.border = "2px solid #ffffff";
            innerEl.style.borderRadius = "9999px";
            innerEl.style.width = isDimmed ? "14px" : "20px";
            innerEl.style.height = isDimmed ? "14px" : "20px";
            innerEl.style.opacity = isDimmed ? "0.35" : "1";
            innerEl.style.boxShadow = isSelected
                ? kind === "pickup"
                    ? "0 0 0 4px rgba(96, 165, 250, 0.9), 0 8px 18px rgba(0,0,0,0.18)"
                    : "0 0 0 4px rgba(74, 222, 128, 0.9), 0 8px 18px rgba(0,0,0,0.18)"
                : isDimmed
                    ? "0 3px 10px rgba(0,0,0,0.12)"
                    : "0 8px 18px rgba(0,0,0,0.18)";
        },
        [selectedOrderIds]
    );

    // Create order markers (only when orders change, not when selection changes)
    useEffect(() => {
        if (!mapInstance.current || !mapReady || orders.length === 0) return;

        const bounds = new mapboxgl.LngLatBounds();
        let hasCoords = false;

        // Build a stable, order-insensitive key so we don't recreate markers/popups
        // when the `orders` array is re-ordered after selection/state updates.
        const coordsKey = [...orders]
            .sort((a, b) => String(a.id).localeCompare(String(b.id)))
            .map(
                (o) =>
                    `${o.id}:${o.pickup_latitude ?? ""},${o.pickup_longitude ?? ""}|${o.delivery_latitude ?? ""},${o.delivery_longitude ?? ""}`
            )
            .join(";");

        // If only the orders array identity changed (common after selection state updates),
        // do NOT recreate markers. Recreating markers removes popups immediately.
        if (lastMarkersKeyRef.current === coordsKey && markersRef.current.size > 0) {
            markersRef.current.forEach(({ innerEl, orderId, kind }) => {
                applyOrderSelectionStyles(orderId, kind, innerEl);
            });
            return;
        }

        lastMarkersKeyRef.current = coordsKey;

        // Clear existing markers
        markersRef.current.forEach(({ marker, popup }) => {
            try {
                popup?.remove();
            } catch { }
            marker.remove();
        });
        markersRef.current.clear();
        // Also clear any remembered active popup (it may have been removed above)
        activeOrderPopupRef.current = null;

        orders.forEach((order) => {
            // Pickup Marker
            if (order.pickup_latitude && order.pickup_longitude) {
                const markerId = `pickup-${order.id}`;

                const wrapper = document.createElement("div");
                wrapper.style.width = "20px";
                wrapper.style.height = "20px";
                wrapper.style.display = "flex";
                wrapper.style.alignItems = "center";
                wrapper.style.justifyContent = "center";
                wrapper.style.cursor = "pointer";
                wrapper.style.pointerEvents = "auto";
                wrapper.style.zIndex = "1";

                const inner = document.createElement("div");
                inner.style.backgroundColor = "#6366f1";
                wrapper.appendChild(inner);

                const popupHtml = createOrderPopup(order, "pickup");
                const popup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false,
                    maxWidth: "300px",
                    closeOnClick: false,
                    className: "wayo-order-popup",
                }).setHTML(popupHtml);

                const marker = new mapboxgl.Marker({ element: wrapper })
                    .setLngLat([order.pickup_longitude, order.pickup_latitude])
                    .addTo(mapInstance.current!);

                const handleMarkerActivate = (e: Event) => {
                    e.stopPropagation();
                    if (e instanceof PointerEvent) e.preventDefault();

                    if (!mapInstance.current) return;

                    // Close the previous popup if another marker opens a new one
                    if (
                        activeOrderPopupRef.current &&
                        activeOrderPopupRef.current !== popup &&
                        activeOrderPopupRef.current.isOpen()
                    ) {
                        try {
                            activeOrderPopupRef.current.remove();
                        } catch {}
                    }

                    if (popup.isOpen()) {
                        popup.remove();
                        if (activeOrderPopupRef.current === popup) {
                            activeOrderPopupRef.current = null;
                        }
                    } else {
                        popup.setLngLat(marker.getLngLat());
                        popup.addTo(mapInstance.current);
                        activeOrderPopupRef.current = popup;
                    }

                    if (process.env.NODE_ENV !== "production") {
                        // eslint-disable-next-line no-console
                        console.log("[UniversalMap] pickup marker activate", order.id, { popups: document.querySelectorAll('.mapboxgl-popup').length });
                    }

                    onOrderSelectRef.current?.(order.id);
                };

                // Use pointerup to avoid Mapbox click suppression on slight drags
                marker.getElement().addEventListener("pointerup", handleMarkerActivate);

                markersRef.current.set(markerId, {
                    marker,
                    popup,
                    innerEl: inner,
                    orderId: order.id,
                    kind: "pickup",
                });

                bounds.extend([order.pickup_longitude, order.pickup_latitude]);
                hasCoords = true;
            }

            // Delivery Marker
            if (order.delivery_latitude && order.delivery_longitude) {
                const markerId = `delivery-${order.id}`;

                const wrapper = document.createElement("div");
                wrapper.style.width = "20px";
                wrapper.style.height = "20px";
                wrapper.style.display = "flex";
                wrapper.style.alignItems = "center";
                wrapper.style.justifyContent = "center";
                wrapper.style.cursor = "pointer";
                wrapper.style.pointerEvents = "auto";
                wrapper.style.zIndex = "1";

                const inner = document.createElement("div");
                inner.style.backgroundColor = "#22c55e";
                wrapper.appendChild(inner);

                const popupHtml = createOrderPopup(order, "delivery");
                const popup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false,
                    maxWidth: "300px",
                    closeOnClick: false,
                    className: "wayo-order-popup",
                }).setHTML(popupHtml);

                const marker = new mapboxgl.Marker({ element: wrapper })
                    .setLngLat([order.delivery_longitude, order.delivery_latitude])
                    .addTo(mapInstance.current!);

                const handleMarkerActivate = (e: Event) => {
                    e.stopPropagation();
                    if (e instanceof PointerEvent) e.preventDefault();

                    if (!mapInstance.current) return;

                    // Close the previous popup if another marker opens a new one
                    if (
                        activeOrderPopupRef.current &&
                        activeOrderPopupRef.current !== popup &&
                        activeOrderPopupRef.current.isOpen()
                    ) {
                        try {
                            activeOrderPopupRef.current.remove();
                        } catch {}
                    }

                    if (popup.isOpen()) {
                        popup.remove();
                        if (activeOrderPopupRef.current === popup) {
                            activeOrderPopupRef.current = null;
                        }
                    } else {
                        popup.setLngLat(marker.getLngLat());
                        popup.addTo(mapInstance.current);
                        activeOrderPopupRef.current = popup;
                    }

                    if (process.env.NODE_ENV !== "production") {
                        // eslint-disable-next-line no-console
                        console.log("[UniversalMap] delivery marker activate", order.id, { popups: document.querySelectorAll('.mapboxgl-popup').length });
                    }

                    onOrderSelectRef.current?.(order.id);
                };

                marker.getElement().addEventListener("pointerup", handleMarkerActivate);

                markersRef.current.set(markerId, {
                    marker,
                    popup,
                    innerEl: inner,
                    orderId: order.id,
                    kind: "delivery",
                });

                bounds.extend([order.delivery_longitude, order.delivery_latitude]);
                hasCoords = true;
            }
        });

        // Apply initial selection styles
        markersRef.current.forEach(({ innerEl, orderId, kind }) => {
            applyOrderSelectionStyles(orderId, kind, innerEl);
        });

        // Fit bounds only when coordinates actually change (not on selection change)
        if (hasCoords && !bounds.isEmpty() && lastFitKeyRef.current !== coordsKey) {
            lastFitKeyRef.current = coordsKey;
            mapInstance.current.fitBounds(bounds, {
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
                maxZoom: 15,
                duration: 700,
            });
        }
    }, [orders, mapReady, createOrderPopup, applyOrderSelectionStyles]);

    // Update selection styling without recreating markers (prevents popup disappearing and fixes drift)
    useEffect(() => {
        if (!mapInstance.current || !mapReady) return;

        markersRef.current.forEach(({ innerEl, orderId, kind, popup, marker }) => {
            applyOrderSelectionStyles(orderId, kind, innerEl);

            // also update fill color for selected state
            if (orderId && kind) {
                const isSelected = selectedOrderIds.includes(orderId);
                if (kind === "pickup") {
                    innerEl.style.backgroundColor = isSelected ? "#2563eb" : "#6366f1";
                } else {
                    innerEl.style.backgroundColor = isSelected ? "#16a34a" : "#22c55e";
                }
            }

            // keep popup anchored correctly if open
            if (popup && marker && popup.isOpen()) {
                try {
                    popup.setLngLat(marker.getLngLat());
                } catch { }
            }
        });
    }, [selectedOrderIds, mapReady, applyOrderSelectionStyles]);

    // Update node markers
    useEffect(() => {
        if (!mapInstance.current || !mapReady || nodes.length === 0 || orders.length > 0) return;

        // Clear existing markers
        markersRef.current.forEach(({ marker }) => marker.remove());
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

            markersRef.current.set(markerId, { marker, innerEl: el });
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
            className={`w-full rounded-lg ${className}`}
            style={{ height }}
        />
    );
};

export default UniversalMap;
