import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import RouteList from './RouteList';
import NodeList from './NodeList';
import RouteAnalysis from './RouteAnalysis';
import 'leaflet/dist/leaflet.css';
import { useMapControls } from '@/hooks/useMapControls';
import config from '@/config/config';
import { Instance, Solution, Node, Route } from '@/utils/dataModels';

// Extend Window interface
declare global {
  interface Window {
    testRouteInteractivity?: () => void;
    toggleRealRouting?: () => void;
  }
}

// Fix for default marker icon issue with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Extended Leaflet types
interface ExtendedLayerOptions extends L.PathOptions {
  routeId?: number;
  originalFillOpacity?: number;
}

interface ExtendedLayer extends L.Layer {
  options: ExtendedLayerOptions;
  setStyle?: (style: L.PathOptions) => ExtendedLayer;
  bringToFront?: () => ExtendedLayer;
}

// Extended Node interface for markers
interface NodeWithMarker extends Node {
  marker?: L.Marker & {
    small_icon: L.DivIcon;
    large_icon: L.DivIcon;
    opaque_icon: L.DivIcon;
  };
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
  hidePanels?: boolean; // When true, hide Node/Route/Analysis panels (for details view usage)
  mapHeight?: string; // Allow parent to control map height
  externalApiRef?: React.MutableRefObject<any | null>; // expose imperative API (timeline highlight, etc.)
}

