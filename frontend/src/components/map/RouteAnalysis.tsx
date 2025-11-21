import React, { useState, useEffect } from 'react';

const RouteAnalysis: React.FC<any> = ({ solution, instance, onRouteSelect }) => {
    const [analysisData, setAnalysisData] = useState<any[]>([]);
    const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(-1);

    useEffect(() => {
        if (solution?.routes && instance?.nodes) {
            console.log('Processing routes for analysis:', solution.routes);
            const analysisResults = solution.routes.map((route: any, index: number) => {
                // Normalize route structure like in visualizer
                let routeSequence = route.sequence || route.nodes || route.node_sequence || (Array.isArray(route) ? route : []);

                if (routeSequence.length > 2) { // Skip routes with only depot
                    const normalizedRoute = {
                        ...route,
                        sequence: routeSequence,
                        index
                    };
                    const metrics = calculateRouteMetrics(normalizedRoute, instance);
                    return {
                        ...normalizedRoute,
                        ...metrics
                    };
                }
                return null;
            }).filter(Boolean);

            console.log('Analysis results:', analysisResults);
            setAnalysisData(analysisResults as any[]);
        }
    }, [solution, instance]);

    const calculateRouteMetrics = (route: any, instance: any) => {
        if (!route?.sequence || !instance?.nodes || !instance?.times) {
            return { distance: 0, time: 0, load: 0, violations: 0, totalCost: 0 };
        }

        let totalDistance = 0;
        let maxLoad = 0;
        let currentLoad = 0;
        let violations = 0;
        let totalTime = 0;
        let totalCost = route.cost || 0;

        for (let i = 0; i < route.sequence.length; i++) {
            const nodeId = route.sequence[i];
            const node = instance.nodes[nodeId];

            if (!node) continue;

            // Calculate load
            currentLoad += node.demand || 0;
            maxLoad = Math.max(maxLoad, currentLoad);

            // Calculate distance and time using instance.times if available
            if (i > 0) {
                const prevNodeId = route.sequence[i - 1];

                // Use instance.times if available (like in visualizer)
                if (instance.times && instance.times[prevNodeId] && instance.times[prevNodeId][nodeId]) {
                    const timeCost = instance.times[prevNodeId][nodeId];
                    totalTime += timeCost;
                    // Estimate distance from time (assuming time represents travel time)
                    totalDistance += timeCost * 30; // 30 km/h average
                } else {
                    // Fallback to coordinate calculation
                    const prevNode = instance.nodes[prevNodeId];
                    if (prevNode && node) {
                        const distance = getDistanceBetweenPoints(prevNode.coords, node.coords);
                        totalDistance += distance;
                        totalTime += distance / 30; // Assume 30 km/h average speed
                    }
                }
            }

            // Check time window violations
            if (node.time_window && totalTime > node.time_window[1]) {
                violations++;
            }

            // Add service time
            totalTime += node.service_time || 0;
        }

        return {
            distance: totalDistance,
            time: totalTime,
            load: maxLoad,
            violations,
            totalCost
        };
    };

    const getDistanceBetweenPoints = (coord1: number[], coord2: number[]) => {
        const R = 6371; // Earth's radius in km
        const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
        const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const handleRouteClick = (route: any, index: number) => {
        setSelectedRouteIndex(index);
        if (onRouteSelect) {
            onRouteSelect(route, index);
        }
    };

    const getRouteStatusColor = (violations: number) => {
        if (violations === 0) return 'bg-green-100 border-green-300 text-green-800';
        if (violations <= 2) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
        return 'bg-red-100 border-red-300 text-red-800';
    };

    const getRouteQualityBadge = (route: any) => {
        const efficiency = route.distance > 0 ? (route.sequence?.length || 0) / route.distance : 0;

        if (efficiency > 0.5) return { text: 'Hiệu quả cao', color: 'bg-green-500' };
        if (efficiency > 0.3) return { text: 'Hiệu quả trung bình', color: 'bg-yellow-500' };
        return { text: 'Cần cải thiện', color: 'bg-red-500' };
    };

    if (!analysisData.length) {
        return (
            <div className="p-4 text-center text-gray-500">
                <i className="fas fa-chart-line text-4xl mb-2"></i>
                <p>Chưa có solution để phân tích</p>
                <p className="text-sm">Hãy load instance và chạy thuật toán hoặc load solution file</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Statistics */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <i className="fas fa-chart-bar text-blue-600 mr-2"></i>
                    Thống kê tổng quan
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{analysisData.length}</div>
                        <div className="text-xs text-gray-600">Routes</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                            {analysisData.reduce((sum, route) => sum + route.distance, 0).toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-600">Tổng KM</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                            {analysisData.reduce((sum, route) => sum + route.time, 0).toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-600">Tổng giờ</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                            {analysisData.reduce((sum, route) => sum + route.violations, 0)}
                        </div>
                        <div className="text-xs text-gray-600">Vi phạm</div>
                    </div>
                </div>
            </div>

            {/* Route List */}
            <div className="space-y-2">
                <h3 className="font-semibold text-gray-800 flex items-center">
                    <i className="fas fa-list text-blue-600 mr-2"></i>
                    Danh sách Routes
                </h3>

                {analysisData.map((route, index) => {
                    const quality = getRouteQualityBadge(route);
                    const isSelected = selectedRouteIndex === index;

                    return (
                        <div
                            key={index}
                            onClick={() => handleRouteClick(route, index)}
                            className={`
                p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md
                ${isSelected
                                    ? 'bg-blue-50 border-blue-300 shadow-md'
                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                }
                ${getRouteStatusColor(route.violations)}
              `}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-lg">Route {index + 1}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs text-white ${quality.color}`}>
                                        {quality.text}
                                    </span>
                                    {route.violations > 0 && (
                                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                                            <i className="fas fa-exclamation-triangle mr-1"></i>
                                            {route.violations} vi phạm
                                        </span>
                                    )}
                                </div>
                                <i className={`fas fa-chevron-${isSelected ? 'up' : 'down'} text-gray-400`}></i>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-600">Chi phí:</span>
                                    <div className="font-medium">{route.cost || 'N/A'}</div>
                                </div>
                                <div>
                                    <span className="text-gray-600">Khoảng cách:</span>
                                    <div className="font-medium">{route.distance.toFixed(1)} km</div>
                                </div>
                                <div>
                                    <span className="text-gray-600">Thời gian:</span>
                                    <div className="font-medium">{route.time.toFixed(1)} h</div>
                                </div>
                                <div>
                                    <span className="text-gray-600">Tải trọng max:</span>
                                    <div className="font-medium">{route.load}</div>
                                </div>
                            </div>

                            <div className="mt-3 text-xs text-gray-500">
                                <div className="flex items-center space-x-4">
                                    <span>
                                        <i className="fas fa-map-marker-alt mr-1"></i>
                                        {route.sequence?.length || 0} điểm
                                    </span>
                                    <span>
                                        <i className="fas fa-route mr-1"></i>
                                        Nodes: {route.sequence?.join(' → ') || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Progress bar for efficiency */}
                            <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                    <span>Hiệu quả route</span>
                                    <span>{((route.sequence?.length || 0) / Math.max(route.distance, 1) * 100).toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${quality.color}`}
                                        style={{ width: `${Math.min(((route.sequence?.length || 0) / Math.max(route.distance, 1) * 100), 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Route Comparison Chart */}
            <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <i className="fas fa-chart-line text-blue-600 mr-2"></i>
                    So sánh Routes
                </h3>
                <div className="space-y-3">
                    {analysisData.map((route, index) => (
                        <div key={index} className="flex items-center space-x-3">
                            <div className="w-16 text-sm font-medium">Route {index + 1}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                                <div
                                    className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                                    style={{
                                        width: `${Math.min((route.distance / Math.max(...analysisData.map(r => r.distance))) * 100, 100)}%`
                                    }}
                                ></div>
                                <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                                    {route.distance.toFixed(1)} km
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RouteAnalysis;
