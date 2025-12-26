"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import RouteList from './RouteList';
import NodeList from './NodeList';
import RouteAnalysis from './RouteAnalysis';
import { useMapControls } from '@/hooks/useMapControls';
import config from '@/config/config';
import { Instance, Solution, Node, Route } from '@/utils/dataModels';
import type { FeatureCollection, Feature, LineString, Point } from 'geojson';

// Extend Window interface
declare global {
  interface Window {
    testRouteInteractivity?: () => void;
    toggleRealRouting?: () => void;
  }
}

// Extended Node interface for markers
interface NodeWithMarker extends Node {
  marker?: mapboxgl.Marker;
}

// Props interface
interface MapComponentProps {
  instance: Instance | null;
  solution: Solution | null;
  selectedNodes: Node[] | null;
  setSelectedNodes: (nodes: Node[] | null) => void;
  selectedRoute: Route | null;
  setSelectedRoute: (route: Route | null) => void;
  useRealRouting: boolean;
  onToggleRealRouting?: () => void;
  hidePanels?: boolean;
  mapHeight?: string;
  externalApiRef?: React.MutableRefObject<any | null>;
}

const MapboxComponent: React.FC<MapComponentProps> = ({
  instance,
  solution,
  selectedNodes,
  setSelectedNodes,
  selectedRoute,
  setSelectedRoute,
  useRealRouting,
  onToggleRealRouting,
  hidePanels = false,
  mapHeight = '60vh',
  externalApiRef,
}) => {
  const SEGMENT_HIGHLIGHT_COLOR = '#f97316'; // Tailwind orange-500
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Marker and layer state
  const nodeMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const segmentMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const segmentPopupRef = useRef<mapboxgl.Popup | null>(null);

  // Track last loaded instance/solution to avoid unnecessary fitBounds
  const lastInstanceRef = useRef<Instance | null>(null);
  const lastSolutionRef = useRef<Solution | null>(null);

  // Track drawn route IDs to ensure proper cleanup
  const drawnRouteIdsRef = useRef<Set<number>>(new Set());

  // Ref to access latest clearRouteSelection in event listeners without triggering re-init
  const clearRouteSelectionRef = useRef<() => void>(() => { });

  // Get cache-related functions from hook
  const { routingCacheRef, generateCacheKey, loadCacheFromStorage, saveCacheToStorage } = useMapControls();

  // Utility: Haversine distance (km)
  const haversineKm = (a: [number, number], b: [number, number]) => {
    const R = 6371; // km
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180;
    const lat2 = b[0] * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // Create HTML element for node markers
  const createNodeMarkerElement = useCallback((node: NodeWithMarker, iconSize: number, isOpaque = false): HTMLDivElement => {
    const el = document.createElement('div');
    el.style.width = `${iconSize}px`;
    el.style.height = `${iconSize}px`;
    el.style.cursor = 'pointer';

    let className;
    if (node.is_pickup) {
      className = isOpaque ? 'pickup-marker-opaque' : 'pickup-marker';
    } else if (node.is_delivery) {
      className = isOpaque ? 'delivery-marker-opaque' : 'delivery-marker';
    } else {
      className = isOpaque ? 'depot-marker-opaque' : 'depot-marker';
    }

    el.className = className;
    return el;
  }, []);

  // Highlight markers logic
  const highlightMarkers = useCallback((node: NodeWithMarker, lightOn: boolean) => {
    if (!mapRef.current || !instance) return;

    const marker = nodeMarkersRef.current.get(node.id);
    if (!marker) return;

    const markerEl = marker.getElement();
    if (lightOn) {
      markerEl.style.width = '20px';
      markerEl.style.height = '20px';
      markerEl.style.zIndex = '1000';
    } else {
      markerEl.style.width = '10px';
      markerEl.style.height = '10px';
      markerEl.style.zIndex = '0';
    }

    // Handle pair highlighting
    if (!node.is_depot) {
      const pair = instance.nodes.find(n => n.id === node.pair) as NodeWithMarker | undefined;
      if (pair) {
        const pairMarker = nodeMarkersRef.current.get(pair.id);
        if (pairMarker) {
          const pairEl = pairMarker.getElement();
          if (lightOn) {
            pairEl.style.width = '20px';
            pairEl.style.height = '20px';
            pairEl.style.zIndex = '1000';
          } else {
            pairEl.style.width = '10px';
            pairEl.style.height = '10px';
            pairEl.style.zIndex = '0';
          }
        }
      }
    }

    // Dim other markers
    for (const other of instance.nodes as NodeWithMarker[]) {
      if (other.id === node.id || other.id === node.pair) continue;

      const otherMarker = nodeMarkersRef.current.get(other.id);
      if (otherMarker) {
        const otherEl = otherMarker.getElement();
        if (lightOn) {
          otherEl.style.opacity = '0.3';
        } else {
          otherEl.style.opacity = '1';
        }
      }
    }
  }, [instance]);

  // Click handler for nodes
  const onClickNode = useCallback((node: NodeWithMarker) => {
    if (!mapRef.current) return;

    // Clear previous selection
    if (selectedNodes) {
      selectedNodes.forEach(n => highlightMarkers(n as NodeWithMarker, false));
    }

    let nodesToSelect = [node];
    if (!node.is_depot && instance) {
      const pairNode = instance.nodes.find(n => n.id === node.pair) as NodeWithMarker | undefined;
      if (pairNode) {
        nodesToSelect.push(pairNode);
      }
    }
    setSelectedNodes(nodesToSelect);
    nodesToSelect.forEach(n => highlightMarkers(n, true));

    // Fly to selected node
    mapRef.current.flyTo({
      center: [node.coords[1], node.coords[0]],
      zoom: 15,
    });
  }, [instance, selectedNodes, setSelectedNodes, highlightMarkers]);

  // Add node to map
  const addNodeToMap = useCallback((node: NodeWithMarker) => {
    if (!mapRef.current) return;

    const el = createNodeMarkerElement(node, 10, false);

    // Create popup content
    let strType = "Depot";
    if (node.is_pickup) strType = "Pickup";
    else if (node.is_delivery) strType = "Delivery";

    const popup = new mapboxgl.Popup({ offset: 15 })
      .setHTML(`<b>${strType}: ${node.id}</b><br>&ensp;Demand: ${node.demand}<br>&ensp;Time window: [ ${node.time_window[0]} , ${node.time_window[1]} ]`);

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([node.coords[1], node.coords[0]])
      .setPopup(popup)
      .addTo(mapRef.current);

    // Add event listeners
    el.addEventListener('mouseenter', () => {
      if (!selectedNodes) highlightMarkers(node, true);
    });

    el.addEventListener('mouseleave', () => {
      if (!selectedNodes) highlightMarkers(node, false);
    });

    el.addEventListener('click', () => onClickNode(node));

    nodeMarkersRef.current.set(node.id, marker);
  }, [createNodeMarkerElement, highlightMarkers, onClickNode, selectedNodes]);

  // Real routing functionality
  const getRouteFromAPI = useCallback(async (startCoord: [number, number], endCoord: [number, number]): Promise<[number, number][]> => {
    const cacheKey = generateCacheKey(startCoord, endCoord);
    if (routingCacheRef.current.has(cacheKey)) {
      return routingCacheRef.current.get(cacheKey)!;
    }

    try {
      const routingProfile = localStorage.getItem('routingProfile') || 'walking';
      const mapboxProfile = routingProfile === 'driving' ? 'driving' : routingProfile === 'cycling' ? 'cycling' : 'walking';
      const accessToken = mapboxgl.accessToken;
      const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxProfile}/${startCoord[1]},${startCoord[0]};${endCoord[1]},${endCoord[0]}?overview=full&geometries=geojson&access_token=${accessToken}`;
      const response = await fetch(url);
      const data = await response.json();

      let routeCoords: [number, number][];
      if (data.routes && data.routes.length > 0) {
        routeCoords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
      } else {
        console.warn('No route found, using straight line');
        routeCoords = [startCoord, endCoord];
      }

      routingCacheRef.current.set(cacheKey, routeCoords);
      if (routingCacheRef.current.size % 10 === 0) {
        saveCacheToStorage();
      }
      return routeCoords;
    } catch (error) {
      console.warn('Routing API error:', error, 'Using straight line');
      const fallback = [startCoord, endCoord];
      routingCacheRef.current.set(cacheKey, fallback);
      return fallback;
    }
  }, [generateCacheKey, saveCacheToStorage]);

  const buildRealRoute = useCallback(async (route: Route): Promise<[number, number][]> => {
    const sequence = route.sequence;
    if (!sequence || sequence.length < 2) {
      console.warn('Invalid route sequence for route', route.id);
      return route.path;
    }

    const depotCoords = instance?.nodes?.find((n) => n.id === 0)?.coords;
    const depotIsZeroZero =
      !!depotCoords &&
      Number.isFinite(depotCoords[0]) &&
      Number.isFinite(depotCoords[1]) &&
      depotCoords[0] === 0 &&
      depotCoords[1] === 0;

    const isFiniteLatLng = (coords: [number, number]) => {
      const [lat, lng] = coords;
      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    };

    const isPlaceholderZeroZero = (coords: [number, number], nodeId: number) => {
      if (nodeId === 0) return false;
      if (coords[0] !== 0 || coords[1] !== 0) return false;
      // Treat (0,0) as invalid if depot isn't also (0,0)
      return !depotIsZeroZero;
    };

    // Helper to safely get coords (null means invalid/missing)
    const getCoords = (id: number): [number, number] | null => {
      if (!instance || !instance.nodes) return null;
      const node = instance.nodes.find((n) => n.id === id);
      if (!node) return null;
      const coords = node.coords as [number, number];
      if (!isFiniteLatLng(coords)) return null;
      if (isPlaceholderZeroZero(coords, id)) return null;
      return coords;
    };

    const seqWithCoords = sequence.map((id) => ({ id, coords: getCoords(id) }));
    const invalidNodeIds = seqWithCoords.filter((x) => !x.coords).map((x) => x.id);
    if (invalidNodeIds.length > 0) {
      console.warn('Route has invalid coords; skipping invalid nodes to avoid (0,0) artifacts', {
        routeId: route.id,
        invalidNodeIds,
      });
      const fallback = seqWithCoords
        .filter((x): x is { id: number; coords: [number, number] } => Boolean(x.coords))
        .map((x) => x.coords);
      route.path = fallback;
      return fallback;
    }

    if (useRealRouting && instance) {
      const coordPairs = seqWithCoords
        .map((x) => {
          const c = x.coords as [number, number];
          return `${c[1]},${c[0]}`;
        })
        .join(';');
      const cacheKey = `full:${coordPairs}`;

      if (routingCacheRef.current.has(cacheKey)) {
        return routingCacheRef.current.get(cacheKey)!;
      }

      try {
        const routingProfile = localStorage.getItem('routingProfile') || 'walking';
        const mapboxProfile = routingProfile === 'driving' ? 'driving' : routingProfile === 'cycling' ? 'cycling' : 'walking';
        const accessToken = mapboxgl.accessToken;
        const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxProfile}/${coordPairs}?overview=full&geometries=geojson&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        let routeCoords: [number, number][];
        if (data.routes && data.routes.length > 0) {
          routeCoords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        } else {
          console.warn('No full route found, fallback to straight lines');
          routeCoords = seqWithCoords.map((x) => x.coords as [number, number]);
        }
        routingCacheRef.current.set(cacheKey, routeCoords);
        saveCacheToStorage();
        route.path = routeCoords;
        return routeCoords;
      } catch (error) {
        console.warn('Full route API error:', error, 'Using straight lines fallback');
        const fallback = seqWithCoords.map((x) => x.coords as [number, number]);
        route.path = fallback;
        routingCacheRef.current.set(cacheKey, fallback);
        return fallback;
      }
    } else {
      return seqWithCoords.map((x) => x.coords as [number, number]);
    }
  }, [useRealRouting, instance, saveCacheToStorage]);

  // Route highlighting logic
  const highlightRoute = useCallback((route: Route, lightOn: boolean) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const routeLayerId = `route-${route.id}`;
    const routeLayerFillId = `route-fill-${route.id}`;

    if (lightOn) {
      // Highlight this route
      if (map.getLayer(routeLayerId)) {
        map.setPaintProperty(routeLayerId, 'line-color', 'red');
        map.setPaintProperty(routeLayerId, 'line-width', 6);
        map.setPaintProperty(routeLayerId, 'line-opacity', 1);
      }
      if (map.getLayer(routeLayerFillId)) {
        map.setPaintProperty(routeLayerFillId, 'fill-opacity', 0.5);
      }

      // Fade other routes
      if (solution && solution.routes) {
        solution.routes.forEach(r => {
          if (r.id !== route.id) {
            const otherLayerId = `route-${r.id}`;
            const otherFillId = `route-fill-${r.id}`;
            if (map.getLayer(otherLayerId)) {
              map.setPaintProperty(otherLayerId, 'line-opacity', 0.25);
              map.setPaintProperty(otherLayerId, 'line-width', 2);
            }
            if (map.getLayer(otherFillId)) {
              map.setPaintProperty(otherFillId, 'fill-opacity', 0.06);
            }
          }
        });
      }
    } else {
      // Restore original style
      if (map.getLayer(routeLayerId)) {
        map.setPaintProperty(routeLayerId, 'line-color', route.color);
        map.setPaintProperty(routeLayerId, 'line-width', 4);
        map.setPaintProperty(routeLayerId, 'line-opacity', 0.8);
      }
      if (map.getLayer(routeLayerFillId)) {
        map.setPaintProperty(routeLayerFillId, 'fill-opacity', useRealRouting ? 0 : 0.2);
      }

      // Restore other routes
      if (solution && solution.routes) {
        solution.routes.forEach(r => {
          if (r.id !== route.id) {
            const otherLayerId = `route-${r.id}`;
            const otherFillId = `route-fill-${r.id}`;
            if (map.getLayer(otherLayerId)) {
              map.setPaintProperty(otherLayerId, 'line-opacity', 0.8);
              map.setPaintProperty(otherLayerId, 'line-width', 4);
            }
            if (map.getLayer(otherFillId)) {
              map.setPaintProperty(otherFillId, 'fill-opacity', useRealRouting ? 0 : 0.2);
            }
          }
        });
      }
    }
  }, [solution, useRealRouting]);

  const clearRouteSelection = useCallback(() => {
    if (selectedRoute) {
      highlightRoute(selectedRoute, false);
      setSelectedRoute(null);
    }
  }, [selectedRoute, setSelectedRoute, highlightRoute]);

  // Update ref whenever clearRouteSelection changes
  useEffect(() => {
    clearRouteSelectionRef.current = clearRouteSelection;
  }, [clearRouteSelection]);

  const onClickRoute = useCallback((route: Route) => {
    if (!mapRef.current) return;

    if (selectedRoute && selectedRoute.id === route.id) {
      clearRouteSelection();
    } else {
      clearRouteSelection();
      highlightRoute(route, true);
      setSelectedRoute(route);
    }
  }, [selectedRoute, setSelectedRoute, clearRouteSelection, highlightRoute]);

  // Draw solution (routes)
  const drawSolution = useCallback(async (currentSolution: Solution) => {
    console.log('🎨 drawSolution called:', {
      hasMap: !!mapRef.current,
      hasSolution: !!currentSolution,
      routeCount: currentSolution?.routes?.length || 0
    });

    if (!mapRef.current || !currentSolution || !currentSolution.routes) {
      console.warn('⚠️ drawSolution early return - missing requirements');
      return;
    }

    const map = mapRef.current;

    // Simple check - if style not loaded, skip this call (will be called again when ready)
    if (!map.isStyleLoaded()) {
      console.warn('⚠️ Style not loaded yet, skipping this drawSolution call');
      return;
    }

    console.log('🗺️ Starting to draw routes...');

    // Remove ALL previously drawn routes
    console.log(`🗑️ Removing ${drawnRouteIdsRef.current.size} existing route layers...`);
    drawnRouteIdsRef.current.forEach(routeId => {
      const routeLayerId = `route-${routeId}`;
      const routeSourceId = `route-source-${routeId}`;
      const routeFillId = `route-fill-${routeId}`;

      if (map.getLayer(routeFillId)) {
        map.removeLayer(routeFillId);
      }
      if (map.getLayer(routeLayerId)) {
        map.removeLayer(routeLayerId);
      }
      if (map.getSource(routeSourceId)) {
        map.removeSource(routeSourceId);
      }
    });
    drawnRouteIdsRef.current.clear();

    // Draw each route
    console.log(`🎨 Drawing ${currentSolution.routes.length} routes...`);
    for (const route of currentSolution.routes) {
      console.log(`  Drawing route ${route.id} with ${route.sequence.length} nodes`);
      const routeCoords = await buildRealRoute(route);

      // Check if map still exists after await
      if (!mapRef.current) return;

      // Convert coords to GeoJSON (LngLat format)
      const coordinates: [number, number][] = routeCoords.map(c => [c[1], c[0]]);

      const geojson: FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            routeId: route.id,
            color: route.color,
            cost: route.cost,
            nodeCount: route.sequence.length
          },
          geometry: {
            type: 'LineString',
            coordinates
          }
        }]
      };

      const routeSourceId = `route-source-${route.id}`;
      const routeLayerId = `route-${route.id}`;
      const routeFillId = `route-fill-${route.id}`;

      // Ensure cleanup before adding (in case of race conditions or manual adds)
      if (map.getLayer(routeFillId)) map.removeLayer(routeFillId);
      if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
      if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);

      // Add source
      map.addSource(routeSourceId, {
        type: 'geojson',
        data: geojson
      });

      // Add fill layer for polygon mode (only when not using real routing)
      if (!useRealRouting) {
        map.addLayer({
          id: routeFillId,
          type: 'fill',
          source: routeSourceId,
          paint: {
            'fill-color': route.color,
            'fill-opacity': 0.2
          }
        });
      }

      // Add line layer
      map.addLayer({
        id: routeLayerId,
        type: 'line',
        source: routeSourceId,
        paint: {
          'line-color': route.color,
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      // Track this route as drawn
      drawnRouteIdsRef.current.add(route.id);

      // Add click handler
      map.on('click', routeLayerId, (e) => {
        e.originalEvent.stopPropagation();
        onClickRoute(route);
      });

      // Add hover handlers
      map.on('mouseenter', routeLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
        if (!selectedRoute) {
          highlightRoute(route, true);
        }
      });

      map.on('mouseleave', routeLayerId, () => {
        map.getCanvas().style.cursor = '';
        if (!selectedRoute) {
          highlightRoute(route, false);
        }
      });
    }

    // Reapply selection if exists
    if (selectedRoute) {
      const found = currentSolution.routes.find(r => r.id === selectedRoute.id);
      if (found) {
        console.log(`🎯 Reapplying selection to route ${found.id}`);
        setTimeout(() => {
          highlightRoute(found, true);
        }, 50);
      } else {
        console.log('⚠️ Previously selected route not found, clearing selection');
        setSelectedRoute(null);
      }
    }

    console.log('✅ drawSolution completed successfully');
  }, [useRealRouting, buildRealRoute, onClickRoute, highlightRoute, selectedRoute]);

  const clearDrawnRoutes = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;

    drawnRouteIdsRef.current.forEach((routeId) => {
      const routeLayerId = `route-${routeId}`;
      const routeSourceId = `route-source-${routeId}`;
      const routeFillId = `route-fill-${routeId}`;

      if (map.getLayer(routeFillId)) map.removeLayer(routeFillId);
      if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
      if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);
    });
    drawnRouteIdsRef.current.clear();
  }, []);

  // Highlight segment between two nodes
  const highlightSegment = useCallback(async (fromId: number, toId: number, routeOverride?: Route) => {
    if (!mapRef.current || !instance) return;

    // Simple check - skip if style not loaded
    if (!mapRef.current.isStyleLoaded()) {
      console.warn('⚠️ Style not loaded in highlightSegment, skipping');
      return;
    }

    const r = routeOverride || selectedRoute;
    if (!r) return;

    // Remove previous segment highlight
    if (segmentMarkerRef.current) {
      segmentMarkerRef.current.remove();
      segmentMarkerRef.current = null;
    }
    if (segmentPopupRef.current) {
      segmentPopupRef.current.remove();
      segmentPopupRef.current = null;
    }

    // Remove segment layer if exists
    if (mapRef.current.getLayer('segment-highlight')) {
      mapRef.current.removeLayer('segment-highlight');
    }
    if (mapRef.current.getSource('segment-highlight-source')) {
      mapRef.current.removeSource('segment-highlight-source');
    }

    const fromNode = instance.nodes.find(n => n.id === fromId);
    const toNode = instance.nodes.find(n => n.id === toId);
    if (!fromNode || !toNode) return;

    let coords: [number, number][] = [fromNode.coords, toNode.coords];
    let distanceKm = haversineKm(fromNode.coords, toNode.coords);
    let travelTimeH: number | undefined;
    let profile = '';

    if (useRealRouting) {
      try {
        profile = localStorage.getItem('routingProfile') || 'walking';
        const mapboxProfile = profile === 'driving' ? 'driving' : profile === 'cycling' ? 'cycling' : 'walking';
        const accessToken = mapboxgl.accessToken;
        const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxProfile}/${fromNode.coords[1]},${fromNode.coords[0]};${toNode.coords[1]},${toNode.coords[0]}?overview=full&geometries=geojson&access_token=${accessToken}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.routes && data.routes[0]) {
          const r0 = data.routes[0];
          if (typeof r0.distance === 'number') distanceKm = r0.distance / 1000;
          if (typeof r0.duration === 'number') travelTimeH = r0.duration / 3600;
          if (r0.geometry && r0.geometry.coordinates) {
            coords = r0.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          }
        }
      } catch { }
    }

    // Calculate min speed
    let minSpeed: string | null = null;
    if (toNode.time_window && Array.isArray(toNode.time_window)) {
      const twStart = Number(toNode.time_window[0]);
      const twEnd = Number(toNode.time_window[1]);
      const usedTravelTime = travelTimeH ?? (distanceKm / 30);
      const impliedSpeed = distanceKm / (usedTravelTime || (distanceKm / 30));
      if (!isNaN(twEnd) && twEnd > 0) {
        const minimalSpeedNeeded = distanceKm / twEnd;
        minSpeed = `${minimalSpeedNeeded.toFixed(1)} km/h (req ≤ TW end)`;
      } else if (!isNaN(twStart) && twStart > 0) {
        const minimalSpeedNeeded = distanceKm / twStart;
        minSpeed = `${minimalSpeedNeeded.toFixed(1)} km/h (req ≤ TW start)`;
      } else {
        minSpeed = `${impliedSpeed.toFixed(1)} km/h (implied)`;
      }
    }

    // Add segment layer
    const coordinates: [number, number][] = coords.map(c => [c[1], c[0]]);
    const geojson: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates
        }
      }]
    };

    mapRef.current.addSource('segment-highlight-source', {
      type: 'geojson',
      data: geojson
    });

    mapRef.current.addLayer({
      id: 'segment-highlight',
      type: 'line',
      source: 'segment-highlight-source',
      paint: {
        'line-color': SEGMENT_HIGHLIGHT_COLOR,
        'line-width': 6,
        'line-opacity': 0.9
      }
    });

    // Build popup HTML
    const popupParts: string[] = [];
    popupParts.push(`<div style="font-size:12px; line-height:1.3">`);
    popupParts.push(`<strong>Segment:</strong> Node ${fromNode.id} → Node ${toNode.id}`);
    if (useRealRouting) popupParts.push(`<div>Profile: <b>${profile}</b></div>`);
    popupParts.push(`<div>Distance: <b>${distanceKm.toFixed(2)} km</b></div>`);
    if (travelTimeH) popupParts.push(`<div>Travel time: <b>${travelTimeH.toFixed(2)} h</b></div>`);
    if (toNode.time_window) popupParts.push(`<div>Dest TW: [${toNode.time_window[0]}, ${toNode.time_window[1]}]</div>`);
    if (minSpeed) popupParts.push(`<div>Min speed: <b>${minSpeed}</b></div>`);
    popupParts.push('</div>');

    // Create and show popup at midpoint
    const midLat = (coords[0][0] + coords[coords.length - 1][0]) / 2;
    const midLng = (coords[0][1] + coords[coords.length - 1][1]) / 2;

    const popup = new mapboxgl.Popup({ offset: 25 })
      .setLngLat([midLng, midLat])
      .setHTML(popupParts.join(''))
      .addTo(mapRef.current);

    segmentPopupRef.current = popup;

    // Fit bounds to segment
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach(coord => bounds.extend(coord as [number, number]));
    mapRef.current.fitBounds(bounds, { padding: 50 });
  }, [instance, selectedRoute, useRealRouting]);

  // Clear segment highlight
  const clearSegmentHighlight = useCallback(() => {
    if (!mapRef.current) return;

    if (segmentPopupRef.current) {
      segmentPopupRef.current.remove();
      segmentPopupRef.current = null;
    }

    if (mapRef.current.getLayer('segment-highlight')) {
      mapRef.current.removeLayer('segment-highlight');
    }
    if (mapRef.current.getSource('segment-highlight-source')) {
      mapRef.current.removeSource('segment-highlight-source');
    }
  }, []);

  // Focus on a node
  const focusNode = useCallback((nodeId: number, zoom: number = 14) => {
    if (!mapRef.current || !instance) return;
    const node = instance.nodes.find(n => n.id === nodeId);
    if (!node) return;
    mapRef.current.flyTo({
      center: [node.coords[1], node.coords[0]],
      zoom,
    });
  }, [instance]);

  // Expose API
  useEffect(() => {
    if (externalApiRef) {
      externalApiRef.current = {
        highlightSegment,
        clearSegmentHighlight,
        focusNode,
        getMap: () => mapRef.current,
      };
    }
  }, [externalApiRef, highlightSegment, clearSegmentHighlight, focusNode]);

  // Redraw routes when mode changes
  const redrawRoutesWithNewMode = useCallback(async () => {
    if (!mapRef.current) return;

    // Simple check - skip if style not loaded
    if (!mapRef.current.isStyleLoaded()) {
      console.warn('⚠️ Style not loaded in redrawRoutesWithNewMode, skipping');
      return;
    }

    if (useRealRouting && routingCacheRef.current.size > 0) {
      saveCacheToStorage();
    }

    if (solution) {
      await drawSolution(solution);
    } else {
      clearDrawnRoutes();
    }

    if (useRealRouting) {
      saveCacheToStorage();
    }

    // Don't fitBounds here - it causes unwanted camera resets during interactions
    // fitBounds is only called when instance actually changes (in instance effect)
  }, [useRealRouting, solution, drawSolution, clearDrawnRoutes, saveCacheToStorage]);

  // Toggle real routing handler
  const handleToggleRealRouting = useCallback(() => {
    if (onToggleRealRouting) {
      onToggleRealRouting();
    } else {
      console.warn('onToggleRealRouting callback not provided');
    }
  }, [onToggleRealRouting]);

  // Debug function
  const testRouteInteractivity = useCallback(() => {
    if (!mapRef.current || !solution) return;
    console.log('Routes:', solution.routes?.length || 0);
  }, [solution]);

  // Initialize map
  useEffect(() => {
    console.log('🏗️ Map initialization effect triggered');
    if (!mapContainer.current) {
      console.log('⚠️ No map container');
      return;
    }
    if (mapRef.current) {
      console.log('✅ Map already initialized, skipping');
      return; // Already initialized
    }

    console.log('🆕 Creating new map instance...');
    const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string) || "";
    if (!token) {
      console.error("Mapbox access token not found");
      return;
    }

    mapboxgl.accessToken = token;

    const lat = config.mapDefaults?.defaultCenterLat ?? 21.0227;
    const lng = config.mapDefaults?.defaultCenterLng ?? 105.8194;
    const zoom = config.mapDefaults?.defaultZoom ?? 12;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom,
      pitch: 0,
      bearing: 0
    });

    // Don't set mapReady yet - wait for load event
    console.log('📦 Map created, waiting for load event...');

    mapRef.current.on('load', () => {
      if (!mapRef.current) return;

      console.log('✅ Map loaded (load event)');
      console.log('📊 Map state:', {
        isStyleLoaded: mapRef.current.isStyleLoaded(),
        zoom: mapRef.current.getZoom(),
        center: mapRef.current.getCenter()
      });

      // Set map ready AFTER load completes
      setMapReady(true);
      loadCacheFromStorage();

      // Add click listener to clear route selection
      mapRef.current.on('click', (e) => {
        // Check if clicked on a route layer
        const features = mapRef.current!.queryRenderedFeatures(e.point);
        const isRouteClick = features.some(f => f.layer && f.layer.id.startsWith('route-'));
        if (!isRouteClick) {
          // Use ref to call latest version without re-initializing map
          clearRouteSelectionRef.current();
        }
      });
    });

    return () => {
      console.log('🧹 Map cleanup - unmounting map');
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []); // Empty dependency array to ensure map only initializes once

  // Ensure Mapbox canvas resizes when the container size changes
  useEffect(() => {
    if (!mapRef.current || !mapContainer.current || !mapReady) return;

    const map = mapRef.current;

    // Initial resize after mount/layout
    const rafId = window.requestAnimationFrame(() => {
      try {
        map.resize();
      } catch (e) {
        // Ignore resize errors
      }
    });

    // Use ResizeObserver if available
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        try {
          map.resize();
        } catch (e) {
          // Ignore resize errors
        }
      });
      ro.observe(mapContainer.current);

      return () => {
        window.cancelAnimationFrame(rafId);
        ro.disconnect();
      };
    }

    // Fallback: listen to window resize
    const handleResize = () => {
      try {
        map.resize();
      } catch (e) {
        // Ignore resize errors
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mapReady]);

  // Handle instance changes (nodes)
  useEffect(() => {
    console.log('📍 Instance effect triggered:', {
      mapReady,
      hasMap: !!mapRef.current,
      hasInstance: !!instance,
      nodeCount: instance?.nodes?.length || 0,
      isStyleLoaded: mapRef.current?.isStyleLoaded()
    });

    if (!mapReady || !mapRef.current || !instance) {
      console.log('⚠️ Instance effect skipped - requirements not met');
      return;
    }

    // Retry mechanism similar to solution effect
    const attemptAddNodes = (attempt = 1, maxAttempts = 10) => {
      if (!mapRef.current) return;

      if (mapRef.current.isStyleLoaded()) {
        console.log(`📍 Adding nodes (attempt ${attempt})`);

        // Clear existing markers
        console.log(`🗑️ Clearing ${nodeMarkersRef.current.size} existing markers`);
        nodeMarkersRef.current.forEach(marker => marker.remove());
        nodeMarkersRef.current.clear();

        // Add new markers
        console.log(`📍 Adding ${instance.nodes.length} node markers`);
        instance.nodes.forEach(node => {
          addNodeToMap(node);
        });
        console.log(`✅ Added ${nodeMarkersRef.current.size} markers to map`);

        // Fit bounds to all nodes only if instance actually changed
        const instanceChanged = lastInstanceRef.current !== instance;
        if (instanceChanged && instance.all_coords && instance.all_coords.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          instance.all_coords.forEach(coord => bounds.extend([coord[1], coord[0]] as [number, number]));
          mapRef.current.fitBounds(bounds, { padding: 50 });
          console.log('📏 Fitted bounds to all nodes (instance changed)');
          lastInstanceRef.current = instance;
        } else if (!instanceChanged) {
          console.log('⏭️ Skipping fitBounds - same instance');
        }
      } else {
        console.log(`⏳ Style not loaded for nodes, retry ${attempt}/${maxAttempts}`);
        if (attempt < maxAttempts) {
          setTimeout(() => attemptAddNodes(attempt + 1, maxAttempts), 200);
        } else {
          console.error('❌ Failed to add nodes after max attempts');
        }
      }
    };

    // Start with a small delay
    const timer = setTimeout(() => attemptAddNodes(), 100);

    return () => clearTimeout(timer);
  }, [mapReady, instance, solution, addNodeToMap]); // Added solution to trigger redraw when solution changes

  // Handle solution changes (routes)
  useEffect(() => {
    console.log('🎯 Solution effect triggered:', {
      mapReady,
      hasMap: !!mapRef.current,
      hasSolution: !!solution,
      routeCount: solution?.routes?.length || 0,
      isStyleLoaded: mapRef.current?.isStyleLoaded()
    });

    if (!mapReady || !mapRef.current || !solution) {
      console.log('⚠️ Solution effect skipped - requirements not met');
      return;
    }

    // Retry mechanism: try to draw, if style not loaded, retry after delay
    const attemptDraw = (attempt = 1, maxAttempts = 10) => {
      if (!mapRef.current) return;

      if (mapRef.current.isStyleLoaded()) {
        console.log(`🚀 Calling drawSolution (attempt ${attempt})`);
        drawSolution(solution);
      } else {
        console.log(`⏳ Style not loaded yet, retry ${attempt}/${maxAttempts}`);
        if (attempt < maxAttempts) {
          setTimeout(() => attemptDraw(attempt + 1, maxAttempts), 200);
        } else {
          console.error('❌ Failed to draw solution after max attempts');
        }
      }
    };

    // Start with a small delay to ensure map is settled
    const timer = setTimeout(() => attemptDraw(), 100);

    return () => clearTimeout(timer);
  }, [mapReady, solution, drawSolution]);

  // Handle useRealRouting changes
  useEffect(() => {
    if (!mapReady || !mapRef.current || !solution || !solution.routes || solution.routes.length === 0) return;
    redrawRoutesWithNewMode();
  }, [mapReady, useRealRouting, redrawRoutesWithNewMode]);

  // Expose debugging functions
  useEffect(() => {
    window.testRouteInteractivity = testRouteInteractivity;
    window.toggleRealRouting = handleToggleRealRouting;

    const handleProfileChange = () => {
      if (solution && solution.routes && solution.routes.length > 0) {
        redrawRoutesWithNewMode();
      }
    };

    window.addEventListener('routingProfileChanged', handleProfileChange);

    return () => {
      delete window.testRouteInteractivity;
      delete window.toggleRealRouting;
      window.removeEventListener('routingProfileChanged', handleProfileChange);
    };
  }, [testRouteInteractivity, handleToggleRealRouting, solution, redrawRoutesWithNewMode]);

  return (
    <div className="flex flex-col h-full">
      <div ref={mapContainer} className="rounded-l-lg shadow-inner bg-gray-200" style={{ height: mapHeight }} />
      {!hidePanels && (
        <div className="bg-white p-4 border-t border-gray-200 overflow-auto flex-1">
          <NodeList
            instance={instance}
            onClickNode={onClickNode}
            highlightMarkers={highlightMarkers}
            selectedNodes={selectedNodes}
          />
          <RouteList
            solution={solution}
            onClickRoute={onClickRoute}
            highlightRoute={highlightRoute}
            selectedRoute={selectedRoute}
            instance={instance}
          />
          <RouteAnalysis
            solution={solution}
            instance={instance}
            onRouteSelect={onClickRoute}
          />
        </div>
      )}
    </div>
  );
};

export default MapboxComponent;
