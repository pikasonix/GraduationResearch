"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DispatchDriver, DispatchRoute } from '@/app/dispatch/DispatchClient';
import config from '@/config/config';
import { Instance } from '@/utils/dataModels';
import { useMapControls } from '@/hooks/useMapControls';

interface DispatchMapProps {
    drivers: DispatchDriver[];
    selectedDriverId: string | null;
    onSelectDriver: (id: string) => void;
    selectedRoute: DispatchRoute | null;
    instance: Instance | null;
}

export default function DispatchMap({ drivers, selectedDriverId, onSelectDriver, selectedRoute, instance }: DispatchMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});

    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // Use map controls for caching
    const { routingCacheRef, loadCacheFromStorage, saveCacheToStorage } = useMapControls();

    useEffect(() => {
        if (map.current) return; // Initialize only once

        const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string) || "";
        if (!token) {
            console.error("Mapbox access token not found");
            return;
        }
        mapboxgl.accessToken = token;

        // Default to Hanoi
        const defaultCenter: [number, number] = [105.8500, 21.0285];

        map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: defaultCenter,
            zoom: 12,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.current.on('load', () => {
            console.log('Dispatch Map loaded');
            setIsMapLoaded(true);
        });

    }, []);

    // Load cache on mount
    useEffect(() => {
        loadCacheFromStorage();
    }, [loadCacheFromStorage]);

    // Update Driver Markers
    useEffect(() => {
        if (!map.current || !isMapLoaded) return;

        drivers.forEach(driver => {
            const isSelected = selectedDriverId === driver.id;
            const color = driver.status === 'available' ? '#52c41a' : driver.status === 'busy' ? '#faad14' : '#d9d9d9';

            if (!markersRef.current[driver.id]) {
                // Create marker
                const el = document.createElement('div');
                el.className = 'driver-marker';
                el.style.width = '24px';
                el.style.height = '24px';
                el.style.backgroundColor = color;
                el.style.borderRadius = '50%';
                el.style.border = '2px solid white';
                el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
                el.style.cursor = 'pointer';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H10v12z"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"></path><path d="M14 17h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>`; // Simple truck icon

                el.addEventListener('click', () => {
                    onSelectDriver(driver.id);
                });

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([driver.currentLng, driver.currentLat])
                    .addTo(map.current!);

                markersRef.current[driver.id] = marker;
            } else {
                // Update marker style
                const marker = markersRef.current[driver.id];
                const el = marker.getElement();
                el.style.backgroundColor = color;
                el.style.width = isSelected ? '32px' : '24px';
                el.style.height = isSelected ? '32px' : '24px';
                el.style.zIndex = isSelected ? '10' : '1';
                el.style.border = isSelected ? '3px solid #1677ff' : '2px solid white';
            }
        });

    }, [drivers, selectedDriverId, onSelectDriver, isMapLoaded]);

    // Helper to build real route
    const buildRealRoute = useCallback(async (route: any): Promise<[number, number][]> => {
        const sequence = route.originalRoute?.sequence || route.sequence;
        if (!sequence || sequence.length < 2) {
            return [];
        }

        // Helper to safely get coords
        const getCoords = (id: number): [number, number] => {
            if (!instance || !instance.nodes) return [0, 0];
            const node = instance.nodes.find(n => n.id === id);
            return node ? node.coords : [0, 0];
        };

        const coordPairs = sequence.map((id: number) => {
            const c = getCoords(id);
            return `${c[1]},${c[0]}`;
        }).join(';');

        const cacheKey = `full:${coordPairs}`;

        if (routingCacheRef.current.has(cacheKey)) {
            return routingCacheRef.current.get(cacheKey)!;
        }

        try {
            const routingProfile = localStorage.getItem('routingProfile') || 'driving'; // Default to driving for dispatch
            const url = `https://router.project-osrm.org/route/v1/${routingProfile}/${coordPairs}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const data = await response.json();
            let routeCoords: [number, number][];

            if (data.routes && data.routes.length > 0) {
                routeCoords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
            } else {
                console.warn('No full route found, fallback to straight lines');
                routeCoords = sequence.map((id: number) => getCoords(id));
            }

            routingCacheRef.current.set(cacheKey, routeCoords);
            saveCacheToStorage();
            return routeCoords;
        } catch (error) {
            console.warn('Full route API error:', error, 'Using straight lines fallback');
            const fallback = sequence.map((id: number) => getCoords(id));
            routingCacheRef.current.set(cacheKey, fallback);
            return fallback;
        }
    }, [instance, routingCacheRef, saveCacheToStorage]);

    // Handle Route Selection (Draw Polyline & Node Markers)
    useEffect(() => {
        if (!map.current || !instance || !isMapLoaded) return;

        const routeLayerId = 'selected-route-line';
        const routeSourceId = 'selected-route-source';
        const arrowLayerId = 'selected-route-arrows'; // For direction arrows if needed

        const drawRoute = async () => {
            // Cleanup previous route line
            if (map.current?.getSource(routeSourceId)) {
                if (map.current.getLayer(routeLayerId)) map.current.removeLayer(routeLayerId);
                if (map.current.getLayer(arrowLayerId)) map.current.removeLayer(arrowLayerId);
                map.current.removeSource(routeSourceId);
            }

            // Cleanup previous node markers
            const currentMarkers = document.querySelectorAll('.route-node-marker');
            currentMarkers.forEach(marker => marker.remove());

            if (selectedRoute && selectedRoute.originalRoute) {
                let points: [number, number][] = [];
                let sequenceNodes: any[] = [];

                // Fetch real route geometry
                points = await buildRealRoute(selectedRoute);

                // Get nodes for markers
                if (selectedRoute.originalRoute.sequence && instance.nodes) {
                    sequenceNodes = selectedRoute.originalRoute.sequence.map(nodeId => {
                        return instance.nodes.find(n => n.id === nodeId);
                    }).filter(n => n !== undefined);
                }

                if (points.length > 1 && map.current) {
                    // Ensure map is still mounted
                    map.current.addSource(routeSourceId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'LineString',
                                coordinates: points.map(p => [p[1], p[0]]) // Mapbox expects [lng, lat]
                            }
                        }
                    });

                    map.current.addLayer({
                        id: routeLayerId,
                        type: 'line',
                        source: routeSourceId,
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': selectedRoute.originalRoute.color || '#1677ff',
                            'line-width': 6,
                            'line-opacity': 0.8
                        }
                    });

                    // Fit bounds to route
                    const bounds = new mapboxgl.LngLatBounds();
                    points.forEach(p => bounds.extend([p[1], p[0]])); // Extend with [lng, lat]
                    map.current.fitBounds(bounds, { padding: 50 });
                }

                // Draw Node Markers
                sequenceNodes.forEach((node, index) => {
                    if (!map.current) return;
                    const el = document.createElement('div');
                    el.className = 'route-node-marker';
                    el.style.width = '12px';
                    el.style.height = '12px';
                    el.style.borderRadius = '50%';
                    el.style.border = '2px solid white';
                    el.style.cursor = 'pointer';
                    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

                    if (node.is_depot) {
                        el.style.backgroundColor = '#000';
                        el.style.width = '16px';
                        el.style.height = '16px';
                        el.style.zIndex = '2';
                    } else if (node.is_pickup) {
                        el.style.backgroundColor = '#52c41a'; // Green
                    } else if (node.is_delivery) {
                        el.style.backgroundColor = '#faad14'; // Orange
                    } else {
                        el.style.backgroundColor = '#1677ff'; // Blue default
                    }

                    // Add popup
                    const popup = new mapboxgl.Popup({ offset: 25 })
                        .setHTML(`
                            <div style="font-size: 12px; color: #333;">
                                <strong>${node.is_depot ? 'Kho' : (node.is_pickup ? 'Điểm lấy hàng' : 'Điểm giao hàng')}</strong><br/>
                                ID: ${node.id}<br/>
                                Nhu cầu: ${node.demand}<br/>
                                Thứ tự: ${index + 1}
                            </div>
                        `);

                    new mapboxgl.Marker(el)
                        .setLngLat([node.coords[1], node.coords[0]])
                        .setPopup(popup)
                        .addTo(map.current);
                });
            }
        };

        drawRoute();

    }, [selectedRoute, instance, isMapLoaded, buildRealRoute]);

    return (
        <div ref={mapContainer} className="w-full h-full" />
    );
}
