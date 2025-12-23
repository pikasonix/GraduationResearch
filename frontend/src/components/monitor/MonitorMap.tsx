"use client";

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DispatchDriver } from '@/app/dispatch/DispatchClient';
import config from '@/config/config';

interface MonitorMapProps {
    drivers: DispatchDriver[];
    selectedDriverId: string | null;
    onSelectDriver: (id: string | null) => void;
}

export default function MonitorMap({ drivers, selectedDriverId, onSelectDriver }: MonitorMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    useEffect(() => {
        if (map.current) return;

        const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string) || "";
        if (!token) return;
        mapboxgl.accessToken = token;

        map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [105.8500, 21.0285], // Hanoi
            zoom: 12,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.current.on('load', () => setIsMapLoaded(true));

        // Click on map background to deselect
        map.current.on('click', (e) => {
            // Check if click target was NOT a marker (markers handle their own clicks stopPropagation)
            if (e.originalEvent.target && (e.originalEvent.target as HTMLElement).tagName !== 'path') {
                // Simplistic check, better to rely on marker click events
            }
            // Actually, marker click handlers are separate. If this fires, it likely wasn't a marker.
            // But we need to be careful not to override marker clicks if they propagate.
            // For now, let's keep it simple: clicks on sidebar select, clicks on markers select. 
            // Map background click could deselect?
            // onSelectDriver(null); 
        });

    }, []);

    // Update markers
    useEffect(() => {
        if (!map.current || !isMapLoaded) return;

        // Remove markers for drivers that no longer exist (if any) - not common in this view but good practice
        Object.keys(markersRef.current).forEach(id => {
            if (!drivers.find(d => d.id === id)) {
                markersRef.current[id].remove();
                delete markersRef.current[id];
            }
        });

        drivers.forEach(driver => {
            const isSelected = selectedDriverId === driver.id;
            const color = driver.status === 'available' ? '#22c55e' : driver.status === 'busy' ? '#f59e0b' : '#9ca3af';

            if (!markersRef.current[driver.id]) {
                const el = document.createElement('div');
                el.className = 'monitor-marker';
                el.style.width = '32px';
                el.style.height = '32px';
                el.style.backgroundColor = color;
                el.style.borderRadius = '50%';
                el.style.border = '2px solid white';
                el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
                el.style.cursor = 'pointer';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                // Truck icon SVG
                el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H10v12z"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"></path><path d="M14 17h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>`;

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onSelectDriver(driver.id);
                });

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([driver.currentLng, driver.currentLat])
                    .addTo(map.current!);

                markersRef.current[driver.id] = marker;
            } else {
                // Update existing
                const marker = markersRef.current[driver.id];
                marker.setLngLat([driver.currentLng, driver.currentLat]);
                const el = marker.getElement();
                el.style.backgroundColor = color;
                el.style.width = isSelected ? '40px' : '32px';
                el.style.height = isSelected ? '40px' : '32px';
                el.style.zIndex = isSelected ? '10' : '1';
                el.style.border = isSelected ? '3px solid #3b82f6' : '2px solid white';
            }
        });

        // If selected driver changes, fly to them
        if (selectedDriverId) {
            const driver = drivers.find(d => d.id === selectedDriverId);
            if (driver) {
                map.current.flyTo({
                    center: [driver.currentLng, driver.currentLat],
                    zoom: 15,
                    speed: 1.5
                });
            }
        }

    }, [drivers, selectedDriverId, isMapLoaded]);

    return <div ref={mapContainer} className="w-full h-full relative" />;
}
