import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import config from '../config/config';

const AddInstancePage = ({ onBack, onInstanceCreated }) => {
    // Instance metadata state
    const [instanceData, setInstanceData] = useState({
        name: `instance-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}`,
        location: '',
        comment: '',
        routeTime: 480,
        timeWindow: 120,
        capacity: 100
    });

    // Node management state
    const [nodes, setNodes] = useState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [isAddingNode, setIsAddingNode] = useState(false);
    const [nextNodeId, setNextNodeId] = useState(1); // Start from 1, depot will be 0
    const [editingNode, setEditingNode] = useState(null);

    // Time matrix state
    const [timeMatrix, setTimeMatrix] = useState({});
    const [isGeneratingMatrix, setIsGeneratingMatrix] = useState(false);
    const [matrixGenerationProgress, setMatrixGenerationProgress] = useState(0);
    const [notification, setNotification] = useState(null); // { type: 'success'|'error'|'info', message: string }
    const [showTableInput, setShowTableInput] = useState(false);
    const [tableData, setTableData] = useState([]);
    const [editingTableRow, setEditingTableRow] = useState(null);
    const [isSelectingLocation, setIsSelectingLocation] = useState(false);
    const [selectedTableRowIndex, setSelectedTableRowIndex] = useState(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);

    // Auto-hide notification after 3 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Cleanup search timeout on unmount
    useEffect(() => {
        return () => {
            if (window.searchTimeout) {
                clearTimeout(window.searchTimeout);
            }
        };
    }, []);

    const showNotification = (type, message) => {
        setNotification({ type, message });
    };

    // Table/Excel input functions
    const createEmptyTableRow = () => {
        // Generate next available ID
        const existingIds = tableData.map(row => parseInt(row.id) || 0);
        const nextId = existingIds.length === 0 ? 0 : Math.max(...existingIds) + 1;

        return {
            id: nextId,
            type: nextId === 0 ? 'depot' : 'regular', // depot, pickup, delivery, regular
            lat: '',
            lng: '',
            demand: nextId === 0 ? 0 : 1,
            earliestTime: 0,
            latestTime: 480,
            serviceDuration: nextId === 0 ? 0 : 10,
            pickupId: 0,
            deliveryId: 0
        };
    };

    const addTableRow = () => {
        setTableData(prev => [...prev, createEmptyTableRow()]);
    };

    const removeTableRow = (index) => {
        setTableData(prev => prev.filter((_, i) => i !== index));
    };

    const updateTableRow = (index, field, value) => {
        setTableData(prev => prev.map((row, i) =>
            i === index ? { ...row, [field]: value } : row
        ));
    };

    // Handle location selection for table
    const startLocationSelection = (rowIndex) => {
        setSelectedTableRowIndex(rowIndex);
        setIsSelectingLocation(true);
        showNotification('info', 'Click vào bản đồ để chọn vị trí cho node này');
    };

    const stopLocationSelection = () => {
        setIsSelectingLocation(false);
        setSelectedTableRowIndex(null);
    };

    // Search functions
    const searchLocation = async (query) => {
        if (!query || query.length < 3) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=vn&accept-language=vi,en`
            );
            const data = await response.json();

            const formattedResults = data.map(item => ({
                display_name: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                importance: item.importance || 0
            }));

            setSearchResults(formattedResults);
            setShowSearchResults(formattedResults.length > 0);
        } catch (error) {
            console.error('Search error:', error);
            showNotification('error', 'Lỗi khi tìm kiếm địa điểm');
            setSearchResults([]);
            setShowSearchResults(false);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchInputChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        // Debounce search
        if (window.searchTimeout) {
            clearTimeout(window.searchTimeout);
        }

        window.searchTimeout = setTimeout(() => {
            searchLocation(query);
        }, 500);
    };

    const selectSearchResult = (result) => {
        if (mapInstance.current) {
            mapInstance.current.setView([result.lat, result.lng], 15);
            showNotification('success', `Đã chuyển đến: ${result.display_name.split(',')[0]}`);
        }
        setShowSearchResults(false);
        setSearchQuery('');
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchResults(false);
        if (window.searchTimeout) {
            clearTimeout(window.searchTimeout);
        }
    };

    const applyTableData = () => {
        try {
            // Validate data
            const errors = [];
            const processedNodes = [];

            tableData.forEach((row, index) => {
                if (!row.lat || !row.lng) {
                    errors.push(`Dòng ${index + 1}: Thiếu tọa độ`);
                    return;
                }

                const node = {
                    id: parseInt(row.id) || processedNodes.length,
                    lat: parseFloat(row.lat),
                    lng: parseFloat(row.lng),
                    demand: parseInt(row.demand) || 0,
                    earliestTime: parseInt(row.earliestTime) || 0,
                    latestTime: parseInt(row.latestTime) || 480,
                    serviceDuration: parseInt(row.serviceDuration) || 0,
                    pickupId: parseInt(row.pickupId) || 0,
                    deliveryId: parseInt(row.deliveryId) || 0,
                    isDepot: row.type === 'depot',
                    isPickup: row.type === 'pickup',
                    isDelivery: row.type === 'delivery'
                };

                // Validate node type constraints
                if (node.isDepot && node.demand !== 0) {
                    errors.push(`Dòng ${index + 1}: Depot phải có demand = 0`);
                }
                if (node.isPickup && node.demand <= 0) {
                    errors.push(`Dòng ${index + 1}: Pickup phải có demand > 0`);
                }
                if (node.isDelivery && node.demand >= 0) {
                    errors.push(`Dòng ${index + 1}: Delivery phải có demand < 0`);
                }

                processedNodes.push(node);
            });

            if (errors.length > 0) {
                showNotification('error', 'Lỗi validation:\n' + errors.join('\n'));
                return;
            }

            // Apply to nodes
            setNodes(processedNodes);
            setNextNodeId(Math.max(...processedNodes.map(n => n.id)) + 1);
            setShowTableInput(false);
            showNotification('success', `Đã áp dụng ${processedNodes.length} nodes từ bảng!`);

        } catch (error) {
            showNotification('error', 'Lỗi khi áp dụng dữ liệu: ' + error.message);
        }
    };

    const loadNodesIntoTable = () => {
        const tableRows = nodes.map(node => ({
            id: node.id,
            type: node.isDepot ? 'depot' : node.isPickup ? 'pickup' : node.isDelivery ? 'delivery' : 'regular',
            lat: node.lat,
            lng: node.lng,
            demand: node.demand,
            earliestTime: node.earliestTime,
            latestTime: node.latestTime,
            serviceDuration: node.serviceDuration,
            pickupId: node.pickupId,
            deliveryId: node.deliveryId
        }));
        setTableData(tableRows);
        setShowTableInput(true);
    };

    // Map state
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef(new Map());

    // Initialize map
    useEffect(() => {
        if (mapRef.current && !mapInstance.current) {
            console.log('Initializing map...'); // Debug log
            // Initialize map centered on Hanoi, Vietnam
            mapInstance.current = L.map(mapRef.current).setView([21.0285, 105.8542], 12);
            L.tileLayer(config.map.tileUrl, {
                maxZoom: 19,
                attribution: config.map.attribution
            }).addTo(mapInstance.current);
            console.log('Map initialized successfully'); // Debug log
        }

        return () => {
            if (mapInstance.current) {
                console.log('Cleaning up map...'); // Debug log
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    // Define helper functions
    const updateMapCursor = useCallback(() => {
        if (!mapInstance.current) return;

        const mapContainer = mapInstance.current.getContainer();
        if (isAddingNode) {
            mapContainer.style.cursor = 'crosshair';
            mapContainer.style.zIndex = '1';
        } else {
            mapContainer.style.cursor = '';
            mapContainer.style.zIndex = '';
        }
    }, [isAddingNode]);

    const addNewNode = useCallback((lat, lng) => {
        const nodeId = nodes.length === 0 ? 0 : nextNodeId; // First node is depot (id=0)
        const newNode = {
            id: nodeId,
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6)),
            demand: 0,
            earliestTime: 0,
            latestTime: instanceData.routeTime,
            serviceDuration: 0,
            pickupId: 0,
            deliveryId: 0,
            isDepot: nodeId === 0,
            isPickup: false,
            isDelivery: false
        };

        setNodes(prev => [...prev, newNode]);
        setNextNodeId(prev => prev + 1);
        setSelectedNodeId(nodeId);
        setIsAddingNode(false);
        setEditingNode(newNode);

        console.log('Added new node:', newNode); // Debug log
    }, [nodes.length, nextNodeId, instanceData.routeTime]);

    const handleMapClick = useCallback((e) => {
        console.log('Map clicked, isAddingNode:', isAddingNode, 'isSelectingLocation:', isSelectingLocation); // Debug log
        if (isAddingNode) {
            const { lat, lng } = e.latlng;
            addNewNode(lat, lng);
        } else if (isSelectingLocation && selectedTableRowIndex !== null) {
            const { lat, lng } = e.latlng;
            updateTableRow(selectedTableRowIndex, 'lat', lat.toFixed(6));
            updateTableRow(selectedTableRowIndex, 'lng', lng.toFixed(6));
            stopLocationSelection();
            showNotification('success', `Đã cập nhật tọa độ cho dòng ${selectedTableRowIndex + 1}`);
        }
    }, [isAddingNode, isSelectingLocation, selectedTableRowIndex, addNewNode, updateTableRow, stopLocationSelection, showNotification]);

    // Separate effect for map click handler to handle isAddingNode changes
    useEffect(() => {
        if (!mapInstance.current) return;

        // Remove existing click handler
        mapInstance.current.off('click', handleMapClick);

        // Add click handler if in adding mode or selecting location
        if (isAddingNode || isSelectingLocation) {
            mapInstance.current.on('click', handleMapClick);
            console.log('Map click handler added for adding nodes or selecting location'); // Debug log
        } else {
            console.log('Map click handler removed'); // Debug log
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.off('click', handleMapClick);
            }
        };
    }, [isAddingNode, isSelectingLocation, handleMapClick]);

    // Update markers when nodes change
    useEffect(() => {
        updateMarkersOnMap();
        updateMapCursor();
    }, [nodes, selectedNodeId, isAddingNode, updateMapCursor]);

    const updateMarkersOnMap = () => {
        if (!mapInstance.current) {
            console.warn('updateMarkersOnMap: Map instance not available'); // Debug log
            return;
        }

        console.log('Updating markers on map, nodes count:', nodes.length); // Debug log

        // Clear existing markers
        markersRef.current.forEach(marker => {
            if (mapInstance.current) {
                mapInstance.current.removeLayer(marker);
            }
        });
        markersRef.current.clear();

        // Add markers for all nodes
        nodes.forEach(node => {
            if (mapInstance.current) {
                const marker = createNodeMarker(node);
                markersRef.current.set(node.id, marker);
                marker.addTo(mapInstance.current);
            }
        });

        console.log('Markers updated, total markers:', markersRef.current.size); // Debug log
    };

    const createNodeMarker = (node) => {
        let iconColor = '#6b7280'; // gray for depot
        let iconSymbol = '●'; // Depot symbol

        if (node.isPickup) {
            iconColor = '#10b981'; // green for pickup
            iconSymbol = '▲'; // Triangle up for pickup
        } else if (node.isDelivery) {
            iconColor = '#ef4444'; // red for delivery
            iconSymbol = '▼'; // Triangle down for delivery
        }

        const isSelected = selectedNodeId === node.id;
        const iconHtml = `
            <div style="
                background-color: ${iconColor};
                width: ${isSelected ? '32px' : '24px'};
                height: ${isSelected ? '32px' : '24px'};
                border-radius: 50%;
                border: ${isSelected ? '3px solid #fff' : '2px solid #fff'};
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isSelected ? '14px' : '12px'};
                font-weight: bold;
                color: white;
                cursor: pointer;
                transition: all 0.2s ease;
            ">
                ${node.isDepot ? iconSymbol : node.id}
            </div>
        `;

        const marker = L.marker([node.lat, node.lng], {
            icon: L.divIcon({
                html: iconHtml,
                className: 'custom-marker',
                iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
                iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12]
            })
        });

        marker.on('click', () => {
            setSelectedNodeId(node.id);
            setEditingNode(node);
        });

        marker.bindPopup(`
            <div class="text-sm">
                <strong>Node ${node.id}</strong><br>
                Type: ${node.isDepot ? 'Depot' : node.isPickup ? 'Pickup' : node.isDelivery ? 'Delivery' : 'Regular'}<br>
                Demand: ${node.demand}<br>
                Time Window: [${node.earliestTime}, ${node.latestTime}]<br>
                Coordinates: [${node.lat}, ${node.lng}]
            </div>
        `);

        return marker;
    };

    const handleNodeUpdate = (updatedNode) => {
        setNodes(prev => prev.map(node =>
            node.id === updatedNode.id ? updatedNode : node
        ));
        setEditingNode(updatedNode);
    };

    const handleNodeDelete = (nodeId) => {
        if (nodeId === 0) {
            showNotification('error', 'Không thể xóa depot node!');
            return;
        }

        setNodes(prev => prev.filter(node => node.id !== nodeId));
        setSelectedNodeId(null);
        setEditingNode(null);
        showNotification('success', `Node ${nodeId} đã được xóa!`);
    };

    const generateInstanceFile = () => {
        if (nodes.length === 0) {
            showNotification('error', 'Vui lòng thêm ít nhất một node (depot)!');
            return null;
        }

        const hasDepot = nodes.some(node => node.id === 0);
        if (!hasDepot) {
            showNotification('error', 'Instance phải có depot node với ID 0!');
            return null;
        }

        // Validate pickup-delivery pairs
        const pickupNodes = nodes.filter(n => n.isPickup);
        const deliveryNodes = nodes.filter(n => n.isDelivery);

        for (const pickup of pickupNodes) {
            if (pickup.deliveryId > 0) {
                const correspondingDelivery = nodes.find(n => n.id === pickup.deliveryId);
                if (!correspondingDelivery) {
                    showNotification('error', `Pickup node ${pickup.id} tham chiếu đến delivery node ${pickup.deliveryId} không tồn tại!`);
                    return null;
                }
                if (!correspondingDelivery.isDelivery) {
                    showNotification('error', `Pickup node ${pickup.id} tham chiếu đến node ${pickup.deliveryId} không phải là delivery node!`);
                    return null;
                }
                // Set the delivery node's pickup reference
                correspondingDelivery.pickupId = pickup.id;
            }
        }

        for (const delivery of deliveryNodes) {
            if (delivery.pickupId > 0) {
                const correspondingPickup = nodes.find(n => n.id === delivery.pickupId);
                if (!correspondingPickup) {
                    showNotification('error', `Delivery node ${delivery.id} tham chiếu đến pickup node ${delivery.pickupId} không tồn tại!`);
                    return null;
                }
                if (!correspondingPickup.isPickup) {
                    showNotification('error', `Delivery node ${delivery.id} tham chiếu đến node ${delivery.pickupId} không phải là pickup node!`);
                    return null;
                }
            }
        }

        // Sort nodes by ID to ensure depot is first
        const sortedNodes = [...nodes].sort((a, b) => a.id - b.id);

        let instanceContent = `NAME: ${instanceData.name || 'custom-instance'}\n`;
        instanceContent += `LOCATION: ${instanceData.location || 'Custom'}\n`;
        instanceContent += `COMMENT: ${instanceData.comment || 'Created with PDPTW Visualizer'}\n`;
        instanceContent += `TYPE: PDPTW\n`;
        instanceContent += `SIZE: ${nodes.length}\n`;
        instanceContent += `DISTRIBUTION: custom\n`;
        instanceContent += `DEPOT: 0\n`;
        instanceContent += `ROUTE-TIME: ${instanceData.routeTime}\n`;
        instanceContent += `TIME-WINDOW: ${instanceData.timeWindow}\n`;
        instanceContent += `CAPACITY: ${instanceData.capacity}\n`;
        instanceContent += `NODES\n`;

        sortedNodes.forEach(node => {
            instanceContent += `${node.id} ${node.lat} ${node.lng} ${node.demand} ${node.earliestTime} ${node.latestTime} ${node.serviceDuration} ${node.pickupId} ${node.deliveryId}\n`;
        });

        // Add time matrix if available
        if (Object.keys(timeMatrix).length > 0) {
            instanceContent += `EDGES\n`;

            // Generate time matrix in matrix format
            for (let i = 0; i < sortedNodes.length; i++) {
                const fromNode = sortedNodes[i];
                const row = [];

                for (let j = 0; j < sortedNodes.length; j++) {
                    const toNode = sortedNodes[j];

                    if (i === j) {
                        row.push('0'); // Same node = 0 time
                    } else {
                        const matrixKey = `${fromNode.id}-${toNode.id}`;
                        const time = timeMatrix[matrixKey] || calculateStraightLineTime(fromNode, toNode);
                        row.push(time.toFixed(1));
                    }
                }

                instanceContent += row.join(' ') + '\n';
            }
        }

        return instanceContent;
    };

    // Helper function to calculate straight line time between two nodes
    const calculateStraightLineTime = (node1, node2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (node2.lat - node1.lat) * Math.PI / 180;
        const dLon = (node2.lng - node1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(node1.lat * Math.PI / 180) * Math.cos(node2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        // Convert distance to time (assuming 30 km/h average speed)
        return distance / 30; // hours
    };

    // Function to generate time matrix using OSRM API
    const generateTimeMatrix = async () => {
        if (nodes.length < 2) {
            showNotification('error', 'Cần ít nhất 2 nodes để tạo ma trận thời gian!');
            return;
        }

        setIsGeneratingMatrix(true);
        setMatrixGenerationProgress(0);

        const newTimeMatrix = {};
        const totalPairs = nodes.length * (nodes.length - 1); // Exclude same node pairs
        let processedPairs = 0;

        try {
            // Get routing profile from localStorage, default to 'driving'
            const routingProfile = localStorage.getItem('routingProfile') || 'driving';

            for (let i = 0; i < nodes.length; i++) {
                for (let j = 0; j < nodes.length; j++) {
                    if (i === j) continue; // Skip same node

                    const fromNode = nodes[i];
                    const toNode = nodes[j];
                    const matrixKey = `${fromNode.id}-${toNode.id}`;

                    try {
                        // Build OSRM request
                        const coordPairs = `${fromNode.lng},${fromNode.lat};${toNode.lng},${toNode.lat}`;
                        const url = `https://router.project-osrm.org/route/v1/${routingProfile}/${coordPairs}?overview=false`;

                        console.log(`Fetching route time: ${fromNode.id} -> ${toNode.id}`);

                        const response = await fetch(url);
                        const data = await response.json();

                        if (data.routes && data.routes.length > 0) {
                            // OSRM returns duration in seconds, convert to hours
                            const durationHours = data.routes[0].duration / 3600;
                            newTimeMatrix[matrixKey] = durationHours;
                        } else {
                            console.warn(`No route found for ${fromNode.id} -> ${toNode.id}, using straight line`);
                            newTimeMatrix[matrixKey] = calculateStraightLineTime(fromNode, toNode);
                        }
                    } catch (error) {
                        console.warn(`Error fetching route ${fromNode.id} -> ${toNode.id}:`, error);
                        newTimeMatrix[matrixKey] = calculateStraightLineTime(fromNode, toNode);
                    }

                    processedPairs++;
                    setMatrixGenerationProgress((processedPairs / totalPairs) * 100);

                    // Small delay to avoid overwhelming the API
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            setTimeMatrix(newTimeMatrix);
            console.log('Time matrix generated:', newTimeMatrix); showNotification('success', 'Ma trận thời gian đã được tạo thành công!');
        } catch (error) {
            console.error('Error generating time matrix:', error);
            showNotification('error', 'Lỗi khi tạo ma trận thời gian: ' + error.message);
        } finally {
            setIsGeneratingMatrix(false);
            setMatrixGenerationProgress(0);
        }
    };

    // Function to clear time matrix
    const clearTimeMatrix = () => {
        const confirmClear = window.confirm('Bạn có chắc chắn muốn xóa ma trận thời gian?');
        if (!confirmClear) return;

        setTimeMatrix({});
        showNotification('success', 'Ma trận thời gian đã được xóa!');
    };

    const downloadInstanceFile = () => {
        const content = generateInstanceFile();
        if (!content) return; // Validation failed

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${instanceData.name || 'custom-instance'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('success', 'Instance file đã được tải xuống!');
    };

    const loadInstanceIntoApp = () => {
        const content = generateInstanceFile();
        if (!content) return; // Validation failed

        // Create a File object from the content
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], `${instanceData.name || 'custom-instance'}.txt`, { type: 'text/plain' });

        // Call the callback to load this instance into the main app
        if (onInstanceCreated) {
            onInstanceCreated(file, content);
        }
    };

    const createSampleInstance = () => {
        if (nodes.length > 0) {
            const confirmClear = window.confirm('Thao tác này sẽ xóa tất cả nodes hiện tại. Bạn có chắc chắn?');
            if (!confirmClear) return;
        }

        // Set sample instance data
        setInstanceData({
            name: 'hanoi-sample-instance',
            location: 'Hanoi, Vietnam',
            comment: 'Sample instance with depot, pickup and delivery points in Hanoi',
            routeTime: 480,
            timeWindow: 120,
            capacity: 100
        });

        // Create sample nodes - centered around Hanoi, Vietnam
        const sampleNodes = [
            // Depot - Hoan Kiem Lake area
            {
                id: 0,
                lat: 21.0285,
                lng: 105.8542,
                demand: 0,
                earliestTime: 0,
                latestTime: 480,
                serviceDuration: 0,
                pickupId: 0,
                deliveryId: 0,
                isDepot: true,
                isPickup: false,
                isDelivery: false
            },
            // Pickup 1 - Ba Dinh area
            {
                id: 1,
                lat: 21.0368,
                lng: 105.8345,
                demand: 5,
                earliestTime: 60,
                latestTime: 180,
                serviceDuration: 15,
                pickupId: 0,
                deliveryId: 2,
                isDepot: false,
                isPickup: true,
                isDelivery: false
            },
            // Delivery 1 - Dong Da area
            {
                id: 2,
                lat: 21.0122,
                lng: 105.8327,
                demand: -5,
                earliestTime: 120,
                latestTime: 240,
                serviceDuration: 10,
                pickupId: 1,
                deliveryId: 0,
                isDepot: false,
                isPickup: false,
                isDelivery: true
            },
            // Pickup 2 - Hai Ba Trung area
            {
                id: 3,
                lat: 21.0067,
                lng: 105.8638,
                demand: 3,
                earliestTime: 90,
                latestTime: 210,
                serviceDuration: 12,
                pickupId: 0,
                deliveryId: 4,
                isDepot: false,
                isPickup: true,
                isDelivery: false
            },
            // Delivery 2 - Cau Giay area
            {
                id: 4,
                lat: 21.0353,
                lng: 105.7968,
                demand: -3,
                earliestTime: 150,
                latestTime: 270,
                serviceDuration: 8,
                pickupId: 3,
                deliveryId: 0,
                isDepot: false,
                isPickup: false,
                isDelivery: true
            }
        ];

        setNodes(sampleNodes);
        setNextNodeId(5);
        setSelectedNodeId(0);
        setEditingNode(sampleNodes[0]);

        // Center map on Hanoi
        if (mapInstance.current) {
            mapInstance.current.setView([21.0285, 105.8542], 13);
        }

        showNotification('success', 'Instance mẫu Hanoi đã được tạo! Bạn có thể tạo ma trận thời gian để có instance hoàn chỉnh.');
    };

    const clearAllNodes = () => {
        const confirmClear = window.confirm('Bạn có chắc chắn muốn xóa tất cả nodes và ma trận thời gian?');
        if (!confirmClear) return;

        setNodes([]);
        setNextNodeId(1);
        setSelectedNodeId(null);
        setEditingNode(null);
        setTimeMatrix({}); // Clear time matrix as well

        showNotification('success', 'Đã xóa tất cả nodes và ma trận thời gian!');
    };

    return (
        <div className="flex flex-col h-screen">
            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${notification.type === 'success' ? 'bg-green-500 text-white' :
                    notification.type === 'error' ? 'bg-red-500 text-white' :
                        'bg-blue-500 text-white'
                    }`}>
                    <div className="flex items-center space-x-2">
                        <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' :
                            notification.type === 'error' ? 'fa-exclamation-circle' :
                                'fa-info-circle'
                            }`}></i>
                        <span className="text-sm font-medium">{notification.message}</span>
                        <button
                            onClick={() => setNotification(null)}
                            className="ml-2 text-white hover:text-gray-200"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <button
                            onClick={onBack}
                            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 mr-4"
                        >
                            <i className="fas fa-arrow-left mr-2"></i>
                            Quay lại Dashboard
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800">Tạo Instance Mới</h1>
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={downloadInstanceFile}
                            className="flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors duration-200"
                            disabled={nodes.length === 0 || isGeneratingMatrix}
                            title={Object.keys(timeMatrix).length > 0 ? "Tải file với ma trận thời gian" : "Tải file (chưa có ma trận thời gian)"}
                        >
                            <i className="fas fa-download mr-2"></i>
                            Tải xuống File
                            {Object.keys(timeMatrix).length > 0 && (
                                <i className="fas fa-check-circle text-green-600 ml-2" title="Có ma trận thời gian"></i>
                            )}
                        </button>
                        <button
                            onClick={loadInstanceIntoApp}
                            className="flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors duration-200"
                            disabled={nodes.length === 0 || isGeneratingMatrix}
                            title={Object.keys(timeMatrix).length > 0 ? "Load instance với ma trận thời gian" : "Load instance (chưa có ma trận thời gian)"}
                        >
                            <i className="fas fa-upload mr-2"></i>
                            Load vào App
                            {Object.keys(timeMatrix).length > 0 && (
                                <i className="fas fa-check-circle text-green-600 ml-2" title="Có ma trận thời gian"></i>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Instance Settings */}
                <div className="w-80 bg-white shadow-xl border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="bg-blue-600 text-white p-4">
                        <div className="flex items-center space-x-3">
                            <i className="fas fa-cog text-xl"></i>
                            <h2 className="text-lg font-semibold">Cài đặt Instance</h2>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Basic Information */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700">Thông tin cơ bản</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Instance</label>
                                <input
                                    type="text"
                                    value={instanceData.name}
                                    onChange={(e) => setInstanceData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Tên sẽ được tạo tự động theo thời gian"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Địa điểm</label>
                                <input
                                    type="text"
                                    value={instanceData.location}
                                    onChange={(e) => setInstanceData(prev => ({ ...prev, location: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="vd: Hanoi, Vietnam"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                                <textarea
                                    value={instanceData.comment}
                                    onChange={(e) => setInstanceData(prev => ({ ...prev, comment: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows="3"
                                    placeholder="Mô tả ngắn về instance này"
                                />
                            </div>
                        </div>

                        {/* Constraints */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700">Ràng buộc</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian route tối đa (phút)</label>
                                <input
                                    type="number"
                                    value={instanceData.routeTime}
                                    onChange={(e) => setInstanceData(prev => ({ ...prev, routeTime: parseInt(e.target.value) || 480 }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Độ rộng time window (phút)</label>
                                <input
                                    type="number"
                                    value={instanceData.timeWindow}
                                    onChange={(e) => setInstanceData(prev => ({ ...prev, timeWindow: parseInt(e.target.value) || 120 }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sức chứa xe</label>
                                <input
                                    type="number"
                                    value={instanceData.capacity}
                                    onChange={(e) => setInstanceData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 100 }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Time Matrix Management */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700">Ma trận thời gian</h3>

                            {/* Matrix Status */}
                            <div className={`p-3 rounded-lg border ${Object.keys(timeMatrix).length > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center space-x-2">
                                    <i className={`fas ${Object.keys(timeMatrix).length > 0 ? 'fa-check-circle text-green-600' : 'fa-exclamation-triangle text-gray-600'}`}></i>
                                    <span className="text-sm font-medium">
                                        {Object.keys(timeMatrix).length > 0
                                            ? `Ma trận đã tạo (${Object.keys(timeMatrix).length} routes)`
                                            : 'Chưa có ma trận thời gian'
                                        }
                                    </span>
                                </div>
                                {Object.keys(timeMatrix).length > 0 && (
                                    <div className="text-xs text-gray-600 mt-1">
                                        Ma trận {nodes.length}x{nodes.length} với thời gian thực
                                    </div>
                                )}
                            </div>

                            {/* Matrix Actions */}
                            <div className="space-y-2">
                                <button
                                    onClick={generateTimeMatrix}
                                    disabled={nodes.length < 2 || isGeneratingMatrix}
                                    className={`w-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${nodes.length < 2 || isGeneratingMatrix
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                                        }`}
                                >
                                    {isGeneratingMatrix ? (
                                        <>
                                            <i className="fas fa-spinner animate-spin mr-2"></i>
                                            Đang tạo ma trận... ({matrixGenerationProgress.toFixed(0)}%)
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-matrix mr-2"></i>
                                            {Object.keys(timeMatrix).length > 0 ? 'Tạo lại ma trận' : 'Tạo ma trận thời gian'}
                                        </>
                                    )}
                                </button>

                                {Object.keys(timeMatrix).length > 0 && !isGeneratingMatrix && (
                                    <button
                                        onClick={clearTimeMatrix}
                                        className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors duration-200"
                                    >
                                        <i className="fas fa-trash mr-2"></i>
                                        Xóa ma trận
                                    </button>
                                )}
                            </div>

                            {/* Progress Bar */}
                            {isGeneratingMatrix && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-gray-600">
                                        <span>Tiến độ:</span>
                                        <span>{matrixGenerationProgress.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${matrixGenerationProgress}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-gray-500 text-center">
                                        Đang gọi OSRM API để lấy thời gian thực...
                                    </div>
                                </div>
                            )}

                            {/* Matrix Info */}
                            {Object.keys(timeMatrix).length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                                    <div className="font-medium mb-1">ℹ️ Thông tin ma trận:</div>
                                    <ul className="text-xs space-y-1">
                                        <li>• Sử dụng OSRM API cho thời gian thực</li>
                                        <li>• Fallback về đường thẳng nếu lỗi</li>
                                        <li>• Thời gian tính bằng giờ (hours)</li>
                                        <li>• Profile: {localStorage.getItem('routingProfile') || 'driving'}</li>
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Quick Templates */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700">Templates nhanh</h3>

                            <div className="space-y-2">
                                <button
                                    onClick={createSampleInstance}
                                    className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors duration-200"
                                >
                                    <i className="fas fa-magic mr-2"></i>
                                    Tạo instance mẫu
                                </button>

                                <button
                                    onClick={clearAllNodes}
                                    className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors duration-200"
                                    disabled={nodes.length === 0}
                                >
                                    <i className="fas fa-trash mr-2"></i>
                                    Xóa tất cả nodes
                                </button>
                            </div>
                        </div>

                        {/* Table Input Toggle */}
                        <div className="space-y-4">
                            <button
                                onClick={() => setShowTableInput(!showTableInput)}
                                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors duration-200"
                            >
                                <i className="fas fa-table mr-2"></i>
                                {showTableInput ? 'Đóng bảng nhập liệu' : 'Dùng bảng nhập liệu'}
                            </button>

                            {nodes.length > 0 && (
                                <button
                                    onClick={loadNodesIntoTable}
                                    className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors duration-200"
                                >
                                    <i className="fas fa-download mr-2"></i>
                                    Load nodes vào bảng
                                </button>
                            )}
                        </div>

                        {/* Node Management */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700">Quản lý Nodes</h3>

                            <button
                                onClick={() => {
                                    console.log('Toggle adding node. Current state:', isAddingNode); // Debug log
                                    console.log('Map instance exists:', !!mapInstance.current); // Debug log
                                    setIsAddingNode(!isAddingNode);

                                    // Small delay to ensure state update
                                    setTimeout(() => {
                                        console.log('New isAddingNode state:', !isAddingNode); // Debug log
                                        if (mapInstance.current) {
                                            console.log('Map container exists:', !!mapInstance.current.getContainer()); // Debug log
                                        }
                                    }, 100);
                                }}
                                className={`w-full flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${isAddingNode
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                            >
                                <i className={`fas ${isAddingNode ? 'fa-times' : 'fa-plus'} mr-2`}></i>
                                {isAddingNode ? 'Hủy thêm node' : 'Thêm node mới'}
                            </button>

                            {isAddingNode && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="text-sm text-blue-800">
                                        <i className="fas fa-info-circle mr-2"></i>
                                        Click vào bản đồ để thêm node tại vị trí đó
                                    </div>
                                </div>
                            )}

                            <div className="text-sm text-gray-600">
                                Tổng số nodes: <span className="font-medium">{nodes.length}</span>
                            </div>

                            {/* Node List */}
                            {nodes.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-gray-700">Danh sách Nodes:</h4>
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {/* Depot Node */}
                                        {(() => {
                                            const depotNode = nodes.find(n => n.isDepot);
                                            if (!depotNode) return null;

                                            const isSelected = selectedNodeId === depotNode.id;
                                            return (
                                                <div
                                                    key={depotNode.id}
                                                    className={`node-list-item cursor-pointer p-2 rounded border text-xs transition-all duration-200 ${isSelected
                                                        ? 'selected bg-blue-50 border-blue-300'
                                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    onClick={() => {
                                                        setSelectedNodeId(depotNode.id);
                                                        setEditingNode(depotNode);
                                                        if (mapInstance.current) {
                                                            mapInstance.current.setView([depotNode.lat, depotNode.lng], 15);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-gray-600 font-medium">
                                                                ● {depotNode.id}
                                                            </span>
                                                            <span className="text-gray-500">Depot</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Pickup-Delivery Pairs */}
                                        {(() => {
                                            const pickupNodes = nodes.filter(n => n.isPickup).sort((a, b) => a.id - b.id);
                                            const deliveryNodes = nodes.filter(n => n.isDelivery);
                                            const regularNodes = nodes.filter(n => !n.isDepot && !n.isPickup && !n.isDelivery).sort((a, b) => a.id - b.id);

                                            const pairs = [];
                                            const usedDeliveries = new Set();

                                            // Create pickup-delivery pairs
                                            pickupNodes.forEach(pickup => {
                                                const delivery = deliveryNodes.find(d => d.pickupId === pickup.id || pickup.deliveryId === d.id);
                                                if (delivery) {
                                                    usedDeliveries.add(delivery.id);
                                                    pairs.push({ pickup, delivery });
                                                } else {
                                                    pairs.push({ pickup, delivery: null });
                                                }
                                            });

                                            // Add unpaired deliveries
                                            deliveryNodes.forEach(delivery => {
                                                if (!usedDeliveries.has(delivery.id)) {
                                                    pairs.push({ pickup: null, delivery });
                                                }
                                            });

                                            return (
                                                <>
                                                    {pairs.map((pair, index) => (
                                                        <div key={`pair-${index}`} className="space-y-1">
                                                            {pair.pickup && (
                                                                <div
                                                                    className={`node-list-item cursor-pointer p-2 rounded border text-xs transition-all duration-200 ${selectedNodeId === pair.pickup.id
                                                                        ? 'selected bg-blue-50 border-blue-300'
                                                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                                                        }`}
                                                                    onClick={() => {
                                                                        setSelectedNodeId(pair.pickup.id);
                                                                        setEditingNode(pair.pickup);
                                                                        if (mapInstance.current) {
                                                                            mapInstance.current.setView([pair.pickup.lat, pair.pickup.lng], 15);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center space-x-2">
                                                                            <span className="text-green-600 font-medium">
                                                                                ▲ {pair.pickup.id}
                                                                            </span>
                                                                            <span className="text-gray-500">Pickup</span>
                                                                            {pair.delivery && (
                                                                                <span className="text-xs text-gray-400">→ {pair.delivery.id}</span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-gray-400 text-xs">
                                                                            D:{pair.pickup.demand}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {pair.delivery && (
                                                                <div
                                                                    className={`node-list-item cursor-pointer p-2 rounded border text-xs transition-all duration-200 ml-4 ${selectedNodeId === pair.delivery.id
                                                                        ? 'selected bg-blue-50 border-blue-300'
                                                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                                                        }`}
                                                                    onClick={() => {
                                                                        setSelectedNodeId(pair.delivery.id);
                                                                        setEditingNode(pair.delivery);
                                                                        if (mapInstance.current) {
                                                                            mapInstance.current.setView([pair.delivery.lat, pair.delivery.lng], 15);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center space-x-2">
                                                                            <span className="text-red-600 font-medium">
                                                                                ▼ {pair.delivery.id}
                                                                            </span>
                                                                            <span className="text-gray-500">Delivery</span>
                                                                            {pair.pickup && (
                                                                                <span className="text-xs text-gray-400">← {pair.pickup.id}</span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-gray-400 text-xs">
                                                                            D:{pair.delivery.demand}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}

                                                    {/* Regular nodes (not paired) */}
                                                    {regularNodes.map(node => {
                                                        const isSelected = selectedNodeId === node.id;
                                                        return (
                                                            <div
                                                                key={node.id}
                                                                className={`node-list-item cursor-pointer p-2 rounded border text-xs transition-all duration-200 ${isSelected
                                                                    ? 'selected bg-blue-50 border-blue-300'
                                                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                                                    }`}
                                                                onClick={() => {
                                                                    setSelectedNodeId(node.id);
                                                                    setEditingNode(node);
                                                                    if (mapInstance.current) {
                                                                        mapInstance.current.setView([node.lat, node.lng], 15);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center space-x-2">
                                                                        <span className="text-gray-600 font-medium">
                                                                            ● {node.id}
                                                                        </span>
                                                                        <span className="text-gray-500">Regular</span>
                                                                    </div>
                                                                    <span className="text-gray-400 text-xs">
                                                                        {node.demand !== 0 && `D:${node.demand}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Instance Preview */}
                        {nodes.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700">Xem trước Instance</h3>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                    <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                                        {generateInstanceFile() || 'Instance không hợp lệ'}
                                    </pre>
                                </div>

                                {/* Time Matrix Preview */}
                                {Object.keys(timeMatrix).length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-700">Ma trận thời gian (giờ):</h4>
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto">
                                            <table className="text-xs w-full">
                                                <thead>
                                                    <tr>
                                                        <th className="text-left p-1 font-medium">From/To</th>
                                                        {nodes.sort((a, b) => a.id - b.id).map(node => (
                                                            <th key={node.id} className="text-center p-1 font-medium min-w-12">
                                                                {node.id}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {nodes.sort((a, b) => a.id - b.id).map(fromNode => (
                                                        <tr key={fromNode.id}>
                                                            <td className="text-left p-1 font-medium">{fromNode.id}</td>
                                                            {nodes.sort((a, b) => a.id - b.id).map(toNode => (
                                                                <td key={toNode.id} className="text-center p-1">
                                                                    {fromNode.id === toNode.id
                                                                        ? '0.0'
                                                                        : (timeMatrix[`${fromNode.id}-${toNode.id}`] || calculateStraightLineTime(fromNode, toNode)).toFixed(1)
                                                                    }
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Map */}
                <div className="flex-1 bg-gray-50 relative">
                    {/* Search Box */}
                    <div className="absolute top-4 right-4 w-80" style={{ zIndex: 9999 }}>
                        <div className="relative">
                            <div className="flex">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={handleSearchInputChange}
                                        placeholder="Hoàn Kiếm, Hà Nội..."
                                        className="w-full px-4 py-2 pr-10 text-sm bg-white border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-lg"
                                    />
                                    {isSearching && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <i className="fas fa-spinner animate-spin text-gray-400"></i>
                                        </div>
                                    )}
                                    {searchQuery && !isSearching && (
                                        <button
                                            onClick={clearSearch}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => searchLocation(searchQuery)}
                                    disabled={!searchQuery || isSearching}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition-colors"
                                >
                                    <i className="fas fa-search"></i>
                                </button>
                            </div>

                            {/* Search Results */}
                            {showSearchResults && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-30">
                                    {searchResults.map((result, index) => (
                                        <div
                                            key={index}
                                            onClick={() => selectSearchResult(result)}
                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                        >
                                            <div className="text-sm font-medium text-gray-900 truncate">
                                                {result.display_name.split(',')[0]}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                                {result.display_name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Node Adding Indicator */}
                    {(isAddingNode || isSelectingLocation) && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
                            <div className="flex items-center space-x-2">
                                <i className="fas fa-crosshairs animate-pulse"></i>
                                <span className="font-medium">
                                    {isAddingNode ? 'Click vào bản đồ để thêm node' :
                                        isSelectingLocation ? `Chọn vị trí cho dòng ${selectedTableRowIndex + 1}` : ''}
                                </span>
                            </div>
                        </div>
                    )}

                    <div
                        ref={mapRef}
                        className="w-full h-full"
                        style={{ cursor: isAddingNode || isSelectingLocation ? 'crosshair' : 'default' }}
                    ></div>
                </div>

                {/* Right Sidebar - Node Editor */}
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
                    <div className="bg-green-600 text-white p-4">
                        <div className="flex items-center space-x-3">
                            <i className="fas fa-edit text-xl"></i>
                            <h3 className="text-lg font-semibold">Chỉnh sửa Node</h3>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {editingNode ? (
                            <NodeEditor
                                node={editingNode}
                                nodes={nodes}
                                onUpdate={handleNodeUpdate}
                                onDelete={handleNodeDelete}
                                showNotification={showNotification}
                            />
                        ) : (
                            <div className="text-center text-gray-500 py-8">
                                <i className="fas fa-mouse-pointer text-4xl mb-4"></i>
                                <p>Chọn một node trên bản đồ để chỉnh sửa</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Input Section - Bottom Panel */}
            {showTableInput && (
                <div className="bg-white border-t border-gray-200 p-4">
                    {/* Warning about location selection */}
                    {isSelectingLocation && (
                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center text-blue-800">
                                <i className="fas fa-crosshairs mr-2"></i>
                                <span className="font-medium">
                                    Đang chọn vị trí cho dòng {selectedTableRowIndex + 1}. Click vào bản đồ để chọn tọa độ.
                                </span>
                                <button
                                    onClick={stopLocationSelection}
                                    className="ml-auto px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Bảng nhập liệu Node</h3>
                        <div className="flex space-x-2">
                            <button
                                onClick={addTableRow}
                                className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                <i className="fas fa-plus mr-1"></i>
                                Thêm dòng
                            </button>
                            <button
                                onClick={applyTableData}
                                disabled={tableData.length === 0}
                                className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                            >
                                <i className="fas fa-check mr-1"></i>
                                Áp dụng ({tableData.length} nodes)
                            </button>
                            <button
                                onClick={() => setShowTableInput(false)}
                                className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                                <i className="fas fa-times mr-1"></i>
                                Đóng
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[33vh] overflow-y-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left border-b border-gray-200">
                                        <div className="flex items-center space-x-1">
                                            <span>ID</span>
                                            <i className="fas fa-question-circle text-blue-500 text-xs cursor-help" title="Số thứ tự node (depot phải là 0)"></i>
                                        </div>
                                    </th>
                                    <th className="px-3 py-2 text-left border-b border-gray-200">
                                        <div className="flex items-center space-x-1">
                                            <span>Loại</span>
                                            <i className="fas fa-question-circle text-blue-500 text-xs cursor-help" title="depot/pickup/delivery/regular"></i>
                                        </div>
                                    </th>
                                    <th className="px-3 py-2 text-left border-b border-gray-200">
                                        <div className="flex items-center space-x-1">
                                            <span>Tọa độ</span>
                                            <i className="fas fa-question-circle text-blue-500 text-xs cursor-help" title="Nhập tọa độ hoặc click 📍 để chọn trên bản đồ"></i>
                                        </div>
                                    </th>
                                    <th className="px-3 py-2 text-left border-b border-gray-200">
                                        <div className="flex items-center space-x-1">
                                            <span>Demand</span>
                                            <i className="fas fa-question-circle text-blue-500 text-xs cursor-help" title="Depot=0, Pickup>0, Delivery<0"></i>
                                        </div>
                                    </th>
                                    <th className="px-3 py-2 text-left border-b border-gray-200">
                                        <div className="flex items-center space-x-1">
                                            <span>Time Window</span>
                                            <i className="fas fa-question-circle text-blue-500 text-xs cursor-help" title="ETW (sớm nhất), LTW (muộn nhất) - tính bằng phút"></i>
                                        </div>
                                    </th>
                                    <th className="px-3 py-2 text-left border-b border-gray-200">
                                        <div className="flex items-center space-x-1">
                                            <span>Service</span>
                                            <i className="fas fa-question-circle text-blue-500 text-xs cursor-help" title="Thời gian phục vụ (phút)"></i>
                                        </div>
                                    </th>
                                    <th className="px-3 py-2 text-left border-b border-gray-200">
                                        <div className="flex items-center space-x-1">
                                            <span>Liên kết</span>
                                            <i className="fas fa-question-circle text-blue-500 text-xs cursor-help" title="P (Pickup ID), D (Delivery ID) cho các cặp node"></i>
                                        </div>
                                    </th>
                                    <th className="px-3 py-2 text-left border-b border-gray-200">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50 border-b border-gray-100">
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                value={row.id}
                                                onChange={(e) => updateTableRow(index, 'id', e.target.value)}
                                                className="w-16 px-2 py-1 text-sm border rounded"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <select
                                                value={row.type}
                                                onChange={(e) => updateTableRow(index, 'type', e.target.value)}
                                                className="w-24 px-2 py-1 text-sm border rounded"
                                            >
                                                <option value="depot">Depot</option>
                                                <option value="pickup">Pickup</option>
                                                <option value="delivery">Delivery</option>
                                                <option value="regular">Regular</option>
                                            </select>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center space-x-1">
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={row.lat}
                                                    onChange={(e) => updateTableRow(index, 'lat', e.target.value)}
                                                    className="w-28 px-2 py-1 text-sm border rounded"
                                                    placeholder="Latitude"
                                                />
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={row.lng}
                                                    onChange={(e) => updateTableRow(index, 'lng', e.target.value)}
                                                    className="w-28 px-2 py-1 text-sm border rounded"
                                                    placeholder="Longitude"
                                                />
                                                <button
                                                    onClick={() => startLocationSelection(index)}
                                                    className={`px-2 py-1 text-xs rounded transition-colors ${isSelectingLocation && selectedTableRowIndex === index
                                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                                        : 'bg-blue-500 text-white hover:bg-blue-600'
                                                        }`}
                                                    title="Click để chọn vị trí trên bản đồ"
                                                >
                                                    <i className={`fas ${isSelectingLocation && selectedTableRowIndex === index
                                                        ? 'fa-times'
                                                        : 'fa-map-marker-alt'
                                                        }`}></i>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                value={row.demand}
                                                onChange={(e) => updateTableRow(index, 'demand', e.target.value)}
                                                className="w-20 px-2 py-1 text-sm border rounded"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex space-x-1">
                                                <input
                                                    type="number"
                                                    value={row.earliestTime}
                                                    onChange={(e) => updateTableRow(index, 'earliestTime', e.target.value)}
                                                    className="w-16 px-2 py-1 text-sm border rounded"
                                                    placeholder="ETW"
                                                />
                                                <input
                                                    type="number"
                                                    value={row.latestTime}
                                                    onChange={(e) => updateTableRow(index, 'latestTime', e.target.value)}
                                                    className="w-16 px-2 py-1 text-sm border rounded"
                                                    placeholder="LTW"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                value={row.serviceDuration}
                                                onChange={(e) => updateTableRow(index, 'serviceDuration', e.target.value)}
                                                className="w-16 px-2 py-1 text-sm border rounded"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex space-x-1">
                                                <input
                                                    type="number"
                                                    value={row.pickupId}
                                                    onChange={(e) => updateTableRow(index, 'pickupId', e.target.value)}
                                                    className="w-12 px-2 py-1 text-sm border rounded"
                                                    placeholder="P"
                                                />
                                                <input
                                                    type="number"
                                                    value={row.deliveryId}
                                                    onChange={(e) => updateTableRow(index, 'deliveryId', e.target.value)}
                                                    className="w-12 px-2 py-1 text-sm border rounded"
                                                    placeholder="D"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <button
                                                onClick={() => removeTableRow(index)}
                                                className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {tableData.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <i className="fas fa-table text-4xl mb-4"></i>
                            <p>Chưa có dữ liệu. Nhấn "Thêm dòng" để bắt đầu.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Node Editor Component
const NodeEditor = ({ node, nodes, onUpdate, onDelete, showNotification }) => {
    const [editedNode, setEditedNode] = useState({ ...node });

    useEffect(() => {
        setEditedNode({ ...node });
    }, [node]);

    const handleSave = () => {
        // Validation
        if (editedNode.isPickup && editedNode.demand <= 0) {
            showNotification('error', 'Pickup node phải có demand dương (> 0)!');
            return;
        }

        if (editedNode.isDelivery && editedNode.demand >= 0) {
            showNotification('error', 'Delivery node phải có demand âm (< 0)!');
            return;
        }

        if (editedNode.earliestTime >= editedNode.latestTime) {
            showNotification('error', 'Thời gian sớm nhất phải nhỏ hơn thời gian muộn nhất!');
            return;
        }

        if (editedNode.serviceDuration < 0) {
            showNotification('error', 'Thời gian phục vụ không thể âm!');
            return;
        }

        // Pickup-delivery pairing validation
        if (editedNode.isPickup && editedNode.deliveryId > 0) {
            const deliveryNode = nodes.find(n => n.id === editedNode.deliveryId);
            if (!deliveryNode || !deliveryNode.isDelivery) {
                showNotification('error', 'Delivery node được chọn không tồn tại hoặc không phải là delivery node!');
                return;
            }
            // Check if total demand is valid (pickup + delivery >= 0, not negative)
            const total = editedNode.demand + deliveryNode.demand;
            if (total < 0) {
                showNotification('error', `Lỗi: Tổng pickup (${editedNode.demand}) + delivery (${deliveryNode.demand}) = ${total} < 0. Không thể giao nhiều hơn lấy! Vui lòng điều chỉnh lại demand.`);
                return;
            }
        }

        if (editedNode.isDelivery && editedNode.pickupId > 0) {
            const pickupNode = nodes.find(n => n.id === editedNode.pickupId);
            if (!pickupNode || !pickupNode.isPickup) {
                showNotification('error', 'Pickup node được chọn không tồn tại hoặc không phải là pickup node!');
                return;
            }
            // Check if total demand is valid (pickup + delivery >= 0, not negative)
            const total = pickupNode.demand + editedNode.demand;
            if (total < 0) {
                showNotification('error', `Lỗi: Tổng pickup (${pickupNode.demand}) + delivery (${editedNode.demand}) = ${total} < 0. Không thể giao nhiều hơn lấy! Vui lòng điều chỉnh lại demand.`);
                return;
            }
        }

        onUpdate(editedNode);
        showNotification('success', 'Node đã được cập nhật!');
    };

    const setNodeType = (type) => {
        const updated = { ...editedNode };

        // Reset all type flags
        updated.isDepot = false;
        updated.isPickup = false;
        updated.isDelivery = false;

        // Set the selected type
        if (type === 'depot') {
            updated.isDepot = true;
            updated.demand = 0;
            updated.pickupId = 0;
            updated.deliveryId = 0;
        } else if (type === 'pickup') {
            updated.isPickup = true;
            // Auto-set positive demand for pickup
            if (updated.demand <= 0) {
                updated.demand = 1;
            } else {
                updated.demand = Math.abs(updated.demand); // Ensure positive
            }
        } else if (type === 'delivery') {
            updated.isDelivery = true;
            // Auto-set negative demand for delivery
            if (updated.demand >= 0) {
                updated.demand = -1;
            } else {
                updated.demand = -Math.abs(updated.demand); // Ensure negative
            }
        }

        setEditedNode(updated);
    };

    const getAvailableNodes = (excludeType) => {
        return nodes.filter(n => {
            if (n.id === editedNode.id) return false;
            if (excludeType === 'pickup' && n.isPickup) return false;
            if (excludeType === 'delivery' && n.isDelivery) return false;
            if (excludeType === 'depot' && n.isDepot) return false;

            // For pickup selection in delivery node: only show pickups without delivery
            if (excludeType === 'delivery' && n.isPickup) {
                return n.deliveryId === 0; // Only pickups that don't have a delivery yet
            }

            // For delivery selection in pickup node: only show deliveries without pickup
            if (excludeType === 'pickup' && n.isDelivery) {
                return n.pickupId === 0; // Only deliveries that don't have a pickup yet
            }

            return true;
        });
    };

    return (
        <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h4 className="font-medium text-gray-800 mb-2">Node {editedNode.id}</h4>
                <div className="text-sm text-gray-600">
                    Tọa độ: [{editedNode.lat.toFixed(6)}, {editedNode.lng.toFixed(6)}]
                </div>
            </div>

            {/* Node Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Loại Node</label>
                <div className="space-y-2">
                    <button
                        onClick={() => setNodeType('depot')}
                        className={`w-full text-left px-3 py-2 rounded border ${editedNode.isDepot ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-300'
                            }`}
                        disabled={editedNode.id !== 0 && editedNode.isDepot}
                    >
                        ● Depot (Kho)
                    </button>
                    <button
                        onClick={() => setNodeType('pickup')}
                        className={`w-full text-left px-3 py-2 rounded border ${editedNode.isPickup ? 'bg-green-100 border-green-300' : 'bg-white border-gray-300'
                            }`}
                        disabled={editedNode.id === 0}
                    >
                        ▲ Pickup (Nhận hàng)
                    </button>
                    <button
                        onClick={() => setNodeType('delivery')}
                        className={`w-full text-left px-3 py-2 rounded border ${editedNode.isDelivery ? 'bg-red-100 border-red-300' : 'bg-white border-gray-300'
                            }`}
                        disabled={editedNode.id === 0}
                    >
                        ▼ Delivery (Giao hàng)
                    </button>
                </div>
            </div>

            {/* Pickup/Delivery Pairing - Show BEFORE Demand */}
            {editedNode.isPickup && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery node tương ứng
                    </label>
                    <select
                        value={editedNode.deliveryId}
                        onChange={(e) => {
                            const deliveryId = parseInt(e.target.value) || 0;
                            setEditedNode(prev => {
                                const updated = { ...prev, deliveryId };
                                // Auto-set demand based on corresponding delivery node
                                if (deliveryId > 0) {
                                    const deliveryNode = nodes.find(n => n.id === deliveryId);
                                    if (deliveryNode && deliveryNode.demand < 0) {
                                        updated.demand = Math.abs(deliveryNode.demand);
                                    }
                                }
                                return updated;
                            });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={0}>Không có</option>
                        {getAvailableNodes('pickup').map(n => (
                            <option key={n.id} value={n.id}>Node {n.id} (D: {n.demand})</option>
                        ))}
                    </select>
                    {editedNode.deliveryId > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                            💡 Demand được tự động điều chỉnh theo delivery node
                        </div>
                    )}
                </div>
            )}

            {editedNode.isDelivery && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pickup node tương ứng
                    </label>
                    <select
                        value={editedNode.pickupId}
                        onChange={(e) => {
                            const pickupId = parseInt(e.target.value) || 0;
                            setEditedNode(prev => {
                                const updated = { ...prev, pickupId };
                                // Auto-set demand based on corresponding pickup node
                                if (pickupId > 0) {
                                    const pickupNode = nodes.find(n => n.id === pickupId);
                                    if (pickupNode && pickupNode.demand > 0) {
                                        updated.demand = -pickupNode.demand;
                                    }
                                }
                                return updated;
                            });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={0}>Không có</option>
                        {getAvailableNodes('delivery').map(n => (
                            <option key={n.id} value={n.id}>Node {n.id} (D: {n.demand})</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Demand */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nhu cầu {editedNode.isPickup ? '(pickup)' : editedNode.isDelivery ? '(delivery)' : '(depot luôn = 0)'}
                </label>
                {editedNode.isDepot ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500">
                        0 (Depot không có demand)
                    </div>
                ) : (
                    <div className="flex items-center space-x-2">
                        <div className={`px-3 py-2 border rounded-md font-medium text-center min-w-12 ${editedNode.isPickup ? 'bg-green-100 border-green-300 text-green-700' : 'bg-red-100 border-red-300 text-red-700'}`}>
                            {editedNode.isPickup ? '+' : '-'}
                        </div>
                        <input
                            type="number"
                            value={Math.abs(editedNode.demand)}
                            onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                const absoluteValue = Math.abs(value);
                                const finalValue = editedNode.isPickup ? absoluteValue : -absoluteValue;
                                setEditedNode(prev => ({ ...prev, demand: finalValue || (editedNode.isPickup ? 1 : -1) }));
                            }}
                            min="0"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nhập số dương"
                        />
                    </div>
                )}
                {!editedNode.isDepot && Math.abs(editedNode.demand) === 0 && (
                    <div className="text-xs text-amber-600 mt-1">
                        ⚠️ Demand không thể bằng 0
                    </div>
                )}
                {/* Validation for pickup-delivery pair balance */}
                {(() => {
                    if (editedNode.isPickup && editedNode.deliveryId > 0) {
                        const deliveryNode = nodes.find(n => n.id === editedNode.deliveryId);
                        if (deliveryNode) {
                            const total = editedNode.demand + deliveryNode.demand;
                            if (total < 0) {
                                return (
                                    <div className="text-xs text-red-600 mt-1">
                                        Lỗi: Tổng pickup ({editedNode.demand}) + delivery ({deliveryNode.demand}) = {total} &lt; 0. Không thể giao nhiều hơn lấy!
                                    </div>
                                );
                            }
                        }
                    }
                    if (editedNode.isDelivery && editedNode.pickupId > 0) {
                        const pickupNode = nodes.find(n => n.id === editedNode.pickupId);
                        if (pickupNode) {
                            const total = pickupNode.demand + editedNode.demand;
                            if (total < 0) {
                                return (
                                    <div className="text-xs text-red-600 mt-1">
                                        Lỗi: Tổng pickup ({pickupNode.demand}) + delivery ({editedNode.demand}) = {total} &lt; 0. Không thể giao nhiều hơn lấy!
                                    </div>
                                );
                            }
                        }
                    }
                    return null;
                })()}
            </div>

            {/* Time Window */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Time Window</label>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Sớm nhất (ETW)</label>
                        <input
                            type="number"
                            value={editedNode.earliestTime}
                            onChange={(e) => setEditedNode(prev => ({ ...prev, earliestTime: parseInt(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Muộn nhất (LTW)</label>
                        <input
                            type="number"
                            value={editedNode.latestTime}
                            onChange={(e) => setEditedNode(prev => ({ ...prev, latestTime: parseInt(e.target.value) || 480 }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Service Duration */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thời gian phục vụ (phút)
                </label>
                <input
                    type="number"
                    value={editedNode.serviceDuration}
                    onChange={(e) => setEditedNode(prev => ({ ...prev, serviceDuration: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4">
                <button
                    onClick={handleSave}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                    <i className="fas fa-save mr-2"></i>
                    Lưu thay đổi
                </button>

                {!editedNode.isDepot && (
                    <button
                        onClick={() => onDelete(editedNode.id)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                    >
                        <i className="fas fa-trash mr-2"></i>
                        Xóa node
                    </button>
                )}
            </div>
        </div>
    );
};

export default AddInstancePage;
