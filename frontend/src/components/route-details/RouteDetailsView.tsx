"use client";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Map as MapIcon, Truck } from 'lucide-react';
import type { Instance, Route, Solution } from '@/utils/dataModels';
import dynamic from 'next/dynamic';
const MapComponent = dynamic(() => import('@/components/map/MapboxComponent'), { ssr: false });
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
        const mapboxProfile = routingProfile === 'driving' ? 'driving' : routingProfile === 'cycling' ? 'cycling' : 'walking';
        const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
        const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxProfile}/${coordPairs}?overview=full&geometries=geojson&access_token=${accessToken}`;
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
    // Include useRealRouting in deps to force re-render when routing mode changes
    const solution: Solution | null = useMemo(() => {
        if (!route) return null;
        const ensuredRoute: Route = { ...route, color: route.color || '#1d4ed8' };
        return createSolution(instance?.name || 'instance', 'ref', new Date().toISOString(), 'system', [ensuredRoute]);
    }, [route, instance?.name, useRealRouting]);

    const filteredInstance: Instance | null = useMemo(() => {
        if (!instance || !route || !Array.isArray(route.sequence)) return instance;
        const idSet = new Set(route.sequence);
        // Always keep depot nodes (is_depot true) if present
        const nodes = instance.nodes.filter((n: any) => n.is_depot || idSet.has(n.id));
        const all_coords = nodes.map((n: any) => n.coords);
        return { ...instance, nodes, all_coords };
    }, [instance, route]);

    const metrics = route ? calcMetrics(route, filteredInstance) : null;

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

    const handleNavigateRouting = () => {
        if (!route?.sequence || !instance?.nodes) return;
        // Build lat,lng pairs separated by '|'
        const coordsList = route.sequence
            .map((nodeId: number) => instance.nodes.find((n: any) => n.id === nodeId))
            .filter(Boolean)
            .map((node: any) => `${node.coords[0]},${node.coords[1]}`)
            .join('|');

        // Save timeline data to sessionStorage for the routing page to pick up
        if (timelineData && typeof window !== 'undefined') {
            sessionStorage.setItem('routingTimelineData', JSON.stringify(timelineData));
        }

        const profile = (typeof window !== 'undefined' && (localStorage.getItem('routingProfile') || 'driving')) || 'driving';
        router.push(`/routing?coords=${encodeURIComponent(coordsList)}&profile=${encodeURIComponent(profile)}`);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-1 overflow-hidden">
                <div className="w-80 bg-white shadow-xl border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <h2 className="text-lg font-bold text-gray-800">Route #{route?.id ?? 'N/A'}</h2>
                        </div>
                        <div>
                            <label className="inline-flex items-center cursor-pointer select-none group">
                                <span className="mr-3 text-xs font-medium text-gray-500 group-hover:text-gray-700 transition-colors">Real Routing</span>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={useRealRouting}
                                    onChange={() => onToggleRealRouting()}
                                    aria-label="Toggle real routing"
                                />
                                <span className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors duration-300 ${useRealRouting ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                    <span className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform duration-300 ${useRealRouting ? 'translate-x-4' : 'translate-x-0'}`} />
                                </span>
                            </label>
                        </div>
                    </div>
                    <div className="p-4 border-b border-gray-100 bg-white">
                        {route && metrics ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Points</div>
                                    <div className="text-sm font-bold text-gray-800">{metrics.nodes}</div>
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Distance</div>
                                    <div className="text-sm font-bold text-gray-800">{metrics.distance.toFixed(1)} km</div>
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Time</div>
                                    <div className="text-sm font-bold text-gray-800">{metrics.time.toFixed(1)} h</div>
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Cost</div>
                                    <div className="text-sm font-bold text-gray-800">{route.cost ?? '-'}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-400 text-sm text-center py-2">No data available</div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Sequence</h3>
                        <div className="space-y-3">
                            {route?.sequence && instance?.nodes ? route.sequence.map((nodeId: number, idx: number) => {
                                const node = instance.nodes.find((n: any) => n.id === nodeId); if (!node) return null;
                                let nodeType = 'Delivery';
                                let typeColor = 'text-orange-600 bg-orange-50';
                                if (node.is_depot) { nodeType = 'Depot'; typeColor = 'text-gray-600 bg-gray-100'; }
                                else if (node.is_pickup) { nodeType = 'Pickup'; typeColor = 'text-blue-600 bg-blue-50'; }

                                return (
                                    <div key={idx} className="flex items-center space-x-3 p-2.5 bg-white rounded-xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            {/* Line 1: Info mixed */}
                                            <div className="flex items-center gap-2 text-[11px] leading-tight mb-0.5">
                                                <span className="font-bold text-gray-800 whitespace-nowrap">Node {nodeId}</span>
                                                <span className={`px-1 rounded text-[10px] font-medium whitespace-nowrap ${typeColor}`}>
                                                    {nodeType}
                                                </span>
                                                <span className="text-gray-300">|</span>
                                                <span className="text-gray-500 whitespace-nowrap">D:{node.demand}</span>
                                                <span className="text-gray-500 whitespace-nowrap">TW:[{node.time_window?.[0]}-{node.time_window?.[1]}]</span>
                                            </div>

                                            {/* Line 2: Coords */}
                                            <div className="text-[10px] font-mono text-gray-400 select-all truncate leading-tight">
                                                {node.coords[0]}, {node.coords[1]}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : <div className="text-xs text-gray-500 text-center py-4">No sequence data</div>}
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
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden z-10">
                    <div className="bg-white border-b border-gray-100 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <i className="far fa-clock text-blue-600" />
                                Timeline
                            </h3>
                            <div className="flex bg-gray-100/80 p-1 rounded-full border border-gray-200/50 backdrop-blur-sm">
                                <button
                                    type="button"
                                    onClick={handleNavigateRouting}
                                    disabled={!route?.sequence?.length}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 text-gray-600 hover:text-blue-600 hover:bg-white hover:shadow-sm disabled:opacity-30"
                                    title="Chỉ đường"
                                >
                                    <span>Chỉ đường</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push('/dispatch')}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 text-gray-600 hover:text-blue-600 hover:bg-white hover:shadow-sm"
                                    title="Dispatch"
                                >
                                    <span>Dispatch</span>
                                </button>
                            </div>
                        </div>

                        {/* Clean Summary */}
                        {timelineData && (
                            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                <div className="text-center flex-1 border-r border-gray-200">
                                    <div className="text-lg font-bold text-gray-800">{timelineData.totalDuration.toFixed(1)}h</div>
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Duration</div>
                                </div>
                                <div className="text-center flex-1">
                                    <div className="text-lg font-bold text-gray-800">{timelineData.totalDistance.toFixed(1)}km</div>
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Distance</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4">
                        {timelineData ? (
                            <div className="relative pl-4">
                                {/* Timeline Line */}
                                <div className="absolute left-[35px] top-4 bottom-0 w-px bg-gray-200" />

                                {timelineData.events.map((event, index) => {
                                    const node = filteredInstance?.nodes?.find((n: any) => n.id === event.nodeId);
                                    if (!node) return null;

                                    // Node Styling
                                    let nodeColor = 'bg-gray-800';
                                    let ringColor = 'ring-gray-100';
                                    let typeLabel = 'Depot';

                                    if (node.is_pickup) {
                                        nodeColor = 'bg-blue-600';
                                        ringColor = 'ring-blue-50';
                                        typeLabel = 'Pickup';
                                    } else if (!node.is_depot) {
                                        nodeColor = 'bg-orange-500';
                                        ringColor = 'ring-orange-50';
                                        typeLabel = 'Delivery';
                                    }

                                    const isActive = clickedCardIndex === index;
                                    const arrivalTime = event.arrivalTime;
                                    const twStart = event.timeWindow[0];
                                    const twEnd = event.timeWindow[1];

                                    // Status
                                    let isLate = arrivalTime > twEnd;
                                    let isEarly = arrivalTime < twStart;

                                    return (
                                        <div key={index} className="relative mb-6 last:mb-0">
                                            {/* Node Dot */}
                                            <div className={`absolute left-0 top-3 w-10 h-10 rounded-full border-4 border-white shadow-sm z-10 ${nodeColor} flex items-center justify-center text-sm text-white font-bold`}>
                                                {index + 1}
                                            </div>

                                            {/* Travel Info (between nodes) */}
                                            {index > 0 && (
                                                <div className="ml-14 mb-3 flex items-center gap-3 text-[10px] text-gray-400">
                                                    <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">
                                                        <i className="fas fa-road" />
                                                        {event.distance.toFixed(1)}km
                                                    </span>
                                                    <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">
                                                        <i className="far fa-clock" />
                                                        {event.travelTime.toFixed(1)}h
                                                    </span>
                                                </div>
                                            )}

                                            {/* Wait Time Block - Separated */}
                                            {event.waitTime > 0 && (
                                                <div className="ml-14 mb-3 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg p-2 shadow-sm">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-2">
                                                            <i className="far fa-pause-circle text-orange-600" />
                                                            <div>
                                                                <div className="font-bold text-orange-800 text-[11px]">Wait Required</div>
                                                                <div className="text-[10px] text-orange-600">Wait {event.waitTime.toFixed(1)}h for window</div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-orange-200 px-1.5 py-0.5 rounded text-orange-800 font-bold text-[10px]">+{event.waitTime.toFixed(1)}h</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Card */}
                                            <div
                                                className={`ml-14 bg-white rounded-xl border transition-all duration-200 cursor-pointer
                                                    ${isActive
                                                        ? 'border-blue-500 shadow-md ring-4 ring-blue-50/50'
                                                        : 'border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md'
                                                    }
                                                `}
                                                onClick={() => {
                                                    if (index === 0) {
                                                        setClickedCardIndex(0);
                                                        externalApiRef.current?.clearSegmentHighlight?.();
                                                        externalApiRef.current?.focusNode?.(event.nodeId);
                                                        return;
                                                    }
                                                    setClickedCardIndex(index);
                                                    const prevNodeId = timelineData.events[index - 1].nodeId;
                                                    externalApiRef.current?.highlightSegment(prevNodeId, event.nodeId, selectedRoute || route);
                                                }}
                                            >
                                                <div className="p-3">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-800 text-sm">Node {event.nodeId}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${typeLabel === 'Pickup' ? 'bg-blue-50 text-blue-700' :
                                                                    typeLabel === 'Delivery' ? 'bg-orange-50 text-orange-700' :
                                                                        'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                    {typeLabel}
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-gray-500 mt-0.5">
                                                                {twStart}h - {twEnd}h
                                                            </div>
                                                        </div>
                                                        <div className={`text-right ${isLate ? 'text-red-600' : isEarly ? 'text-orange-500' : 'text-green-600'}`}>
                                                            <div className="font-bold text-xs">{arrivalTime.toFixed(2)}h</div>
                                                            <div className="text-[10px] font-medium">
                                                                {isLate ? 'Late' : isEarly ? 'Early' : 'On Time'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Metrics Grid */}
                                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-50">
                                                        <div className="text-center">
                                                            <div className="text-[10px] text-gray-400 uppercase">Service</div>
                                                            <div className="text-xs font-semibold text-gray-700">{(event.serviceEndTime - event.serviceStartTime).toFixed(1)}h</div>
                                                        </div>
                                                        <div className="text-center border-l border-gray-50">
                                                            <div className="text-[10px] text-gray-400 uppercase">Demand</div>
                                                            <div className={`text-xs font-semibold ${event.demand > 0 ? 'text-blue-600' : event.demand < 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                                                                {event.demand > 0 ? '+' : ''}{event.demand}
                                                            </div>
                                                        </div>
                                                        <div className="text-center border-l border-gray-50">
                                                            <div className="text-[10px] text-gray-400 uppercase">Load</div>
                                                            <div className="text-xs font-semibold text-gray-700">{event.load}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <i className="far fa-calendar-times text-3xl mb-2" />
                                <span className="text-sm">No timeline data</span>
                            </div>
                        )}
                    </div>
                </div>
            </div >
        </div >
    );
};

export default RouteDetailsView;
