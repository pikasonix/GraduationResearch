"use client";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Map as MapIcon } from 'lucide-react';
import type { Instance, Route, Solution } from '@/utils/dataModels';
import dynamic from 'next/dynamic';
const MapComponent = dynamic(() => import('@/components/map/MapComponent'), { ssr: false });
import { createSolution } from '@/utils/dataModels';
import { useRouter } from 'next/navigation';

export interface RouteDetailsViewProps {
    route: Route | any | null;
    instance: Instance | any | null;
    useRealRouting: boolean;
    onToggleRealRouting: () => void;
    showBack?: boolean;
    onBack?: () => void;
    compactTimeline?: boolean;
}

const getDistanceBetweenPoints = (coord1: [number, number], coord2: [number, number]) => {
    const R = 6371; const dLat = (coord2[0] - coord1[0]) * Math.PI / 180; const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2; const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
};

async function buildRealRoute(route: any, instance: any, useRealRouting: boolean) {
    if (!useRealRouting || !route?.sequence) {
        return route.sequence.map((nodeId: number) => instance?.nodes?.find((n: any) => n.id === nodeId)?.coords || [0, 0]);
    }
    try {
        const coordPairs = route.sequence.map((nodeId: number) => {
            const coords = instance?.nodes?.find((n: any) => n.id === nodeId)?.coords || [0, 0];
            return `${coords[1]},${coords[0]}`;
        }).join(';');
        const routingProfile = (typeof window !== 'undefined' && localStorage.getItem('routingProfile')) || 'walking';
        const url = `https://router.project-osrm.org/route/v1/${routingProfile}/${coordPairs}?overview=full&geometries=geojson`;
        const response = await fetch(url); const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            return data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        }
        return route.sequence.map((nodeId: number) => instance?.nodes?.find((n: any) => n.id === nodeId)?.coords || [0, 0]);
    } catch {
        return route.sequence.map((nodeId: number) => instance?.nodes?.find((n: any) => n.id === nodeId)?.coords || [0, 0]);
    }
}

function calcMetrics(route: any, instance: any) {
    if (!route?.sequence || !instance?.nodes) return null; let totalDistance = 0; for (let i = 1; i < route.sequence.length; i++) {
        const n1 = instance.nodes.find((n: any) => n.id === route.sequence[i - 1]); const n2 = instance.nodes.find((n: any) => n.id === route.sequence[i]); if (n1 && n2) totalDistance += getDistanceBetweenPoints(n1.coords, n2.coords);
    } return { distance: totalDistance, time: totalDistance / 30, nodes: route.sequence.length };
}

