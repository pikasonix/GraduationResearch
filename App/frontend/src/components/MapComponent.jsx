import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import NodeList from './NodeList';
import RouteList from './RouteList';
import RouteAnalysis from './RouteAnalysis';
import 'leaflet/dist/leaflet.css';
import { useMapControls } from '../hooks/useMapControls';
import config from '../config/config';

// Fix for default marker icon issue with Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const MapComponent = ({
  instance,
  solution,
  selectedNodes,
  setSelectedNodes,
  selectedRoute,
  setSelectedRoute,
  useRealRouting, // Receive from parent
  onToggleRealRouting, // Optional callback for parent component
}) => {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null); // To store the Leaflet map instance

  // Get only the cache-related functions from hook, not useRealRouting state
  const { routingCacheRef, generateCacheKey, loadCacheFromStorage, saveCacheToStorage } = useMapControls();

  // State variables for map elements and settings
  const [markers, setMarkers] = useState([]);
  const [polygons, setPolygons] = useState(new Map()); // For routes
  const [routesPolylines, setRoutesPolylines] = useState(new Map()); // For real routes

  // Function to create custom node icons
  const createNodeIcon = useCallback((node, iconSize, isOpaque = false) => {
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
      iconAnchor: iconAnchor,
      iconSize: leafletIconSize
    });
  }, []);

  // Highlight markers logic
  const highlightMarkers = useCallback((node, lightOn) => {
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
      const pair = instance.nodes.find(n => n.id === node.pair);
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

    for (const other of instance.nodes) {
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
  const onClickNode = useCallback((node) => {
    if (!leafletMapRef.current) return;

    // Clear previous selection
    if (selectedNodes) {
      // Assuming selectedNodes is an array of node objects
      selectedNodes.forEach(n => highlightMarkers(n, false));
    }

    let nodesToSelect = [node];
    if (!node.is_depot) {
      const pairNode = instance.nodes.find(n => n.id === node.pair);
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
  const addNodeToMap = useCallback((node) => {
    if (!leafletMapRef.current) return;

    const smallIcon = createNodeIcon(node, 10, false);
    const largeIcon = createNodeIcon(node, 20, false);
    const opaqueIcon = createNodeIcon(node, 10, true);

    const marker = L.marker(node.coords, {
      icon: smallIcon
    });

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
  const getRouteFromAPI = useCallback(async (startCoord, endCoord) => {
    const cacheKey = generateCacheKey(startCoord, endCoord);
    if (routingCacheRef.current.has(cacheKey)) {
      console.log(`Cache hit for ${cacheKey}`);
      return routingCacheRef.current.get(cacheKey);
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startCoord[1]},${startCoord[0]};${endCoord[1]},${endCoord[0]}?overview=full&geometries=geojson`;
      console.log(`Fetching route from API: ${cacheKey}`);
      const response = await fetch(url);
      const data = await response.json();

      let routeCoords;
      if (data.routes && data.routes.length > 0) {
        routeCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
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

  const buildRealRoute = useCallback(async (route) => {
    console.log('buildRealRoute called for route:', route.id);
    console.log('Route sequence:', route.sequence);

    const sequence = route.sequence;
    if (!sequence || sequence.length < 2) {
      console.warn('Invalid route sequence for route', route.id);
      return route.path; // Fallback to original path
    }

    if (useRealRouting) {
      // Single OSRM request for full route through all waypoints (like visualizer)
      const coordPairs = sequence.map(id => {
        const c = instance.nodes[id].coords;
        return `${c[1]},${c[0]}`;
      }).join(';');
      const cacheKey = `full:${coordPairs}`;

      if (routingCacheRef.current.has(cacheKey)) {
        console.log(`Cache hit for full route ${route.id}`);
        return routingCacheRef.current.get(cacheKey);
      }

      try {
        console.log(`Fetching full route for route ${route.id}`);
        const url = `https://router.project-osrm.org/route/v1/driving/${coordPairs}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        let routeCoords;
        if (data.routes && data.routes.length > 0) {
          routeCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        } else {
          console.warn('No full route found, fallback to straight lines');
          routeCoords = sequence.map(id => instance.nodes[id].coords);
        }
        routingCacheRef.current.set(cacheKey, routeCoords);
        saveCacheToStorage();
        // Update route.path so details view uses real routing geometry
        route.path = routeCoords;
        return routeCoords;
      } catch (error) {
        console.warn('Full route API error:', error, 'Using straight lines fallback');
        const fallback = sequence.map(id => instance.nodes[id].coords);
        // Fallback path assignment
        route.path = fallback;
        routingCacheRef.current.set(cacheKey, fallback);
        return fallback;
      }
    } else {
      // Straight-line fallback when real routing disabled
      return sequence.map(id => instance.nodes[id].coords);
    }
  }, [useRealRouting, instance, saveCacheToStorage]);

  // Route highlighting and interaction logic
  const highlightRoute = useCallback((route, lightOn) => {
    if (!leafletMapRef.current) return;

    // Find the route layer by iterating through map layers
    let routeLayer = null;
    leafletMapRef.current.eachLayer((layer) => {
      if ((layer instanceof L.Polygon || layer instanceof L.Polyline) &&
        layer.options && layer.options.routeId === route.id) {
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
        routeLayer.setStyle({
          color: 'red',
          weight: 6,
          opacity: 1
        }).bringToFront();
      } else {
        let style = routeLayer.options.fillOpacity > 0 ? highlight_route_filled_style.highlight : highlight_route_hollow_style.highlight;
        routeLayer.setStyle(style).bringToFront();
      }
      // Fade others
      leafletMapRef.current.eachLayer((layer) => {
        if ((layer instanceof L.Polygon || layer instanceof L.Polyline) &&
          layer.options && layer.options.routeId !== route.id) {
          if (useRealRouting) {
            layer.setStyle({ opacity: 0.3, weight: 2 });
          } else {
            layer.setStyle({ fillOpacity: layer.options.fillOpacity > 0 ? 0.08 : 0, opacity: 0.3 });
          }
        }
      });
    } else {
      if (useRealRouting) {
        routeLayer.setStyle({
          color: route.color,
          weight: 4,
          opacity: 0.8
        });
      } else {
        routeLayer.setStyle({ 'color': route.color, fillOpacity: routeLayer.options.originalFillOpacity }); // Restore original fillOpacity
      }
      // Unfade others
      leafletMapRef.current.eachLayer((layer) => {
        if ((layer instanceof L.Polygon || layer instanceof L.Polyline) &&
          layer.options && layer.options.routeId !== route.id) {
          if (useRealRouting) {
            layer.setStyle({ opacity: 0.8, weight: 4 });
          } else {
            layer.setStyle({ fillOpacity: layer.options.originalFillOpacity, opacity: 1 });
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

  const onClickRoute = useCallback((route) => {
    if (!leafletMapRef.current) return;

    if (selectedRoute && selectedRoute.id === route.id) {
      clearRouteSelection();
    } else {
      clearRouteSelection(); // Clear any existing selection
      highlightRoute(route, true);
      setSelectedRoute(route);
    }
  }, [selectedRoute, setSelectedRoute, clearRouteSelection, highlightRoute]);

  const drawSolution = useCallback(async (currentSolution) => {
    console.log('=== drawSolution called ===');
    console.log('Solution:', currentSolution);
    console.log('useRealRouting:', useRealRouting);
    console.log('Number of routes:', currentSolution.routes?.length);

    if (!leafletMapRef.current || !currentSolution || !currentSolution.routes) return;

    setPolygons(new Map());
    setRoutesPolylines(new Map());

    // Clear existing routes first - use Leaflet's layer management instead of state
    console.log('Clearing existing routes...');
    leafletMapRef.current.eachLayer((layer) => {
      // Remove only polygons and polylines that are routes, keep markers and tile layer
      if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
        // Only remove if it has routeId (indicating it's a route layer)
        if (layer.options && layer.options.routeId !== undefined) {
          leafletMapRef.current.removeLayer(layer);
        }
      }
    });
    const newPolygons = new Map();
    const newRoutesPolylines = new Map();

    for (const route of currentSolution.routes) {
      console.log('=== Processing route:', route.id, '===');
      console.log('Route sequence:', route.sequence);
      console.log('Route color:', route.color);

      const tooltipText = `<b>Route ${route.id}</b><br>Cost: ${route.cost}<br>Nodes: ${route.sequence.length}<br>${useRealRouting ? 'Real routing' : 'Straight lines'}`;

      let leafletLayer;
      if (useRealRouting) {
        console.log('Building real route for route', route.id);

        // Build real route using routing API
        const routeCoords = await buildRealRoute(route);
        console.log('Real route coords for route', route.id, ':', routeCoords.length, 'points');

        // Create polyline for real routes (like visualizer)
        leafletLayer = L.polyline(routeCoords, {
          color: route.color,
          weight: 4,
          opacity: 0.8,
          routeId: route.id // Add routeId for identification
        });

        // Store route path in route object for future use
        route.path = routeCoords;

        newRoutesPolylines.set(route.id, leafletLayer);
        // Also store in polygons map for compatibility with existing code
        newPolygons.set(route.id, leafletLayer);
        console.log('✓ Added polyline for route', route.id, 'to map');
      } else {
        console.log('Creating straight-line polygon for route', route.id);
        // Recalculate straight-line points from sequence to ignore any real-route geometry
        const straightCoords = route.sequence.map(nodeId => instance.nodes[nodeId].coords);
        // Update route.path for consistency
        route.path = straightCoords;
        // Draw polygon with straight segments
        leafletLayer = L.polygon(straightCoords, {
          color: route.color,
          fillOpacity: 0.2, // Default fill for polygons
          weight: 3,
          opacity: 0.8,
          routeId: route.id // Add routeId for identification
        });
        leafletLayer.options.originalFillOpacity = 0.2;
        newPolygons.set(route.id, leafletLayer);
        console.log('✓ Added straight-line polygon for route', route.id, 'to map');
      }

      // Add tooltip and events (same for both types)
      leafletLayer.bindTooltip(tooltipText);

      leafletLayer.on('click', (e) => {
        console.log('Route clicked:', route.id);
        e.originalEvent.stopPropagation();
        onClickRoute(route);
      });

      leafletLayer.on('mouseover', () => {
        console.log('Route mouseover:', route.id);
        if (!selectedRoute) {
          highlightRoute(route, true);
        }
      });

      leafletLayer.on('mouseout', () => {
        console.log('Route mouseout:', route.id);
        if (!selectedRoute) {
          highlightRoute(route, false);
        }
      });

      console.log('Adding layer to map for route', route.id);
      if (leafletMapRef.current) {
        leafletLayer.addTo(leafletMapRef.current);
        console.log('✓ Layer added successfully for route', route.id);
      } else {
        console.warn('Map reference is null, cannot add layer for route', route.id);
      }
    }

    // Update state after all routes are processed
    setPolygons(newPolygons);
    setRoutesPolylines(newRoutesPolylines);
    console.log('=== drawSolution completed ===');
    console.log('Total routes processed:', currentSolution.routes.length);
    console.log('Polygons map size:', newPolygons.size);
    console.log('Routes polylines map size:', newRoutesPolylines.size);

    // Test interactivity after drawing (like visualizer)
    setTimeout(() => {
      testRouteInteractivity();
    }, 100);
  }, [useRealRouting, buildRealRoute, onClickRoute, highlightRoute, selectedRoute, instance]); // Removed polygons to prevent infinite loop

  // Debug function to test route interactivity (like visualizer)
  const testRouteInteractivity = useCallback(() => {
    console.log('Testing route interactivity...');
    console.log('useRealRouting:', useRealRouting);

    let routeCount = 0;
    leafletMapRef.current.eachLayer((layer) => {
      if ((layer instanceof L.Polygon || layer instanceof L.Polyline) &&
        layer.options && layer.options.routeId !== undefined) {
        routeCount++;
        console.log(`Route ${layer.options.routeId}:`, {
          layerType: layer instanceof L.Polyline ? 'polyline' : layer instanceof L.Polygon ? 'polygon' : 'unknown',
          hasClickEvent: layer.listens ? layer.listens('click') : 'unknown',
          hasMouseoverEvent: layer.listens ? layer.listens('mouseover') : 'unknown',
          bounds: layer.getBounds ? layer.getBounds() : 'no bounds'
        });
      }
    });

    console.log('Total route layers found:', routeCount);

    if (solution && solution.routes) {
      console.log('Routes in solution:', solution.routes.map(r => ({
        id: r.id,
        color: r.color,
        sequenceLength: r.sequence?.length
      })));
    }
  }, [useRealRouting, solution]);

  // Wrapper for toggleRealRouting to notify parent
  const handleToggleRealRouting = useCallback(() => {
    console.log('handleToggleRealRouting called');
    if (onToggleRealRouting) {
      onToggleRealRouting(); // Call the toggle function from parent
    } else {
      console.warn('onToggleRealRouting callback not provided');
    }
  }, [onToggleRealRouting]);

  const redrawRoutesWithNewMode = useCallback(async () => {
    console.log('redrawRoutesWithNewMode called. Current useRealRouting:', useRealRouting);

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
    console.log('Clearing existing routes for mode change...');
    leafletMapRef.current.eachLayer((layer) => {
      // Remove only polygons and polylines that are routes, keep markers and tile layer
      if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
        // Only remove if it has routeId (indicating it's a route layer)
        if (layer.options && layer.options.routeId !== undefined) {
          leafletMapRef.current.removeLayer(layer);
        }
      }
    });

    // Show loading indicator (simplified for now)
    console.log(useRealRouting ? 'Đang tải đường đi thực tế...' : 'Đang chuyển về đường thẳng...');

    // Debug: Check markers before redraw
    let markerCountBefore = 0;
    leafletMapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        markerCountBefore++;
      }
    });
    console.log('Markers present before redraw:', markerCountBefore);

    try {
      await drawSolution(solution);

      // Save cache after successful completion
      if (useRealRouting) {
        saveCacheToStorage();
      }

      // Fit bounds to show all routes after redrawing
      if (leafletMapRef.current && instance && instance.all_coords && instance.all_coords.length > 0) {
        const bounds = L.latLngBounds(instance.all_coords);
        leafletMapRef.current.fitBounds(bounds.pad(0.1));
        console.log('Map bounds adjusted after mode change');
      }

      // Debug: Check if markers are still present after redraw
      if (leafletMapRef.current) {
        let markerCount = 0;
        leafletMapRef.current.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            markerCount++;
          }
        });
        console.log('Markers present after redraw:', markerCount);
        console.log('Expected markers:', instance?.nodes?.length || 0);

        // Reload nodes after routes redraw
        console.log('Reloading node markers after real-route redraw');
        instance.nodes.forEach(node => addNodeToMap(node));
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
    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapRef.current).setView([0, 0], 2);
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
        leafletMapRef.current.removeLayer(marker);
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
      console.log('Solution effect triggered, calling drawSolution');
      drawSolution(solution);
    }
  }, [solution, drawSolution]); // Include drawSolution but ensure it's stable

  // Effect for handling useRealRouting changes
  useEffect(() => {
    console.log('useRealRouting changed to:', useRealRouting);
    console.log('Current solution:', solution);
    console.log('Current polygons size:', polygons.size);

    // Only redraw if we have solution and routes are already displayed
    if (leafletMapRef.current && solution && solution.routes && solution.routes.length > 0) {
      console.log('useRealRouting changed, redrawing routes...');
      redrawRoutesWithNewMode();
    } else {
      console.log('Skipping redraw - no solution or routes not yet displayed');
    }
  }, [useRealRouting, redrawRoutesWithNewMode]);

  // Expose debugging functions to window for console access (like visualizer)
  useEffect(() => {
    window.testRouteInteractivity = testRouteInteractivity;
    window.toggleRealRouting = handleToggleRealRouting;

    return () => {
      delete window.testRouteInteractivity;
      delete window.toggleRealRouting;
    };
  }, [testRouteInteractivity, handleToggleRealRouting]);

  return (
    <div className="flex flex-col h-full">
      <div id="map" ref={mapRef} className="rounded-l-lg shadow-inner bg-gray-200" style={{ height: '60vh' }} />
      {/* Panels below map */}
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
    </div>
  );
};

export default MapComponent;
