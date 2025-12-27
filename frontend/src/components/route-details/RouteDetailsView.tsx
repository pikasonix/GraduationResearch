"use client";
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Map as MapIcon, BarChart3, Clock, Package, TrendingUp, AlertTriangle, CheckCircle, ChevronUp, ChevronDown, ArrowLeft, Route as RouteIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import RouteAnalysisDashboard from '@/components/map/RouteAnalysis';
import type { Instance, Route, Solution } from '@/utils/dataModels';
import dynamic from 'next/dynamic';
const MapComponent = dynamic(() => import('@/components/map/MapboxComponent'), { ssr: false });
const RouteDetailsSidebar = dynamic(() => import('@/components/route-details/RouteDetailsSidebar').then(mod => mod.RouteDetailsSidebar), { ssr: false });
import { createSolution } from '@/utils/dataModels';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFileReader } from '@/hooks/useFileReader';
import { useMapControls } from '@/hooks/useMapControls';
import config from '@/config/config';
import { solverService, type Job } from '@/services/solverService';
import sampleInstance from '@/data/sampleInstance.js';
import { supabase } from '@/supabase/client';
import { useSolutionHistory } from '@/components/route-details/useSolutionHistory';

export interface RouteDetailsViewProps {
    route: Route | any | null;
    instance: Instance | any | null;
    useRealRouting: boolean;
    onToggleRealRouting: () => void;
    showBack?: boolean;
    onBack?: () => void;
    compactTimeline?: boolean;
    // Optional: allow parent to provide all routes for analysis
    allRoutes?: Route[] | any[];
}

function formatWhen(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
}

const getDistanceBetweenPoints = (coord1: [number, number], coord2: [number, number]) => {
    const R = 6371; const dLat = (coord2[0] - coord1[0]) * Math.PI / 180; const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2; const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
};

function calcMetrics(route: any, instance: any) {
    if (!route?.sequence || !instance?.nodes) return null;
    let totalDistance = 0;
    for (let i = 1; i < route.sequence.length; i++) {
        const n1 = instance.nodes.find((n: any) => n.id === route.sequence[i - 1]);
        const n2 = instance.nodes.find((n: any) => n.id === route.sequence[i]);
        if (n1 && n2) totalDistance += getDistanceBetweenPoints(n1.coords, n2.coords);
    }
    return { distance: totalDistance, time: totalDistance / 30, nodes: route.sequence.length };
}

