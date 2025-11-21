"use client";

import { Suspense, useState, useCallback, useEffect } from 'react';
import config from '@/config/config';
import type { Instance, Solution, Route, Node } from '@/utils/dataModels';
import dynamic from 'next/dynamic';
import { useFileReader } from '@/hooks/useFileReader';
import sampleInstance from '@/data/sampleInstance.js';
import { useMapControls } from '@/hooks/useMapControls';
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";

// Dynamically import components to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import('@/components/map/MapComponent'), { ssr: false });
const Sidebar = dynamic(() => import('@/components/map/Sidebar'), { ssr: false });
const GuidePage = dynamic(() => import('@/components/map/GuidePage'), { ssr: false });
const AddInstancePage = dynamic(() => import('@/components/add-instance/AddInstanceBuilder'), { ssr: false });
const TrackAsiaTrafficPage = dynamic(() => import('@/components/map/TrackAsiaTrafficPage'), { ssr: false });

type ViewKey = 'map' | 'guide' | 'addInstance' | 'trafficMonitoring' | 'trackAsiaTraffic';
type RouteType = Route | any;

function MapPageClient() {
    const { instance, solution, readInstanceFile, readSolutionFile, setInstance, setSolution } = useFileReader();
    const {
        useRealRouting,
        setUseRealRouting,
        routingCacheRef,
        generateCacheKey,
        loadCacheFromStorage,
        saveCacheToStorage,
        getCacheStats,
        showCacheInfo,
        clearRoutingCache,
        toggleRealRouting
    } = useMapControls();

    const [currentView, setCurrentView] = useState<ViewKey>('map');
    const [selectedNodes, setSelectedNodes] = useState<Node[] | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const loadSampleInstance = useCallback(() => {
        console.log('Sample instance loading...');
        setInstanceText?.(sampleInstance);
        try {
            const file = new File([sampleInstance], 'sample_instance.txt', { type: 'text/plain' });
            readInstanceFile(file).then((inst) => {
                console.log('Sample instance parsed and loaded:', inst?.name);
            }).catch((err) => {
                console.error('Failed to parse sample instance:', err);
            });
        } catch (e) {
            console.error('Error loading sample instance:', e);
        }
    }, [setInstance]);

    const defaultParams = config.defaultParams;
    const [instanceText, setInstanceText] = useState('');
    const [params, setParams] = useState(defaultParams);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        try {
            const text = localStorage.getItem('builderInstanceText');
            if (text && text.trim()) {
                setInstanceText(text);
                const blob = new Blob([text], { type: 'text/plain' });
                const file = new File([blob], 'builder_instance.txt', { type: 'text/plain' });
                readInstanceFile(file).catch((e) => console.error('Failed to parse builder instance:', e));
            }
        } catch (e) {
            console.warn('Không thể đọc builderInstanceText từ localStorage', e);
        }
    }, [readInstanceFile]);

    const handleInstanceFileChange = useCallback(async (fileOrEvent: File | React.ChangeEvent<HTMLInputElement>) => {
        try {
            let file: File | undefined;
            if ((fileOrEvent as any)?.target && (fileOrEvent as any).target.files) {
                file = (fileOrEvent as React.ChangeEvent<HTMLInputElement>).target.files?.[0];
            } else {
                file = fileOrEvent as File;
            }
            if (!file) return;

            const parsedInstance = await readInstanceFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                setInstanceText(content || '');
            };
            reader.readAsText(file);

            console.log('Instance loaded:', parsedInstance?.name);
        } catch (error) {
            console.error('Error reading instance file:', error);
            alert('Error reading instance file: ' + (error as any)?.message || error);
        }
    }, [readInstanceFile, setInstanceText]);

    const handleParamChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setParams(prev => ({ ...prev, [e.target.name]: Number(e.target.value) }));
    }, []);

    const loadSolutionFromText = useCallback(async (solutionText: string) => {
        try {
            console.log('Loading solution from text');
            let retries = 5;
            while (!instance && retries > 0) {
                console.log('Waiting for instance to be available, retries left:', retries);
                await new Promise(resolve => setTimeout(resolve, 200));
                retries--;
            }
            if (!instance) {
                console.error('Instance not loaded after retries');
                alert('Vui lòng load instance trước khi load solution!');
                return;
            }

            const blob = new Blob([solutionText], { type: 'text/plain' });
            const file = new File([blob], 'solution.txt', { type: 'text/plain' });
            const parsedSolution = await readSolutionFile(file, instance);
            console.log('Solution loaded and parsed:', parsedSolution);
            if (parsedSolution && parsedSolution.routes && parsedSolution.routes.length > 0) {
                alert('Giải bài toán thành công! Kết quả đã được hiển thị trên bản đồ.');
            } else {
                console.error('Parsed solution is empty or invalid:', parsedSolution);
                alert('Solution được parse nhưng không có routes hợp lệ.');
            }
        } catch (error: any) {
            console.error('Error loading solution from text:', error);
            alert('Lỗi khi load solution: ' + (error?.message || error));
        }
    }, [instance, readSolutionFile]);

    const runInstance = useCallback(async () => {
        if (!instanceText || !instanceText.trim()) {
            alert('Vui lòng nhập nội dung instance!');
            return;
        }

        setLoading(true);
        try {
            if (!instance) {
                console.log('Instance not parsed yet, parsing now...');
                const blob = new Blob([instanceText], { type: 'text/plain' });
                const file = new File([blob], 'instance.txt', { type: 'text/plain' });
                const parsedInstance = await readInstanceFile(file);
                console.log('Instance parsed successfully:', parsedInstance);
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                console.log('Instance already parsed:', instance?.name);
            }

            console.log('Running instance with params:', params);
            const apiUrl = `${config.api.baseURL}${config.api.basePath}/solve`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance: instanceText, params }),
            });
            const rawBody = await response.text();
            let data: any = null;
            try {
                data = rawBody ? JSON.parse(rawBody) : null;
            } catch (parseError) {
                console.error('Backend returned non-JSON payload:', rawBody);
                throw new Error(`Máy chủ trả về dữ liệu không hợp lệ (status ${response.status}).`);
            }
            console.log('Response from backend:', data);
            if (!response.ok) {
                const message = (data && typeof data === 'object' && 'error' in data)
                    ? (data.error || `Yêu cầu thất bại với mã ${response.status}`)
                    : `Yêu cầu thất bại với mã ${response.status}`;
                throw new Error(message);
            }
            if (data && data.success && data.result) {
                console.log('Solution received, loading into visualizer...');
                await loadSolutionFromText(data.result);
            } else if (data && !data.success) {
                console.error('Backend error:', data.error);
                alert('Lỗi từ backend: ' + (data.error || 'Unknown error'));
            } else {
                console.error('Unexpected backend response:', data);
                alert('Không nhận được kết quả hợp lệ từ backend.');
            }
        } catch (error: any) {
            console.error('Error running instance:', error);
            alert('Lỗi kết nối: ' + (error?.message || error));
        } finally {
            setLoading(false);
        }
    }, [instanceText, instance, params, readInstanceFile, loadSolutionFromText]);

    const resetParameters = useCallback(() => {
        setParams(defaultParams);
    }, [defaultParams]);

    const handleDebugSolution = useCallback(() => {
        if (solution) {
            console.log('Debug solution:', solution);
        }
    }, [solution]);

    const handleDebugInstance = useCallback(() => {
        if (instance) {
            console.log('Debug instance:', instance);
        }
    }, [instance]);

    const toggleSidebar = useCallback(() => {
        setSidebarVisible(prev => !prev);
    }, []);

    const handleViewChange = useCallback((view: string) => {
        setCurrentView(view as ViewKey);
    }, []);

    // Read ?view=... on client without using Next's hook
    useEffect(() => {
        try {
            if (typeof window === 'undefined') return;
            const sp = new URLSearchParams(window.location.search);
            const v = sp.get('view');
            if (v && ['map', 'guide', 'addInstance', 'trafficMonitoring', 'trackAsiaTraffic'].includes(v)) {
                setCurrentView(v as ViewKey);
            }
        } catch {
            // ignore
        }
    }, []);

    // Sync to localStorage for route-details page
    useEffect(() => {
        try {
            const sanitizeRoutes = (routes: any[]) => routes.map(r => ({
                id: r.id,
                sequence: Array.isArray(r.sequence) ? [...r.sequence] : [],
                cost: r.cost ?? null,
                color: r.color ?? null,
                path: Array.isArray(r.path) ? r.path.map((p: any) => Array.isArray(p) ? p : null).filter(Boolean) : []
            }));

            const sanitizeInstance = (inst: any) => inst ? {
                name: inst.name,
                capacity: inst.capacity,
                size: inst.size,
                type: inst.type,
                location: inst.location,
                all_coords: Array.isArray(inst.all_coords) ? inst.all_coords : (Array.isArray(inst.nodes) ? inst.nodes.map((n: any) => n.coords) : []),
                times: Array.isArray(inst.times) ? inst.times : [],
                nodes: Array.isArray(inst.nodes) ? inst.nodes.map((n: any) => ({
                    id: n.id,
                    coords: n.coords,
                    demand: n.demand,
                    time_window: n.time_window,
                    duration: n.duration,
                    is_depot: n.is_depot,
                    is_pickup: n.is_pickup,
                    is_delivery: n.is_delivery,
                    pair: n.pair
                })) : [],
            } : null;

            if (solution?.routes && solution.routes.length > 0) {
                const safeRoutes = sanitizeRoutes(solution.routes);
                localStorage.setItem('allRoutes', JSON.stringify(safeRoutes));
            }
            if (instance) {
                const safeInstance = sanitizeInstance(instance);
                localStorage.setItem('currentInstance', JSON.stringify(safeInstance));
            }
        } catch (e) {
            console.warn('Không thể lưu allRoutes/currentInstance vào localStorage', e);
        }
    }, [solution?.routes, instance]);

    const handleRouteSelect = useCallback((route: RouteType) => {
        try {
            if (route) localStorage.setItem('selectedRoute', JSON.stringify(route));
            if (instance) localStorage.setItem('currentInstance', JSON.stringify(instance));
            window.open(`/route-details/${route.id}`, '_blank');
        } catch (e) { console.error('Cannot open route details page', e); }
    }, [instance]);

    const showMap = useCallback(() => {
        setCurrentView('map');
    }, []);

    const renderCurrentView = () => {
        switch (currentView) {
            case 'guide':
                return <GuidePage onBack={showMap} />;
            case 'addInstance':
                return (
                    <AddInstancePage
                        onBack={showMap}
                        onInstanceLoad={(fileOrObj) => {
                            if (fileOrObj instanceof File) {
                                readInstanceFile(fileOrObj).catch(err => console.error('Failed to parse instance from AddInstancePage:', err));
                            } else if (fileOrObj && 'text' in fileOrObj) {
                                const f = new File([fileOrObj.text], 'instance.txt', { type: 'text/plain' });
                                readInstanceFile(f).catch(err => console.error('Failed to parse instance text from AddInstancePage:', err));
                            }
                        }}
                    />
                );
            case 'trackAsiaTraffic':
                return <TrackAsiaTrafficPage onBack={showMap} />;
            case 'map':
            default:
                return (
                    <div className="map-container">
                        <MapComponent
                            instance={instance}
                            solution={solution}
                            selectedNodes={selectedNodes}
                            setSelectedNodes={setSelectedNodes}
                            selectedRoute={selectedRoute}
                            setSelectedRoute={setSelectedRoute}
                            useRealRouting={useRealRouting}
                            onToggleRealRouting={toggleRealRouting}
                        />
                    </div>
                );
        }
    };

    return (
        <div className="app-container flex h-screen">
            <Suspense fallback={<div className="flex items-center justify-center h-full">Loading map...</div>}>
                {sidebarVisible && (
                    <Sidebar
                        instance={instance}
                        solution={solution}
                        onInstanceUpload={handleInstanceFileChange}
                        onSolutionUpload={(file) => readSolutionFile(file, instance ?? undefined)}
                        onDebugSolution={handleDebugSolution}
                        onDebugInstance={handleDebugInstance}
                        onViewChange={handleViewChange}
                        selectedNodes={selectedNodes || undefined}
                        selectedRoute={selectedRoute}
                        onRouteSelect={handleRouteSelect}
                        useRealRouting={useRealRouting}
                        onToggleRealRouting={toggleRealRouting}
                        getCacheStats={getCacheStats}
                        showCacheInfo={showCacheInfo}
                        clearRoutingCache={clearRoutingCache}
                        instanceText={instanceText}
                        setInstanceText={setInstanceText}
                        params={params}
                        handleParamChange={handleParamChange}
                        runInstance={runInstance}
                        loading={loading}
                        resetParameters={resetParameters}
                        loadSampleInstance={loadSampleInstance}
                        collapsed={sidebarCollapsed}
                        onCollapseChange={setSidebarCollapsed}
                        sidebarVisible={sidebarVisible}
                        toggleSidebar={toggleSidebar}
                    />
                )}

                <div className={`main-content flex-1 relative ${sidebarVisible ? (sidebarCollapsed ? 'ml-16' : 'ml-80') : 'ml-0'}`}>
                    {renderCurrentView()}
                </div>
            </Suspense>
        </div>
    );
}

export default MapPageClient;
