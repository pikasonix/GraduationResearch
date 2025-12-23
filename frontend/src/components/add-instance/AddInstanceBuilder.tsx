"use client";

import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftToLine, MapPinPlus, X, Grid2x2X, Grid2x2Plus, WandSparkles, MapPinXInside, LoaderCircle, FileCode, Download, Play, Link } from 'lucide-react';
import CoordinateInspectorTool from './CoordinateInspectorTool';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot } from 'react-dom/client';

import { NodeRow } from './NodeEditor';
import TimeMatrixControls from './TimeMatrixControls';
import NodeTableInput from './NodeTableInput';
import InstanceSettingsPanel from './InstanceSettingsPanel';
import NodeDetailsPanel from './NodeDetailsPanel';
import { useFileReader } from '@/hooks/useFileReader';
import type { Instance } from '@/utils/dataModels';
import { useRouter } from 'next/navigation';
import config from '@/config/config';

export interface AddInstanceBuilderProps {
    onBack?: () => void;
    onInstanceLoad?: (fileOrInstance: File | { text: string }) => void;
}

const defaultCapacity = 100;

const AddInstanceBuilder: React.FC<AddInstanceBuilderProps> = ({ onBack, onInstanceLoad }) => {
    const router = useRouter();
    // metadata
    // Use a deterministic initial name to avoid SSR/client hydration mismatches.
    // Generate a timestamped name on the client after mount.
    const [instanceData, setInstanceData] = useState(() => ({
        name: 'instance',
        location: '',
        comment: '',
        routeTime: 480,
        timeWindow: 120,
        capacity: defaultCapacity
    }));

    // Set a timestamped name only on the client to avoid hydration mismatch
    useEffect(() => {
        // Only set if the name is still the default placeholder
        if (!instanceData.name || instanceData.name === 'instance') {
            const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            setInstanceData(prev => ({ ...prev, name: `instance-${ts}` }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // node management
    const [nodes, setNodes] = useState<NodeRow[]>([]);
    const nodesRef = useRef<NodeRow[]>([]);
    const [isAddingNode, setIsAddingNode] = useState<boolean>(false);
    const isAddingNodeRef = useRef(false);
    const [editingNode, setEditingNode] = useState<NodeRow | null>(null);
    const editingNodeRef = useRef<NodeRow | null>(null);
    const [nextNodeId, setNextNodeId] = useState<number>(1);

    // time matrix state
    const [timeMatrix, setTimeMatrix] = useState<number[][]>([]);
    const [isGeneratingMatrix, setIsGeneratingMatrix] = useState(false);
    const [matrixGenerationProgress, setMatrixGenerationProgress] = useState(0);
    // File loading state
    const { readInstanceFile } = useFileReader();
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    // (moved) file load handlers are defined after showNotification

    // UI state
    const [notification, setNotification] = useState<null | { type: 'success' | 'error' | 'info', message: string }>(null);
    const [showTableInput, setShowTableInput] = useState(false);
    const [tableData, setTableData] = useState<any[]>([]);
    const [tableDirty, setTableDirty] = useState(false);
    const [isSelectingLocation, setIsSelectingLocation] = useState(false);
    const isSelectingLocationRef = useRef(false);
    const [isPickingNode, setIsPickingNode] = useState(false);
    const isPickingNodeRef = useRef(false);
    const pickPrevCloseRef = useRef<boolean | undefined>(undefined);
    // Link mode state (drag from pickup -> delivery)
    const [isLinkingMode, setIsLinkingMode] = useState(false);
    const isLinkingModeRef = useRef(false);
    // Drag state for linking
    const linkingDragRef = useRef<{ active: boolean; fromId: number | null; tempLine: any | null }>(
        { active: false, fromId: null, tempLine: null }
    );
    const hoveredMarkerIdRef = useRef<number | null>(null);
    const mapDraggingPrevRef = useRef<boolean | null>(null);
    const autoPanLastTsRef = useRef<number>(0);
    // Coordinate inspector tool state
    const [isInspecting, setIsInspecting] = useState(true);
    const isInspectingRef = useRef(false);
    const [inspectHover, setInspectHover] = useState<{ lat: number; lng: number } | null>(null);
    const [inspectPoint, setInspectPoint] = useState<{ x: number; y: number } | null>(null);
    const inspectPopupRef = useRef<mapboxgl.Popup | null>(null);
    const inspectMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [selectedTableRowIndex, setSelectedTableRowIndex] = useState<number | null>(null);
    const selectedRowIndexRef = useRef<number | null>(null);
    const routeTimeRef = useRef<number>(480);

    useEffect(() => { isAddingNodeRef.current = isAddingNode; }, [isAddingNode]);
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { selectedRowIndexRef.current = selectedTableRowIndex; }, [selectedTableRowIndex]);
    useEffect(() => { isSelectingLocationRef.current = isSelectingLocation; }, [isSelectingLocation]);
    useEffect(() => { isPickingNodeRef.current = isPickingNode; }, [isPickingNode]);
    useEffect(() => { editingNodeRef.current = editingNode; }, [editingNode]);
    useEffect(() => { routeTimeRef.current = instanceData.routeTime; }, [instanceData.routeTime]);
    useEffect(() => { isInspectingRef.current = isInspecting; }, [isInspecting]);
    useEffect(() => { isLinkingModeRef.current = isLinkingMode; }, [isLinkingMode]);

    // (moved ESC/mode-off cancel effects below cancelLinkingDrag)

    // search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);

    // map refs
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
    const [mapReady, setMapReady] = useState(false);

    // sync next id based on current nodes (no auto depot)
    useEffect(() => {
        if (nodes.length === 0) {
            setNextNodeId(0);
        } else {
            const maxId = nodes.reduce((m, n) => Math.max(m, n.id), 0);
            setNextNodeId(maxId + 1);
        }
    }, [nodes]);

    const handleNodeClick = useCallback((node: NodeRow) => {
        if (mapInstance.current) {
            mapInstance.current.flyTo({ center: [node.lng, node.lat], zoom: 15 });
        }
    }, []);

    const createSampleInstance = useCallback(() => {
        const sampleNodes: NodeRow[] = [
            { id: 0, type: 'depot', lat: 21.0278, lng: 105.8342, demand: 0, earliestTime: 0, latestTime: 1440, serviceDuration: 0 },
            { id: 1, type: 'pickup', lat: 21.03, lng: 105.835, demand: 5, earliestTime: 60, latestTime: 300, serviceDuration: 10, deliveryId: 2 },
            { id: 2, type: 'delivery', lat: 21.032, lng: 105.837, demand: -5, earliestTime: 80, latestTime: 360, serviceDuration: 10, pickupId: 1 },
            { id: 3, type: 'none', lat: 21.025, lng: 105.83, demand: 3, earliestTime: 0, latestTime: 480, serviceDuration: 5 },
        ];
        setNodes(sampleNodes);
        setInstanceData(prev => ({ ...prev, name: 'sample-instance', location: 'Hanoi', comment: 'Generated sample instance', capacity: 100 }));
        setTimeMatrix([]);
    }, []);

    const generateInstanceFile = useCallback(() => {
        const headerLines: string[] = [];
        headerLines.push(`NAME : ${instanceData.name}`);
        headerLines.push(`LOCATION : ${instanceData.location}`);
        headerLines.push(`COMMENT : PDPTW Instance`);
        headerLines.push(`TYPE : CVRPTW`);
        headerLines.push(`SIZE : ${nodes.length}`);
        headerLines.push(`DISTRIBUTION : CLUSTER`);
        headerLines.push(`DEPOT : ( ${nodes[0]?.lat.toFixed(6)} ${nodes[0]?.lng.toFixed(6)} )`);
        headerLines.push(`ROUTE-TIME : ${instanceData.routeTime}`);
        headerLines.push(`TIME-WINDOW : ${instanceData.timeWindow}`);
        headerLines.push(`CAPACITY : ${instanceData.capacity}`);
        headerLines.push(`NODES`);

        const nodeLines = nodes.map(n => {
            const p = n.pickupId != null ? n.pickupId : 0;
            const d = n.deliveryId != null ? n.deliveryId : 0;
            return `${n.id} ${n.lat.toFixed(6)} ${n.lng.toFixed(6)} ${n.demand} ${n.earliestTime} ${n.latestTime} ${n.serviceDuration} ${p} ${d}`;
        });

        function haversine(a: NodeRow, b: NodeRow) {
            const toRad = (x: number) => (x * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(b.lat - a.lat);
            const dLon = toRad(b.lng - a.lng);
            const lat1 = toRad(a.lat);
            const lat2 = toRad(b.lat);
            const sinDLat = Math.sin(dLat / 2) ** 2;
            const sinDLon = Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.asin(Math.sqrt(sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon));
            const km = R * c;
            const minutes = Math.max(1, Math.round((km / 50) * 60));
            return minutes;
        }

        let edgesMatrix: number[][];
        if (timeMatrix.length === nodes.length && timeMatrix.every(r => r.length === nodes.length)) {
            edgesMatrix = timeMatrix.map(row => row.map(v => Math.max(0, Math.round(v))));
        } else {
            edgesMatrix = nodes.map((from) => nodes.map((to) => (from.id === to.id ? 0 : haversine(from, to))));
        }
        const edgesLines = edgesMatrix.map(row => row.join(' '));
        const footer = ['EDGES', ...edgesLines, 'EOF'];
        return [...headerLines, ...nodeLines, ...footer].join('\n');
    }, [instanceData, nodes, timeMatrix]);

    const downloadInstanceFile = useCallback(() => {
        const text = generateInstanceFile();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${instanceData.name || 'instance'}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }, [generateInstanceFile, instanceData.name]);

    // Navigate to /map with current instance (store in localStorage)
    const goToMapWithInstance = useCallback(() => {
        const text = generateInstanceFile();
        try {
            localStorage.setItem('builderInstanceText', text);
        } catch (e) {
            console.warn('Không thể lưu instance vào localStorage', e);
        }
        router.push('/map?view=map');
    }, [generateInstanceFile, router]);

    const clearAllNodes = useCallback(() => {
        if (window.confirm('Bạn có chắc chắn muốn xóa hết các điểm không?')) {
            setNodes([]);
            setTimeMatrix([]);
        }
    }, []);

    const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
        setNotification({ type, message });
        window.setTimeout(() => setNotification(null), 3000);
    }, []);

    // Map parsed Instance (from reader) to local builder state
    const applyParsedInstance = useCallback((inst: Instance) => {
        const mappedNodes: NodeRow[] = (inst.nodes || []).map(n => {
            const type: NodeRow['type'] = n.is_depot ? 'depot' : n.is_pickup ? 'pickup' : n.is_delivery ? 'delivery' : 'none';
            const pickupId = n.is_delivery && n.pair >= 0 ? n.pair : undefined;
            const deliveryId = n.is_pickup && n.pair >= 0 ? n.pair : undefined;
            return {
                id: n.id,
                type,
                lat: n.coords[0],
                lng: n.coords[1],
                demand: n.demand,
                earliestTime: n.time_window?.[0] ?? 0,
                latestTime: n.time_window?.[1] ?? 480,
                serviceDuration: n.duration ?? 0,
                pickupId,
                deliveryId,
            } as NodeRow;
        }).sort((a, b) => a.id - b.id);

        setNodes(mappedNodes);
        if (inst.times && inst.times.length > 0) {
            setTimeMatrix(inst.times);
        } else {
            setTimeMatrix([]);
        }
        setInstanceData(prev => ({
            ...prev,
            name: inst.name || prev.name,
            location: inst.location || prev.location,
            capacity: inst.capacity || prev.capacity,
        }));
        const focus = mappedNodes.find(n => n.type === 'depot') || mappedNodes[0];
        if (focus && mapInstance.current) {
            try {
                mapInstance.current.flyTo({ center: [focus.lng, focus.lat], zoom: 13 });
            } catch { }
        }
        // keep table in sync if open
        setTableData(mappedNodes.map(n => ({
            id: n.id,
            type: n.type,
            lat: n.lat,
            lng: n.lng,
            demand: n.demand,
            earliestTime: n.earliestTime,
            latestTime: n.latestTime,
            serviceDuration: n.serviceDuration,
            pickupId: n.pickupId || 0,
            deliveryId: n.deliveryId || 0
        })));
        setTableDirty(false);
        showNotification('success', 'Đã load file instance');
    }, [showNotification]);

    const onClickLoadFile = useCallback(() => {
        if (fileInputRef.current) fileInputRef.current.click();
    }, []);

    const onFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.currentTarget.value = '';
        if (!file) return;
        setIsLoadingFile(true);
        try {
            const inst = await readInstanceFile(file);
            applyParsedInstance(inst);
        } catch (err: any) {
            console.error(err);
            showNotification('error', 'Không đọc được file instance');
        } finally {
            setIsLoadingFile(false);
        }
    }, [readInstanceFile, applyParsedInstance, showNotification]);

    // Table helpers
    const createEmptyTableRow = useCallback(() => ({
        id: 0,
        type: 'none',
        lat: 0,
        lng: 0,
        demand: 0,
        earliestTime: 0,
        latestTime: 480,
        serviceDuration: 0,
        pickupId: 0,
        deliveryId: 0
    }), []);

    const addTableRow = useCallback(() => { setTableData(prev => [...prev, createEmptyTableRow()]); setTableDirty(true); }, [createEmptyTableRow]);
    const removeTableRow = useCallback((index: number) => { setTableData(prev => prev.filter((_, i) => i !== index)); setTableDirty(true); }, []);
    const updateTableRow = useCallback((index: number, field: string, value: any) => { setTableData(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r)); setTableDirty(true); }, []);

    const startLocationSelection = useCallback((rowIndex: number) => {
        setIsSelectingLocation(true);
        isSelectingLocationRef.current = true;
        setSelectedTableRowIndex(rowIndex);
        selectedRowIndexRef.current = rowIndex; // Crucial for map click listener

        // Visual feedback
        try {
            if (mapInstance.current) {
                mapInstance.current.getCanvas().style.cursor = 'crosshair';
            }
        } catch { }

        showNotification('info', 'Chọn vị trí trên bản đồ cho dòng ' + (rowIndex + 1));
    }, [showNotification]);

    const stopLocationSelection = useCallback(() => {
        setIsSelectingLocation(false);
        isSelectingLocationRef.current = false;
        // keep the selected row index for potential further edits rather than clearing immediately

        // Restore cursor
        try {
            if (mapInstance.current) {
                mapInstance.current.getCanvas().style.cursor = '';
            }
        } catch { }
    }, []);

    // Start interactive picking of coordinates for currently editing node
    // Start interactive picking of coordinates for currently editing node
    const startPickForEditingNode = useCallback(() => {
        // Change cursor to crosshair
        try {
            if (mapInstance.current) {
                mapInstance.current.getCanvas().style.cursor = 'crosshair';
            }
        } catch { }
        setIsPickingNode(true);
        isPickingNodeRef.current = true;
        showNotification('info', 'Chọn vị trí trên bản đồ cho node này');
    }, [showNotification]);

    // Reverse geocode helper for inspector popup
    const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'vi' } });
            if (!res.ok) return null;
            const data = await res.json();
            return data?.display_name || null;
        } catch {
            return null;
        }
    }, []);

    // Toggle inspector
    const onToggleInspect = useCallback(() => {
        setIsInspecting(prev => {
            const next = !prev;
            if (next) {
                // Turn off other modes
                setIsAddingNode(false);
                setIsLinkingMode(false);
                if (isSelectingLocationRef.current) stopLocationSelection();
                if (isPickingNodeRef.current) setIsPickingNode(false);
            }

            // close any existing inspect popup when turning off
            if (!next && inspectPopupRef.current) {
                try { inspectPopupRef.current.remove(); } catch { }
                inspectPopupRef.current = null;
            }
            if (!next) {
                setInspectHover(null);
                setInspectPoint(null);
            }
            return next;
        });
    }, [stopLocationSelection]);

    // Cancel current linking drag (if any)
    // Cancel current linking drag (if any)
    const cancelLinkingDrag = useCallback((silent = false) => {
        // Remove temp line data
        try {
            (mapInstance.current?.getSource('temp-link-source') as mapboxgl.GeoJSONSource)?.setData({
                type: 'FeatureCollection',
                features: []
            });
        } catch { }

        linkingDragRef.current = { active: false, fromId: null, tempLine: null };

        // restore map dragging
        try {
            const map = mapInstance.current;
            if (map && mapDraggingPrevRef.current !== null) {
                if (mapDraggingPrevRef.current) map.dragPan.enable(); else map.dragPan.disable();
                mapDraggingPrevRef.current = null;
            }
        } catch { }
        if (!silent) showNotification('info', 'Đã hủy nối điểm');
    }, [showNotification]);

    // Cancel linking on ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && linkingDragRef.current.active) {
                e.preventDefault();
                cancelLinkingDrag();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); };
    }, [cancelLinkingDrag]);

    // If user turns off linking mode while dragging, cancel temp line
    useEffect(() => {
        if (!isLinkingMode && linkingDragRef.current.active) {
            cancelLinkingDrag(true);
        }
    }, [isLinkingMode, cancelLinkingDrag]);

    // Complete linking between two nodes, enforcing data model updates
    const finishLinking = useCallback((fromId: number, toId: number) => {
        setNodes(prev => {
            let next = [...prev];
            const fromIdx = next.findIndex(n => n.id === fromId);
            const toIdx = next.findIndex(n => n.id === toId);
            if (fromIdx < 0 || toIdx < 0) return prev;
            const from = next[fromIdx];
            const to = next[toIdx];
            // Validate: from cannot be depot/delivery; to cannot be depot/pickup
            if (from.type === 'depot' || from.type === 'delivery') return prev;
            if (to.type === 'depot' || to.type === 'pickup') return prev;
            // Clear previous links if any
            if (from.deliveryId && from.deliveryId !== toId) {
                next = next.map(n => (n.id === from.deliveryId && n.type === 'delivery') ? { ...n, pickupId: undefined } : n);
            }
            if (to.pickupId && to.pickupId !== fromId) {
                next = next.map(n => (n.id === to.pickupId && n.type === 'pickup') ? { ...n, deliveryId: undefined } : n);
            }
            // Apply type conversions and new link
            // When a pair is created, we force roles: from = pickup, to = delivery.
            // Also sync delivery demand from pickup demand (delivery = -|pickup|).
            const pickupDemand = Math.abs(from.demand ?? 0);
            const newFrom = {
                ...from,
                type: 'pickup' as const,
                demand: pickupDemand,
                deliveryId: toId,
            };
            const newTo = {
                ...to,
                type: 'delivery' as const,
                pickupId: fromId,
                demand: -pickupDemand,
            };
            next[fromIdx] = newFrom;
            next[toIdx] = newTo;
            return next;
        });
        setTimeMatrix([]);
        showNotification('success', `Đã ghép #${fromId} → #${toId}`);
        // clear temp line
        cancelLinkingDrag(true);
        // ensure map dragging restored
        try {
            const map = mapInstance.current;
            if (map && mapDraggingPrevRef.current !== null) {
                if (mapDraggingPrevRef.current) map.dragPan.enable(); else map.dragPan.disable();
                mapDraggingPrevRef.current = null;
            }
        } catch { }
    }, [cancelLinkingDrag, showNotification]);

    const searchLocation = useCallback(async (query: string) => {
        if (!query) return;
        setIsSearching(true);
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const data = await res.json();
            setSearchResults(data || []);
            setShowSearchResults(true);
        } catch (e) { console.error(e); } finally { setIsSearching(false); }
    }, []);
    const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); }, []);
    const selectSearchResult = useCallback((result: any) => {
        setShowSearchResults(false);
        if (!mapInstance.current) return;
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        mapInstance.current.flyTo({ center: [lon, lat], zoom: 14 });
    }, []);
    const clearSearch = useCallback(() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }, []);

    const handleAddNodeAt = useCallback((lat: number, lng: number) => {
        const currentNodes = nodesRef.current;
        const nextIdLocal = currentNodes.length === 0 ? 0 : currentNodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
        const isDepot = nextIdLocal === 0;
        const type = isDepot ? 'depot' : 'none';
        const demand = isDepot ? 0 : 1;
        const serviceDuration = isDepot ? 0 : 5;

        setNodes(prev => [...prev, { id: nextIdLocal, type, lat, lng, demand, earliestTime: 0, latestTime: routeTimeRef.current, serviceDuration }]);

        setNextNodeId(nextIdLocal + 1);
        setTimeMatrix([]);
        if (showTableInput) {
            setTableDirty(false);
        }
        showNotification('success', isDepot ? 'Đã thêm Depot (Kho)' : 'Đã thêm điểm mới');
    }, [showTableInput, showNotification]);

    // Stable ref for handleAddNodeAt to use in persistent listeners
    const handleAddNodeAtRef = useRef(handleAddNodeAt);
    useEffect(() => { handleAddNodeAtRef.current = handleAddNodeAt; }, [handleAddNodeAt]);

    const applyTableData = useCallback(() => {
        const newNodes: NodeRow[] = tableData.map(r => ({
            id: Number(r.id),
            type: r.type || 'none',
            lat: Number(r.lat),
            lng: Number(r.lng),
            demand: Number(r.demand || 0),
            earliestTime: Number(r.earliestTime || 0),
            latestTime: Number(r.latestTime || 480),
            serviceDuration: Number(r.serviceDuration || 0),
            pickupId: r.pickupId ? Number(r.pickupId) : undefined,
            deliveryId: r.deliveryId ? Number(r.deliveryId) : undefined
        }));
        setNodes(newNodes.sort((a, b) => a.id - b.id));
        setTimeMatrix([]);
        setShowTableInput(false);
        showNotification('success', 'Đã áp dụng bảng dữ liệu');
    }, [tableData, showNotification]);

    const loadNodesIntoTable = useCallback(() => {
        setTableData(nodes.map(n => ({
            id: n.id,
            type: n.type,
            lat: n.lat,
            lng: n.lng,
            demand: n.demand,
            earliestTime: n.earliestTime,
            latestTime: n.latestTime,
            serviceDuration: n.serviceDuration,
            pickupId: n.pickupId || 0,
            deliveryId: n.deliveryId || 0
        })));
        setTableDirty(false);
        setShowTableInput(true);
    }, [nodes]);

    // Auto-sync table data from nodes when table is visible and user hasn't modified it
    useEffect(() => {
        if (showTableInput && !tableDirty) {
            setTableData(nodes.map(n => ({
                id: n.id,
                type: n.type,
                lat: n.lat,
                lng: n.lng,
                demand: n.demand,
                earliestTime: n.earliestTime,
                latestTime: n.latestTime,
                serviceDuration: n.serviceDuration,
                pickupId: n.pickupId || 0,
                deliveryId: n.deliveryId || 0
            })));
        }
    }, [nodes, showTableInput, tableDirty]);

    // Mapbox initialization
    useEffect(() => {
        if (typeof window === 'undefined') return;
        console.log("AddInstanceBuilder: Map init effect running");
        if (!mapRef.current) {
            console.error("AddInstanceBuilder: mapRef is null");
            return;
        }
        if (mapInstance.current) {
            console.log("AddInstanceBuilder: mapInstance already exists");
            return;
        }

        const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string) || "";
        if (!token) {
            console.error("AddInstanceBuilder: Missing Mapbox Access Token");
            showNotification('error', 'Thiếu Mapbox Access Token');
            return;
        }
        mapboxgl.accessToken = token;
        console.log("AddInstanceBuilder: Token set, creating map...");

        const initial = nodes[0] || { lat: 21.0278, lng: 105.8342 };

        try {
            mapInstance.current = new mapboxgl.Map({
                container: mapRef.current,
                style: config.mapbox?.style || 'mapbox://styles/mapbox/streets-v12',
                center: [initial.lng, initial.lat], // Mapbox uses [lng, lat]
                zoom: 13,
                pitch: 0,
                bearing: 0,
                antialias: true
            });

            mapInstance.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
            mapInstance.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
            mapInstance.current.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }));

            mapInstance.current.on('load', () => {
                console.log("AddInstanceBuilder: Map loaded");
                setMapReady(true);
                mapInstance.current?.resize();

                // Add source for temp linking line
                if (!mapInstance.current?.getSource('temp-link-source')) {
                    mapInstance.current?.addSource('temp-link-source', {
                        type: 'geojson',
                        data: { type: 'FeatureCollection', features: [] }
                    });
                    mapInstance.current?.addLayer({
                        id: 'temp-link-layer',
                        type: 'line',
                        source: 'temp-link-source',
                        paint: {
                            'line-color': '#22c55e',
                            'line-width': 3,
                            'line-opacity': 0.9,
                            'line-dasharray': [2, 1]
                        }
                    });
                }
            });

            mapInstance.current.on('error', (e) => {
                console.error("AddInstanceBuilder: Mapbox error", e);
            });

            mapInstance.current.on('click', (e) => {
                // Check if click was on a marker (prevent adding node when clicking existing marker)
                if (e.originalEvent) {
                    const target = e.originalEvent.target as HTMLElement;
                    if (target.closest('.mapboxgl-marker') || target.closest('.node-marker')) {
                        return;
                    }
                }

                const { lng, lat } = e.lngLat;

                if (isSelectingLocationRef.current && selectedRowIndexRef.current != null) {
                    const idx = selectedRowIndexRef.current;
                    setTableData(prev => prev.map((r, i) => i === idx ? { ...r, lat, lng } : r));
                    setTableDirty(true);
                    stopLocationSelection();
                } else if (isPickingNodeRef.current && editingNodeRef.current) {
                    const current = editingNodeRef.current;
                    setNodes(prev => prev.map(n => n.id === current!.id ? { ...n, lat, lng } : n));
                    setEditingNode(prev => (prev ? { ...prev, lat, lng } : prev));

                    // Force update popup if exists
                    // (Popup update logic will be handled in marker effect)

                    setIsPickingNode(false);
                    isPickingNodeRef.current = false;
                    showNotification('success', 'Đã chọn tọa độ cho node');

                    // Restore cursor
                    if (mapInstance.current) mapInstance.current.getCanvas().style.cursor = '';
                } else if (isInspectingRef.current) {
                    // Remove previous inspect popup/marker
                    if (inspectPopupRef.current) {
                        inspectPopupRef.current.remove();
                        inspectPopupRef.current = null;
                    }
                    if (inspectMarkerRef.current) {
                        inspectMarkerRef.current.remove();
                        inspectMarkerRef.current = null;
                    }

                    // Create temporary marker
                    const el = document.createElement('div');
                    el.className = 'w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm ring-2 ring-blue-500/30';
                    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                        .setLngLat([lng, lat])
                        .addTo(mapInstance.current!);
                    inspectMarkerRef.current = marker;

                    const popupNode = document.createElement('div');
                    const popup = new mapboxgl.Popup({
                        closeButton: true,
                        closeOnClick: true,
                        maxWidth: '300px',
                        className: 'inspect-popup',
                        offset: 12
                    })
                        .setLngLat([lng, lat])
                        .setDOMContent(popupNode)
                        .addTo(mapInstance.current!);

                    inspectPopupRef.current = popup;

                    const root = createRoot(popupNode);

                    const handleAdd = () => {
                        handleAddNodeAt(lat, lng);
                        popup.remove();
                    };

                    const PopupContent = ({ address, loading }: { address?: string | null, loading?: boolean }) => (
                        <div className="px-1 py-1 font-sans" style={{ minWidth: '220px' }}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-blue-50 text-blue-600 p-1.5 rounded-md">
                                        <MapPinPlus size={16} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">Tọa độ</div>
                                        <div className="font-mono text-xs font-bold text-gray-700 select-all">{lat.toFixed(5)}, {lng.toFixed(5)}</div>
                                    </div>
                                </div>
                                <a
                                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                                    title="Mở Google Maps"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                                </a>
                            </div>

                            <div className="mb-3 pl-0.5">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">Địa chỉ</div>
                                <div className="text-[11px] text-gray-600 leading-snug break-words">
                                    {loading ? (
                                        <div className="flex items-center gap-1.5 text-blue-500 italic">
                                            <LoaderCircle className="animate-spin w-3 h-3" />
                                            <span>Đang tìm...</span>
                                        </div>
                                    ) : (address || <span className="italic text-gray-400">Không tìm thấy địa chỉ</span>)}
                                </div>
                            </div>

                            <button
                                onClick={handleAdd}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <MapPinPlus size={14} />
                                Thêm điểm này
                            </button>
                        </div>
                    );

                    root.render(<PopupContent loading={true} />);

                    reverseGeocode(lat, lng).then(address => {
                        if (inspectPopupRef.current !== popup) return;
                        root.render(<PopupContent address={address} loading={false} />);
                    });

                    popup.on('close', () => {
                        setTimeout(() => root.unmount(), 0);
                        if (inspectMarkerRef.current === marker) {
                            marker.remove();
                            inspectMarkerRef.current = null;
                        }
                    });
                } else if (isAddingNodeRef.current) {
                    // Refactored to use handleAddNodeAt
                    handleAddNodeAt(lat, lng);
                }
            });

            // Mouse move for inspector and linking
            mapInstance.current.on('mousemove', (e) => {
                const { lng, lat } = e.lngLat;
                const { x, y } = e.point;

                // Update inspector state
                if (isInspectingRef.current) {
                    setInspectHover({ lat, lng });
                    setInspectPoint({ x, y });
                }

                // Update temp linking line
                if (isLinkingModeRef.current && linkingDragRef.current.active) {
                    const fromId = linkingDragRef.current.fromId;
                    if (fromId !== null) {
                        const fromNode = nodesRef.current.find(n => n.id === fromId);
                        if (fromNode) {
                            const lineGeoJson: any = {
                                type: 'Feature',
                                geometry: {
                                    type: 'LineString',
                                    coordinates: [[fromNode.lng, fromNode.lat], [lng, lat]]
                                }
                            };
                            (mapInstance.current?.getSource('temp-link-source') as mapboxgl.GeoJSONSource)?.setData(lineGeoJson);
                        }
                    }
                }
            });

            // Cancel linking on mouseup anywhere on map (if not handled by marker)
            mapInstance.current.on('mouseup', () => {
                if (isLinkingModeRef.current && linkingDragRef.current.active) {
                    cancelLinkingDrag(true);
                }
            });

        } catch (e) {
            console.error("Error initializing Mapbox:", e);
            showNotification('error', 'Không thể khởi tạo bản đồ');
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
                setMapReady(false);
            }
        };
    }, [showNotification, stopLocationSelection, cancelLinkingDrag, routeTimeRef]);



    // update markers & lines between paired pickup-delivery
    const pairLinesRef = useRef<mapboxgl.Marker[]>([]); // We'll use Markers (lines) or just GeoJSON layers for lines? 
    // Actually for Mapbox it's better to use a GeoJSON source for all pair lines rather than individual objects if possible, 
    // but for simplicity let's use a GeoJSON source 'pair-lines'

    const popupRootsRef = useRef<Map<number, any>>(new Map());

    // Update Pair Lines (Pickup -> Delivery links)
    useEffect(() => {
        if (!mapInstance.current || !mapReady) return;

        const features: any[] = [];
        nodes.forEach(n => {
            if (n.deliveryId) {
                const target = nodes.find(t => t.id === n.deliveryId);
                if (target) {
                    features.push({
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [[n.lng, n.lat], [target.lng, target.lat]]
                        }
                    });
                }
            }
        });

        const source = mapInstance.current.getSource('pair-lines-source') as mapboxgl.GeoJSONSource;
        if (source) {
            source.setData({ type: 'FeatureCollection', features });
        } else {
            mapInstance.current.addSource('pair-lines-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features }
            });
            mapInstance.current.addLayer({
                id: 'pair-lines-layer',
                type: 'line',
                source: 'pair-lines-source',
                paint: {
                    'line-color': '#3b82f6',
                    'line-width': 2,
                    'line-opacity': 0.6,
                    'line-dasharray': [1, 1]
                }
            }, 'temp-link-layer'); // Below temp link
        }
    }, [nodes, mapReady]);

    // Update Markers
    useEffect(() => {
        if (!mapInstance.current || !mapReady) return;

        const currentIds = new Set(nodes.map(n => n.id));

        // 1. Remove markers no longer in nodes
        markersRef.current.forEach((marker, id) => {
            if (!currentIds.has(id)) {
                marker.remove();
                markersRef.current.delete(id);
                const root = popupRootsRef.current.get(id);
                if (root) {
                    setTimeout(() => root.unmount(), 0);
                    popupRootsRef.current.delete(id);
                }
            }
        });

        // 2. Add or Update markers
        nodes.forEach(n => {
            let marker = markersRef.current.get(n.id);
            const selected = editingNode && editingNode.id === n.id;
            const color = n.type === 'depot' ? '#000000' : n.type === 'pickup' ? '#2563eb' : n.type === 'delivery' ? '#dc2626' : '#6b7280';
            const innerHtml = `<div class="node-marker-inner ${selected ? 'selected' : ''}" style="background:${color};border:2px solid #ffffff;color:#fff;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:11px;font-weight:600;box-shadow:0 0 0 2px ${color}33;cursor:pointer;">${n.id}</div>`;

            if (!marker) {
                // Create DOM element for marker
                const el = document.createElement('div');
                el.className = 'node-marker';
                el.innerHTML = innerHtml;

                // Create Marker
                marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([n.lng, n.lat])
                    .addTo(mapInstance.current!);

                markersRef.current.set(n.id, marker);

                // Popup Logic
                const popupNode = document.createElement('div');
                const popup = new mapboxgl.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    maxWidth: '300px',
                    className: 'node-popup',
                    offset: 15
                }).setDOMContent(popupNode);

                marker.setPopup(popup);

                // Check for 'open' event listener existence to avoid dupes? 
                // Mapbox markers seem to reuse the popup instance.

                popup.on('open', () => {
                    const root = createRoot(popupNode);
                    popupRootsRef.current.set(n.id, root);

                    const freshNode = nodesRef.current.find(node => node.id === n.id) || n;

                    root.render(
                        <NodeDetailsPanel
                            variant="popover"
                            node={freshNode}
                            nodes={nodesRef.current}
                            onUpdate={handleNodeUpdate}
                            onDelete={handleNodeDelete}
                            showNotification={showNotification}
                            onClose={() => popup.remove()}
                            onStartPickCoordinates={startPickForEditingNode}
                        />
                    );
                    setEditingNode(prev => (prev?.id === freshNode.id ? prev : freshNode));
                });

                popup.on('close', () => {
                    const root = popupRootsRef.current.get(n.id);
                    if (root) {
                        setTimeout(() => root.unmount(), 0);
                        popupRootsRef.current.delete(n.id);
                    }
                    setEditingNode(prev => (prev?.id === n.id ? null : prev));
                });

                // Interaction listeners
                el.addEventListener('mousedown', (e) => {

                    if (!isLinkingModeRef.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const freshNode = nodesRef.current.find(node => node.id === n.id);
                    if (!freshNode) return;

                    if (freshNode.type !== 'pickup' && freshNode.type !== 'none') {
                        showNotification('error', 'Điểm bắt đầu phải là pickup hoặc none');
                        return;
                    }
                    popup.remove();
                    linkingDragRef.current = { active: true, fromId: freshNode.id, tempLine: null };
                    if (mapInstance.current) {
                        mapDraggingPrevRef.current = mapInstance.current.dragPan.isEnabled();
                        mapInstance.current.dragPan.disable();
                    }
                });

                el.addEventListener('mouseenter', () => {
                    if (!isLinkingModeRef.current || !linkingDragRef.current.active) return;
                    hoveredMarkerIdRef.current = n.id;
                });

                el.addEventListener('mouseleave', () => {
                    if (hoveredMarkerIdRef.current === n.id) hoveredMarkerIdRef.current = null;
                });

                el.addEventListener('mouseup', (e) => {
                    if (!isLinkingModeRef.current || !linkingDragRef.current.active) return;
                    e.stopPropagation();
                    const st = linkingDragRef.current;
                    if (!st.fromId || st.fromId === n.id) {
                        cancelLinkingDrag();
                        return;
                    }
                    const targetNode = nodesRef.current.find(node => node.id === n.id);
                    if (!targetNode || (targetNode.type !== 'delivery' && targetNode.type !== 'none')) {
                        showNotification('error', 'Điểm kết thúc phải là delivery hoặc none');
                        cancelLinkingDrag(true);
                        return;
                    }
                    finishLinking(st.fromId, n.id);
                });

            } else {
                // Update existing marker
                marker.setLngLat([n.lng, n.lat]);
                const el = marker.getElement();
                if (el.innerHTML !== innerHtml) {
                    el.innerHTML = innerHtml;
                }
            }
        });

    }, [nodes, mapReady, editingNode, showNotification, startPickForEditingNode, finishLinking, cancelLinkingDrag]);

    const handleNodeUpdate = useCallback((updatedNode: NodeRow) => {
        setNodes(prev => {
            let next = prev.map(n => n.id === updatedNode.id ? updatedNode : n);
            // If delivery updated with pickupId ensure corresponding pickup has deliveryId
            if (updatedNode.type === 'delivery' && updatedNode.pickupId) {
                next = next.map(n => (n.id === updatedNode.pickupId && n.type === 'pickup') ? { ...n, deliveryId: updatedNode.id } : n);
            }
            // If pickup updated and deliveryId removed, clear delivery's pickupId
            if (updatedNode.type === 'pickup') {
                if (!updatedNode.deliveryId) {
                    next = next.map(n => (n.type === 'delivery' && n.pickupId === updatedNode.id) ? { ...n, pickupId: undefined } : n);
                }
            }
            return next;
        });
        setEditingNode(null);
        setTimeMatrix([]); // matrix invalidated
        showNotification('success', 'Node updated');
    }, [showNotification]);
    const handleNodeDelete = useCallback((nodeId: number) => {
        setNodes(prev => prev.filter(n => n.id !== nodeId));
        setEditingNode(null);
        setTimeMatrix([]);
        showNotification('info', 'Node deleted');
    }, [showNotification]);
    const updateNode = useCallback((id: number, patch: Partial<NodeRow>) => { setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n)); setTimeMatrix([]); }, []);
    const addNode = useCallback(() => {
        setNodes(prev => {
            const nextIdLocal = prev.length === 0 ? 0 : prev.reduce((m, n) => Math.max(m, n.id), 0) + 1;
            const baseLat = prev[0]?.lat ?? 21.0278;
            const baseLng = prev[0]?.lng ?? 105.8342;
            return [...prev, { id: nextIdLocal, type: 'none', lat: baseLat + 0.001 * (nextIdLocal), lng: baseLng + 0.001 * (nextIdLocal), demand: 1, earliestTime: 0, latestTime: 480, serviceDuration: 5 }];
        });
        setNextNodeId(id => id + 1);
        setTimeMatrix([]);
        if (showTableInput) {
            // resync table from nodes on next render via effect; also consider table clean
            setTableDirty(false);
        }
    }, []);

    // Time matrix generation using Mapbox Matrix API
    const generateTimeMatrix = useCallback(async () => {
        if (nodes.length === 0) return;
        setIsGeneratingMatrix(true);
        setMatrixGenerationProgress(0);
        try {
            const coords = nodes.map(n => `${n.lng.toFixed(6)},${n.lat.toFixed(6)}`).join(';');
            const accessToken = config.mapbox?.accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
            const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}?annotations=duration&access_token=${accessToken}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Mapbox Matrix request failed');
            const data = await res.json();
            if (data.durations && Array.isArray(data.durations)) {
                const matrix: number[][] = data.durations.map((row: number[]) => row.map((v: number) => Math.max(0, Math.round(v / 60))));
                setTimeMatrix(matrix);
                showNotification('success', 'Đã tạo time matrix (Mapbox)');
            } else {
                showNotification('error', 'Mapbox Matrix không trả về durations');
            }
        } catch (e) {
            console.error(e);
            showNotification('error', 'Lỗi tạo time matrix');
        } finally {
            setIsGeneratingMatrix(false);
            setMatrixGenerationProgress(1);
        }
    }, [nodes, showNotification]);

    const clearTimeMatrix = useCallback(() => {
        setTimeMatrix([]);
        showNotification('info', 'Đã xóa time matrix');
    }, [showNotification]);

    const instancePreview = useMemo(() => generateInstanceFile(), [generateInstanceFile]);

    // local UI: collapse left settings sidebar
    const [settingsCollapsed, setSettingsCollapsed] = useState(false);

    return (
        <div className="flex flex-col h-screen">
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${notification.type === 'success' ? 'bg-green-500 text-white' : notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{notification.message}</span>
                        <button onClick={() => setNotification(null)} className="ml-2 text-white">✕</button>
                    </div>
                </div>
            )}
            {/* Tool bar */}
            <div className="bg-white border-b px-4 py-1 flex items-center gap-4">
                {/* Left group: back + name/location */}
                {onBack && (
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onBack}
                            title="Quay về Dashboard"
                            className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
                        >
                            <ArrowLeftToLine className="mr-2" />
                            <span>Dashboard</span>
                        </button>
                        <div className="text-sm w-48 text-gray-600 hidden md:block">
                            <div className="font-medium truncate max-w-[180px]">{instanceData.name}</div>
                            <div className="text-xs truncate max-w-[180px]">{instanceData.location || 'Chưa có địa điểm'}</div>
                        </div>
                    </div>
                )}
                {/* Toolbar */}
                <div className="flex-1 flex justify-start items-center space-x-4">
                    {/* Grouped actions: Add Node / Time Matrix / Sample */}
                    <div className="flex items-center space-x-3 mr-6">
                        <div className="flex items-center space-x-2">
                            {/* Add node */}
                            <button
                                onClick={() => {
                                    setIsAddingNode(v => {
                                        const next = !v;
                                        if (next) {
                                            setIsLinkingMode(false);
                                            setIsInspecting(false);
                                            // Close inspector popup if open
                                            if (inspectPopupRef.current) {
                                                inspectPopupRef.current.remove();
                                                inspectPopupRef.current = null;
                                                setInspectHover(null);
                                                setInspectPoint(null);
                                            }
                                            if (isSelectingLocationRef.current) stopLocationSelection();
                                        }
                                        return next;
                                    });
                                }}
                                title={isAddingNode ? 'Hủy thêm node (click để hủy)' : 'Click để thêm node trên bản đồ'}
                                className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border ${isAddingNode ? 'bg-red-500 border-red-600 text-white' : 'bg-blue-50 border-blue-500 border-2 text-blue-600 hover:bg-blue-100'}`}
                            >
                                {isAddingNode ? <X size={24} /> : <MapPinPlus size={24} />}
                                <span className="text-[12px] mt-1">{isAddingNode ? 'Hủy' : 'Thêm điểm'}</span>
                            </button>

                            {/* Link pickup -> delivery */}
                            <button
                                onClick={() => {
                                    setIsLinkingMode(prev => {
                                        const next = !prev;
                                        if (next) {
                                            setIsAddingNode(false);
                                            setIsInspecting(false);
                                            // Close inspector popup if open
                                            if (inspectPopupRef.current) {
                                                inspectPopupRef.current.remove();
                                                inspectPopupRef.current = null;
                                                setInspectHover(null);
                                                setInspectPoint(null);
                                            }
                                            if (isSelectingLocationRef.current) stopLocationSelection();
                                        }
                                        return next;
                                    });
                                }}
                                title="Kéo từ điểm pickup đến điểm delivery để ghép cặp"
                                className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border ${isLinkingMode ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 border-green-500 hover:bg-green-100'}`}
                            >
                                <Link size={24} />
                                <span className="text-[12px] mt-1">{isLinkingMode ? 'Đang nối' : 'Nối điểm'}</span>
                            </button>

                            {/* Table Input */}
                            <button
                                onClick={() => {
                                    setShowTableInput(v => {
                                        const next = !v;
                                        if (next) {
                                            // opening: load fresh from nodes
                                            setTableData(nodes.map(n => ({
                                                id: n.id,
                                                type: n.type,
                                                lat: n.lat,
                                                lng: n.lng,
                                                demand: n.demand,
                                                earliestTime: n.earliestTime,
                                                latestTime: n.latestTime,
                                                serviceDuration: n.serviceDuration,
                                                pickupId: n.pickupId || 0,
                                                deliveryId: n.deliveryId || 0
                                            })));
                                            setTableDirty(false);
                                        }
                                        return next;
                                    });
                                }}
                                title={showTableInput ? "Đóng bảng" : "Mở bảng"}
                                className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border ${showTableInput ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-50 hover:bg-gray-100 text-purple-600'}`}
                            >
                                {showTableInput ? <Grid2x2X size={24} /> : <Grid2x2Plus size={24} />}
                                <span className="text-[12px] mt-1">{showTableInput ? 'Đóng bảng' : 'Bảng nhập'}</span>
                            </button>

                            {/* Sample Instance */}
                            <button
                                onClick={createSampleInstance}
                                title="Tạo mẫu"
                                className="w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-gray-50 hover:bg-gray-100 text-indigo-600"
                            >
                                <WandSparkles size={24} />
                                <span className="text-[12px] mt-1">Tạo mẫu</span>
                            </button>

                            <div className='border-l-1 border-gray-200 pl-2'>
                                {/* Clear All Nodes */}
                                <button
                                    onClick={clearAllNodes}
                                    disabled={nodes.length === 0}
                                    className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-gray-50 text-red-600 hover:bg-red-500 hover:text-white`}
                                    title="Xóa tất cả nodes"
                                >
                                    <MapPinXInside size={24} />
                                    <span className="text-[12px] mt-1">Xóa hết</span>
                                </button>
                            </div>
                        </div>

                        {/* Coordinate Inspector Tool */}
                        <div className="flex items-center space-x-2">
                            <CoordinateInspectorTool active={isInspecting} onToggle={onToggleInspect} />
                        </div>

                        <TimeMatrixControls
                            nodesLength={nodes.length}
                            isGenerating={isGeneratingMatrix}
                            matrixLength={timeMatrix.length}
                            progress={matrixGenerationProgress}
                            onGenerate={generateTimeMatrix}
                            onClear={clearTimeMatrix}
                        />
                    </div>
                </div>

                {/* Download and Load buttons */}
                <div className="flex items-center space-x-2">
                    {/* Hidden file input for loading instance */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.vrp,.vrptw,.dat,text/plain"
                        className="hidden"
                        onChange={onFileSelected}
                    />
                    <button
                        onClick={onClickLoadFile}
                        disabled={isLoadingFile}
                        className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60`}
                        title="Load file instance để chỉnh sửa tiếp"
                    >
                        {isLoadingFile ? <LoaderCircle size={24} /> : <FileCode size={24} />}
                        <span className="text-[12px] mt-1">Load File</span>
                    </button>
                    <button
                        onClick={downloadInstanceFile}
                        className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-blue-600 text-white hover:bg-blue-700`}
                        title="Tải file instance"
                    >
                        <Download size={24} />
                        <span className="text-[12px] mt-1">Tải xuống</span>
                    </button>
                    <button
                        onClick={goToMapWithInstance}
                        className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-green-600 text-white hover:bg-green-700`}
                        title="Mở /map với instance hiện tại"
                    >
                        <Play size={24} />
                        <span className="text-[12px] mt-1">Load App</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left settings panel (collapsible) */}
                <InstanceSettingsPanel
                    settingsCollapsed={settingsCollapsed}
                    onSetCollapsed={setSettingsCollapsed}
                    isAddingNode={isAddingNode}
                    onToggleAddNode={() => setIsAddingNode(v => !v)}
                    instanceData={instanceData}
                    onUpdateInstance={(patch) => setInstanceData(prev => ({ ...prev, ...patch }))}
                    nodes={nodes}
                    updateNode={updateNode}
                    timeMatrixLength={timeMatrix.length}
                    isGeneratingMatrix={isGeneratingMatrix}
                    matrixGenerationProgress={matrixGenerationProgress}
                    instancePreview={instancePreview}
                    onNodeClick={handleNodeClick}
                />
                {/* Map panel */}
                <div className="flex-1 bg-gray-50 relative">
                    {(isAddingNode || isSelectingLocation || isLinkingMode) && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
                            <div className="flex items-center space-x-2">
                                <i className="fas fa-crosshairs animate-pulse"></i>
                                <span className="font-medium text-xs">
                                    {isAddingNode
                                        ? 'Click vào bản đồ để thêm node'
                                        : isSelectingLocation && selectedTableRowIndex != null
                                            ? `Chọn vị trí cho dòng ${selectedTableRowIndex + 1}`
                                            : 'Kéo từ pickup/none đến delivery/none để ghép cặp'}
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="absolute top-4 right-4 w-80" style={{ zIndex: 9 }}>
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
                                        <button onClick={clearSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                                    )}
                                </div>
                                <button onClick={() => searchLocation(searchQuery)} disabled={!searchQuery || isSearching} className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition-colors">
                                    <i className="fas fa-search"></i>
                                </button>
                            </div>
                            {showSearchResults && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-30">
                                    {searchResults.map((result, index) => (
                                        <div key={index} onClick={() => selectSearchResult(result)} className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">{(result.display_name || '').split(',')[0]}</div>
                                            <div className="text-xs text-gray-500 truncate">{result.display_name}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Live coordinate overlay while inspecting */}
                    {isInspecting && inspectHover && inspectPoint && (
                        <div
                            className="absolute pointer-events-none bg-white border border-gray-300 rounded px-2 py-1 text-[11px] text-gray-800 shadow"
                            style={{ left: (inspectPoint.x + 12) + 'px', top: (inspectPoint.y + 12) + 'px', zIndex: 1000 }}
                        >
                            {inspectHover.lat.toFixed(6)}, {inspectHover.lng.toFixed(6)}
                        </div>
                    )}
                    <div ref={mapRef} className="absolute inset-0 min-h-[800px]" style={{ cursor: (isSelectingLocation || isAddingNode || isInspecting || isLinkingMode) ? 'crosshair' : 'default' }} />
                </div>
                {/* Right node editor panel removed (using popovers on markers instead) */}
            </div>

            {showTableInput && (
                <NodeTableInput
                    rows={tableData}
                    isDirty={tableDirty}
                    isSelecting={isSelectingLocation}
                    selectedIndex={selectedTableRowIndex}
                    onAddRow={addTableRow}
                    onRemoveRow={(index) => removeTableRow(index)}
                    onChangeCell={(index, key, value) => updateTableRow(index, key as any, value)}
                    onApply={applyTableData}
                    onStartPick={(index) => startLocationSelection(index)}
                    onCancelPick={stopLocationSelection}
                    onClose={() => setShowTableInput(false)}
                />
            )}
        </div >
    );
};

export default AddInstanceBuilder;