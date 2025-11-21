"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, Plus, ArrowUpDown, X, ScanSearch, Navigation, Route, List, Clock, GaugeCircle, TrafficCone, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { formatDistance, formatInstructionVI } from './formatters';
import config from '@/config/config';
import { getGeocoder, type Suggestion } from '@/services/geocoding';
import AdvancedRoutingPanel, { type AdvancedOptions } from './AdvancedRoutingPanel';

type Profile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';

const SUGGEST_DEBOUNCE_MS = 600;

export type AnnotationMetrics = {
    durationSec?: number;
    durationSource?: 'annotation' | 'summary';
    distanceM?: number;
    distanceSource?: 'annotation' | 'summary';
    averageSpeedKmh?: number;
    speedSource?: 'segments' | 'computed';
    congestionLevels?: Record<string, number>;
    congestionSampleCount?: number;
};

const CONGESTION_LABELS: Record<string, string> = {
    severe: 'Rất nặng',
    heavy: 'Kẹt xe',
    moderate: 'Đông',
    light: 'Hơi đông',
    low: 'Thưa',
    free: 'Thông thoáng',
    unknown: 'Không rõ'
};

const CONGESTION_COLOR_CLASSES: Record<string, string> = {
    severe: 'bg-red-50 text-red-700 border border-red-200',
    heavy: 'bg-orange-50 text-orange-600 border border-orange-200',
    moderate: 'bg-amber-50 text-amber-600 border border-amber-200',
    light: 'bg-yellow-50 text-yellow-600 border border-yellow-200',
    low: 'bg-lime-50 text-lime-600 border border-lime-200',
    free: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    unknown: 'bg-gray-100 text-gray-600 border border-gray-200'
};

const CONGESTION_ORDER: Record<string, number> = {
    severe: 0,
    heavy: 1,
    moderate: 2,
    light: 3,
    low: 4,
    free: 5,
    unknown: 6
};

const formatEta = (sec: number): string => {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00:00';
    const totalSeconds = Math.round(sec);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

type ControlsPanelProps = {
    profile: Profile;
    setProfile: (p: Profile) => void;
    isRouting: boolean;
    calculateRoute: (advancedOptions?: AdvancedOptions) => void;
    instructions: any[];
    routeSummary: { distanceKm: number; durationMin: number } | null;
    selectedAnnotations: string[];
    annotationMetrics: AnnotationMetrics;
    routeAlternatives: Array<{
        index: number;
        distanceKm: number;
        durationMin: number;
        summary: string;
    }>;
    selectedRouteIndex: number;
    onSelectRoute: (idx: number) => void;
    activeStepIdx: number | null;
    focusStep: (idx: number) => void;
    onStartGuidance: () => void;
    startPoint: { lat: number; lng: number } | null;
    endPoint: { lat: number; lng: number } | null;
    waypoints: Array<{ lat: number; lng: number }>;
    startLabel?: string;
    endLabel?: string;
    waypointLabels?: string[];
    setWaypointLabels: React.Dispatch<React.SetStateAction<string[]>>;
    setStartPoint: (p: { lat: number; lng: number } | null) => void;
    setEndPoint: (p: { lat: number; lng: number } | null) => void;
    setWaypoints: (wps: Array<{ lat: number; lng: number }>) => void;
    onPickStart: () => void;
    onPickEnd: () => void;
    onPickWaypoint: (index: number) => void;
    focusOnCoordinate: (coords: { lat: number; lng: number }) => void;
};

// Move SortableWaypoint outside of ControlsPanel
const SortableWaypoint: React.FC<{
    idStr: string;
    idx: number;
    txt: string;
    waypoints: Array<{ lat: number; lng: number }>;
    setWaypoints: (wps: Array<{ lat: number; lng: number }>) => void;
    waypointTexts: string[];
    setWaypointTexts: React.Dispatch<React.SetStateAction<string[]>>;
    isEditingWaypoint: boolean[];
    setIsEditingWaypoint: React.Dispatch<React.SetStateAction<boolean[]>>;
    loadingWaypoint: boolean[];
    setLoadingWaypoint: React.Dispatch<React.SetStateAction<boolean[]>>;
    waypointSugs: Record<number, Suggestion[]>;
    setWaypointSugs: React.Dispatch<React.SetStateAction<Record<number, Suggestion[]>>>;
    onPickWaypoint: (idx: number) => void;
    onRemoveWaypoint: (idx: number) => void;
    onSearchWaypoint: (idx: number) => void;
    onChangeWaypointText: (idx: number, val: string) => void;
    dragOverId: string | null;
    isDragging: boolean;
    geocodeSuggest: (query: string) => Promise<Suggestion[]>;
    waypointTimerRef: React.MutableRefObject<Record<number, number>>;
    waypointPendingQueryRef: React.MutableRefObject<Record<number, string>>;
    focusOnCoordinate: (coords: { lat: number; lng: number }) => void;
}> = React.memo(({
    idStr, idx, txt, waypoints, setWaypoints, waypointTexts, setWaypointTexts,
    isEditingWaypoint, setIsEditingWaypoint, loadingWaypoint, setLoadingWaypoint,
    waypointSugs, setWaypointSugs, onPickWaypoint, onRemoveWaypoint, onSearchWaypoint,
    onChangeWaypointText, dragOverId, isDragging, geocodeSuggest,
    waypointTimerRef, waypointPendingQueryRef, focusOnCoordinate
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging: itemIsDragging } = useSortable({
        id: idStr,
        disabled: !!isEditingWaypoint[idx]
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: itemIsDragging ? 0.5 : 1,
        zIndex: itemIsDragging ? 1000 : 1,
    };

    const isDropTarget = dragOverId === idStr && isDragging;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 transition-all duration-200 ${isDropTarget ? 'bg-blue-50 border border-blue-300 rounded-lg shadow-md' : ''} ${itemIsDragging ? 'shadow-lg' : ''}`}
        >
            <button
                className={`p-1 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 transition-colors ${itemIsDragging ? 'bg-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kéo để sắp xếp"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} />
            </button>
            <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold flex items-center justify-center" title={`Trung gian ${idx + 2}`}>
                {idx + 2}
            </div>
            <div className="relative flex-1">
                <input
                    className="w-full border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Điểm trung gian hoặc Lat,Lng"
                    value={txt}
                    onFocus={() => setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? true : v))}
                    onBlur={() => setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v))}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChangeWaypointText(idx, val);
                        const trimmed = val.trim();
                        waypointPendingQueryRef.current[idx] = trimmed;
                        const prevT = waypointTimerRef.current[idx];
                        if (prevT) window.clearTimeout(prevT);
                        waypointTimerRef.current[idx] = window.setTimeout(async () => {
                            const query = waypointPendingQueryRef.current[idx];
                            if (!query || query.length < 2) {
                                setWaypointSugs((m) => ({ ...m, [idx]: [] }));
                                return;
                            }
                            const sugs = await geocodeSuggest(query);
                            if (waypointPendingQueryRef.current[idx] === query) {
                                setWaypointSugs((m) => ({ ...m, [idx]: sugs }));
                            }
                        }, SUGGEST_DEBOUNCE_MS);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onSearchWaypoint(idx);
                        }
                    }}
                />
                {(waypointSugs[idx]?.length || 0) > 0 && (
                    <div className="absolute top-full left-0 right-20 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[500] max-h-56 overflow-auto">
                        {(waypointSugs[idx] || []).map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                    const next = [...waypoints];
                                    next[idx] = { lat: s.center[1], lng: s.center[0] };
                                    setWaypoints(next);
                                    setWaypointTexts(prev => prev.map((t, i) => i === idx ? s.place_name : t));
                                    setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
                                    setWaypointSugs((m) => ({ ...m, [idx]: [] }));
                                }}
                            >
                                {s.place_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-2 rounded-md flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50"
                onClick={() => {
                    setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
                    onPickWaypoint(idx);
                }}
                title="Chọn trên bản đồ"
                disabled={loadingWaypoint[idx]}
            >
                {loadingWaypoint[idx] ? (
                    <span className="animate-pulse">...</span>
                ) : (
                    <MapPin size={14} />
                )}
            </button>
            <button
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-md flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                    const point = waypoints[idx];
                    if (point) focusOnCoordinate(point);
                }}
                title="Phóng tới vị trí điểm trung gian"
                disabled={loadingWaypoint[idx] || !waypoints[idx]}
            >
                {loadingWaypoint[idx] ? (
                    <span className="animate-pulse">Đang tìm...</span>
                ) : (
                    <><ScanSearch size={14} /> Tìm</>
                )}
            </button>
            <button
                className="shrink-0 bg-red-500 hover:bg-red-600 text-white text-xs px-2.5 py-2 rounded-md flex items-center transition-colors"
                onClick={() => onRemoveWaypoint(idx)}
                title="Xóa điểm này"
            >
                <X size={14} />
            </button>
        </div>
    );
});