export const RouteDetailsView: React.FC<RouteDetailsViewProps> = ({ route, instance, useRealRouting, onToggleRealRouting, showBack, onBack }) => {
    const [selectedNodes, setSelectedNodes] = useState<any[] | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(route || null);
    const externalApiRef = useRef<any | null>(null);
    // Active segment highlight index for timeline (legacy-like interaction)
    const [clickedCardIndex, setClickedCardIndex] = useState<number | null>(null);
    const router = useRouter();

    // Keep local selectedRoute in sync if parent route changes
    useEffect(() => {
        setSelectedRoute(route || null);
    }, [route]);

    // Build a minimal solution object for MapComponent consumption
    const solution: Solution | null = useMemo(() => {
        if (!route) return null;
        const ensuredRoute: Route = { ...route, color: route.color || '#1d4ed8' };
        return createSolution(instance?.name || 'instance', 'ref', new Date().toISOString(), 'system', [ensuredRoute]);
    }, [route, instance?.name]);

    const filteredInstance: Instance | null = useMemo(() => {
        if (!instance || !route || !Array.isArray(route.sequence)) return instance;
        const idSet = new Set(route.sequence);
        // Always keep depot nodes (is_depot true) if present
        const nodes = instance.nodes.filter((n: any) => n.is_depot || idSet.has(n.id));
        const all_coords = nodes.map((n: any) => n.coords);
        return { ...instance, nodes, all_coords };
    }, [instance, route]);

    const metrics = route ? calcMetrics(route, filteredInstance) : null;

    const handleNavigateRouting = () => {
        if (!route?.sequence || !instance?.nodes) return;
        // Build lat,lng pairs separated by '|'
        const coordsList = route.sequence
            .map((nodeId: number) => instance.nodes.find((n: any) => n.id === nodeId))
            .filter(Boolean)
            .map((node: any) => `${node.coords[0]},${node.coords[1]}`)
            .join('|');
        const profile = (typeof window !== 'undefined' && (localStorage.getItem('routingProfile') || 'driving')) || 'driving';
        router.push(`/routing?coords=${encodeURIComponent(coordsList)}&profile=${encodeURIComponent(profile)}`);
    };

    interface TimelineEvent {
        nodeId: number;
        index: number;
        arrivalTime: number;
        serviceStartTime: number;
        serviceEndTime: number;
        waitTime: number;
        travelTime: number;
        distance: number;
        demand: number;
        load: number;
        timeWindow: [number, number];
        nodeType: string;
    }

    const timelineData = useMemo(() => {
        if (!route?.sequence || !filteredInstance?.nodes) return null;
        const events: TimelineEvent[] = [];
        let currentTime = 0;
        let currentLoad = 0;
        let totalDistance = 0;
        const nodesMap = new Map(filteredInstance.nodes.map((n: any) => [n.id, n]));
        const getNode = (id: number) => nodesMap.get(id);
        for (let i = 0; i < route.sequence.length; i++) {
            const nodeId = route.sequence[i];
            const node = getNode(nodeId);
            if (!node) continue;
            let travelTime = 0;
            let distance = 0;
            if (i > 0) {
                const prevId = route.sequence[i - 1];
                const prevNode = getNode(prevId);
                if (prevNode) {
                    if (Array.isArray(filteredInstance.times) && filteredInstance.times[prevId] && filteredInstance.times[prevId][nodeId] != null) {
                        travelTime = filteredInstance.times[prevId][nodeId];
                        distance = travelTime * 30;
                    } else {
                        distance = getDistanceBetweenPoints(prevNode.coords, node.coords);
                        travelTime = distance / 30;
                    }
                    totalDistance += distance;
                }
            }
            const arrivalTime = currentTime + travelTime;
            const twStart = node.time_window?.[0] ?? 0;
            const twEnd = node.time_window?.[1] ?? twStart;
            const waitTime = arrivalTime < twStart ? (twStart - arrivalTime) : 0;
            const serviceStartTime = arrivalTime + waitTime;
            const serviceDuration = node.duration ?? 0;
            currentLoad += node.demand || 0;
            const event: TimelineEvent = {
                nodeId,
                index: i,
                arrivalTime,
                serviceStartTime,
                serviceEndTime: serviceStartTime + serviceDuration,
                waitTime,
                travelTime,
                distance,
                demand: node.demand || 0,
                load: currentLoad,
                timeWindow: [twStart, twEnd],
                nodeType: node.is_depot ? 'Depot' : node.is_pickup ? 'Pickup' : 'Delivery'
            };
            events.push(event);
            currentTime = serviceStartTime + serviceDuration;
        }
        return {
            events,
            totalDuration: currentTime,
            totalDistance,
        };
    }, [route, filteredInstance]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-1 overflow-hidden">
                <div className="w-80 bg-white shadow-xl border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <h2 className="text-lg font-semibold">Route #{route?.id ?? 'N/A'}</h2>
                        </div>
                        <div>
                            <label className="inline-flex items-center cursor-pointer select-none">
                                <span className="ml-3 text-sm p-2">Đường thực tế</span>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={useRealRouting}
                                    onChange={() => onToggleRealRouting()}
                                    aria-label="Toggle real routing"
                                />
                                <span className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${useRealRouting ? 'bg-blue-800' : 'bg-gray-300'}`}>
                                    <span className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${useRealRouting ? 'translate-x-4' : 'translate-x-0'}`} />
                                </span>
                            </label>
                        </div>
                    </div>
                    <div className="p-4 border-b border-gray-200 space-y-2 text-sm">
                        {route && metrics ? (
                            <>
                                <div className="flex justify-between"><span className="text-gray-600">Số điểm:</span><span className="font-medium">{metrics.nodes}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Khoảng cách:</span><span className="font-medium">{metrics.distance.toFixed(2)} km</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Thời gian:</span><span className="font-medium">{metrics.time.toFixed(1)} h</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Chi phí:</span><span className="font-medium">{route.cost ?? 'N/A'}</span></div>
                            </>
                        ) : (
                            <div className="text-gray-500">Không có dữ liệu.</div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Trình tự các điểm</h3>
                        <div className="space-y-2">
                            {route?.sequence && instance?.nodes ? route.sequence.map((nodeId: number, idx: number) => {
                                const node = instance.nodes.find((n: any) => n.id === nodeId); if (!node) return null;
                                let nodeType = 'Delivery'; if (node.is_depot) nodeType = 'Depot'; else if (node.is_pickup) nodeType = 'Pickup';
                                return (
                                    <div key={idx} className="flex items-center space-x-3 p-2 bg-gray-50 rounded border-l-4">
                                        <span className="bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">{idx + 1}</span>
                                        <div className="flex-1">
                                            <div className="font-medium text-sm">{nodeType} {nodeId}</div>
                                            <div className="text-xs text-gray-500">Demand: {node.demand || 0}, TW: [{node.time_window?.[0] || 0}, {node.time_window?.[1] || 0}]</div>
                                            <div className="text-xs text-gray-400">Coords: [{node.coords[0].toFixed(4)}, {node.coords[1].toFixed(4)}]</div>
                                        </div>
                                    </div>
                                );
                            }) : <div className="text-xs text-gray-500">Không có sequence.</div>}
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-gray-50">
                    <MapComponent
                        instance={filteredInstance}
                        solution={solution}
                        selectedNodes={selectedNodes}
                        setSelectedNodes={setSelectedNodes}
                        selectedRoute={selectedRoute}
                        setSelectedRoute={setSelectedRoute}
                        useRealRouting={useRealRouting}
                        onToggleRealRouting={onToggleRealRouting}
                        hidePanels
                        mapHeight="100%"
                        externalApiRef={externalApiRef}
                    />
                </div>
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
                    <div className="bg-purple-600 text-white p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <i className="fas fa-clock text-xl" />
                                <h3 className="text-lg font-semibold">Timeline Route</h3>
                            </div>
                            <button
                                type="button"
                                onClick={handleNavigateRouting}
                                disabled={!route?.sequence?.length}
                                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                                title="Chuyển sang trang định tuyến và chỉ đường"
                            >
                                <MapIcon size={16} />
                                <span>Chỉ đường</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {timelineData ? (
                            <div className="space-y-4 p-4">
                                {/* Summary */}
                                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-2">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                        <i className="far fa-chart-bar mr-2 text-blue-600" />
                                        Timeline Summary
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="bg-blue-50 p-2 rounded-lg border-l-4 border-blue-400">
                                            <div className="flex items-center space-x-2">
                                                <i className="far fa-clock text-blue-600" />
                                                <div className="text-blue-600 font-bold text-base">{timelineData.totalDuration.toFixed(1)}h</div>
                                            </div>
                                            <div className="text-gray-600 font-medium mt-1">Total Duration</div>
                                        </div>
                                        <div className="bg-green-50 p-2 rounded-lg border-l-4 border-green-400">
                                            <div className="flex items-center space-x-2">
                                                <i className="fas fa-route text-green-600" />
                                                <div className="text-green-600 font-bold text-base">{timelineData.totalDistance.toFixed(1)}km</div>
                                            </div>
                                            <div className="text-gray-600 font-medium mt-1">Total Distance</div>
                                        </div>
                                    </div>
                                </div>
                                {/* Events */}
                                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                    <i className="far fa-clock mr-2 text-blue-600" />
                                    Route Timeline
                                </h3>
                                <div className="relative">
                                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300" />
                                    {timelineData.events.map((event, index) => {
                                        const node = filteredInstance?.nodes?.find((n: any) => n.id === event.nodeId);
                                        if (!node) return null;
                                        // Node style classification
                                        let markerColor = 'bg-gray-500';
                                        let nodeIcon = 'fas fa-home';
                                        let nodeLabel = 'Depot';
                                        let iconBg = 'bg-gray-100';
                                        let borderColor = 'border-gray-400';
                                        let hoverBg = 'hover:bg-gray-100';
                                        let hoverTextColor = 'hover:text-gray-900';
                                        let hoverIconBg = 'hover:bg-gray-300';
                                        let activeBg = 'bg-gray-200';
                                        let activeTextColor = 'text-gray-900';
                                        let activeIconBg = 'bg-gray-400';
                                        if (node.is_pickup) {
                                            markerColor = 'bg-blue-500'; nodeIcon = 'fas fa-arrow-up'; nodeLabel = 'Pickup'; iconBg = 'bg-blue-100'; borderColor = 'border-blue-400'; hoverBg = 'hover:bg-blue-100'; hoverTextColor = 'hover:text-blue-900'; hoverIconBg = 'hover:bg-blue-300'; activeBg = 'bg-blue-200'; activeTextColor = 'text-blue-900'; activeIconBg = 'bg-blue-400';
                                        } else if (!node.is_depot) {
                                            markerColor = 'bg-red-500'; nodeIcon = 'fas fa-arrow-down'; nodeLabel = 'Delivery'; iconBg = 'bg-red-100'; borderColor = 'border-red-400'; hoverBg = 'hover:bg-red-100'; hoverTextColor = 'hover:text-red-900'; hoverIconBg = 'hover:bg-red-300'; activeBg = 'bg-red-200'; activeTextColor = 'text-red-900'; activeIconBg = 'bg-red-400';
                                        }
                                        const twStart = event.timeWindow[0];
                                        const twEnd = event.timeWindow[1];
                                        const arrivalTime = event.arrivalTime;
                                        const twDuration = twEnd - twStart;
                                        const arrivalProgress = twDuration > 0 ? Math.max(0, Math.min(100, ((arrivalTime - twStart) / twDuration) * 100)) : 0;
                                        let arrivalStatus: 'early' | 'on-time' | 'late' = 'on-time';
                                        let statusColor = 'text-green-600';
                                        let statusIcon = 'far fa-check-circle';
                                        if (arrivalTime < twStart) { arrivalStatus = 'early'; statusColor = 'text-orange-600'; statusIcon = 'far fa-clock'; }
                                        else if (arrivalTime > twEnd) { arrivalStatus = 'late'; statusColor = 'text-red-600'; statusIcon = 'fas fa-exclamation-triangle'; }
                                        const hasWaitTime = event.waitTime > 0;
                                        const isActive = clickedCardIndex === index;
                                        const cardBgClass = isActive ? activeBg : 'bg-white';
                                        const cardTextClass = isActive ? activeTextColor : '';
                                        const cardIconBgClass = isActive ? activeIconBg : iconBg;
                                        const serviceDuration = (event.serviceEndTime - event.serviceStartTime);
                                        return (
                                            <div key={index} className="relative flex items-start space-x-4 pb-8">
                                                <div className={`w-12 h-12 ${markerColor} rounded-full flex items-center justify-center text-white text-sm font-bold z-10 shadow-lg`}>{index + 1}</div>
                                                <div className="flex-1 space-y-3">
                                                    {index > 0 && (
                                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-2">
                                                                    <i className="fas fa-route text-blue-600" />
                                                                    <div className="font-semibold text-blue-800 text-xs">
                                                                        <div>Travel:</div>
                                                                        <div className="flex items-center space-x-1">
                                                                            <span>{timelineData.events[index - 1].nodeId}</span>
                                                                            <i className="fas fa-arrow-right text-blue-800" />
                                                                            <span>{timelineData.events[index].nodeId}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex space-x-3 text-[10px]">
                                                                    <div className="text-center">
                                                                        <div className="text-blue-600 font-bold">{event.distance.toFixed(1)}km</div>
                                                                        <div className="text-[10px] text-gray-600">Distance</div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-blue-600 font-bold">{event.travelTime.toFixed(1)}h</div>
                                                                        <div className="text-[10px] text-gray-600">Time</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {hasWaitTime && (
                                                        <div className="bg-orange-50 border-l-4 border-orange-400 rounded-lg p-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-2">
                                                                    <i className="far fa-pause-circle text-orange-600" />
                                                                    <div>
                                                                        <div className="font-semibold text-orange-800 text-xs">Wait Required</div>
                                                                        <div className="text-[10px] text-orange-600">Need to wait {event.waitTime.toFixed(1)}h</div>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-orange-200 px-2 py-1 rounded text-orange-800 font-bold text-[10px]">+{event.waitTime.toFixed(1)}h</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`rounded-lg shadow-sm border-l-4 ${borderColor} p-4 transition-all duration-300 cursor-pointer ${(index === 0) ? `${cardBgClass} ${hoverBg} hover:shadow-lg` : (isActive ? `${activeBg} ${activeTextColor}` : `${cardBgClass} ${hoverBg} hover:shadow-lg ${hoverTextColor}`)}`}
                                                        onClick={() => {
                                                            if (index === 0) {
                                                                // Focus depot only and clear any highlighted segment
                                                                setClickedCardIndex(0);
                                                                externalApiRef.current?.clearSegmentHighlight?.();
                                                                externalApiRef.current?.focusNode?.(event.nodeId);
                                                                return;
                                                            }
                                                            setClickedCardIndex(index);
                                                            const prevNodeId = timelineData.events[index - 1].nodeId;
                                                            externalApiRef.current?.highlightSegment(prevNodeId, event.nodeId, selectedRoute || route);
                                                        }}
                                                        title={index === 0 ? 'Focus depot' : `Click để highlight đoạn ${timelineData.events[index - 1].nodeId} → ${event.nodeId}`}
                                                    >
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center space-x-3">
                                                                <div className={`w-10 h-10 ${!isActive ? cardIconBgClass : ''} ${!isActive ? hoverIconBg : ''} rounded-full flex items-center justify-center transition-colors duration-300`}>
                                                                    <i className={`${nodeIcon} text-base`} />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-800 text-sm">Node {event.nodeId}</div>
                                                                    <div className="text-[11px] text-gray-600">{nodeLabel}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <i className={`${statusIcon} ${statusColor} text-sm`} />
                                                                {index > 0 && <i className="fas fa-map-marked-alt text-blue-500 text-sm" title="Click để hiển thị đoạn" />}
                                                            </div>
                                                        </div>
                                                        <div className="mb-3">
                                                            <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                                                                <div>
                                                                    <div>Window:</div>
                                                                    <div>{twStart}h - {twEnd}h</div>
                                                                </div>
                                                                <div className={statusColor}>
                                                                    <div>Arrive:</div>
                                                                    <div>{arrivalTime.toFixed(1)}h ({arrivalStatus})</div>
                                                                </div>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div className={`h-2 rounded-full ${arrivalStatus === 'early' ? 'bg-orange-400' : arrivalStatus === 'late' ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${arrivalProgress}%` }} />
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                                            <div className="bg-blue-50 p-1 rounded text-center">
                                                                <div className="text-blue-600 font-bold text-[11px]">{serviceDuration.toFixed(1)}h</div>
                                                                <div className="text-[10px] text-gray-600">Service</div>
                                                            </div>
                                                            <div className={`p-1 rounded text-center ${event.demand > 0 ? 'bg-green-50' : event.demand < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                                                <div className={`font-bold text-[11px] ${event.demand > 0 ? 'text-green-600' : event.demand < 0 ? 'text-red-600' : 'text-gray-600'}`}>{event.demand > 0 ? '+' : ''}{event.demand}</div>
                                                                <div className="text-[10px] text-gray-600">Demand</div>
                                                            </div>
                                                            <div className="bg-purple-50 p-1 rounded text-center">
                                                                <div className="text-purple-600 font-bold text-[11px]">{event.load}</div>
                                                                <div className="text-[10px] text-gray-600">Load</div>
                                                            </div>
                                                        </div>
                                                        <div className="pt-2 border-t border-gray-100">
                                                            <div className="text-[10px] text-gray-600 text-center">Service: {event.serviceStartTime.toFixed(1)}h - {event.serviceEndTime.toFixed(1)}h</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 text-gray-500 text-xs">Không có dữ liệu timeline.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouteDetailsView;