// Route Analysis Component
const RouteAnalysis: React.FC<{
    route: Route | any | null;
    instance: Instance | any | null;
    allRoutes?: Route[] | any[];
    timelineData: any;
}> = ({ route, instance, allRoutes, timelineData }) => {
    if (!route || !instance) {
        return (
            <div className="p-6 text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Chưa có dữ liệu route để phân tích</p>
            </div>
        );
    }

    const metrics = calcMetrics(route, instance);
    const capacity = instance.capacity || 100;

    // Calculate time window compliance
    let onTimeCount = 0;
    let lateCount = 0;
    let earlyCount = 0;
    let totalWaitTime = 0;
    let maxLoad = 0;

    if (timelineData?.events) {
        timelineData.events.forEach((event: any) => {
            if (event.arrivalTime > event.timeWindow[1]) lateCount++;
            else if (event.arrivalTime < event.timeWindow[0]) earlyCount++;
            else onTimeCount++;
            totalWaitTime += event.waitTime || 0;
            if (event.load > maxLoad) maxLoad = event.load;
        });
    }

    const totalNodes = timelineData?.events?.length || 0;
    const complianceRate = totalNodes > 0 ? ((onTimeCount / totalNodes) * 100).toFixed(1) : '0';
    const utilizationRate = capacity > 0 ? ((maxLoad / capacity) * 100).toFixed(1) : '0';

    return (
        <div className="bg-white border-t border-gray-200">
            <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Phân tích Route #{route.id}
                </h3>
            </div>
            <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Distance & Time */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-medium">Quãng đường</span>
                        </div>
                        <div className="text-xl font-bold text-gray-800">{metrics?.distance.toFixed(1)} km</div>
                        <div className="text-xs text-gray-500">~{metrics?.time.toFixed(1)}h di chuyển</div>
                    </div>

                    {/* Time Window Compliance */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Đúng giờ</span>
                        </div>
                        <div className="text-xl font-bold text-gray-800">{complianceRate}%</div>
                        <div className="text-xs text-gray-500">{onTimeCount}/{totalNodes} điểm</div>
                    </div>

                    {/* Wait Time */}
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-orange-600 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-medium">Thời gian chờ</span>
                        </div>
                        <div className="text-xl font-bold text-gray-800">{totalWaitTime.toFixed(1)}h</div>
                        <div className="text-xs text-gray-500">{earlyCount} đến sớm, {lateCount} muộn</div>
                    </div>

                    {/* Capacity Utilization */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-purple-600 mb-1">
                            <Package className="w-4 h-4" />
                            <span className="text-xs font-medium">Sử dụng tải</span>
                        </div>
                        <div className="text-xl font-bold text-gray-800">{utilizationRate}%</div>
                        <div className="text-xs text-gray-500">Max: {maxLoad}/{capacity}</div>
                    </div>
                </div>

                {/* Warnings */}
                {lateCount > 0 && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-700">
                            <strong>{lateCount}</strong> điểm đến muộn so với time window
                        </span>
                    </div>
                )}

                {/* Route Cost */}
                {route.cost && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-gray-600">Tổng chi phí route</span>
                        <span className="text-lg font-bold text-gray-800">{route.cost}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const RouteDetailsView: React.FC<RouteDetailsViewProps> = ({
    route,
    instance: propInstance,
    useRealRouting,
    onToggleRealRouting,
    showBack,
    onBack,
    allRoutes
}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const externalApiRef = useRef<any | null>(null);

    const { solutions: solutionHistory, loading: solutionHistoryLoading, error: solutionHistoryError, organizationId } = useSolutionHistory();
    const lastSolutionId = typeof window !== 'undefined' ? localStorage.getItem('lastSolutionId') : null;

    // Sidebar state
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    // Route analysis collapse state
    const [analysisExpanded, setAnalysisExpanded] = useState(false);

    // Trigger map resize when analysis panel expands/collapses
    useEffect(() => {
        if (externalApiRef?.current?.getMap) {
            const map = externalApiRef.current.getMap();
            if (map) {
                // Use setTimeout to ensure DOM has updated
                setTimeout(() => {
                    try {
                        map.resize();
                    } catch (e) {
                        // Ignore resize errors
                    }
                }, 100);
            }
        }
    }, [analysisExpanded, externalApiRef]);

    // Map/Solver state from hooks
    const { instance: hookInstance, solution: hookSolution, readInstanceFile, readSolutionFile } = useFileReader();
    const { getCacheStats, showCacheInfo, clearRoutingCache, toggleRealRouting } = useMapControls();

    // Use propInstance if available, otherwise use hookInstance
    const instance = propInstance || hookInstance;

    // Load instanceText from localStorage (from /orders page)
    useEffect(() => {
        const encoded = searchParams?.get('data');
        const useCache = searchParams?.get('useCache') === 'true';
        const hasBuilderData =
            typeof window !== 'undefined' &&
            (!!localStorage.getItem('builderInstanceText') || !!localStorage.getItem('builderInputData'));
        const allowCache = useCache || !!encoded || hasBuilderData;
        if (!allowCache) return;

        try {
            const text = localStorage.getItem('builderInstanceText');
            if (text && text.trim() && !propInstance) {
                // Only load if no propInstance provided
                setInstanceText(text);
                const blob = new Blob([text], { type: 'text/plain' });
                const file = new File([blob], 'builder_instance.txt', { type: 'text/plain' });
                readInstanceFile(file).catch((e) => {
                    console.error('Failed to parse builder instance from /orders:', e);
                });
            }
        } catch (e) {
            console.warn('Không thể đọc builderInstanceText từ localStorage', e);
        }
    }, [readInstanceFile, propInstance, searchParams]);

    // Solver parameters state
    const defaultParams = config.defaultParams;
    const [instanceText, setInstanceText] = useState('');
    const [params, setParams] = useState(defaultParams);
    const [loading, setLoading] = useState(false);
    const [jobProgress, setJobProgress] = useState(0);
    const [jobStatus, setJobStatus] = useState<string>('');
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);

    // Route/Map state
    const [selectedNodes, setSelectedNodes] = useState<any[] | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(route || null);
    const [clickedCardIndex, setClickedCardIndex] = useState<number | null>(null);

    // Keep local selectedRoute in sync if parent route changes
    useEffect(() => {
        setSelectedRoute(route || null);
    }, [route]);

    // Load sample instance
    const loadSampleInstance = useCallback(() => {
        setInstanceText(sampleInstance);
        try {
            const file = new File([sampleInstance], 'sample_instance.txt', { type: 'text/plain' });
            readInstanceFile(file).catch((err) => {
                console.error('Failed to parse sample instance:', err);
            });
        } catch (e) {
            console.error('Error loading sample instance:', e);
        }
    }, [readInstanceFile]);

    // Handle instance file change
    const handleInstanceFileChange = useCallback(async (fileOrEvent: File | React.ChangeEvent<HTMLInputElement>) => {
        try {
            let file: File | undefined;
            if ((fileOrEvent as any)?.target && (fileOrEvent as any).target.files) {
                file = (fileOrEvent as React.ChangeEvent<HTMLInputElement>).target.files?.[0];
            } else {
                file = fileOrEvent as File;
            }
            if (!file) return;

            await readInstanceFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                setInstanceText(content || '');
            };
            reader.readAsText(file);
        } catch (error: unknown) {
            console.error('Error reading instance file:', error);
        }
    }, [readInstanceFile, setInstanceText]);

    const handleParamChange = useCallback((name: string, value: unknown) => {
        setParams(prev => ({ ...prev, [name]: value }));
    }, []);

    const loadSolutionFromText = useCallback(async (solutionText: string) => {
        try {
            const currentInst = propInstance || hookInstance;
            if (!currentInst) {
                alert('Vui lòng load instance trước!');
                return;
            }
            const blob = new Blob([solutionText], { type: 'text/plain' });
            const file = new File([blob], 'solution.txt', { type: 'text/plain' });
            await readSolutionFile(file, currentInst);
        } catch (error: any) {
            console.error('Error loading solution:', error);
        }
    }, [propInstance, hookInstance, readSolutionFile]);

    const runInstance = useCallback(async () => {
        if (!instanceText || !instanceText.trim()) {
            alert('Vui lòng nhập nội dung instance!');
            return;
        }

        setLoading(true);
        setJobProgress(0);
        setJobStatus('Đang khởi tạo...');
        setCurrentJobId(null);

        try {
            const metadataRaw = typeof window !== 'undefined' ? localStorage.getItem('routePlanningMetadata') : null;
            const metadata = metadataRaw ? JSON.parse(metadataRaw) : null;
            const inputDataRaw = typeof window !== 'undefined' ? localStorage.getItem('builderInputData') : null;
            const inputData = inputDataRaw ? JSON.parse(inputDataRaw) : null;

            const user = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as any));
            const createdBy = user?.data?.user?.id ?? undefined;
            const organizationId = metadata?.organizationId ?? undefined;

            const result = await solverService.solveInstance(
                instanceText,
                params,
                (job: Job) => {
                    setCurrentJobId(job.jobId);
                    setJobProgress(job.progress);
                    let statusText = 'Đang xử lý...';
                    if (job.status === 'pending') {
                        statusText = 'Đang chờ trong hàng đợi...';
                    } else if (job.status === 'processing') {
                        statusText = `Đang giải (${job.progress}%)`;
                        if (job.cost !== undefined) {
                            statusText += ` - Chi phí: ${job.cost.toFixed(2)}`;
                        }
                    }
                    setJobStatus(statusText);
                }
                , {
                    createdBy,
                    organizationId,
                    inputData,
                });

            try {
                if (result.solutionId) {
                    localStorage.setItem('lastSolutionId', result.solutionId);
                }
            } catch { }

            setJobStatus('Đang tải kết quả...');
            await loadSolutionFromText(result.solutionText);
            setJobStatus('Hoàn thành!');
        } catch (error: any) {
            console.error('Error running instance:', error);
            setJobStatus('Lỗi!');
            alert('Lỗi: ' + (error?.message || error));
        } finally {
            setLoading(false);
            setTimeout(() => {
                setJobStatus('');
                setJobProgress(0);
                setCurrentJobId(null);
            }, 3000);
        }
    }, [instanceText, params, loadSolutionFromText]);

    const resetParameters = useCallback(() => {
        setParams(defaultParams);
    }, [defaultParams]);

    const cancelJob = useCallback(async () => {
        if (!currentJobId) return;
        try {
            await solverService.cancelJob(currentJobId);
            setJobStatus('Đã hủy');
            setLoading(false);
        } catch (error: any) {
            console.error('Error cancelling job:', error);
        }
    }, [currentJobId]);

    // Build a minimal solution object for MapComponent consumption
    const solution: Solution | null = useMemo(() => {
        // If we have hookSolution (from file upload), use it
        if (hookSolution) return hookSolution;

        // If we have allRoutes, create solution with all routes
        if (allRoutes && allRoutes.length > 0 && instance) {
            const routesWithColors = allRoutes.map((r: any, index: number) => ({
                ...r,
                color: r.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`
            }));
            return createSolution(instance?.name || 'instance', 'ref', new Date().toISOString(), 'system', routesWithColors);
        }

        // Fallback to single route
        if (!route) return null;
        const ensuredRoute: Route = { ...route, color: route.color || '#1d4ed8' };
        return createSolution(instance?.name || 'instance', 'ref', new Date().toISOString(), 'system', [ensuredRoute]);
    }, [route, instance?.name, useRealRouting, hookSolution, allRoutes]);

    const filteredInstance: Instance | null = useMemo(() => {
        if (!instance || !route || !Array.isArray(route.sequence)) return instance;
        const idSet = new Set(route.sequence);
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
        const coordsList = route.sequence
            .map((nodeId: number) => instance.nodes.find((n: any) => n.id === nodeId))
            .filter(Boolean)
            .map((node: any) => `${node.coords[0]},${node.coords[1]}`)
            .join('|');

        if (timelineData && typeof window !== 'undefined') {
            sessionStorage.setItem('routingTimelineData', JSON.stringify(timelineData));
        }

        const profile = (typeof window !== 'undefined' && (localStorage.getItem('routingProfile') || 'driving')) || 'driving';
        router.push(`/routing?coords=${encodeURIComponent(coordsList)}&profile=${encodeURIComponent(profile)}`);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar Wrapper - prevents overlap */}
                <div className={`flex-shrink-0 transition-all duration-300 relative ${sidebarCollapsed ? 'w-16' : 'w-80'}`}>
                    <RouteDetailsSidebar
                        instance={instance}
                        solution={solution}
                        onInstanceUpload={handleInstanceFileChange}
                        onSolutionUpload={(file: File) => readSolutionFile(file, instance ?? undefined)}
                        loadSampleInstance={loadSampleInstance}

                        instanceText={instanceText}
                        setInstanceText={setInstanceText}
                        params={params}
                        handleParamChange={handleParamChange}
                        runInstance={runInstance}
                        loading={loading}
                        jobProgress={jobProgress}
                        jobStatus={jobStatus}
                        onCancelJob={cancelJob}
                        resetParameters={resetParameters}
                        collapsed={sidebarCollapsed}
                        onCollapseChange={setSidebarCollapsed}
                    />
                </div>

                {/* Center: Map */}
                <div className="flex-1 bg-gray-50 min-w-0 flex flex-col relative">
                    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                        <Button
                            variant="secondary"
                            onClick={onToggleRealRouting}
                            className={`shadow-md transition-all duration-200 gap-2 h-10 px-4 ${useRealRouting
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 ring-2 ring-blue-100"
                                : "bg-white hover:bg-gray-100 text-gray-700"
                                }`}
                            title={useRealRouting ? "Tắt chế độ đường đi thực tế" : "Bật chế độ đường đi thực tế"}
                        >
                            <RouteIcon className={`w-4 h-4 ${useRealRouting ? "text-white" : "text-gray-500"}`} />
                            <span className="text-sm font-medium">Đường đi thực tế</span>
                        </Button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <MapComponent
                            instance={filteredInstance || instance}
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

                    {/* Route Analysis - moved to bottom with collapse */}
                    <div className="shrink-0 border-t border-gray-200 bg-white">
                        {/* Collapsible Header */}
                        <div
                            className="px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
                            onClick={() => setAnalysisExpanded(!analysisExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-600" />
                                <h3 className="text-sm font-semibold text-gray-800">
                                    Phân tích Route
                                </h3>
                                {solution && solution.routes && (
                                    <span className="text-xs text-gray-500">
                                        ({solution.routes.length} routes)
                                    </span>
                                )}
                            </div>
                            <button
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAnalysisExpanded(!analysisExpanded);
                                }}
                            >
                                {analysisExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                ) : (
                                    <ChevronUp className="w-4 h-4 text-gray-600" />
                                )}
                            </button>
                        </div>

                        {/* Collapsible Content */}
                        {analysisExpanded && (
                            <div className="max-w-7xl mx-auto w-full px-4 py-4 max-h-[60vh] overflow-y-auto">
                                {solution && instance ? (
                                    <RouteAnalysisDashboard
                                        solution={solution}
                                        instance={instance}
                                        onRouteSelect={(route: any, index: number) => {
                                            if (route && solution?.routes?.[index]) {
                                                setSelectedRoute(solution.routes[index]);
                                            }
                                        }}
                                    />
                                ) : (
                                    <RouteAnalysis
                                        route={route}
                                        instance={instance}
                                        allRoutes={allRoutes}
                                        timelineData={timelineData}
                                    />
                                )}
                            </div>
                        )}

                        {/* Compact Summary when collapsed */}
                        {!analysisExpanded && solution && solution.routes && (
                            <div className="px-4 py-3">
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                    <div className="flex items-center gap-4">
                                        <span>
                                            <span className="font-semibold text-gray-800">{solution.routes.length}</span> routes
                                        </span>
                                        {instance && (
                                            <span>
                                                Tổng: <span className="font-semibold text-gray-800">
                                                    {solution.routes.reduce((sum: number, r: any) => {
                                                        const seq = r.sequence || [];
                                                        return sum + (seq.length > 0 ? seq.length - 1 : 0);
                                                    }, 0)}
                                                </span> điểm
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500">Click để xem chi tiết</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar: Timeline */}
                <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
                    <div className="bg-white border-b border-gray-100 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                {searchParams?.get('solutionId') && (
                                    <button
                                        type="button"
                                        onClick={() => router.push('/route-details')}
                                        className="p-1.5 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        title="Quay lại danh sách Solutions"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                )}
                                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                    {route ? 'Timeline' : 'Solutions'}
                                </h3>
                            </div>
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
                                    onClick={() => {
                                        const fromUrl = searchParams?.get('solutionId') || searchParams?.get('solution_id');
                                        const sid = fromUrl || (typeof window !== 'undefined' ? localStorage.getItem('lastSolutionId') : null);
                                        if (sid) {
                                            router.push(`/dispatch?solutionId=${encodeURIComponent(String(sid))}`);
                                            return;
                                        }
                                        router.push('/dispatch');
                                    }}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 text-gray-600 hover:text-blue-600 hover:bg-white hover:shadow-sm"
                                    title="Dispatch"
                                >
                                    <span>Dispatch</span>
                                </button>
                            </div>
                        </div>

                        {/* Route Summary */}
                        {route && metrics && (
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Points</div>
                                    <div className="text-sm font-bold text-gray-800">{metrics.nodes}</div>
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Distance</div>
                                    <div className="text-sm font-bold text-gray-800">{metrics.distance.toFixed(1)} km</div>
                                </div>
                            </div>
                        )}

                        {/* Timeline Summary */}
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
                        {!route ? (
                            <div className="space-y-3">
                                <div className="text-xs text-gray-500">
                                    {organizationId ? `Organization: ${organizationId}` : 'Chưa có organizationId (không tải được lịch sử)'}
                                </div>

                                {solutionHistoryError && (
                                    <div className="p-2 bg-red-50 text-red-600 text-sm rounded">
                                        {solutionHistoryError}
                                    </div>
                                )}

                                {solutionHistoryLoading ? (
                                    <div className="p-2 bg-yellow-50 text-yellow-700 text-sm rounded">
                                        Đang tải lịch sử solution...
                                    </div>
                                ) : solutionHistory.length === 0 ? (
                                    <div className="p-2 bg-white border border-gray-200 rounded text-sm text-gray-600">
                                        Chưa có solution nào để hiển thị.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {solutionHistory.map((s, idx) => {
                                            const isLast = lastSolutionId && String(lastSolutionId) === String(s.id);
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${isLast ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                                                    onClick={() => {
                                                        const base = typeof window !== 'undefined' ? window.location.pathname : '/route-details';
                                                        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
                                                        params.set('solutionId', s.id);
                                                        params.delete('useCache');
                                                        router.push(`${base}?${params.toString()}`);
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-sm font-semibold text-gray-800">
                                                            {s.solution_name || `Solution #${idx + 1}`}
                                                        </div>
                                                        {isLast && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white">
                                                                Mới nhất
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-500">{formatWhen(s.created_at)}</div>
                                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                        <div className="bg-gray-50 border border-gray-100 rounded p-2">
                                                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Cost</div>
                                                            <div className="text-gray-800 font-bold">{Number.isFinite(s.total_cost) ? s.total_cost.toFixed(2) : '0.00'}</div>
                                                        </div>
                                                        <div className="bg-gray-50 border border-gray-100 rounded p-2">
                                                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Vehicles</div>
                                                            <div className="text-gray-800 font-bold">{s.total_vehicles_used}</div>
                                                        </div>
                                                        <div className="bg-gray-50 border border-gray-100 rounded p-2">
                                                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Distance</div>
                                                            <div className="text-gray-800 font-bold">{Number.isFinite(s.total_distance_km) ? s.total_distance_km.toFixed(1) : '0.0'} km</div>
                                                        </div>
                                                        <div className="bg-gray-50 border border-gray-100 rounded p-2">
                                                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Time</div>
                                                            <div className="text-gray-800 font-bold">{Number.isFinite(s.total_time_hours) ? s.total_time_hours.toFixed(1) : '0.0'} h</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : timelineData ? (
                            <div className="relative pl-4">
                                <div className="absolute left-[35px] top-4 bottom-0 w-px bg-gray-200" />

                                {timelineData.events.map((event: TimelineEvent, index: number) => {
                                    const node = filteredInstance?.nodes?.find((n: any) => n.id === event.nodeId);
                                    if (!node) return null;

                                    let nodeColor = 'bg-gray-800';
                                    let typeLabel = 'Depot';
                                    if (node.is_pickup) {
                                        nodeColor = 'bg-blue-600';
                                        typeLabel = 'Pickup';
                                    } else if (!node.is_depot) {
                                        nodeColor = 'bg-orange-500';
                                        typeLabel = 'Delivery';
                                    }

                                    const isActive = clickedCardIndex === index;
                                    const arrivalTime = event.arrivalTime;
                                    const twEnd = event.timeWindow[1];
                                    const twStart = event.timeWindow[0];
                                    let isLate = arrivalTime > twEnd;
                                    let isEarly = arrivalTime < twStart;

                                    return (
                                        <div key={index} className="relative mb-6 last:mb-0">
                                            <div className={`absolute left-0 top-3 w-10 h-10 rounded-full border-4 border-white shadow-sm z-10 ${nodeColor} flex items-center justify-center text-sm text-white font-bold`}>
                                                {index + 1}
                                            </div>

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
            </div>
        </div>
    );
};

export default RouteDetailsView;