SortableWaypoint.displayName = 'SortableWaypoint';

// Move SortableStartRow outside of ControlsPanel
const SortableStartRow: React.FC<{
    startText: string;
    setStartText: React.Dispatch<React.SetStateAction<string>>;
    setStartPoint: (p: { lat: number; lng: number } | null) => void;
    isEditingStart: boolean;
    setIsEditingStart: React.Dispatch<React.SetStateAction<boolean>>;
    loadingStart: boolean;
    startSugs: Suggestion[];
    setStartSugs: React.Dispatch<React.SetStateAction<Suggestion[]>>;
    onPickStart: () => void;
    onSearchStart: () => void;
    dragOverId: string | null;
    isDragging: boolean;
    geocodeSuggest: (query: string) => Promise<Suggestion[]>;
    startTimerRef: React.MutableRefObject<number | null>;
    startPendingQueryRef: React.MutableRefObject<string>;
    currentPoint: { lat: number; lng: number } | null;
    focusOnCoordinate: (coords: { lat: number; lng: number }) => void;
}> = React.memo(({
    startText, setStartText, setStartPoint, isEditingStart, setIsEditingStart,
    loadingStart, startSugs, setStartSugs, onPickStart, onSearchStart,
    dragOverId, isDragging, geocodeSuggest, startTimerRef, startPendingQueryRef,
    currentPoint, focusOnCoordinate
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging: itemIsDragging } = useSortable({
        id: 'start',
        disabled: isEditingStart
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: itemIsDragging ? 0.5 : 1,
        zIndex: itemIsDragging ? 1000 : 1
    };

    const isDropTarget = dragOverId === 'start' && isDragging;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 transition-all duration-200 ${isDropTarget ? 'bg-blue-50 border border-blue-300 rounded-lg shadow-md' : ''} ${itemIsDragging ? 'shadow-lg' : ''}`}
        >
            <button
                className={`p-1 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 transition-colors ${itemIsDragging ? 'bg-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kéo để sắp xếp"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} />
            </button>
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center" title="Điểm đầu">
                1
            </div>
            <div className="relative flex-1">
                <input
                    className="w-full border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Nhập địa chỉ hoặc Lat,Lng (ví dụ: 21.0278, 105.8342)"
                    value={startText}
                    onFocus={() => setIsEditingStart(true)}
                    onBlur={() => setIsEditingStart(false)}
                    onChange={(e) => {
                        const val = e.target.value;
                        setStartText(val);
                        const trimmed = val.trim();
                        startPendingQueryRef.current = trimmed;
                        if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
                        startTimerRef.current = window.setTimeout(async () => {
                            const query = startPendingQueryRef.current;
                            if (!query || query.length < 2) {
                                setStartSugs([]);
                                return;
                            }
                            const sugs = await geocodeSuggest(query);
                            if (startPendingQueryRef.current === query) setStartSugs(sugs);
                        }, SUGGEST_DEBOUNCE_MS);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onSearchStart();
                        }
                    }}
                />
                {startSugs.length > 0 && (
                    <div className="absolute top-full left-0 right-16 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[500] max-h-56 overflow-auto">
                        {startSugs.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                    setStartPoint({ lat: s.center[1], lng: s.center[0] });
                                    setStartText(s.place_name);
                                    setIsEditingStart(false);
                                    setStartSugs([]);
                                }}
                            >
                                {s.place_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-2 rounded-md flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50"
                onClick={() => {
                    setIsEditingStart(false);
                    onPickStart();
                }}
                title="Chọn trên bản đồ"
                disabled={loadingStart}
            >
                {loadingStart ? (
                    <span className="animate-pulse">...</span>
                ) : (
                    <MapPin size={14} />
                )}
            </button>
            <button
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-md flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => { if (currentPoint) focusOnCoordinate(currentPoint); }}
                title="Phóng tới điểm bắt đầu"
                disabled={loadingStart || !currentPoint}
            >
                {loadingStart ? (
                    <span className="animate-pulse">Đang tìm...</span>
                ) : (
                    <><ScanSearch size={14} /> Tìm</>
                )}
            </button>
        </div>
    );
});

SortableStartRow.displayName = 'SortableStartRow';

// Move SortableEndRow outside of ControlsPanel
const SortableEndRow: React.FC<{
    endText: string;
    setEndText: React.Dispatch<React.SetStateAction<string>>;
    setEndPoint: (p: { lat: number; lng: number } | null) => void;
    isEditingEnd: boolean;
    setIsEditingEnd: React.Dispatch<React.SetStateAction<boolean>>;
    loadingEnd: boolean;
    endSugs: Suggestion[];
    setEndSugs: React.Dispatch<React.SetStateAction<Suggestion[]>>;
    onPickEnd: () => void;
    onSearchEnd: () => void;
    dragOverId: string | null;
    isDragging: boolean;
    waypoints: Array<{ lat: number; lng: number }>;
    geocodeSuggest: (query: string) => Promise<Suggestion[]>;
    endTimerRef: React.MutableRefObject<number | null>;
    endPendingQueryRef: React.MutableRefObject<string>;
    currentPoint: { lat: number; lng: number } | null;
    focusOnCoordinate: (coords: { lat: number; lng: number }) => void;
}> = React.memo(({
    endText, setEndText, setEndPoint, isEditingEnd, setIsEditingEnd,
    loadingEnd, endSugs, setEndSugs, onPickEnd, onSearchEnd,
    dragOverId, isDragging, waypoints, geocodeSuggest, endTimerRef, endPendingQueryRef,
    currentPoint, focusOnCoordinate
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging: itemIsDragging } = useSortable({
        id: 'end',
        disabled: isEditingEnd
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: itemIsDragging ? 0.5 : 1,
        zIndex: itemIsDragging ? 1000 : 1
    };

    const isDropTarget = dragOverId === 'end' && isDragging;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 transition-all duration-200 ${isDropTarget ? 'bg-blue-50 border border-blue-300 rounded-lg shadow-md' : ''} ${itemIsDragging ? 'shadow-lg' : ''}`}
        >
            <button
                className={`p-1 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 transition-colors ${itemIsDragging ? 'bg-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kéo để sắp xếp"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} />
            </button>
            <div className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center" title="Điểm cuối">
                {waypoints.length + 2}
            </div>
            <div className="relative flex-1">
                <input
                    className="w-full border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Nhập địa chỉ hoặc Lat,Lng"
                    value={endText}
                    onFocus={() => setIsEditingEnd(true)}
                    onBlur={() => setIsEditingEnd(false)}
                    onChange={(e) => {
                        const val = e.target.value;
                        setEndText(val);
                        const trimmed = val.trim();
                        endPendingQueryRef.current = trimmed;
                        if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
                        endTimerRef.current = window.setTimeout(async () => {
                            const query = endPendingQueryRef.current;
                            if (!query || query.length < 2) {
                                setEndSugs([]);
                                return;
                            }
                            const sugs = await geocodeSuggest(query);
                            if (endPendingQueryRef.current === query) setEndSugs(sugs);
                        }, SUGGEST_DEBOUNCE_MS);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onSearchEnd();
                        }
                    }}
                />
                {endSugs.length > 0 && (
                    <div className="absolute top-full left-0 right-16 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[500] max-h-56 overflow-auto">
                        {endSugs.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                    setEndPoint({ lat: s.center[1], lng: s.center[0] });
                                    setEndText(s.place_name);
                                    setIsEditingEnd(false);
                                    setEndSugs([]);
                                }}
                            >
                                {s.place_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-2 rounded-md flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50"
                onClick={() => {
                    setIsEditingEnd(false);
                    onPickEnd();
                }}
                title="Chọn trên bản đồ"
                disabled={loadingEnd}
            >
                {loadingEnd ? (
                    <span className="animate-pulse">...</span>
                ) : (
                    <MapPin size={14} />
                )}
            </button>
            <button
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-md flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => { if (currentPoint) focusOnCoordinate(currentPoint); }}
                title="Phóng tới điểm kết thúc"
                disabled={loadingEnd || !currentPoint}
            >
                {loadingEnd ? (
                    <span className="animate-pulse">Đang tìm...</span>
                ) : (
                    <><ScanSearch size={14} /> Tìm</>
                )}
            </button>
        </div>
    );
});

SortableEndRow.displayName = 'SortableEndRow';

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
    profile, setProfile, isRouting, calculateRoute, instructions, routeSummary,
    selectedAnnotations, annotationMetrics, routeAlternatives, selectedRouteIndex, onSelectRoute,
    activeStepIdx, focusStep, onStartGuidance,
    startPoint, endPoint, waypoints, startLabel, endLabel, waypointLabels, setWaypointLabels,
    setStartPoint, setEndPoint, setWaypoints,
    onPickStart, onPickEnd, onPickWaypoint, focusOnCoordinate,
}) => {
    // Panel collapse state
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    // Local input texts for search boxes
    const [startText, setStartText] = useState<string>("");
    const [endText, setEndText] = useState<string>("");
    const [waypointTexts, setWaypointTexts] = useState<string[]>([]);
    // Stable ids for waypoints to avoid key/index issues when reordering
    const [waypointIds, setWaypointIds] = useState<string[]>([]);
    const wpIdCounter = useRef(0);
    // Editing guards to avoid overwriting while user is typing
    const [isEditingStart, setIsEditingStart] = useState<boolean>(false);
    const [isEditingEnd, setIsEditingEnd] = useState<boolean>(false);
    const [isEditingWaypoint, setIsEditingWaypoint] = useState<boolean[]>([]);
    // Loading flags for geocoding
    const [loadingStart, setLoadingStart] = useState<boolean>(false);
    const [loadingEnd, setLoadingEnd] = useState<boolean>(false);
    const [loadingWaypoint, setLoadingWaypoint] = useState<boolean[]>([]);
    // Suggestion lists
    const [startSugs, setStartSugs] = useState<Suggestion[]>([]);
    const [endSugs, setEndSugs] = useState<Suggestion[]>([]);
    const [waypointSugs, setWaypointSugs] = useState<Record<number, Suggestion[]>>({});
    // Enhanced drag state tracking
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    // Debounce timers
    const startTimerRef = useRef<number | null>(null);
    const endTimerRef = useRef<number | null>(null);
    const waypointTimerRef = useRef<Record<number, number>>({});
    const startPendingQueryRef = useRef<string>("");
    const endPendingQueryRef = useRef<string>("");
    const waypointPendingQueryRef = useRef<Record<number, string>>({});
    const prevWaypointLabelsRef = useRef<string[]>([]);

    const normalizedSelectedAnnotations = useMemo(() => {
        if (!Array.isArray(selectedAnnotations) || selectedAnnotations.length === 0) {
            return ['duration', 'distance', 'speed'];
        }
        const unique = Array.from(new Set(selectedAnnotations.map((val) => (typeof val === 'string' ? val : '')).filter(Boolean)));
        return unique.length > 0 ? unique : ['duration', 'distance', 'speed'];
    }, [selectedAnnotations]);

    const {
        durationSec,
        durationSource,
        distanceM,
        distanceSource,
        averageSpeedKmh,
        speedSource,
        congestionLevels,
        congestionSampleCount
    } = annotationMetrics || {};

    const wantsDuration = normalizedSelectedAnnotations.includes('duration');
    const wantsDistance = normalizedSelectedAnnotations.includes('distance');
    const wantsSpeed = normalizedSelectedAnnotations.includes('speed');
    const wantsCongestion = normalizedSelectedAnnotations.includes('congestion');

    const sortedCongestionEntries = useMemo(() => {
        if (!wantsCongestion || !congestionLevels) return [] as Array<[string, number]>;
        return Object.entries(congestionLevels)
            .map(([level, count]) => [level.toLowerCase(), count] as [string, number])
            .sort((a, b) => (CONGESTION_ORDER[a[0]] ?? 99) - (CONGESTION_ORDER[b[0]] ?? 99));
    }, [wantsCongestion, congestionLevels]);

    const durationMinutes = useMemo(() => {
        if (!routeSummary || !wantsDuration) return null;
        if (typeof durationSec === 'number' && Number.isFinite(durationSec)) return durationSec / 60;
        return routeSummary.durationMin;
    }, [routeSummary, wantsDuration, durationSec]);

    const distanceMeters = useMemo(() => {
        if (!routeSummary || !wantsDistance) return null;
        if (typeof distanceM === 'number' && Number.isFinite(distanceM)) return distanceM;
        return routeSummary.distanceKm * 1000;
    }, [routeSummary, wantsDistance, distanceM]);

    const speedValueKmh = useMemo(() => {
        if (!routeSummary || !wantsSpeed) return null;
        if (typeof averageSpeedKmh === 'number' && Number.isFinite(averageSpeedKmh)) return averageSpeedKmh;
        const distanceVal = typeof distanceM === 'number' && Number.isFinite(distanceM) ? distanceM : routeSummary.distanceKm * 1000;
        const durationVal = typeof durationSec === 'number' && Number.isFinite(durationSec) ? durationSec : routeSummary.durationMin * 60;
        if (!durationVal || durationVal <= 0) return null;
        const derived = (distanceVal / durationVal) * 3.6;
        return Number.isFinite(derived) && derived > 0 ? derived : null;
    }, [routeSummary, wantsSpeed, averageSpeedKmh, distanceM, durationSec]);

    const totalCongestionSegments = useMemo(() => {
        if (!wantsCongestion) return 0;
        if (typeof congestionSampleCount === 'number' && congestionSampleCount > 0) return congestionSampleCount;
        return sortedCongestionEntries.reduce((sum, [, count]) => sum + count, 0);
    }, [wantsCongestion, congestionSampleCount, sortedCongestionEntries]);

    const durationSubtitle = durationSource === 'annotation'
        ? 'Theo dữ liệu annotation của Mapbox'
        : durationSource === 'summary'
            ? 'Theo tổng tuyến'
            : undefined;

    const distanceSubtitle = distanceSource === 'annotation'
        ? 'Theo dữ liệu annotation của Mapbox'
        : distanceSource === 'summary'
            ? 'Theo tổng tuyến'
            : undefined;

    const speedSubtitle = speedSource === 'segments'
        ? 'Theo tốc độ từng đoạn (Mapbox)'
        : speedSource === 'computed'
            ? 'Tính từ quãng đường & thời gian'
            : undefined;

    const speedDisplay = useMemo(() => {
        if (!wantsSpeed || speedValueKmh == null || typeof speedValueKmh !== 'number' || !Number.isFinite(speedValueKmh)) return null;
        const fixed = speedValueKmh >= 100 ? speedValueKmh.toFixed(0) : speedValueKmh.toFixed(1);
        return `${fixed} km/h`;
    }, [wantsSpeed, speedValueKmh]);

    const showSupplementalSection = !!routeSummary && (wantsDuration || wantsDistance || wantsSpeed || wantsCongestion);
    const showMetricCards = wantsDuration || wantsDistance || wantsSpeed;

    const handleCalculateRoute = useCallback((advancedOptions?: AdvancedOptions) => {
        calculateRoute(advancedOptions);
    }, [calculateRoute]);

    useEffect(() => {
        return () => {
            if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
            if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
            Object.values(waypointTimerRef.current).forEach((id) => window.clearTimeout(id));
        };
    }, []);

    // Ensure waypointIds length tracks waypointTexts length and is stable
    useEffect(() => {
        setWaypointIds((prev) => {
            const needed = waypointTexts.length;
            const current = prev.length;

            if (needed === current) return prev;

            if (needed > current) {
                // Add new IDs
                const newIds = [...prev];
                for (let i = current; i < needed; i++) {
                    newIds.push(`wp-${++wpIdCounter.current}`);
                }
                return newIds;
            } else {
                // Remove excess IDs
                return prev.slice(0, needed);
            }
        });
    }, [waypointTexts.length]);

    // Initialize texts from coords when coming from map or first mount
    useEffect(() => {
        if (isEditingStart) return;
        if (startLabel && startLabel.trim() && startText !== startLabel) {
            setStartText(startLabel);
            return;
        }
        if (startPoint && !startText) {
            const coords = `${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`;
            if (startText !== coords) setStartText(coords);
        }
    }, [startPoint?.lat, startPoint?.lng, startLabel, isEditingStart, startText]);

    useEffect(() => {
        if (isEditingEnd) return;
        if (endLabel && endLabel.trim() && endText !== endLabel) {
            setEndText(endLabel);
            return;
        }
        if (endPoint && !endText) {
            const coords = `${endPoint.lat.toFixed(6)}, ${endPoint.lng.toFixed(6)}`;
            if (endText !== coords) setEndText(coords);
        }
    }, [endPoint?.lat, endPoint?.lng, endLabel, isEditingEnd, endText]);

    useEffect(() => {
        const previousLabels = prevWaypointLabelsRef.current;
        setWaypointTexts((prev) => {
            const next: string[] = new Array(waypoints.length).fill("");
            for (let i = 0; i < waypoints.length; i++) {
                const editing = isEditingWaypoint[i];
                const current = prev[i] ?? "";
                const label = waypointLabels?.[i]?.trim();
                const prevLabelRaw = previousLabels[i];
                const prevLabel = prevLabelRaw ? prevLabelRaw.trim() : "";
                const coords = waypoints[i];
                const fallback = coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "";

                if (editing) {
                    next[i] = current;
                    continue;
                }

                if (label) {
                    const labelChanged = label !== prevLabel;
                    if (!current || current === fallback || (labelChanged && (!current || current === prevLabel))) {
                        next[i] = label;
                        continue;
                    }
                }

                if (!current) {
                    next[i] = fallback;
                } else {
                    next[i] = current;
                }
            }
            return next;
        });
        prevWaypointLabelsRef.current = (waypointLabels ?? []).slice();
    }, [waypoints, waypointLabels, isEditingWaypoint]);

    // keep editing and loading arrays sized to waypoint count
    useEffect(() => {
        setIsEditingWaypoint((prev) => {
            const next = prev.slice();
            next.length = waypoints.length;
            for (let i = 0; i < waypoints.length; i++) if (typeof next[i] !== 'boolean') next[i] = false;
            return next;
        });
        setLoadingWaypoint((prev) => {
            const next = prev.slice();
            next.length = waypoints.length;
            for (let i = 0; i < waypoints.length; i++) if (typeof next[i] !== 'boolean') next[i] = false;
            return next;
        });
    }, [waypoints.length]);

    const geocoder = useMemo(() => getGeocoder(), []);

    const parseLatLng = useCallback((text: string): { lat: number; lng: number } | null => {
        try {
            const parts = text.trim().split(/[\s,;]+/);
            if (parts.length !== 2) return null;
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
            return null;
        } catch { return null; }
    }, []);

    const geocodeForward = useCallback(async (query: string): Promise<{ lat: number; lng: number; place_name: string } | null> => {
        try {
            const top = await geocoder.geocode(query);
            if (!top) return null;
            return { lng: top.center[0], lat: top.center[1], place_name: top.place_name };
        } catch { return null; }
    }, [geocoder]);

    const geocodeSuggest = useCallback(async (query: string): Promise<Suggestion[]> => {
        const trimmed = query.trim();
        if (trimmed.length < 3) return [];
        try {
            return await geocoder.suggest(trimmed);
        } catch { return []; }
    }, [geocoder]);

    const handleSearchStart = useCallback(async () => {
        if (loadingStart) return;
        setLoadingStart(true);
        const parsed = parseLatLng(startText);
        if (parsed) {
            setStartPoint(parsed);
            setIsEditingStart(false);
            setLoadingStart(false);
            return;
        }
        const gc = await geocodeForward(startText);
        if (!gc) {
            alert('Không tìm thấy vị trí bắt đầu.');
            setLoadingStart(false);
            return;
        }
        setStartPoint({ lat: gc.lat, lng: gc.lng });
        setStartText(gc.place_name);
        setIsEditingStart(false);
        setLoadingStart(false);
    }, [startText, geocodeForward, setStartPoint, loadingStart, parseLatLng]);

    const handleSearchEnd = useCallback(async () => {
        if (loadingEnd) return;
        setLoadingEnd(true);
        const parsed = parseLatLng(endText);
        if (parsed) {
            setEndPoint(parsed);
            setIsEditingEnd(false);
            setLoadingEnd(false);
            return;
        }
        const gc = await geocodeForward(endText);
        if (!gc) {
            alert('Không tìm thấy vị trí kết thúc.');
            setLoadingEnd(false);
            return;
        }
        setEndPoint({ lat: gc.lat, lng: gc.lng });
        setEndText(gc.place_name);
        setIsEditingEnd(false);
        setLoadingEnd(false);
    }, [endText, geocodeForward, setEndPoint, loadingEnd, parseLatLng]);

    const handleSearchWaypoint = useCallback(async (idx: number) => {
        if (loadingWaypoint[idx]) return;
        setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? true : (typeof v === 'boolean' ? v : false)));
        const text = waypointTexts[idx] || "";
        const parsed = parseLatLng(text);
        if (parsed) {
            const next = [...waypoints];
            next[idx] = parsed;
            setWaypoints(next);
            setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
            setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
            return;
        }
        const gc = await geocodeForward(text);
        if (!gc) {
            alert('Không tìm thấy điểm trung gian.');
            setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
            return;
        }
        const next = [...waypoints];
        next[idx] = { lat: gc.lat, lng: gc.lng };
        setWaypoints(next);
        setWaypointTexts(prev => prev.map((t, i) => i === idx ? gc.place_name : t));
        setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
        setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
    }, [waypointTexts, waypoints, setWaypoints, geocodeForward, loadingWaypoint, parseLatLng]);

    const handleAddWaypoint = useCallback(() => {
        setWaypointTexts(prev => [...prev, ""]);
        // Do not change waypoints until user searches/sets it
    }, []);

    const handleRemoveWaypoint = useCallback((idx: number) => {
        setWaypointTexts(prev => prev.filter((_, i) => i !== idx));
        // Use current waypoints array (from props) to avoid implicit any in functional setter
        setWaypoints(waypoints.filter((_, i) => i !== idx));
        setWaypointIds(prev => prev.filter((_, i) => i !== idx));

        // Clean up related states
        setIsEditingWaypoint(prev => prev.filter((_, i) => i !== idx));
        setLoadingWaypoint(prev => prev.filter((_, i) => i !== idx));
        setWaypointSugs(prev => {
            const newSugs = { ...prev } as Record<number, Suggestion[]>;
            delete newSugs[idx];
            // Shift down the indices
            const shifted: Record<number, Suggestion[]> = {};
            Object.keys(newSugs).forEach((key) => {
                const numKey = parseInt(key);
                if (numKey > idx) {
                    shifted[numKey - 1] = newSugs[numKey];
                } else if (numKey < idx) {
                    shifted[numKey] = newSugs[numKey];
                }
            });
            return shifted;
        });
        const pending = { ...waypointPendingQueryRef.current };
        delete pending[idx];
        const shiftedPending: Record<number, string> = {};
        Object.keys(pending).forEach((key) => {
            const numKey = parseInt(key, 10);
            if (numKey > idx) shiftedPending[numKey - 1] = pending[numKey];
            else if (numKey < idx) shiftedPending[numKey] = pending[numKey];
        });
        waypointPendingQueryRef.current = shiftedPending;
    }, [setWaypoints, waypoints]);

    const handleChangeWaypointText = useCallback((idx: number, val: string) => {
        setWaypointTexts(prev => prev.map((t, i) => i === idx ? val : t));
    }, []);

    const handleDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        setDragOverId(over ? String(over.id) : null);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setIsDragging(false);
        setDragOverId(null);
        if (!over || active.id === over.id) return;

        const items = ['start', ...waypointIds, 'end'];
        const activeId = String(active.id);
        const overId = String(over.id);
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;

        // Create a full dataset before reordering
        const fullDataSet = [
            { id: 'start', point: startPoint, text: startText },
            ...waypointIds.map((id, i) => ({ id, point: waypoints[i], text: waypointTexts[i] })),
            { id: 'end', point: endPoint, text: endText },
        ];

        // Reorder the full dataset
        const [movedItem] = fullDataSet.splice(oldIndex, 1);
        fullDataSet.splice(newIndex, 0, movedItem);

        // Extract new start, end, and waypoints from the reordered dataset
        const newStart = fullDataSet[0];
        const newEnd = fullDataSet[fullDataSet.length - 1];
        const newWaypointsData = fullDataSet.slice(1, -1);

        const newWaypointIds = newWaypointsData.map(d => (d.id === 'start' || d.id === 'end') ? `wp-${++wpIdCounter.current}` : d.id);
        const newWaypointPoints = newWaypointsData.map(d => d.point).filter(p => p) as Array<{ lat: number; lng: number }>;
        const newWaypointTexts = newWaypointsData.map(d => d.text || '');

        // Apply new state
        setStartPoint(newStart.point || null);
        setStartText(newStart.text || '');
        setEndPoint(newEnd.point || null);
        setEndText(newEnd.text || '');
        setWaypoints(newWaypointPoints);
        setWaypointTexts(newWaypointTexts);
        setWaypointIds(newWaypointIds);
        setWaypointLabels(newWaypointTexts);

        // Clear transient UI state
        setWaypointSugs({});
        setIsEditingWaypoint(prev => prev.map(() => false));
        setIsEditingStart(false);
        setIsEditingEnd(false);
        setStartSugs([]);
        setEndSugs([]);
    }, [startPoint, endPoint, startText, endText, waypointIds, waypointTexts, waypoints, setStartPoint, setEndPoint, setWaypoints, setWaypointLabels]);

    // Swap start/end and reverse waypoints order
    const handleReverseRoute = useCallback(() => {
        // Points
        const newStart = endPoint ? { ...endPoint } : null;
        const newEnd = startPoint ? { ...startPoint } : null;
        const newWaypoints = [...waypoints].reverse();

        setStartPoint(newStart);
        setEndPoint(newEnd);
        setWaypoints(newWaypoints);

        // Texts
        setStartText(endText);
        setEndText(startText);
        setWaypointTexts((prev) => [...prev].reverse());
        // Keep waypoint id order in sync with texts after reverse
        setWaypointIds((prev) => [...prev].reverse());

        // Reset editing/suggestions for clarity
        setIsEditingStart(false);
        setIsEditingEnd(false);
        setIsEditingWaypoint((prev) => prev.map(() => false));
        setStartSugs([]);
        setEndSugs([]);
        setWaypointSugs({});
    }, [startPoint, endPoint, waypoints, startText, endText, setStartPoint, setEndPoint, setWaypoints]);

    const canCalculateRoute = !!startPoint && !!endPoint && !isRouting;
    const hasInstructions = Array.isArray(instructions) && instructions.length > 0;

    return (
        <div className="absolute top-33 left-3 z-[360]">
            {isCollapsed ? (
                <div className="bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 w-16 flex flex-col items-center py-3 space-y-3">
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="p-2 rounded bg-blue-500 text-white hover:bg-blue-400 transition-colors"
                        title="Mở bảng điều khiển"
                    >
                        <PanelLeftOpen size={18} />
                    </button>
                    <button
                        onClick={onPickEnd}
                        className="p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors"
                        title="Chọn điểm kết thúc"
                    >
                        <MapPin size={18} />
                    </button>
                    <button
                        onClick={handleReverseRoute}
                        className="p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors"
                        title="Đảo chiều đi/đến"
                    >
                        <ArrowUpDown size={18} />
                    </button>
                    <button
                        onClick={() => calculateRoute()}
                        disabled={!canCalculateRoute}
                        className={`p-2 rounded transition-colors ${canCalculateRoute ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
                        title="Tìm đường"
                    >
                        <Route size={18} />
                    </button>
                    <button
                        onClick={onStartGuidance}
                        disabled={!hasInstructions}
                        className={`p-2 rounded transition-colors ${hasInstructions ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
                        title="Bắt đầu chỉ đường"
                    >
                        <Navigation size={18} />
                    </button>
                </div>
            ) : (
                <div className="flex items-start gap-2">
                    <div className="bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-4 w-[400px] max-h-[calc(100vh-10rem)] overflow-y-auto overflow-x-hidden scrollbar-rounded">
                        {/* Start/End/Waypoints section */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2">
                                    <button
                                        onClick={() => setIsCollapsed(true)}
                                        className="bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-2 hover:bg-gray-50 transition-colors"
                                        title="Thu gọn bảng điều khiển"
                                    >
                                        <PanelRightOpen size={18} />
                                    </button>
                                    Tìm đường
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md flex items-center gap-1 font-medium transition-colors"
                                        title="Đảo chiều đi/đến"
                                        onClick={handleReverseRoute}
                                    >
                                        <ArrowUpDown size={12} /> Đảo chiều
                                    </button>
                                    <button
                                        className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-md flex items-center gap-1 font-medium transition-colors"
                                        title="Thêm điểm trung gian"
                                        onClick={handleAddWaypoint}
                                    >
                                        <Plus size={12} /> Thêm điểm
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <DndContext
                                    collisionDetection={closestCenter}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext items={['start', ...waypointIds, 'end']} strategy={verticalListSortingStrategy}>
                                        <SortableStartRow
                                            startText={startText}
                                            setStartText={setStartText}
                                            setStartPoint={setStartPoint}
                                            isEditingStart={isEditingStart}
                                            setIsEditingStart={setIsEditingStart}
                                            loadingStart={loadingStart}
                                            startSugs={startSugs}
                                            setStartSugs={setStartSugs}
                                            onPickStart={onPickStart}
                                            onSearchStart={handleSearchStart}
                                            dragOverId={dragOverId}
                                            isDragging={isDragging}
                                            geocodeSuggest={geocodeSuggest}
                                            startTimerRef={startTimerRef}
                                            startPendingQueryRef={startPendingQueryRef}
                                            currentPoint={startPoint}
                                            focusOnCoordinate={focusOnCoordinate}
                                        />
                                        {waypointIds.map((id, idx) => (
                                            <SortableWaypoint
                                                key={id}
                                                idStr={id}
                                                idx={idx}
                                                txt={waypointTexts[idx] || ''}
                                                waypoints={waypoints}
                                                setWaypoints={setWaypoints}
                                                waypointTexts={waypointTexts}
                                                setWaypointTexts={setWaypointTexts}
                                                isEditingWaypoint={isEditingWaypoint}
                                                setIsEditingWaypoint={setIsEditingWaypoint}
                                                loadingWaypoint={loadingWaypoint}
                                                setLoadingWaypoint={setLoadingWaypoint}
                                                waypointSugs={waypointSugs}
                                                setWaypointSugs={setWaypointSugs}
                                                onPickWaypoint={onPickWaypoint}
                                                onRemoveWaypoint={handleRemoveWaypoint}
                                                onSearchWaypoint={handleSearchWaypoint}
                                                onChangeWaypointText={handleChangeWaypointText}
                                                dragOverId={dragOverId}
                                                isDragging={isDragging}
                                                geocodeSuggest={geocodeSuggest}
                                                waypointTimerRef={waypointTimerRef}
                                                waypointPendingQueryRef={waypointPendingQueryRef}
                                                focusOnCoordinate={focusOnCoordinate}
                                            />
                                        ))}
                                        <SortableEndRow
                                            endText={endText}
                                            setEndText={setEndText}
                                            setEndPoint={setEndPoint}
                                            isEditingEnd={isEditingEnd}
                                            setIsEditingEnd={setIsEditingEnd}
                                            loadingEnd={loadingEnd}
                                            endSugs={endSugs}
                                            setEndSugs={setEndSugs}
                                            onPickEnd={onPickEnd}
                                            onSearchEnd={handleSearchEnd}
                                            dragOverId={dragOverId}
                                            isDragging={isDragging}
                                            waypoints={waypoints}
                                            geocodeSuggest={geocodeSuggest}
                                            endTimerRef={endTimerRef}
                                            endPendingQueryRef={endPendingQueryRef}
                                            currentPoint={endPoint}
                                            focusOnCoordinate={focusOnCoordinate}
                                        />
                                    </SortableContext>
                                </DndContext>
                            </div>
                        </div>

                        {/* Profile and route calculation section */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600">
                                    Phương tiện
                                </span>
                                <button
                                    onClick={() => setProfile('driving')}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors ${profile === 'driving'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    title="Ô tô (không traffic)"
                                >
                                    <i className="fas fa-car w-2"></i>
                                </button>
                                <button
                                    onClick={() => setProfile('driving-traffic')}
                                    className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-md transition-colors ${profile === 'driving-traffic'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    title="Ô tô (với traffic)"
                                >
                                    <i className="fas fa-car-on w-2"></i>
                                </button>
                                <button
                                    onClick={() => setProfile('walking')}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors ${profile === 'walking'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    title="Đi bộ"
                                >
                                    <i className="fas fa-walking w-2"></i>
                                </button>
                                <button
                                    onClick={() => setProfile('cycling')}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors ${profile === 'cycling'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    title="Xe đạp"
                                >
                                    <i className="fas fa-bicycle w-2"></i>
                                </button>
                            </div>
                            <button
                                onClick={() => calculateRoute()}
                                disabled={isRouting}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors flex items-center gap-2"
                            >
                                {isRouting ? 'Đang tìm…' : 'Tìm đường'}
                            </button>
                        </div>

                        {routeSummary && routeAlternatives.length > 0 && (
                            <div className="space-y-3 mb-4">
                                <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                            <Route size={14} className="text-blue-500" />
                                            Các tuyến khả dụng
                                        </div>
                                        <div className="text-[11px] text-gray-400">
                                            {routeAlternatives.length > 1 ? 'Chọn tuyến tốt nhất cho bạn' : 'Tuyến đường tốt nhất'}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {routeAlternatives.map((alt) => {
                                            const isActive = alt.index === selectedRouteIndex;
                                            const isOnlyRoute = routeAlternatives.length === 1;

                                            // Lấy thông tin chi tiết cho tuyến hiện tại
                                            const currentDuration = isActive ? durationMinutes : alt.durationMin;
                                            const currentDistance = isActive ? distanceMeters : (alt.distanceKm * 1000);
                                            const currentSpeed = isActive ? (speedDisplay && speedDisplay !== 'Không có dữ liệu' ? speedDisplay : null) : null;
                                            const durationMinutesValue = currentDuration != null ? currentDuration : alt.durationMin;
                                            const durationSeconds = typeof durationMinutesValue === 'number' && Number.isFinite(durationMinutesValue)
                                                ? durationMinutesValue * 60
                                                : 0;
                                            const durationDisplay = formatEta(durationSeconds);

                                            return (
                                                <div
                                                    key={alt.index}
                                                    className={`w-full rounded-md border transition-colors ${isActive || isOnlyRoute
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-gray-200 bg-white hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <button
                                                        className={`w-full text-left p-3 flex items-start gap-3 text-xs ${isActive || isOnlyRoute ? 'text-blue-800' : 'text-gray-700'}`}
                                                        onClick={() => !isOnlyRoute && onSelectRoute(alt.index)}
                                                        disabled={isOnlyRoute}
                                                    >
                                                        <div className="flex-1 min-w-0 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="truncate font-medium">{alt.summary || `Tuyến ${alt.index + 1}`}</div>
                                                                {!isOnlyRoute && (
                                                                    isActive ? (
                                                                        <span className="text-[11px] font-semibold text-blue-600 uppercase">Đang chọn</span>
                                                                    ) : (
                                                                        <span className="text-[11px] text-gray-400">Chọn</span>
                                                                    )
                                                                )}
                                                            </div>

                                                            {/* Thông tin chi tiết */}
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {/* Thời gian */}
                                                                <div className="bg-white/70 border border-gray-200 rounded-md px-2 py-1.5 flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-600">
                                                                        <Clock size={10} className="text-green-600" />
                                                                        Thời gian
                                                                    </div>
                                                                    <div className="text-xs font-semibold text-gray-900">
                                                                        {durationDisplay}
                                                                    </div>
                                                                </div>

                                                                {/* Khoảng cách */}
                                                                <div className="bg-white/70 border border-gray-200 rounded-md px-2 py-1.5 flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-600">
                                                                        <Navigation size={10} className="text-blue-600" />
                                                                        Khoảng cách
                                                                    </div>
                                                                    <div className="text-xs font-semibold text-gray-900">
                                                                        {currentDistance != null ? formatDistance(currentDistance) : `${alt.distanceKm.toFixed(1)} km`}
                                                                    </div>
                                                                </div>

                                                                {/* Tốc độ */}
                                                                <div className="bg-white/70 border border-gray-200 rounded-md px-2 py-1.5 flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-600">
                                                                        <GaugeCircle size={10} className="text-purple-600" />
                                                                        Tốc độ
                                                                    </div>
                                                                    <div className="text-xs font-semibold text-gray-900">
                                                                        {currentSpeed || 'N/A'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Thông tin tắc đường (chỉ cho tuyến đang chọn) */}
                                                            {isActive && wantsCongestion && sortedCongestionEntries.length > 0 && (
                                                                <div className="space-y-1.5">
                                                                    <div className="text-[10px] font-medium text-gray-600 uppercase">Tình trạng giao thông</div>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {sortedCongestionEntries.map(([level, count]) => {
                                                                            const label = CONGESTION_LABELS[level] || level;
                                                                            const badgeClass = CONGESTION_COLOR_CLASSES[level] || 'bg-gray-100 text-gray-600 border border-gray-200';
                                                                            const percentage = totalCongestionSegments > 0 ? Math.round((count / totalCongestionSegments) * 100) : null;
                                                                            return (
                                                                                <span key={level} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeClass}`}>
                                                                                    {label}
                                                                                    {percentage != null ? <span className="text-[9px] font-semibold">{percentage}%</span> : null}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Directions section */}
                        <div className="mt-4">
                            <AdvancedRoutingPanel
                                profile={profile}
                                onCalculateRoute={handleCalculateRoute}
                                isRouting={isRouting}
                            />

                            <div className="max-h-64 overflow-auto">
                                <h3 className="flex text-sm font-semibold mb-3 text-gray-800 items-center justify-between gap-2">
                                    <div className='inline-flex items-center gap-2'>
                                        <List size={16} className="text-green-600" />
                                        Chỉ đường
                                    </div>
                                    <div>
                                        <button
                                            onClick={onStartGuidance}
                                            disabled={!instructions || instructions.length === 0}
                                            className="bg-green-600 hover:bg-green-700 disabled:opacity-20 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors flex items-center gap-2"
                                            title="Bắt đầu chỉ đường"
                                        >
                                            <Navigation size={16} />
                                            Bắt đầu
                                        </button>
                                    </div>

                                </h3>
                                {(!instructions || instructions.length === 0) ? (
                                    <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                                        Chưa có hướng dẫn. Nhấn "Tìm đường" để bắt đầu.
                                    </div>
                                ) : (
                                    <ol className="space-y-2">
                                        {instructions.map((step: any, index: number) => (
                                            <li
                                                key={index}
                                                className={`rounded border p-2 text-xs cursor-pointer transition-colors ${activeStepIdx === index ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                onClick={() => focusStep(index)}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-2">
                                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${activeStepIdx === index ? 'bg-blue-200 text-blue-900' : 'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                        <div>
                                                            <div className="font-medium text-gray-800">{formatInstructionVI(step)}</div>
                                                            {!!step?.name && <div className="text-[10px] text-gray-500">{step.name}</div>}
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-gray-600 whitespace-nowrap">
                                                        {formatDistance(step?.distance || 0)}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    )
};