const MapComponent: React.FC<MapComponentProps> = ({
  instance,
  solution,
  selectedNodes,
  setSelectedNodes,
  selectedRoute,
  setSelectedRoute,
  useRealRouting, // Receive from parent
  onToggleRealRouting, // Optional callback for parent component
  hidePanels = false,
  mapHeight = '60vh',
  externalApiRef,
}) => {
  const SEGMENT_HIGHLIGHT_COLOR = '#f97316'; // Tailwind orange-500

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

  // Highlight a single segment between two node IDs on current selectedRoute (or provided route)
  const highlightSegment = useCallback(async (fromId: number, toId: number, routeOverride?: Route) => {
    if (!leafletMapRef.current || !instance) return;
    const r = routeOverride || selectedRoute;
    if (!r) return;

    // Remove previous segment highlight layers
    leafletMapRef.current.eachLayer((layer: any) => {
      if (layer && layer.options && layer.options._segmentHighlight) {
        try { leafletMapRef.current!.removeLayer(layer); } catch { }
      }
    });

    const fromNode = instance.nodes.find(n => n.id === fromId);
    const toNode = instance.nodes.find(n => n.id === toId);
    if (!fromNode || !toNode) return;

    let coords: [number, number][] = [fromNode.coords, toNode.coords];
    let distanceKm = haversineKm(fromNode.coords, toNode.coords); // fallback distance
    let travelTimeH: number | undefined;
    let profile = '';
    if (useRealRouting) {
      try {
        profile = localStorage.getItem('routingProfile') || 'walking';
        const url = `https://router.project-osrm.org/route/v1/${profile}/${fromNode.coords[1]},${fromNode.coords[0]};${toNode.coords[1]},${toNode.coords[0]}?overview=full&geometries=geojson`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.routes && data.routes[0]) {
          const r0 = data.routes[0];
          // distance (meters) and duration (seconds) from OSRM
          if (typeof r0.distance === 'number') {
            distanceKm = r0.distance / 1000;
          }
          if (typeof r0.duration === 'number') {
            travelTimeH = r0.duration / 3600;
          }
          if (r0.geometry && r0.geometry.coordinates) {
            coords = r0.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          }
        }
      } catch { /* ignore network errors */ }
    }

    // Estimate minimal required speed (km/h) to reach destination within its time window start or end
    // We'll use destination time window end as the deadline if available.
    let minSpeed: string | null = null;
    if (toNode.time_window && Array.isArray(toNode.time_window)) {
      const twStart = Number(toNode.time_window[0]);
      const twEnd = Number(toNode.time_window[1]);
      // If we had travelTimeH from OSRM we can compute implied speed; else approximate with 30km/h fallback.
      const usedTravelTime = travelTimeH ?? (distanceKm / 30);
      const impliedSpeed = distanceKm / (usedTravelTime || (distanceKm / 30));
      // Minimal speed required to arrive before TW end assuming we depart now (time=0 context); if twEnd > 0 compute.
      if (!isNaN(twEnd) && twEnd > 0) {
        const minimalSpeedNeeded = distanceKm / twEnd; // depart at 0h to meet latest end
        minSpeed = `${minimalSpeedNeeded.toFixed(1)} km/h (req ≤ TW end)`;
      } else if (!isNaN(twStart) && twStart > 0) {
        const minimalSpeedNeeded = distanceKm / twStart;
        minSpeed = `${minimalSpeedNeeded.toFixed(1)} km/h (req ≤ TW start)`;
      } else {
        minSpeed = `${impliedSpeed.toFixed(1)} km/h (implied)`;
      }
    }

    const seg = L.polyline(coords, { color: SEGMENT_HIGHLIGHT_COLOR, weight: 6, opacity: 0.9, _segmentHighlight: true } as any).addTo(leafletMapRef.current);

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
    seg.bindPopup(popupParts.join('')).openPopup();

    try { leafletMapRef.current.fitBounds(seg.getBounds().pad(0.15)); } catch { }
  }, [instance, selectedRoute, useRealRouting]);

  // Clear any existing highlighted segment
  const clearSegmentHighlight = useCallback(() => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.eachLayer((layer: any) => {
      if (layer && layer.options && layer.options._segmentHighlight) {
        try { leafletMapRef.current!.removeLayer(layer); } catch { }
      }
    });
  }, []);

  // Focus map on a single node id (center + moderate zoom)
  const focusNode = useCallback((nodeId: number, zoom: number = 14) => {
    if (!leafletMapRef.current || !instance) return;
    const node = instance.nodes.find(n => n.id === nodeId);
    if (!node) return;
    leafletMapRef.current.setView(node.coords, zoom, { animate: true });
  }, [instance]);

  // Expose API
  useEffect(() => {
    if (externalApiRef) {
      externalApiRef.current = {
        highlightSegment,
        clearSegmentHighlight,
        focusNode,
        getMap: () => leafletMapRef.current,
      };
    }
  }, [externalApiRef, highlightSegment, clearSegmentHighlight, focusNode]);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null); // To store the Leaflet map instance

  // Get only the cache-related functions from hook, not useRealRouting state
  const { routingCacheRef, generateCacheKey, loadCacheFromStorage, saveCacheToStorage } = useMapControls();

  // State variables for map elements and settings
  const [markers, setMarkers] = useState<L.Marker[]>([]);
  const [polygons, setPolygons] = useState<Map<number, L.Polygon>>(new Map()); // For routes
  const [routesPolylines, setRoutesPolylines] = useState<Map<number, L.Polyline>>(new Map()); // For real routes

  // Function to create custom node icons
  const createNodeIcon = useCallback((node: NodeWithMarker, iconSize: number, isOpaque = false): L.DivIcon => {
    let classNameValue;
    let leafletIconSize;
    let iconAnchor;

    if (node.is_pickup) {
      classNameValue = isOpaque ? 'pickup-marker-opaque' : 'pickup-marker';
      leafletIconSize = [iconSize, iconSize];
      iconAnchor = [leafletIconSize[0] / 2, leafletIconSize[1] / 2];
    } else if (node.is_delivery) {
      classNameValue = isOpaque ? 'delivery-marker-opaque' : 'delivery-marker';
      leafletIconSize = [iconSize, iconSize];
      iconAnchor = [leafletIconSize[0] / 2, leafletIconSize[1]];
    } else { // Depot
      classNameValue = isOpaque ? 'depot-marker-opaque' : 'depot-marker';
      leafletIconSize = [16, 16]; // Fixed size for depot
      iconAnchor = [8, 8];
    }

    return L.divIcon({
      className: classNameValue,
      iconAnchor: iconAnchor as [number, number],
      iconSize: leafletIconSize as [number, number]
    });
  }, []);

  // Highlight markers logic
  const highlightMarkers = useCallback((node: NodeWithMarker, lightOn: boolean) => {
    if (!leafletMapRef.current || !instance) return;

    const marker = node.marker; // Assuming node.marker is set
    if (!marker) return;

    if (lightOn) {
      marker.setIcon(marker.large_icon);
      marker.setZIndexOffset(1000);
    } else {
      marker.setIcon(marker.small_icon);
      marker.setZIndexOffset(0);
    }

    if (!node.is_depot) {
      const pair = instance.nodes.find(n => n.id === node.pair) as NodeWithMarker | undefined;
      if (pair && pair.marker) {
        if (lightOn) {
          pair.marker.setIcon(pair.marker.large_icon);
          pair.marker.setZIndexOffset(1000);
        } else {
          pair.marker.setIcon(pair.marker.small_icon);
          pair.marker.setZIndexOffset(0);
        }
      }
    }

    for (const other of instance.nodes as NodeWithMarker[]) {
      if (other.id === node.id || other.id === node.pair) {
        continue;
      }
      if (other.marker) {
        if (lightOn) other.marker.setIcon(other.marker.opaque_icon);
        else other.marker.setIcon(other.marker.small_icon);
      }
    }
  }, [instance]); // Depends on instance to access nodes

  // Click handler for nodes
  const onClickNode = useCallback((node: NodeWithMarker) => {
    if (!leafletMapRef.current) return;

    // Clear previous selection
    if (selectedNodes) {
      // Assuming selectedNodes is an array of node objects
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

    // Adjust map view to selected node
    leafletMapRef.current.setView(node.coords, 15); // Zoom to 15
  }, [instance, selectedNodes, setSelectedNodes, highlightMarkers]); // Dependencies for onClickNode

  // Add node to map logic
  const addNodeToMap = useCallback((node: NodeWithMarker) => {
    if (!leafletMapRef.current) return;

    const smallIcon = createNodeIcon(node, 10, false);
    const largeIcon = createNodeIcon(node, 20, false);
    const opaqueIcon = createNodeIcon(node, 10, true);

    const marker = L.marker(node.coords, {
      icon: smallIcon
    }) as L.Marker & {
      small_icon: L.DivIcon;
      large_icon: L.DivIcon;
      opaque_icon: L.DivIcon;
    };

    // Attach icons to marker for easy access
    marker.small_icon = smallIcon;
    marker.large_icon = largeIcon;
    marker.opaque_icon = opaqueIcon;

    // Store marker reference on the node object (for highlightMarkers)
    node.marker = marker;

    marker.on('mouseover', () => {
      if (!selectedNodes) { // Only highlight on hover if no node is currently selected
        highlightMarkers(node, true);
      }
    });

    marker.on('mouseout', () => {
      if (!selectedNodes) { // Only unhighlight on mouseout if no node is currently selected
        highlightMarkers(node, false);
      }
    });

    marker.on('click', () => onClickNode(node));

    let strType = "Depot";
    if (node.is_pickup) {
      strType = "Pickup";
    } else if (node.is_delivery) {
      strType = "Delivery";
    }

    marker.addTo(leafletMapRef.current).bindTooltip(`<b>${strType}: ${node.id}</b><br>&ensp;Demand: ${node.demand}<br>&ensp;Time window: [ ${node.time_window[0]} , ${node.time_window[1]} ]`);
    setMarkers(prev => [...prev, marker]); // Add to state
  }, [createNodeIcon, highlightMarkers, onClickNode, selectedNodes]); // Dependencies for addNodeToMap

  // Real routing functionality
  const getRouteFromAPI = useCallback(async (startCoord: [number, number], endCoord: [number, number]): Promise<[number, number][]> => {
    const cacheKey = generateCacheKey(startCoord, endCoord);
    if (routingCacheRef.current.has(cacheKey)) {
      return routingCacheRef.current.get(cacheKey)!;
    }

    try {
      // Get routing profile from localStorage, default to 'walking' for shortest path
      const routingProfile = localStorage.getItem('routingProfile') || 'walking';
      const url = `https://router.project-osrm.org/route/v1/${routingProfile}/${startCoord[1]},${startCoord[0]};${endCoord[1]},${endCoord[0]}?overview=full&geometries=geojson`;
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
      return route.path; // Fallback to original path
    }

    if (useRealRouting && instance) {
      // Single OSRM request for full route through all waypoints (like visualizer)
      const coordPairs = sequence.map((id: number) => {
        const nodeObj = instance.nodes.find((n: any) => n.id === id);
        const c = nodeObj ? nodeObj.coords : [0, 0];
        return `${c[1]},${c[0]}`;
      }).join(';');
      const cacheKey = `full:${coordPairs}`;

      if (routingCacheRef.current.has(cacheKey)) {
        return routingCacheRef.current.get(cacheKey)!;
      }

      try {
        // Get routing profile from localStorage, default to 'walking' for shortest path
        const routingProfile = localStorage.getItem('routingProfile') || 'walking';
        const url = `https://router.project-osrm.org/route/v1/${routingProfile}/${coordPairs}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        let routeCoords: [number, number][];
        if (data.routes && data.routes.length > 0) {
          routeCoords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        } else {
          console.warn('No full route found, fallback to straight lines');
          routeCoords = sequence.map((id: number) => instance.nodes[id].coords);
        }
        routingCacheRef.current.set(cacheKey, routeCoords);
        saveCacheToStorage();
        // Update route.path so details view uses real routing geometry
        route.path = routeCoords;
        return routeCoords;
      } catch (error) {
        console.warn('Full route API error:', error, 'Using straight lines fallback');
        const fallback = sequence.map((id: number) => instance.nodes[id].coords);
        // Fallback path assignment
        route.path = fallback;
        routingCacheRef.current.set(cacheKey, fallback);
        return fallback;
      }
    } else {
      // Straight-line fallback when real routing disabled
      return sequence.map((id: number) => instance?.nodes[id].coords || [0, 0]);
    }
  }, [useRealRouting, instance, saveCacheToStorage]);

  // Route highlighting and interaction logic
  const highlightRoute = useCallback((route: Route, lightOn: boolean) => {
    if (!leafletMapRef.current) return;

    // Find the route layer by iterating through map layers
    let routeLayer: L.Polygon | L.Polyline | null = null;
    leafletMapRef.current.eachLayer((layer: L.Layer) => {
      const extendedLayer = layer as ExtendedLayer;
      if ((layer instanceof L.Polygon || layer instanceof L.Polyline) &&
        extendedLayer.options && extendedLayer.options.routeId === route.id) {
        routeLayer = layer;
      }
    });

    if (!routeLayer) {
      console.warn('Route layer not found for route:', route.id);
      return;
    }

    const highlight_route_filled_style = {
      'highlight': {
        'color': 'red',
        'fillOpacity': 0.5
      }
    };

    const highlight_route_hollow_style = {
      'highlight': {
        'color': 'red',
        'fillOpacity': 0
      }
    };

    if (lightOn) {
      if (useRealRouting) {
        (routeLayer as any).setStyle({
          color: 'red',
          weight: 6,
          opacity: 1
        }).bringToFront();
      } else {
        const routeLayerExtended = routeLayer as ExtendedLayer;
        let style = routeLayerExtended.options.fillOpacity && routeLayerExtended.options.fillOpacity > 0 ? highlight_route_filled_style.highlight : highlight_route_hollow_style.highlight;
        (routeLayer as ExtendedLayer).setStyle?.(style)?.bringToFront?.();
      }
      // Fade others
      leafletMapRef.current.eachLayer((layer: L.Layer) => {
        const extendedLayer = layer as ExtendedLayer;
        if ((layer instanceof L.Polygon || layer instanceof L.Polyline) &&
          extendedLayer.options && extendedLayer.options.routeId !== route.id) {
          // Preserve original style values on first dim
          if (extendedLayer.options.originalFillOpacity === undefined) {
            extendedLayer.options.originalFillOpacity = (extendedLayer.options.fillOpacity as number) ?? 0;
          }
          if (useRealRouting) {
            extendedLayer.setStyle?.({ opacity: 0.25, weight: 2 });
          } else {
            extendedLayer.setStyle?.({ fillOpacity: extendedLayer.options.originalFillOpacity > 0 ? 0.06 : 0, opacity: 0.25 });
          }
        }
      });
    } else {
      if (useRealRouting) {
        (routeLayer as ExtendedLayer).setStyle?.({
          color: route.color,
          weight: 4,
          opacity: 0.8
        });
      } else {
        const routeLayerExtended = routeLayer as ExtendedLayer;
        routeLayerExtended.setStyle?.({ 'color': route.color, fillOpacity: routeLayerExtended.options.originalFillOpacity }); // Restore original fillOpacity
      }
      // Unfade others (restore original values)
      leafletMapRef.current.eachLayer((layer: L.Layer) => {
        const extendedLayer = layer as ExtendedLayer;
        if ((layer instanceof L.Polygon || layer instanceof L.Polyline) &&
          extendedLayer.options && extendedLayer.options.routeId !== route.id) {
          if (useRealRouting) {
            extendedLayer.setStyle?.({ opacity: 0.8, weight: 4 });
          } else {
            extendedLayer.setStyle?.({ fillOpacity: extendedLayer.options.originalFillOpacity ?? 0.2, opacity: 1 });
          }
        }
      });
    }
  }, [useRealRouting]); // Removed polygons dependency

  const clearRouteSelection = useCallback(() => {
    if (selectedRoute) {
      highlightRoute(selectedRoute, false);
      setSelectedRoute(null);
    }
  }, [selectedRoute, setSelectedRoute, highlightRoute]);

  const onClickRoute = useCallback((route: Route) => {
    if (!leafletMapRef.current) return;

    if (selectedRoute && selectedRoute.id === route.id) {
      clearRouteSelection();
    } else {
      clearRouteSelection(); // Clear any existing selection
      highlightRoute(route, true);
      setSelectedRoute(route);
    }
  }, [selectedRoute, setSelectedRoute, clearRouteSelection, highlightRoute]);

  const drawSolution = useCallback(async (currentSolution: Solution) => {
    if (!leafletMapRef.current || !currentSolution || !currentSolution.routes) return;

    setPolygons(new Map());
    setRoutesPolylines(new Map());

    // Clear existing routes first - use Leaflet's layer management instead of state
    leafletMapRef.current.eachLayer((layer: L.Layer) => {
      // Remove only polygons and polylines that are routes, keep markers and tile layer
      if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
        const extendedLayer = layer as ExtendedLayer;
        // Only remove if it has routeId (indicating it's a route layer)
        if (extendedLayer.options && extendedLayer.options.routeId !== undefined) {
          leafletMapRef.current?.removeLayer(layer);
        }
      }
    });
    const newPolygons = new Map();
    const newRoutesPolylines = new Map();

    for (const route of currentSolution.routes) {
      const tooltipText = `<b>Route ${route.id}</b><br>Cost: ${route.cost}<br>Nodes: ${route.sequence.length}<br>${useRealRouting ? 'Real routing' : 'Straight lines'}`;

      let leafletLayer;
      if (useRealRouting) {
        // Build real route using routing API
        const routeCoords = await buildRealRoute(route);

        // Create polyline for real routes (like visualizer)
        leafletLayer = L.polyline(routeCoords, {
          color: route.color,
          weight: 4,
          opacity: 0.8,
          routeId: route.id // Add routeId for identification
        } as ExtendedLayerOptions);

        // Store route path in route object for future use
        route.path = routeCoords;

        // Ensure original style values are stored for later restoration
        (leafletLayer as ExtendedLayer).options.originalFillOpacity = (leafletLayer as any).options?.fillOpacity ?? 0;
        newRoutesPolylines.set(route.id, leafletLayer);
        // Also store in polygons map for compatibility with existing code
        newPolygons.set(route.id, leafletLayer);
      } else {
        // Recalculate straight-line points from sequence to ignore any real-route geometry
        const straightCoords: [number, number][] = route.sequence.map((nodeId: number) => {
          if (!instance) return [0, 0] as [number, number];
          const nodeObj = instance.nodes.find((n: any) => n.id === nodeId);
          return (nodeObj ? nodeObj.coords : [0, 0]) as [number, number];
        });
        // Update route.path for consistency
        route.path = straightCoords;
        // Draw polygon with straight segments
        leafletLayer = L.polygon(straightCoords, {
          color: route.color,
          fillOpacity: 0.2, // Default fill for polygons
          weight: 3,
          opacity: 0.8,
          routeId: route.id // Add routeId for identification
        } as ExtendedLayerOptions);
        (leafletLayer as ExtendedLayer).options.originalFillOpacity = 0.2;
        newPolygons.set(route.id, leafletLayer);
      }

      // Add tooltip and events (same for both types)
      leafletLayer.bindTooltip(tooltipText);

      leafletLayer.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation();
        onClickRoute(route);
      });

      leafletLayer.on('mouseover', () => {
        if (!selectedRoute) {
          highlightRoute(route, true);
        }
      });

      leafletLayer.on('mouseout', () => {
        if (!selectedRoute) {
          highlightRoute(route, false);
        }
      });
      if (leafletMapRef.current) {
        leafletLayer.addTo(leafletMapRef.current);
      } else {
        console.warn('Map reference is null, cannot add layer for route', route.id);
      }
    }

    // Update state after all routes are processed
    setPolygons(newPolygons);
    setRoutesPolylines(newRoutesPolylines);

    // If a route was already selected before redraw, reapply highlighting
    if (selectedRoute) {
      const found = currentSolution.routes.find(r => r.id === selectedRoute.id);
      if (found) {
        // Small delay to ensure layers are added to map
        setTimeout(() => {
          highlightRoute(found, true);
        }, 50);
      } else {
        // If previously selected route no longer exists, clear selection
        setSelectedRoute(null);
      }
    }

    // Test interactivity after drawing (like visualizer)
    setTimeout(() => {
      testRouteInteractivity();
    }, 100);
  }, [useRealRouting, buildRealRoute, onClickRoute, highlightRoute, selectedRoute, instance]); // Removed polygons to prevent infinite loop

  // Debug function to test route interactivity (like visualizer)
  const testRouteInteractivity = useCallback(() => {
    if (!leafletMapRef.current) return;

    let routeCount = 0;
    leafletMapRef.current.eachLayer((layer: L.Layer) => {
      const extendedLayer = layer as ExtendedLayer;
      if ((layer instanceof L.Polygon || layer instanceof L.Polyline) &&
        extendedLayer.options && extendedLayer.options.routeId !== undefined) {
        routeCount++;
      }
    });
  }, [useRealRouting, solution]);

  // Wrapper for toggleRealRouting to notify parent
  const handleToggleRealRouting = useCallback(() => {
    if (onToggleRealRouting) {
      onToggleRealRouting(); // Call the toggle function from parent
    } else {
      console.warn('onToggleRealRouting callback not provided');
    }
  }, [onToggleRealRouting]);

  const redrawRoutesWithNewMode = useCallback(async () => {
    // Check if map is still available
    if (!leafletMapRef.current) {
      console.warn('Map reference is null, cannot redraw routes');
      return;
    }

    // Save cache before clearing routes
    if (useRealRouting && routingCacheRef.current.size > 0) {
      saveCacheToStorage();
    }

    // Clear existing routes - use Leaflet's layer management
    leafletMapRef.current.eachLayer((layer: L.Layer) => {
      // Remove only polygons and polylines that are routes, keep markers and tile layer
      if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
        const extendedLayer = layer as ExtendedLayer;
        // Only remove if it has routeId (indicating it's a route layer)
        if (extendedLayer.options && extendedLayer.options.routeId !== undefined) {
          leafletMapRef.current?.removeLayer(layer);
        }
      }
    });

    let markerCountBefore = 0;
    leafletMapRef.current.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.Marker) {
        markerCountBefore++;
      }
    });

    try {
      if (solution) {
        await drawSolution(solution);
      }
      if (useRealRouting) {
        saveCacheToStorage();
      }

      // Fit bounds to show all routes after redrawing
      if (leafletMapRef.current && instance && instance.all_coords && instance.all_coords.length > 0) {
        const bounds = L.latLngBounds(instance.all_coords);
        leafletMapRef.current.fitBounds(bounds.pad(0.1));
      }

      if (leafletMapRef.current) {
        let markerCount = 0;
        leafletMapRef.current.eachLayer((layer: L.Layer) => {
          if (layer instanceof L.Marker) {
            markerCount++;
          }
        });

        // Reload nodes after routes redraw
        if (instance) {
          instance.nodes.forEach(node => addNodeToMap(node as NodeWithMarker));
        }
      } else {
        console.warn('Map reference is null, cannot check marker count');
      }
    } catch (error) {
      console.error('Error redrawing routes:', error);
      alert('Có lỗi khi tải đường đi. Vui lòng thử lại.');
    }
  }, [useRealRouting, solution, drawSolution, saveCacheToStorage, instance]);

  // Initial map setup (run once on mount)
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMapRef.current) {
      const lat = config.mapDefaults?.defaultCenterLat ?? 21.0227;
      const lng = config.mapDefaults?.defaultCenterLng ?? 105.8194;
      const zoom = config.mapDefaults?.defaultZoom ?? 12;
      leafletMapRef.current = L.map(mapRef.current).setView([lat, lng], zoom);
      L.tileLayer(config.map.tileUrl, {
        maxZoom: 19,
        attribution: config.map.attribution
      }).addTo(leafletMapRef.current);
      // Load cache on initial map setup
      loadCacheFromStorage();
      // Add click listener to clear route selection when clicking on map background
      leafletMapRef.current.on('click', () => {
        clearRouteSelection();
      });
    }
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Effect for handling instance changes
  useEffect(() => {
    if (leafletMapRef.current && instance) {
      // Clear existing markers
      markers.forEach(marker => {
        if (leafletMapRef.current) {
          leafletMapRef.current.removeLayer(marker);
        }
      });
      setMarkers([]); // Clear state

      // Add new markers
      instance.nodes.forEach(node => {
        addNodeToMap(node);
      });

      // Adjust zoom to fit all nodes
      if (instance.all_coords && instance.all_coords.length > 0) {
        const bounds = L.latLngBounds(instance.all_coords);
        leafletMapRef.current.fitBounds(bounds.pad(0.5));
      }
    }
  }, [instance, addNodeToMap]); // Removed markers from dependency array to prevent infinite loop

  // Effect for handling solution changes (routes)
  useEffect(() => {
    if (leafletMapRef.current && solution) {
      drawSolution(solution);
    }
  }, [solution, drawSolution]); // Include drawSolution but ensure it's stable

  // Effect for handling useRealRouting changes
  useEffect(() => {
    // Only redraw if we have solution and routes are already displayed
    if (leafletMapRef.current && solution && solution.routes && solution.routes.length > 0) {
      redrawRoutesWithNewMode();
    }
  }, [useRealRouting, redrawRoutesWithNewMode]);

  // Expose debugging functions to window for console access (like visualizer)
  useEffect(() => {
    window.testRouteInteractivity = testRouteInteractivity;
    window.toggleRealRouting = handleToggleRealRouting;

    // Listen for routing profile changes
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
      <div id="map" ref={mapRef} className="rounded-l-lg shadow-inner bg-gray-200" style={{ height: mapHeight }} />
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

export default MapComponent;
