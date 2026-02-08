"use client";

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DispatchDriver, DispatchRoute } from '@/app/monitor/page';
import config from '@/config/config';

// Route position info for vehicle markers
export interface RoutePosition {
    lat: number;
    lng: number;
    heading: number;
}

interface MonitorMapProps {
    drivers: DispatchDriver[];
    routes: DispatchRoute[];
    selectedDriverId: string | null;
    onSelectDriver: (id: string | null) => void;
    depot?: { lat: number; lng: number } | null;
    useRealRouting?: boolean;
    currentTime?: string;
    lastUpdated?: string;
    routePositions?: Map<string, RoutePosition>; // Map<routeId, position>
}

export default function MonitorMap({ drivers, routes, selectedDriverId, onSelectDriver, depot, useRealRouting = true, currentTime, lastUpdated, routePositions }: MonitorMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
    const depotMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const drawnRouteIdsRef = useRef<Set<string>>(new Set());
    const routingCacheRef = useRef<Map<string, [number, number][]>>(new Map());
    const hasInitialFitRef = useRef(false); // Track if we've done initial fit to avoid zoom reset

    // Initialize Map
    useEffect(() => {
        if (map.current) return;

        const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string) || "";
        if (!token) return;
        mapboxgl.accessToken = token;

        map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v12', // Standard streets style
            center: [105.8500, 21.0285], // Hanoi
            zoom: 13,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.current.on('load', () => setIsMapLoaded(true));
    }, []);

    // Fetch real road route from Mapbox Directions API
    async function fetchRealRoute(coords: [number, number][]): Promise<[number, number][]> {
        if (coords.length < 2) return coords;
        
        // Build cache key
        const cacheKey = coords.map(c => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join('|');
        if (routingCacheRef.current.has(cacheKey)) {
            return routingCacheRef.current.get(cacheKey)!;
        }

        try {
            // Mapbox limits to 25 waypoints per request, chunk if needed
            const maxWaypoints = 25;
            if (coords.length <= maxWaypoints) {
                const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
                const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?overview=full&geometries=geojson&access_token=${mapboxgl.accessToken}`;
                const resp = await fetch(url);
                const data = await resp.json();
                if (data.routes && data.routes[0]?.geometry?.coordinates) {
                    const result = data.routes[0].geometry.coordinates as [number, number][];
                    routingCacheRef.current.set(cacheKey, result);
                    return result;
                }
            } else {
                // Chunk and merge
                const allCoords: [number, number][] = [];
                for (let i = 0; i < coords.length; i += maxWaypoints - 1) {
                    const chunk = coords.slice(i, Math.min(i + maxWaypoints, coords.length));
                    if (chunk.length < 2) continue;
                    const coordStr = chunk.map(c => `${c[0]},${c[1]}`).join(';');
                    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?overview=full&geometries=geojson&access_token=${mapboxgl.accessToken}`;
                    const resp = await fetch(url);
                    const data = await resp.json();
                    if (data.routes && data.routes[0]?.geometry?.coordinates) {
                        const chunkCoords = data.routes[0].geometry.coordinates as [number, number][];
                        // Skip first point if not first chunk to avoid duplicates
                        allCoords.push(...(allCoords.length > 0 ? chunkCoords.slice(1) : chunkCoords));
                    }
                }
                if (allCoords.length > 0) {
                    routingCacheRef.current.set(cacheKey, allCoords);
                    return allCoords;
                }
            }
        } catch (e) {
            console.error('Real routing failed, using straight lines:', e);
        }
        return coords; // fallback to straight lines
    }

    // Draw Routes
    useEffect(() => {
        if (!map.current || !isMapLoaded) return;

        const currentIds = new Set(routes.map((r) => String(r.id)));

        // Remove stale route layers/sources
        for (const prevId of drawnRouteIdsRef.current) {
            if (currentIds.has(prevId)) continue;
            const sourceId = `route-${prevId}`;
            const layerId = `route-layer-${prevId}`;
            if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
            if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
        }
        drawnRouteIdsRef.current = currentIds;

        // Add/update route layers with real routing
        async function drawRoutes() {
            for (let idx = 0; idx < routes.length; idx++) {
                const route = routes[idx];
                const sourceId = `route-${route.id}`;
                const layerId = `route-layer-${route.id}`;
                const color = route.color || '#3b82f6';

                // Get coordinates from geometry
                let coordinates = (route.geometry as any)?.coordinates as [number, number][] || [];

                // Fetch real road-following route if enabled
                if (useRealRouting && coordinates.length >= 2) {
                    coordinates = await fetchRealRoute(coordinates);
                }

                const feature = {
                    type: 'Feature',
                    properties: { id: String(route.id) },
                    geometry: { type: 'LineString', coordinates },
                };

                const source = map.current?.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
                if (!source) {
                    map.current?.addSource(sourceId, {
                        type: 'geojson',
                        data: feature as any,
                    });
                    map.current?.addLayer({
                        id: layerId,
                        type: 'line',
                        source: sourceId,
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': color,
                            'line-width': 3,
                            'line-opacity': 0.9
                        }
                    });
                } else {
                    try {
                        source.setData(feature as any);
                    } catch {
                        // Ignore occasional setData errors during hot reload
                    }
                }
            }
        }
        
        // Draw routes first, then add nodes layer on top
        drawRoutes().then(() => {
            // Draw nodes AFTER routes to ensure correct z-order
            drawNodesLayer();
        });

        // Nodes layer drawing function
        function drawNodesLayer() {
            if (!map.current || !isMapLoaded) return;
            
            const nodesSourceId = 'monitor-route-nodes';
            const nodesLayerId = 'monitor-route-nodes-layer';
            const nodesLabelLayerId = nodesLayerId + '-labels';
            
            const nodesFeatures = routes.flatMap((r) => {
                const color = r.color || '#3b82f6';
                const stops = (r as any).stops as any[] | undefined;
                if (!Array.isArray(stops)) return [];
                return stops.map((s: any) => ({
                    type: 'Feature',
                    properties: {
                        routeId: String(r.id),
                        nodeId: Number(s.nodeId),
                        seqIndex: Number(s.seqIndex),
                        kind: String(s.kind || ''),
                        color,
                        orderId: s.orderId ?? null,
                        locationId: s.locationId ?? null,
                        // Include order info as JSON string since GeoJSON properties must be primitives
                        orderInfo: s.orderInfo ? JSON.stringify(s.orderInfo) : null,
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [Number(s.lng), Number(s.lat)],
                    },
                }));
            });

            const nodesCollection = { type: 'FeatureCollection', features: nodesFeatures };

            const nodesSource = map.current.getSource(nodesSourceId) as mapboxgl.GeoJSONSource | undefined;
            if (!nodesSource) {
                map.current.addSource(nodesSourceId, { type: 'geojson', data: nodesCollection as any });
                
                // Shadow/glow layer for depth effect (Google Maps style)
                map.current.addLayer({
                    id: nodesLayerId + '-shadow',
                    type: 'circle',
                    source: nodesSourceId,
                    paint: {
                        'circle-color': '#000000',
                        'circle-radius': 16,
                        'circle-opacity': 0.2,
                        'circle-blur': 0.8,
                        'circle-translate': [0, 2],
                    },
                });
                
                // Outer white border (Google Maps pin style)
                map.current.addLayer({
                    id: nodesLayerId + '-border',
                    type: 'circle',
                    source: nodesSourceId,
                    paint: {
                        'circle-color': '#ffffff',
                        'circle-radius': 14,
                        'circle-opacity': 1,
                    },
                });
                
                // Main colored circle
                map.current.addLayer({
                    id: nodesLayerId,
                    type: 'circle',
                    source: nodesSourceId,
                    paint: {
                        'circle-color': ['get', 'color'],
                        'circle-radius': 11,
                        'circle-opacity': 1,
                    },
                });
                
                // Inner white dot (Google Maps style)
                map.current.addLayer({
                    id: nodesLayerId + '-inner',
                    type: 'circle',
                    source: nodesSourceId,
                    paint: {
                        'circle-color': '#ffffff',
                        'circle-radius': 4,
                        'circle-opacity': 0.9,
                    },
                });

                // Add labels for nodes (sequence numbers) - positioned above
                map.current.addLayer({
                    id: nodesLabelLayerId,
                    type: 'symbol',
                    source: nodesSourceId,
                    layout: {
                        'text-field': ['to-string', ['get', 'seqIndex']],
                        'text-size': 10,
                        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                        'text-offset': [0, -1.8],
                        'text-anchor': 'center',
                        'text-allow-overlap': true,
                    },
                    paint: {
                        'text-color': ['get', 'color'],
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 1.5,
                    },
                });

                map.current.on('click', nodesLayerId, (e) => {
                    const f = e.features?.[0];
                    if (!f) return;
                    const props: any = f.properties || {};
                    const kind = props.kind || '';
                    const nodeId = props.nodeId;
                    const label = props.orderId ? `${kind} ${props.orderId}` : `${kind} #${nodeId}`;
                    const coord = (f.geometry as any)?.coordinates as [number, number] | undefined;
                    if (!coord) return;
                    
                    // Parse order info if available
                    let orderInfo: any = null;
                    try {
                        if (props.orderInfo) {
                            orderInfo = JSON.parse(props.orderInfo);
                        }
                    } catch (e) {
                        console.error('Failed to parse orderInfo:', e);
                    }
                    
                    // Build popup HTML
                    let popupHTML = `<div class="p-3 text-xs max-w-xs">`;
                    popupHTML += `<div class="font-semibold text-sm mb-2">${label}</div>`;
                    popupHTML += `<div class="text-gray-500 mb-1">Route: ${props.routeId} | Seq: ${props.seqIndex}</div>`;
                    
                    if (orderInfo) {
                        popupHTML += `<div class="border-t pt-2 mt-2">`;
                        
                        if (orderInfo.tracking_number) {
                            popupHTML += `<div class="mb-1"><span class="font-medium">Tracking:</span> ${orderInfo.tracking_number}</div>`;
                        }
                        
                        if (kind.toLowerCase().includes('pickup') && orderInfo.pickup_address) {
                            popupHTML += `<div class="mb-1"><span class="font-medium">Pickup:</span><br/>${orderInfo.pickup_address}</div>`;
                            if (orderInfo.pickup_contact_name) {
                                popupHTML += `<div class="text-gray-600">${orderInfo.pickup_contact_name}`;
                                if (orderInfo.pickup_contact_phone) {
                                    popupHTML += ` - ${orderInfo.pickup_contact_phone}`;
                                }
                                popupHTML += `</div>`;
                            }
                        }
                        
                        if (kind.toLowerCase().includes('delivery') && orderInfo.delivery_address) {
                            popupHTML += `<div class="mb-1"><span class="font-medium">Delivery:</span><br/>${orderInfo.delivery_address}</div>`;
                            if (orderInfo.delivery_contact_name) {
                                popupHTML += `<div class="text-gray-600">${orderInfo.delivery_contact_name}`;
                                if (orderInfo.delivery_contact_phone) {
                                    popupHTML += ` - ${orderInfo.delivery_contact_phone}`;
                                }
                                popupHTML += `</div>`;
                            }
                        }
                        
                        if (orderInfo.weight) {
                            popupHTML += `<div class="mb-1"><span class="font-medium">Weight:</span> ${orderInfo.weight} kg</div>`;
                        }
                        
                        if (orderInfo.notes) {
                            popupHTML += `<div class="mt-1 text-gray-600 italic">${orderInfo.notes}</div>`;
                        }
                        
                        popupHTML += `</div>`;
                    }
                    
                    popupHTML += `</div>`;
                    
                    new mapboxgl.Popup({ offset: 12, maxWidth: '300px' })
                        .setLngLat(coord)
                        .setHTML(popupHTML)
                        .addTo(map.current!);
                });
                map.current.on('mouseenter', nodesLayerId, () => {
                    map.current!.getCanvas().style.cursor = 'pointer';
                });
                map.current.on('mouseleave', nodesLayerId, () => {
                    map.current!.getCanvas().style.cursor = '';
                });
            } else {
                try {
                    nodesSource.setData(nodesCollection as any);
                } catch { }
            }
        }

        // Add depot marker
        if (depot && depot.lat && depot.lng) {
            if (!depotMarkerRef.current) {
                const el = document.createElement('div');
                el.innerHTML = `
                    <div style="
                        background-color: #dc2626;
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 3px solid white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    ">
                        <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"white\">
                            <path d=\"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5\"/>
                        </svg>
                    </div>
                `;
                const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
                    .setHTML('<div class="p-2 font-semibold">Kho (Depot)</div>');
                depotMarkerRef.current = new mapboxgl.Marker({ element: el })
                    .setLngLat([depot.lng, depot.lat])
                    .setPopup(popup)
                    .addTo(map.current!);
            } else {
                depotMarkerRef.current.setLngLat([depot.lng, depot.lat]);
            }
        }

        // Fit bounds to routes ONLY on first load (to preserve user's zoom/pan on refresh)
        if (!hasInitialFitRef.current) {
            const coords = routes.flatMap((r) => {
                const c = (r.geometry as any)?.coordinates;
                return Array.isArray(c) ? c : [];
            });
            if (coords.length > 1) {
                const bounds = coords.reduce((b: mapboxgl.LngLatBounds, c: any) => {
                    const lng = Number(c?.[0]);
                    const lat = Number(c?.[1]);
                    if (Number.isFinite(lng) && Number.isFinite(lat)) b.extend([lng, lat]);
                    return b;
                }, new mapboxgl.LngLatBounds([coords[0][0], coords[0][1]], [coords[0][0], coords[0][1]]));
                try {
                    map.current.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 500 });
                    hasInitialFitRef.current = true; // Mark that we've done initial fit
                } catch { }
            }
        }

    }, [routes, isMapLoaded, depot, useRealRouting]);

    // Update Vehicle Markers using GeoJSON Layer (like nodes) for accurate positioning
    useEffect(() => {
        if (!map.current || !isMapLoaded) return;
        
        // Skip if routePositions is empty (wait for data to load)
        if (!routePositions || routePositions.size === 0) {
            console.log('[MonitorMap] Waiting for routePositions...');
            return;
        }

        const vehicleSourceId = 'vehicle-markers-source';
        const vehicleLayerId = 'vehicle-markers-layer';
        const vehicleLabelLayerId = 'vehicle-markers-labels';
        const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

        // Build GeoJSON features for vehicle positions
        const vehicleFeatures = routes.map((route, idx) => {
            const routePos = routePositions.get(route.id);
            if (!routePos) return null;
            
            const color = route.color || palette[idx % palette.length];
            
            return {
                type: 'Feature',
                properties: {
                    routeId: route.id,
                    label: String(idx + 1),
                    color: color,
                    heading: routePos.heading || 0,
                },
                geometry: {
                    type: 'Point',
                    coordinates: [routePos.lng, routePos.lat],
                },
            };
        }).filter(Boolean);

        const vehicleCollection = { type: 'FeatureCollection', features: vehicleFeatures };

        // Update or create source
        const existingSource = map.current.getSource(vehicleSourceId) as mapboxgl.GeoJSONSource | undefined;
        
        if (!existingSource) {
            map.current.addSource(vehicleSourceId, { type: 'geojson', data: vehicleCollection as any });
            
            // Add circle layer for vehicle markers (similar to nodes but larger)
            // Shadow layer
            map.current.addLayer({
                id: vehicleLayerId + '-shadow',
                type: 'circle',
                source: vehicleSourceId,
                paint: {
                    'circle-color': '#000000',
                    'circle-radius': 20,
                    'circle-opacity': 0.25,
                    'circle-blur': 0.8,
                    'circle-translate': [0, 3],
                },
            });
            
            // White border
            map.current.addLayer({
                id: vehicleLayerId + '-border',
                type: 'circle',
                source: vehicleSourceId,
                paint: {
                    'circle-color': '#ffffff',
                    'circle-radius': 18,
                    'circle-opacity': 1,
                },
            });
            
            // Main colored circle
            map.current.addLayer({
                id: vehicleLayerId,
                type: 'circle',
                source: vehicleSourceId,
                paint: {
                    'circle-color': ['get', 'color'],
                    'circle-radius': 15,
                    'circle-opacity': 1,
                },
            });
            
            // Arrow/direction indicator (small triangle pointing in heading direction)
            // We'll use a symbol layer with a rotated arrow
            map.current.addLayer({
                id: vehicleLayerId + '-arrow',
                type: 'symbol',
                source: vehicleSourceId,
                layout: {
                    'icon-image': 'triangle-11', // Built-in Mapbox icon
                    'icon-size': 1.2,
                    'icon-rotate': ['get', 'heading'],
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                },
                paint: {
                    'icon-color': '#ffffff',
                    'icon-opacity': 0.9,
                },
            });
            
            // Label with route number
            map.current.addLayer({
                id: vehicleLabelLayerId,
                type: 'symbol',
                source: vehicleSourceId,
                layout: {
                    'text-field': ['get', 'label'],
                    'text-size': 11,
                    'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                    'text-offset': [0, 2.2], // Below the circle
                    'text-anchor': 'top',
                    'text-allow-overlap': true,
                },
                paint: {
                    'text-color': ['get', 'color'],
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2,
                },
            });

            // Click handler
            map.current.on('click', vehicleLayerId, (e) => {
                const f = e.features?.[0];
                if (!f) return;
                const routeId = (f.properties as any)?.routeId;
                const route = routes.find(r => r.id === routeId);
                if (route) {
                    const driver = drivers.find(d => d.vehicleId === route.vehicleId);
                    if (driver) onSelectDriver(driver.id);
                }
            });
            
            map.current.on('mouseenter', vehicleLayerId, () => {
                map.current!.getCanvas().style.cursor = 'pointer';
            });
            map.current.on('mouseleave', vehicleLayerId, () => {
                map.current!.getCanvas().style.cursor = '';
            });
        } else {
            try {
                existingSource.setData(vehicleCollection as any);
            } catch (e) {
                console.error('Error updating vehicle source:', e);
            }
        }

        // Cleanup old HTML markers if any
        Object.keys(markersRef.current).forEach(id => {
            markersRef.current[id].remove();
            delete markersRef.current[id];
        });

    }, [drivers, selectedDriverId, isMapLoaded, routes, routePositions]);

    return (
        <div className="w-full h-full relative">
            <div ref={mapContainer} className="w-full h-full" />
            {/* Time overlay */}
            {(currentTime || lastUpdated) && (
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 z-10">
                    {currentTime && (
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-800">{currentTime}</span>
                        </div>
                    )}
                    {lastUpdated && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Cập nhật: {lastUpdated}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
