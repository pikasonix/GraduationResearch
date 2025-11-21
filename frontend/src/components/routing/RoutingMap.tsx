"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import type { Feature, FeatureCollection, LineString, Geometry } from 'geojson';
import "mapbox-gl/dist/mapbox-gl.css";
import config from "@/config/config";
import { getGeocoder } from '@/services/geocoding';
import { computeBearing, stepBearingTowards, distanceMeters } from './geo';
import { createPinElement } from './pinMarker';
import { formatDuration, formatDistance, formatInstructionVI, renderInstructionPopupHTML } from './formatters';
import { pickManeuverIcon } from './maneuvers';
import { Toolbar } from './Toolbar';
import { ControlsPanel, type AnnotationMetrics } from './ControlsPanel';
import { GuidanceHUD } from './GuidanceHUD';
import { SimulationPanel } from './SimulationPanel';
import { createVehicleMarkerElement, updateVehicleMarkerElementColor } from './VehicleMarker';
import type { Station } from './StationPinTool';
import { StationFilter } from './StationFilter';
import { StationService } from './StationService';
import { createStationMarkerElement } from './StationMarker';

type Profile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';

interface AdvancedOptions {
    alternatives: boolean;
    geometries: 'geojson' | 'polyline' | 'polyline6';
    overview: 'full' | 'simplified' | 'false';
    continue_straight: boolean;
    depart_at?: string;
    arrive_by?: string;
    approaches: string[];
    waypoint_snapping: string[];
    exclude: string[];
    annotations: string[];
    language: string;
    voice_instructions: boolean;
    voice_units: 'imperial' | 'metric';
    banner_instructions: boolean;
    max_weight?: number;
    max_height?: number;
    max_width?: number;
    max_length?: number;
    engine?: string;
}

type CongestionCategory = 'unknown' | 'low' | 'moderate' | 'heavy' | 'severe';

const CONGESTION_COLOR_MAP: Record<CongestionCategory, string> = {
    severe: '#dc2626',
    heavy: '#f97316',
    moderate: '#facc15',
    low: '#22c55e',
    unknown: '#94a3b8',
};

const DEFAULT_TRAFFIC_COLOR = '#1d4ed8';

const toMsFromUnit = (value: number, unit?: string | null): number => {
    if (!Number.isFinite(value)) return value;
    const normalizedUnit = unit?.toLowerCase() ?? 'km/h';
    switch (normalizedUnit) {
        case 'm/s':
        case 'meter/second':
        case 'meters/second':
            return value;
        case 'km/h':
        case 'kph':
        case 'kilometers per hour':
        case 'kilometres per hour':
            return value / 3.6;
        case 'mph':
        case 'mi/h':
        case 'miles per hour':
            return value * 0.44704;
        case 'knots':
            return value * 0.514444;
        default:
            return value / 3.6;
    }
};

const extractMaxSpeedMs = (entry: any): number | null => {
    if (!entry || typeof entry !== 'object' || entry.unknown) return null;
    const candidates = [entry.speed, entry.speed_limit, entry.maxspeed, entry.value];
    const maxValue = candidates.find((val) => typeof val === 'number' && Number.isFinite(val)) as number | undefined;
    if (typeof maxValue !== 'number') return null;
    const unit = entry.unit || entry.speed_unit || entry.maxspeed_unit;
    return toMsFromUnit(maxValue, unit);
};

const congestionNumericToCategory = (value?: number | null): CongestionCategory => {
    if (value == null || Number.isNaN(value)) return 'unknown';
    const numeric = Math.round(value);
    switch (numeric) {
        case 1:
            return 'low';
        case 2:
            return 'moderate';
        case 3:
            return 'heavy';
        case 4:
            return 'severe';
        default:
            return 'unknown';
    }
};

interface CongestionContext {
    speedMs?: number | null;
    maxSpeedMs?: number | null;
    distanceM?: number | null;
    durationSec?: number | null;
}

const normalizeCongestionCategory = (
    raw?: string | null,
    numeric?: number | null,
    context: CongestionContext = {}
): CongestionCategory => {
    const rawNormalized = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
    let normalized: CongestionCategory = 'unknown';

    if (rawNormalized.includes('severe')) {
        normalized = 'severe';
    } else if (rawNormalized.includes('heavy')) {
        normalized = 'heavy';
    } else if (rawNormalized.includes('moderate')) {
        normalized = 'moderate';
    } else if (rawNormalized.includes('slow')) {
        normalized = 'moderate';
    } else if (rawNormalized.includes('light') || rawNormalized.includes('free') || rawNormalized.includes('low')) {
        normalized = 'low';
    }

    if (normalized === 'unknown') {
        const byNumeric = congestionNumericToCategory(numeric);
        if (byNumeric !== 'unknown') {
            normalized = byNumeric;
        }
    }

    if (normalized === 'unknown') {
        const { speedMs, maxSpeedMs, distanceM, durationSec } = context;
        let effectiveSpeedMs: number | null = null;

        if (typeof speedMs === 'number' && Number.isFinite(speedMs)) {
            effectiveSpeedMs = speedMs;
        } else if (
            typeof distanceM === 'number' && Number.isFinite(distanceM) &&
            typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0
        ) {
            effectiveSpeedMs = distanceM / durationSec;
        }

        if (effectiveSpeedMs != null && Number.isFinite(effectiveSpeedMs)) {
            const speedKmh = effectiveSpeedMs * 3.6;
            const maxMs = typeof maxSpeedMs === 'number' && Number.isFinite(maxSpeedMs) && maxSpeedMs > 0
                ? maxSpeedMs
                : undefined;

            if (maxMs) {
                const ratio = effectiveSpeedMs / maxMs;
                if (ratio <= 0.25) normalized = 'severe';
                else if (ratio <= 0.4) normalized = 'heavy';
                else if (ratio <= 0.65) normalized = 'moderate';
                else if (ratio <= 0.85) normalized = 'low';
                else normalized = 'low';
            } else {
                if (speedKmh <= 10) normalized = 'severe';
                else if (speedKmh <= 20) normalized = 'heavy';
                else if (speedKmh <= 35) normalized = 'moderate';
                else if (speedKmh <= 55) normalized = 'low';
                else normalized = 'low';
            }
        }
    }

    return normalized;
};

export default function RoutingMap() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [is3D, setIs3D] = useState(true);
    const [angled, setAngled] = useState(true);
    const [courseUp] = useState(true);
    const [isTrafficVisible, setIsTrafficVisible] = useState(false);
    const [isCongestionVisible, setIsCongestionVisible] = useState(true);
    // Routing state
    type Profile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';
    const routeSourceId = 'route-line';
    const stepSourceId = 'step-line';
    const congestionSourceId = 'congestion-line';
    const routeDataRef = useRef<FeatureCollection<Geometry> | null>(null);
    const routesRef = useRef<any[]>([]);
    const stepDataRef = useRef<FeatureCollection<Geometry> | null>(null);
    const congestionDataRef = useRef<FeatureCollection<Geometry> | null>(null);
    const congestionLookupRef = useRef<Record<number, CongestionCategory>>({});
    const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const viaMarkersRef = useRef<mapboxgl.Marker[]>([]);
    const currentPinMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const vehicleMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const vehicleElRef = useRef<HTMLDivElement | null>(null);
    const stepMarkersRef = useRef<mapboxgl.Marker[]>([]);
    const openStepPopupRef = useRef<mapboxgl.Popup | null>(null);
    const stepPopupsRef = useRef<mapboxgl.Popup[]>([]);
    // Simulation refs
    const simMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const simMarkerColorRef = useRef<string | null>(null);
    const simRAFRef = useRef<number | null>(null);
    const simCoordsRef = useRef<[number, number][]>([]);
    const simCumDistRef = useRef<number[]>([]);
    const simTotalDistRef = useRef<number>(0);
    const simDistRef = useRef<number>(0);
    const lastTsRef = useRef<number | null>(null);
    const simLockedZoomRef = useRef<number | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [startPoint, setStartPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [waypoints, setWaypoints] = useState<Array<{ lat: number; lng: number }>>([]);
    const [profile, setProfile] = useState<Profile>('driving-traffic');
    const [routes, setRoutes] = useState<any[]>([]);
    const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);
    const [instructions, setInstructions] = useState<any[]>([]);
    const routeAlternatives = useMemo(() => {
        return routes.map((route: any, idx: number) => {
            const legs = Array.isArray(route?.legs) ? route.legs : [];
            const summaryParts = legs
                .map((leg: any) => (typeof leg?.summary === 'string' ? leg.summary : ''))
                .filter((part: string) => part && part.trim().length > 0);
            const summary = summaryParts.join(' → ') || (typeof route?.summary === 'string' ? route.summary : '');
            return {
                index: idx,
                distanceKm: (route?.distance ?? 0) / 1000,
                durationMin: (route?.duration ?? 0) / 60,
                summary,
            };
        });
    }, [routes]);

    // Station state
    const [stations, setStations] = useState<Station[]>([]);
    const stationMarkersRef = useRef<mapboxgl.Marker[]>([]);
    useEffect(() => {
        routesRef.current = routes;
    }, [routes]);
    const [isRouting, setIsRouting] = useState(false);
    const [routeSummary, setRouteSummary] = useState<{ distanceKm: number; durationMin: number } | null>(null);
    const [annotationMetrics, setAnnotationMetrics] = useState<AnnotationMetrics>({});
    const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>(['duration', 'distance', 'speed', 'maxspeed', 'congestion', 'congestion_numeric']);
    const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);
    const [guidanceMode, setGuidanceMode] = useState<boolean>(false);
    const [headingDeg, setHeadingDeg] = useState<number>(0);
    const [keepZoom, setKeepZoom] = useState<boolean>(false);
    const smoothTurns = true;
    const maxTurnRateDegPerSecRef = useRef<number>(60);
    const [showAllPopups, setShowAllPopups] = useState<boolean>(false);
    // Display labels for picked/search points
    const [startLabel, setStartLabel] = useState<string>("");
    const [endLabel, setEndLabel] = useState<string>("");
    const [waypointLabels, setWaypointLabels] = useState<string[]>([]);
    // Simulation UI state
    const [simPlaying, setSimPlaying] = useState<boolean>(false);
    const [simSpeed, setSimSpeed] = useState<number>(1);
    const [simFollow, setSimFollow] = useState<boolean>(true);
    // Simulation metrics & step tracking
    const [simRemainingM, setSimRemainingM] = useState<number>(0);
    const [simEtaSec, setSimEtaSec] = useState<number>(0);
    const [simToNextManeuverM, setSimToNextManeuverM] = useState<number>(0);
    const stepStartCumRef = useRef<number[]>([]); // per-step start cumulative distance (m)
    const stepEndCumRef = useRef<number[]>([]);   // per-step end cumulative distance (m)
    const stepFirstCoordIndexRef = useRef<number[]>([]); // index of first coord of each step in route coords
    const stepMetersRef = useRef<number[]>([]);   // per-step length in meters
    const stepDurationSecRef = useRef<number[]>([]); // per-step duration in seconds (from API)
    const stepCumDurEndRef = useRef<number[]>([]); // cumulative duration to end of each step (sec)
    const routeTotalDurationSecRef = useRef<number>(0);
    const nextStepIdxRef = useRef<number>(0);
    const lastPassedPopupRef = useRef<mapboxgl.Popup | null>(null);
    const nextPopupRef = useRef<mapboxgl.Popup | null>(null);
    const geoWatchIdRef = useRef<number | null>(null);
    const courseUpRef = useRef<boolean>(false);
    const cameraBearingRef = useRef<number>(0);
    const lastGuidanceTsRef = useRef<number | null>(null);
    const autoAdvanceThresholdM = 25;
    // Map picking state (choose a point on map for start/end/waypoint)
    type PickTarget = { type: 'start' } | { type: 'end' } | { type: 'via'; index: number };
    const pickingRef = useRef<{ target: PickTarget; handler: (e: mapboxgl.MapMouseEvent) => void } | null>(null);

    // keep ref in sync with state
    useEffect(() => {
        courseUpRef.current = courseUp;
    }, [courseUp]);

    const toLngLat = (p: { lat: number; lng: number }) => [p.lng, p.lat] as [number, number];
    // moved helpers to ./formatters, ./geo, ./maneuvers

    // Reverse geocoding helper to get a human-friendly place name from coordinates
    const reverseGeocode = useCallback(async (lng: number, lat: number): Promise<string | null> => {
        try {
            const gc = getGeocoder();
            if (gc.reverse) return await gc.reverse(lng, lat);
            // fallback to Mapbox if provider has no reverse
            const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string) || "";
            if (!token) return null;
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&language=vi&access_token=${encodeURIComponent(token)}`;
            const res = await fetch(url);
            const data = await res.json();
            return data?.features?.[0]?.place_name ?? null;
        } catch { return null; }
    }, []);

    const updateStartLabelFrom = useCallback(async (lng: number, lat: number) => {
        const name = await reverseGeocode(lng, lat);
        setStartLabel(name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }, [reverseGeocode]);

    const updateEndLabelFrom = useCallback(async (lng: number, lat: number) => {
        const name = await reverseGeocode(lng, lat);
        setEndLabel(name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }, [reverseGeocode]);

    const updateWaypointLabelFrom = useCallback(async (index: number, lng: number, lat: number) => {
        const name = await reverseGeocode(lng, lat);
        setWaypointLabels((prev) => {
            const next = prev.slice();
            next[index] = name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            return next;
        });
    }, [reverseGeocode]);

    // Keep waypointLabels array length in sync with waypoints
    useEffect(() => {
        setWaypointLabels((prev) => {
            const next = [...prev];
            if (next.length !== waypoints.length) {
                next.length = waypoints.length;
            }
            return next.map((v) => v ?? "");
        });
    }, [waypoints.length]);

    const positionAtDistance = useCallback((dist: number): { pos: [number, number]; bearing: number } | null => {
        const coords = simCoordsRef.current;
        const cums = simCumDistRef.current;
        if (!coords || coords.length < 2 || cums.length < 2) return null;
        if (dist <= 0) {
            const [lon1, lat1] = coords[0];
            const [lon2, lat2] = coords[1];
            return { pos: coords[0], bearing: computeBearing(lat1, lon1, lat2, lon2) };
        }
        if (dist >= simTotalDistRef.current) {
            const n = coords.length;
            const [lon1, lat1] = coords[n - 2];
            const [lon2, lat2] = coords[n - 1];
            return { pos: coords[n - 1], bearing: computeBearing(lat1, lon1, lat2, lon2) };
        }
        // find segment where cumulative >= dist
        let i = 1;
        while (i < cums.length && cums[i] < dist) i++;
        const prevD = cums[i - 1];
        const segLen = cums[i] - prevD;
        const t = segLen > 0 ? (dist - prevD) / segLen : 0;
        const [lon1, lat1] = coords[i - 1];
        const [lon2, lat2] = coords[i];
        const lon = lon1 + (lon2 - lon1) * t;
        const lat = lat1 + (lat2 - lat1) * t;
        const br = computeBearing(lat1, lon1, lat2, lon2);
        return { pos: [lon, lat], bearing: br };
    }, []);

    // maneuver helpers moved to ./maneuvers

    const computeManeuverRotation = (step: any): number => {
        try {
            const modifier = (step?.maneuver?.modifier || '').toLowerCase();
            let incomingBearing: number | null = null;
            if (Array.isArray(instructions) && instructions.length > 0) {
                const idx = instructions.findIndex((s) => s === step);
                if (idx > 0) {
                    const prev = instructions[idx - 1];
                    const coords = prev?.geometry?.coordinates as [number, number][] | undefined;
                    if (coords && coords.length >= 2) {
                        const [lon1, lat1] = coords[coords.length - 2];
                        const [lon2, lat2] = coords[coords.length - 1];
                        incomingBearing = computeBearing(lat1, lon1, lat2, lon2);
                    }
                }
            }
            if (incomingBearing == null && step?.geometry?.coordinates?.length >= 2) {
                const [lon1, lat1] = step.geometry.coordinates[0];
                const [lon2, lat2] = step.geometry.coordinates[1];
                incomingBearing = computeBearing(lat1, lon1, lat2, lon2);
            }
            const base = incomingBearing ?? 0;
            return base;
        } catch {
            return 0;
        }
    };

    const enable3D = useCallback((map: mapboxgl.Map) => {
        if (!map.getSource("mapbox-dem")) {
            map.addSource("mapbox-dem", {
                type: "raster-dem",
                url: "mapbox://mapbox.terrain-rgb",
                tileSize: 512,
                maxzoom: 14,
            } as any);
        }
        try {
            (map as any).setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
        } catch { }

        if (!map.getLayer("sky")) {
            map.addLayer({
                id: "sky",
                type: "sky",
                paint: {
                    "sky-type": "atmosphere",
                    "sky-atmosphere-sun": [0.0, 0.0],
                    "sky-atmosphere-sun-intensity": 15,
                },
            } as any);
        }

        const layers = map.getStyle().layers || [];
        const labelLayerId = layers.find(
            (l) => l.type === "symbol" && (l.layout as any)?.["text-field"]
        )?.id;

        if (!map.getLayer("3d-buildings")) {
            map.addLayer(
                {
                    id: "3d-buildings",
                    source: "composite",
                    "source-layer": "building",
                    filter: ["has", "height"],
                    type: "fill-extrusion",
                    minzoom: 15,
                    paint: {
                        "fill-extrusion-color": "#aaa",
                        "fill-extrusion-height": ["get", "height"],
                        "fill-extrusion-base": ["get", "min_height"],
                        "fill-extrusion-opacity": 0.6,
                    },
                } as any,
                labelLayerId
            );
        }
    }, []);

    const disable3D = useCallback((map: mapboxgl.Map) => {
        try {
            (map as any).setTerrain(null);
        } catch { }
        if (map.getLayer("3d-buildings")) {
            map.removeLayer("3d-buildings");
        }
        if (map.getLayer("sky")) {
            map.removeLayer("sky");
        }
        if (map.getSource("mapbox-dem")) {
            map.removeSource("mapbox-dem");
        }
    }, []);


    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!mapContainer.current || mapRef.current) return;

        const token = config.mapbox?.accessToken ?? "";
        if (!token) {
            setError(
                "Thiếu Mapbox access token. Hãy đặt biến môi trường NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN."
            );
            return;
        }

        mapboxgl.accessToken = token;
        try {
            mapRef.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: config.mapbox?.style || "mapbox://styles/mapbox/streets-v12",
                center: [
                    (config.mapDefaults?.defaultCenterLng as number) ?? 105.8194,
                    (config.mapDefaults?.defaultCenterLat as number) ?? 21.0227,
                ],
                zoom: (config.mapDefaults?.defaultZoom as number) ?? 13,
                pitch: 70,
                bearing: -17.6,
                antialias: true,
                cooperativeGestures: false,
            });

            mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
            mapRef.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
            mapRef.current.addControl(new mapboxgl.ScaleControl({ unit: "metric" }));

            // Add traffic layer when map loads
            mapRef.current.on('load', () => {
                // Mapbox has built-in traffic layer
                if (mapRef.current?.getStyle().sources['mapbox-traffic']) {
                    // Traffic source already exists
                    return;
                }

                // Add traffic source if not exists
                mapRef.current?.addSource('mapbox-traffic-v1', {
                    type: 'vector',
                    url: 'mapbox://mapbox.mapbox-traffic-v1'
                });

                // Add traffic layers
                mapRef.current?.addLayer({
                    id: 'traffic',
                    type: 'line',
                    source: 'mapbox-traffic-v1',
                    'source-layer': 'traffic',
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round'
                    },
                    paint: {
                        'line-width': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            10, 1,
                            16, 8
                        ],
                        'line-color': [
                            'case',
                            ['==', ['get', 'congestion'], 'severe'], '#b91c1c',
                            ['==', ['get', 'congestion'], 'heavy'], '#ea580c',
                            ['==', ['get', 'congestion'], 'moderate'], '#d97706',
                            ['==', ['get', 'congestion'], 'low'], '#65a30d',
                            '#16a34a' // free flow
                        ],
                        'line-opacity': 0.8
                    }
                }, 'road-label');

                // Initially hide traffic
                mapRef.current?.setLayoutProperty('traffic', 'visibility', 'none');
            });

            mapRef.current.dragRotate.enable();
            mapRef.current.touchZoomRotate.enableRotation();

            const maybeApply3D = () => {
                if (!mapRef.current) return;
                if (is3D) enable3D(mapRef.current);
                if (angled) {
                    mapRef.current.easeTo({ pitch: 55, bearing: -17.6, duration: 500 });
                } else {
                    mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 300 });
                }
            };
            const onLoaded = () => {
                if (!mapRef.current) return;
                if (!mapRef.current.getSource(routeSourceId)) {
                    mapRef.current.addSource(routeSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    if (!mapRef.current.getLayer('route-alt-layer')) {
                        mapRef.current.addLayer({
                            id: 'route-alt-layer',
                            type: 'line',
                            source: routeSourceId,
                            filter: ['==', ['get', 'isPrimary'], false],
                            paint: {
                                'line-color': '#60a5fa',
                                'line-width': [
                                    'interpolate',
                                    ['linear'],
                                    ['zoom'],
                                    10, 2.8,
                                    14, 4.5,
                                    18, 8
                                ],
                                'line-opacity': 0.7,
                            },
                            layout: { 'line-cap': 'round', 'line-join': 'round' }
                        });
                    }
                    if (!mapRef.current.getLayer('route-line-casing')) {
                        mapRef.current.addLayer({
                            id: 'route-line-casing',
                            type: 'line',
                            source: routeSourceId,
                            filter: ['==', ['get', 'isPrimary'], true],
                            paint: {
                                'line-color': '#60a5fa',
                                'line-width': [
                                    'interpolate',
                                    ['linear'],
                                    ['zoom'],
                                    10, 6,
                                    14, 12,
                                    18, 26
                                ],
                                'line-opacity': 0.45,
                                'line-blur': 0.3
                            },
                            layout: { 'line-cap': 'round', 'line-join': 'round' }
                        });
                    }
                    mapRef.current.addLayer({
                        id: 'route-line-layer',
                        type: 'line',
                        source: routeSourceId,
                        filter: ['==', ['get', 'isPrimary'], true],
                        paint: {
                            'line-color': '#1d4ed8',
                            'line-width': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                10, 4.5,
                                13, 7,
                                16, 12,
                                19, 24
                            ],
                            'line-opacity': 0.95,
                            'line-blur': 0.15
                        },
                        layout: { 'line-cap': 'round', 'line-join': 'round' }
                    });
                }
                if (!mapRef.current.getSource(stepSourceId)) {
                    mapRef.current.addSource(stepSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    mapRef.current.addLayer({
                        id: 'step-line-layer',
                        type: 'line',
                        source: stepSourceId,
                        paint: {
                            'line-color': '#f97316',
                            'line-width': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                10, 6,
                                13, 9,
                                16, 14,
                                19, 26
                            ],
                            'line-opacity': 0.98,
                            'line-blur': 0.05
                        },
                        layout: { 'line-cap': 'round', 'line-join': 'round' }
                    });
                }

                // Add congestion source and layer
                if (!mapRef.current.getSource(congestionSourceId)) {
                    mapRef.current.addSource(congestionSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    mapRef.current.addLayer({
                        id: 'congestion-line-layer',
                        type: 'line',
                        source: congestionSourceId,
                        paint: {
                            'line-color': [
                                'case',
                                ['==', ['get', 'congestion'], 'severe'], '#dc2626',
                                ['==', ['get', 'congestion'], 'heavy'], '#f97316',
                                ['==', ['get', 'congestion'], 'moderate'], '#facc15',
                                ['==', ['get', 'congestion'], 'low'], '#22c55e',
                                ['==', ['get', 'congestion'], 'unknown'], '#94a3b8',
                                '#22c55e'
                            ],
                            'line-width': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                10, 8,
                                13, 12,
                                16, 18,
                                19, 32
                            ],
                            'line-opacity': 0.85
                        },
                        layout: { 'line-cap': 'round', 'line-join': 'round' }
                    }, 'route-line-layer'); // Add below main route layer

                    // Initially show congestion layer
                    mapRef.current?.setLayoutProperty('congestion-line-layer', 'visibility', 'visible');
                }
                try {
                    if (routeDataRef.current) (mapRef.current.getSource(routeSourceId) as mapboxgl.GeoJSONSource)?.setData(routeDataRef.current);
                    if (stepDataRef.current) (mapRef.current.getSource(stepSourceId) as mapboxgl.GeoJSONSource)?.setData(stepDataRef.current);
                } catch { }
                setMapReady(true);
                maybeApply3D();
                // Load stations when map is ready
                setTimeout(() => loadStations(), 100); // Small delay to ensure map is fully loaded
                try {
                    if (courseUpRef.current && routeDataRef.current) {
                        const routeGeom = routeDataRef.current.features?.[0]?.geometry as any;
                        const coords: [number, number][] | undefined = routeGeom?.coordinates;
                        if (coords && coords.length >= 2) {
                            const [lon1, lat1] = coords[0];
                            const [lon2, lat2] = coords[1];
                            const br = computeBearing(lat1, lon1, lat2, lon2);
                            setHeadingDeg(br);
                            cameraBearingRef.current = br;
                            mapRef.current?.easeTo({ bearing: br, pitch: Math.max(mapRef.current.getPitch(), 50), duration: 300 });
                        }
                    }
                } catch { }
            };
            mapRef.current.on("load", onLoaded);
            mapRef.current.on("style.load", onLoaded);
            mapRef.current.on("load", () => {
                try { cameraBearingRef.current = mapRef.current!.getBearing(); } catch { }
            });
        } catch (e: any) {
            setError(e?.message || "Không thể khởi tạo bản đồ Mapbox");
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    const rotateBy = useCallback((delta: number) => {
        if (!mapRef.current) return;
        const current = mapRef.current.getBearing();
        mapRef.current.rotateTo(current + delta, { duration: 300 });
    }, []);

    const resetNorth = useCallback(() => {
        if (!mapRef.current) return;
        mapRef.current.resetNorth({ duration: 300 });
    }, []);

    const endPicking = useCallback(() => {
        if (!mapRef.current) return;
        if (pickingRef.current) {
            mapRef.current.off('click', pickingRef.current.handler as any);
            pickingRef.current = null;
        }
        try { mapRef.current.getCanvas().style.cursor = ''; } catch { }
    }, []);

    const beginPicking = useCallback((target: PickTarget) => {
        if (!mapRef.current) return;
        endPicking();
        try { mapRef.current.getCanvas().style.cursor = 'crosshair'; } catch { }
        const handler = async (e: mapboxgl.MapMouseEvent) => {
            const { lng, lat } = e.lngLat;
            if (target.type === 'start') {
                setStartPoint({ lat, lng });
                await updateStartLabelFrom(lng, lat);
            } else if (target.type === 'end') {
                setEndPoint({ lat, lng });
                await updateEndLabelFrom(lng, lat);
            } else {
                const idx = target.index;
                const next = [...waypoints];
                next[idx] = { lat, lng };
                setWaypoints(next);
                await updateWaypointLabelFrom(idx, lng, lat);
            }
            endPicking();
        };
        pickingRef.current = { target, handler };
        mapRef.current.on('click', handler as any);
    }, [endPicking, setStartPoint, setEndPoint, waypoints, setWaypoints, updateStartLabelFrom, updateEndLabelFrom, updateWaypointLabelFrom]);

    // When start/end/waypoints change (from search, typing, or programmatically), try to populate labels
    useEffect(() => {
        if (startPoint) updateStartLabelFrom(startPoint.lng, startPoint.lat);
    }, [startPoint?.lat, startPoint?.lng, updateStartLabelFrom]);

    useEffect(() => {
        if (endPoint) updateEndLabelFrom(endPoint.lng, endPoint.lat);
    }, [endPoint?.lat, endPoint?.lng, updateEndLabelFrom]);

    useEffect(() => {
        waypoints.forEach((wp, idx) => {
            if (!waypointLabels[idx] || waypointLabels[idx] === '') {
                updateWaypointLabelFrom(idx, wp.lng, wp.lat);
            }
        });
    }, [waypoints, waypointLabels, updateWaypointLabelFrom]);

    // Use external helper to create pin elements
    const create3DPinElement = useCallback((color: string = '#ef4444', number?: number) => createPinElement(color, number), []);

    const set3DPinAt = useCallback((lng: number, lat: number, color: string = '#ef4444') => {
        if (!mapRef.current) return;
        const el = create3DPinElement(color);
        if (currentPinMarkerRef.current) {
            currentPinMarkerRef.current.remove();
            currentPinMarkerRef.current = null;
        }
        currentPinMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' as any })
            .setLngLat([lng, lat])
            .addTo(mapRef.current);

        const currentZoom = mapRef.current.getZoom();
        const targetZoom = keepZoom ? currentZoom : Math.max(currentZoom, 17);
        const targetPitch = Math.max(mapRef.current.getPitch(), 60);
        mapRef.current.easeTo({ center: [lng, lat], zoom: targetZoom, pitch: targetPitch, duration: 600 });
    }, [create3DPinElement, keepZoom]);

    const focusOnCoordinate = useCallback((coords: { lat: number; lng: number }) => {
        if (!mapRef.current) return;
        const { lat, lng } = coords;
        const currentZoom = mapRef.current.getZoom();
        const targetZoom = keepZoom ? currentZoom : Math.max(currentZoom, 16.5);
        mapRef.current.easeTo({ center: [lng, lat], zoom: targetZoom, duration: 450 });
    }, [keepZoom]);

    // Station handlers
    const loadStations = useCallback(async () => {
        try {
            const data = await StationService.getAllStations();
            setStations(data);
        } catch (error) {
            console.error('Lỗi khi tải danh sách trạm:', error);
        }
    }, []);

    const handleStationAdded = useCallback((newStation: Station) => {
        setStations(prev => [newStation, ...prev]);
        // Add marker to map
        if (mapRef.current && newStation.lat && newStation.lng) {
            const element = createStationMarkerElement(newStation, () => {
                focusOnCoordinate({ lat: newStation.lat, lng: newStation.lng });
            });
            const marker = new mapboxgl.Marker({ element })
                .setLngLat([newStation.lng, newStation.lat])
                .addTo(mapRef.current);
            stationMarkersRef.current.push(marker);
        }
    }, [focusOnCoordinate]);

    const handleStationClick = useCallback((station: Station) => {
        if (station.lat && station.lng) {
            focusOnCoordinate({ lat: station.lat, lng: station.lng });
        }
    }, [focusOnCoordinate]);

    const handleStationNavigate = useCallback((station: Station) => {
        if (typeof station.lat !== 'number' || typeof station.lng !== 'number' || Number.isNaN(station.lat) || Number.isNaN(station.lng)) {
            return;
        }

        const { lat, lng, name } = station;
        setEndPoint({ lat, lng });
        setEndLabel(name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        focusOnCoordinate({ lat, lng });
        void updateEndLabelFrom(lng, lat);
    }, [focusOnCoordinate, setEndPoint, setEndLabel, updateEndLabelFrom]);

    const handleStationDelete = useCallback((stationId: string) => {
        setStations(prev => prev.filter(s => s.id !== stationId));
        // Remove marker from map
        const markerIndex = stationMarkersRef.current.findIndex(marker => {
            const lngLat = marker.getLngLat();
            return stations.find(s => s.id === stationId && s.lng === lngLat.lng && s.lat === lngLat.lat);
        });
        if (markerIndex >= 0) {
            stationMarkersRef.current[markerIndex].remove();
            stationMarkersRef.current.splice(markerIndex, 1);
        }
    }, [stations]);

    const toggleTraffic = useCallback(() => {
        if (!mapRef.current) return;

        const currentVisibility = mapRef.current.getLayoutProperty('traffic', 'visibility');
        const newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';

        mapRef.current.setLayoutProperty('traffic', 'visibility', newVisibility);
        setIsTrafficVisible(newVisibility === 'visible');
    }, []);

    const toggleCongestion = useCallback(() => {
        if (!mapRef.current) return;

        const layer = mapRef.current.getLayer('congestion-line-layer');
        if (!layer) {
            console.warn('⚠️ Congestion layer not found');
            return;
        }

        const currentVisibility = mapRef.current.getLayoutProperty('congestion-line-layer', 'visibility');
        const newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';

        console.log('🚦 Toggling congestion visibility:', currentVisibility, '->', newVisibility);

        mapRef.current.setLayoutProperty('congestion-line-layer', 'visibility', newVisibility);
        setIsCongestionVisible(newVisibility === 'visible');

        // Also log current congestion data
        console.log('📊 Current congestion data:', congestionDataRef.current);
    }, []);

    const createCongestionSegments = useCallback((route: any): FeatureCollection<Geometry> => {
        const features: Feature<LineString>[] = [];
        const lookup: Record<number, CongestionCategory> = {};

        if (!route?.legs || !Array.isArray(route.legs) || !route?.geometry?.coordinates) {
            console.warn('⚠️ Invalid route data for congestion rendering', route);
            return { type: 'FeatureCollection', features };
        }

        const routeCoords: [number, number][] = route.geometry.coordinates;
        let coordIndex = 0;

        console.log('📍 Total route coordinates:', routeCoords.length);

        route.legs.forEach((leg: any, legIndex: number) => {
            const congestionData: string[] = Array.isArray(leg?.annotation?.congestion)
                ? leg.annotation.congestion
                : [];
            const congestionNumericData: number[] = Array.isArray(leg?.annotation?.congestion_numeric)
                ? leg.annotation.congestion_numeric
                : [];
            const durationData: number[] = Array.isArray(leg?.annotation?.duration)
                ? leg.annotation.duration
                : [];
            const distanceData: number[] = Array.isArray(leg?.annotation?.distance)
                ? leg.annotation.distance
                : [];
            const speedData: number[] = Array.isArray(leg?.annotation?.speed)
                ? leg.annotation.speed
                : [];
            const maxSpeedData: any[] = Array.isArray(leg?.annotation?.maxspeed)
                ? leg.annotation.maxspeed
                : [];

            console.log(`🦵 Leg ${legIndex} congestion segments:`, congestionData.length, congestionData);
            console.log(`🧮 Leg ${legIndex} numeric congestion:`, congestionNumericData.length, congestionNumericData);

            congestionData.forEach((congestion: string, segmentOffset: number) => {
                const globalIndex = coordIndex + segmentOffset;
                if (globalIndex >= routeCoords.length - 1) {
                    console.warn('⚠️ Congestion segment index exceeds coordinates length', {
                        legIndex,
                        segmentOffset,
                        globalIndex,
                        coordsLength: routeCoords.length
                    });
                    return;
                }

                const startCoord = routeCoords[globalIndex];
                const endCoord = routeCoords[globalIndex + 1];
                if (!startCoord || !endCoord) {
                    return;
                }

                const numericValue = Array.isArray(congestionNumericData)
                    ? congestionNumericData[segmentOffset]
                    : undefined;

                const durationValue = Array.isArray(durationData) ? durationData[segmentOffset] : undefined;
                const distanceValue = Array.isArray(distanceData) ? distanceData[segmentOffset] : undefined;
                const speedValue = Array.isArray(speedData) ? speedData[segmentOffset] : undefined;

                const rawMaxEntry = Array.isArray(maxSpeedData) ? maxSpeedData[segmentOffset] : undefined;
                const maxSpeedMs = extractMaxSpeedMs(rawMaxEntry);

                const normalizedCongestion = normalizeCongestionCategory(congestion, numericValue, {
                    speedMs: typeof speedValue === 'number' && Number.isFinite(speedValue) ? speedValue : undefined,
                    distanceM: typeof distanceValue === 'number' && Number.isFinite(distanceValue) ? distanceValue : undefined,
                    durationSec: typeof durationValue === 'number' && Number.isFinite(durationValue) ? durationValue : undefined,
                    maxSpeedMs: maxSpeedMs ?? undefined,
                });

                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [startCoord, endCoord]
                    },
                    properties: {
                        congestion: normalizedCongestion,
                        congestion_numeric: numericValue ?? null,
                        segmentIndex: segmentOffset,
                        legIndex,
                        coordIndex: globalIndex
                    }
                } as Feature<LineString>);

                if (typeof globalIndex === 'number' && Number.isFinite(globalIndex)) {
                    lookup[globalIndex] = normalizedCongestion;
                }
            });

            coordIndex += congestionData.length;
        });

        console.log(`✅ Created ${features.length} congestion segments`);
        console.log('🚦 Congestion types found:', [...new Set(features.map(f => f.properties?.congestion))]);
        congestionLookupRef.current = lookup;

        return { type: 'FeatureCollection', features };
    }, []);

    const getCongestionColorForCategory = useCallback((category?: CongestionCategory | null) => {
        if (!category) return DEFAULT_TRAFFIC_COLOR;
        return CONGESTION_COLOR_MAP[category] ?? DEFAULT_TRAFFIC_COLOR;
    }, []);

    const getSegmentColorAtDistance = useCallback((distance: number) => {
        const cums = simCumDistRef.current;
        const coords = simCoordsRef.current;
        if (!cums || cums.length < 2 || !coords || coords.length < 2) {
            return getCongestionColorForCategory();
        }

        if (distance <= 0) {
            const category = congestionLookupRef.current[0];
            return getCongestionColorForCategory(category);
        }

        let idx = 1;
        while (idx < cums.length && cums[idx] < distance) idx++;
        const coordIdx = Math.max(0, Math.min(idx - 1, coords.length - 2));
        const category = congestionLookupRef.current[coordIdx];
        return getCongestionColorForCategory(category);
    }, [getCongestionColorForCategory]);

    const createVehicleElement = useCallback((color: string = '#0ea5e9') => {
        return createVehicleMarkerElement(color);
    }, []);

    const applyRouteSelection = useCallback((routesData: any[], index: number, refitView: boolean = true) => {
        if (!Array.isArray(routesData) || routesData.length === 0) {
            routesRef.current = [];
            setInstructions([]);
            setRouteSummary(null);
            setAnnotationMetrics({});
            routeDataRef.current = { type: 'FeatureCollection', features: [] };
            congestionLookupRef.current = {};
            simMarkerColorRef.current = null;
            if (mapRef.current) {
                const src = mapRef.current.getSource(routeSourceId) as mapboxgl.GeoJSONSource | undefined;
                src?.setData(routeDataRef.current);
                const stepSrc = mapRef.current.getSource(stepSourceId) as mapboxgl.GeoJSONSource | undefined;
                stepDataRef.current = { type: 'FeatureCollection', features: [] };
                stepSrc?.setData(stepDataRef.current);
                const congestionSrc = mapRef.current.getSource(congestionSourceId) as mapboxgl.GeoJSONSource | undefined;
                congestionDataRef.current = { type: 'FeatureCollection', features: [] };
                congestionSrc?.setData(congestionDataRef.current);
            }
            return;
        }

        const primaryIdx = Math.min(Math.max(index, 0), routesData.length - 1);
        const primaryRoute = routesData[primaryIdx];
        if (!primaryRoute) return;

        routesRef.current = routesData;

        const features: Feature<Geometry>[] = [];
        routesData.forEach((routeItem: any, idx: number) => {
            const geometry = routeItem?.geometry as LineString | undefined;
            if (!geometry || !geometry.coordinates) return;
            features.push({
                type: 'Feature',
                geometry,
                properties: {
                    routeIndex: idx,
                    isPrimary: idx === primaryIdx,
                },
            } as Feature<LineString>);
        });

        const fc: FeatureCollection<Geometry> = { type: 'FeatureCollection', features };
        routeDataRef.current = fc;
        if (mapRef.current) {
            const src = mapRef.current.getSource(routeSourceId) as mapboxgl.GeoJSONSource | undefined;
            src?.setData(fc);
        }

        setActiveStepIdx(null);
        const emptySteps: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: [] };
        stepDataRef.current = emptySteps;
        if (mapRef.current) {
            const stepSrc = mapRef.current.getSource(stepSourceId) as mapboxgl.GeoJSONSource | undefined;
            stepSrc?.setData(emptySteps);
            const congestionSrc = mapRef.current.getSource(congestionSourceId) as mapboxgl.GeoJSONSource | undefined;
            congestionDataRef.current = emptySteps;
            congestionSrc?.setData(emptySteps);
            congestionLookupRef.current = {};
        }

        if (openStepPopupRef.current) { openStepPopupRef.current.remove(); openStepPopupRef.current = null; }
        if (lastPassedPopupRef.current) { lastPassedPopupRef.current.remove(); lastPassedPopupRef.current = null; }
        if (nextPopupRef.current) { nextPopupRef.current.remove(); nextPopupRef.current = null; }

        const legs: any[] = Array.isArray(primaryRoute?.legs) ? primaryRoute.legs : [];

        const metrics: AnnotationMetrics = {};
        if (legs.length > 0) {
            const collectNumeric = (key: 'duration' | 'distance' | 'speed') => {
                const values: number[] = [];
                legs.forEach((leg: any) => {
                    const arr = leg?.annotation?.[key];
                    if (Array.isArray(arr)) {
                        arr.forEach((val: any) => {
                            if (typeof val === 'number' && Number.isFinite(val)) {
                                values.push(val);
                            }
                        });
                    }
                });
                return values;
            };

            const durationSegments = collectNumeric('duration');
            const distanceSegments = collectNumeric('distance');
            const speedSegments = collectNumeric('speed');

            const durationFromAnnotations = durationSegments.reduce((sum, val) => sum + val, 0);
            if (durationFromAnnotations > 0) {
                metrics.durationSec = durationFromAnnotations;
                metrics.durationSource = 'annotation';
            }

            const distanceFromAnnotations = distanceSegments.reduce((sum, val) => sum + val, 0);
            if (distanceFromAnnotations > 0) {
                metrics.distanceM = distanceFromAnnotations;
                metrics.distanceSource = 'annotation';
            }

            if (speedSegments.length > 0) {
                const avgSpeedMs = speedSegments.reduce((sum, val) => sum + val, 0) / speedSegments.length;
                if (Number.isFinite(avgSpeedMs) && avgSpeedMs > 0) {
                    metrics.averageSpeedKmh = avgSpeedMs * 3.6;
                    metrics.speedSource = 'segments';
                }
            }

            const congestionCounts: Record<string, number> = {};
            let congestionSamples = 0;
            legs.forEach((leg: any) => {
                const arr = Array.isArray(leg?.annotation?.congestion) ? leg.annotation.congestion : [];
                const numericArr = Array.isArray(leg?.annotation?.congestion_numeric) ? leg.annotation.congestion_numeric : [];
                const durationArr = Array.isArray(leg?.annotation?.duration) ? leg.annotation.duration : [];
                const distanceArr = Array.isArray(leg?.annotation?.distance) ? leg.annotation.distance : [];
                const speedArr = Array.isArray(leg?.annotation?.speed) ? leg.annotation.speed : [];
                const maxSpeedArr = Array.isArray(leg?.annotation?.maxspeed) ? leg.annotation.maxspeed : [];
                arr.forEach((val: any, idx: number) => {
                    const normalized = normalizeCongestionCategory(
                        typeof val === 'string' ? val : undefined,
                        numericArr[idx],
                        {
                            durationSec: durationArr[idx],
                            distanceM: distanceArr[idx],
                            speedMs: speedArr[idx],
                            maxSpeedMs: extractMaxSpeedMs(maxSpeedArr[idx]),
                        }
                    );
                    if (normalized && normalized.trim().length > 0) {
                        congestionCounts[normalized] = (congestionCounts[normalized] ?? 0) + 1;
                        congestionSamples++;
                    }
                });
            });
            if (congestionSamples > 0) {
                metrics.congestionLevels = congestionCounts;
                metrics.congestionSampleCount = congestionSamples;
            }
        }

        if (metrics.durationSec == null && typeof primaryRoute?.duration === 'number') {
            metrics.durationSec = primaryRoute.duration;
            metrics.durationSource = 'summary';
        }
        if (metrics.distanceM == null && typeof primaryRoute?.distance === 'number') {
            metrics.distanceM = primaryRoute.distance;
            metrics.distanceSource = 'summary';
        }
        if ((metrics.averageSpeedKmh == null || !Number.isFinite(metrics.averageSpeedKmh)) && metrics.distanceM != null && metrics.durationSec != null && metrics.durationSec > 0) {
            const derivedSpeed = (metrics.distanceM / metrics.durationSec) * 3.6;
            if (Number.isFinite(derivedSpeed) && derivedSpeed > 0) {
                metrics.averageSpeedKmh = derivedSpeed;
                if (!metrics.speedSource) metrics.speedSource = 'computed';
            } else {
                delete metrics.averageSpeedKmh;
                if (metrics.speedSource === 'segments' && !(Number.isFinite(derivedSpeed) && derivedSpeed > 0)) {
                    delete metrics.speedSource;
                }
            }
        }

        setAnnotationMetrics(metrics);

        // Create congestion segments for visualization
        const congestionFeatures = createCongestionSegments(primaryRoute);
        congestionDataRef.current = congestionFeatures;
        if (mapRef.current) {
            const congestionSrc = mapRef.current.getSource(congestionSourceId) as mapboxgl.GeoJSONSource | undefined;
            congestionSrc?.setData(congestionFeatures);
        }

        const steps = legs.flatMap((leg: any) => {
            const legSteps: any[] = Array.isArray(leg?.steps) ? leg.steps : [];
            const maxSpeedAnn: any[] | undefined = leg?.annotation?.maxspeed;
            let annotationIndex = 0;
            const getSpeedValue = (entry: any): number | null => {
                if (!entry || typeof entry !== 'object') return null;
                const candidates = [entry.speed, entry.speed_limit, entry.maxspeed, entry.value];
                for (const cand of candidates) {
                    if (typeof cand === 'number' && Number.isFinite(cand)) return cand;
                }
                return null;
            };
            const normalizeUnit = (entry: any): string | undefined => {
                if (!entry || typeof entry !== 'object') return undefined;
                const unit = entry.unit || entry.speed_unit || entry.maxspeed_unit;
                return typeof unit === 'string' && unit.trim().length > 0 ? unit : undefined;
            };
            return legSteps.map((step: any) => {
                const coordsForStep = step?.geometry?.coordinates;
                const segmentCount = Array.isArray(coordsForStep) ? Math.max(0, coordsForStep.length - 1) : 0;
                if (Array.isArray(maxSpeedAnn) && segmentCount > 0) {
                    const slice = maxSpeedAnn.slice(annotationIndex, annotationIndex + segmentCount);
                    annotationIndex += segmentCount;
                    if (slice.length > 0) {
                        const known = slice.find((entry) => entry && !entry.unknown && getSpeedValue(entry) != null);
                        const fallback = slice.find((entry) => entry && entry.unknown);
                        const chosen = known || fallback || null;
                        if (chosen) {
                            const speedValue = getSpeedValue(chosen);
                            const speedUnit = normalizeUnit(chosen);
                            step.speedLimit = {
                                value: speedValue != null ? speedValue : null,
                                unit: speedUnit,
                                unknown: !!chosen.unknown && (speedValue == null),
                            };
                        }
                    }
                } else if (Array.isArray(maxSpeedAnn) && segmentCount > 0) {
                    annotationIndex += segmentCount;
                }
                return step;
            });
        });

        setInstructions(steps);
        setRouteSummary({
            distanceKm: (primaryRoute?.distance ?? 0) / 1000,
            durationMin: (primaryRoute?.duration ?? 0) / 60,
        });

        const coords: [number, number][] = Array.isArray(primaryRoute?.geometry?.coordinates)
            ? primaryRoute.geometry.coordinates
            : [];
        if (!coords || coords.length === 0) {
            return;
        }

        const bounds = coords.reduce((b, c) => b.extend(c as any), new mapboxgl.LngLatBounds(coords[0] as any, coords[0] as any));
        if (keepZoom) {
            const center = bounds.getCenter();
            mapRef.current?.easeTo({ center: [center.lng, center.lat], duration: 300 });
        } else if (refitView) {
            mapRef.current?.fitBounds(bounds, { padding: 40, maxZoom: 16 });
        } else {
            const center = bounds.getCenter();
            mapRef.current?.easeTo({ center: [center.lng, center.lat], duration: 300 });
        }

        if (courseUpRef.current && coords.length >= 2) {
            const [lon1, lat1] = coords[0];
            const [lon2, lat2] = coords[1];
            const br = computeBearing(lat1, lon1, lat2, lon2);
            setHeadingDeg(br);
            cameraBearingRef.current = br;
            mapRef.current?.easeTo({ bearing: br, pitch: Math.max(mapRef.current?.getPitch() ?? 0, 50), duration: 400 });
        }

        simCoordsRef.current = coords;
        simCumDistRef.current = [0];
        for (let i = 1; i < coords.length; i++) {
            const d = distanceMeters(coords[i - 1], coords[i]);
            simCumDistRef.current.push(simCumDistRef.current[i - 1] + d);
        }
        simTotalDistRef.current = simCumDistRef.current[simCumDistRef.current.length - 1] ?? 0;
        simDistRef.current = 0;
        lastTsRef.current = null;
        stepStartCumRef.current = [];
        stepEndCumRef.current = [];
        stepFirstCoordIndexRef.current = [];
        stepMetersRef.current = [];
        stepDurationSecRef.current = [];
        stepCumDurEndRef.current = [];
        routeTotalDurationSecRef.current = (primaryRoute?.duration as number) || 0;
        {
            let globalIndex = 0;
            for (let si = 0; si < steps.length; si++) {
                const geom: [number, number][] = steps[si]?.geometry?.coordinates || [];
                if (!geom || geom.length === 0) {
                    stepStartCumRef.current.push(simCumDistRef.current[globalIndex] || 0);
                    stepEndCumRef.current.push(simCumDistRef.current[globalIndex] || 0);
                    stepFirstCoordIndexRef.current.push(globalIndex);
                    stepMetersRef.current.push(0);
                    stepDurationSecRef.current.push((steps[si]?.duration as number) || 0);
                    stepCumDurEndRef.current.push((stepCumDurEndRef.current[stepCumDurEndRef.current.length - 1] || 0) + ((steps[si]?.duration as number) || 0));
                    continue;
                }
                const first = geom[0];
                let found = globalIndex;
                for (let gi = globalIndex; gi < coords.length; gi++) {
                    if (coords[gi][0] === first[0] && coords[gi][1] === first[1]) { found = gi; break; }
                }
                stepFirstCoordIndexRef.current.push(found);
                const startCum = simCumDistRef.current[found] || 0;
                const endIdx = Math.min(coords.length - 1, found + Math.max(0, geom.length - 1));
                const endCum = simCumDistRef.current[endIdx] || startCum;
                stepStartCumRef.current.push(startCum);
                stepEndCumRef.current.push(endCum);
                stepMetersRef.current.push(Math.max(0, endCum - startCum));
                const stepDur = (steps[si]?.duration as number) || 0;
                stepDurationSecRef.current.push(stepDur);
                const prevCumDur = stepCumDurEndRef.current[stepCumDurEndRef.current.length - 1] || 0;
                stepCumDurEndRef.current.push(prevCumDur + stepDur);
                globalIndex = endIdx;
            }
        }
        nextStepIdxRef.current = 0;
        setSimRemainingM(simTotalDistRef.current);
        setSimEtaSec(routeTotalDurationSecRef.current);
        setSimToNextManeuverM(Math.max(0, (stepEndCumRef.current[0] || 0) - 0));
        const startPos = coords[0];
        const startColor = getSegmentColorAtDistance(0);
        const simEl = createVehicleElement(startColor);
        simMarkerColorRef.current = startColor;
        if (simMarkerRef.current) simMarkerRef.current.remove();
        if (mapRef.current) {
            simMarkerRef.current = new mapboxgl.Marker({ element: simEl, anchor: 'center' as any })
                .setLngLat(startPos as any)
                .addTo(mapRef.current);
        }

        setSimPlaying(false);
    }, [createCongestionSegments, createVehicleElement, distanceMeters, getSegmentColorAtDistance, keepZoom, setAnnotationMetrics]);


    // Robust geolocation handler for "Pin my location"
    const handlePinMyLocation = useCallback(async () => {
        try {
            if (typeof window === 'undefined') return;
            if (!('geolocation' in navigator)) {
                alert('Thiết bị hoặc trình duyệt không hỗ trợ định vị (Geolocation).');
                return;
            }

            // Geolocation requires secure context on most browsers (HTTPS or localhost)
            const isLocalhost = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|::1)$/i.test(location.hostname);
            const isSecure = (typeof window !== 'undefined' && (window.isSecureContext || location.protocol === 'https:')) || isLocalhost;
            if (!isSecure) {
                alert('Trình duyệt chặn định vị vì trang chưa chạy HTTPS. Hãy dùng https (hoặc localhost khi dev).');
                return;
            }

            // Check permission if available (optional)
            try {
                const perm = await (navigator as any)?.permissions?.query?.({ name: 'geolocation' as PermissionName });
                if (perm && perm.state === 'denied') {
                    alert('Bạn đã chặn quyền truy cập vị trí cho trang này. Hãy mở cài đặt quyền vị trí của trình duyệt và cho phép lại.');
                    return;
                }
            } catch { /* ignore if Permissions API not available */ }

            const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 1000,
                });
            });

            const pos = await getPosition();
            const { latitude, longitude } = pos.coords;
            set3DPinAt(longitude, latitude, '#22c55e');
        } catch (err: any) {
            // Map standard geolocation error codes to friendly messages
            const code = err?.code;
            const msg = err?.message;
            if (code === 1) {
                alert('Truy cập vị trí bị từ chối. Hãy cho phép trang truy cập vị trí trong cài đặt trình duyệt.');
            } else if (code === 2) {
                alert('Không xác định được vị trí. Hãy kiểm tra GPS hoặc thử lại sau.');
            } else if (code === 3) {
                alert('Lấy vị trí quá thời gian cho phép. Hãy thử lại khi tín hiệu tốt hơn.');
            } else {
                alert(`Không thể lấy vị trí: ${msg || 'Lỗi không xác định.'}`);
            }
        }
    }, [set3DPinAt]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (startPoint) return;
        let cancelled = false;

        const attemptInitialLocation = async () => {
            if (!('geolocation' in navigator)) return;

            const loc = typeof window !== 'undefined' ? window.location : undefined;
            const isLocalhost = !!loc && /^(localhost|127\.0\.0\.1|::1)$/i.test(loc.hostname);
            const isSecure = (!!loc && loc.protocol === 'https:') || (typeof window !== 'undefined' && window.isSecureContext) || isLocalhost;
            if (!isSecure) return;

            try {
                const perm = await (navigator as any)?.permissions?.query?.({ name: 'geolocation' as PermissionName });
                if (perm && perm.state === 'denied') return;
            } catch { /* ignore permission probing errors */ }

            const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 1000,
                });
            });

            try {
                const pos = await getPosition();
                if (cancelled) return;
                const { latitude, longitude } = pos.coords;
                setStartPoint({ lat: latitude, lng: longitude });
                updateStartLabelFrom(longitude, latitude);
            } catch { /* silently fall back to empty start point */ }
        };

        attemptInitialLocation();

        return () => {
            cancelled = true;
        };
    }, [startPoint, updateStartLabelFrom]);

    const ensureVehicleMarker = useCallback((lng: number, lat: number) => {
        if (!mapRef.current) return;
        if (!vehicleMarkerRef.current) {
            const el = createVehicleElement();
            vehicleElRef.current = el;
            vehicleMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' as any })
                .setLngLat([lng, lat])
                .addTo(mapRef.current);
        } else {
            vehicleMarkerRef.current.setLngLat([lng, lat]);
        }
    }, [createVehicleElement]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.key === 'q' || e.key === 'Q') {
                rotateBy(-10);
            } else if (e.key === 'e' || e.key === 'E') {
                rotateBy(10);
            } else if (e.key === 'r' || e.key === 'R') {
                resetNorth();
            } else if (e.key === 'Escape') {
                endPicking();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [rotateBy, resetNorth, endPicking]);

    const toggle3D = useCallback(() => {
        setIs3D((prev) => {
            const next = !prev;
            if (mapRef.current) {
                if (next) enable3D(mapRef.current);
                else disable3D(mapRef.current);
            }
            return next;
        });
    }, [enable3D, disable3D]);

    const toggleAngle = useCallback(() => {
        setAngled((prev) => {
            const next = !prev;
            if (mapRef.current) {
                if (next) {
                    mapRef.current.easeTo({ pitch: 55, bearing: -17.6, duration: 500 });
                } else {
                    mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 300 });
                }
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        const m = mapRef.current;

        if (!startMarkerRef.current && startPoint) {
            const startEl = create3DPinElement('#3b82f6', 1);
            startMarkerRef.current = new mapboxgl.Marker({ element: startEl, anchor: 'center' as any, draggable: true })
                .setLngLat(toLngLat(startPoint) as any)
                .addTo(m)
                .on('dragend', () => {
                    const ll = startMarkerRef.current!.getLngLat();
                    setStartPoint({ lat: ll.lat, lng: ll.lng });
                    updateStartLabelFrom(ll.lng, ll.lat);
                });
        } else if (startMarkerRef.current && startPoint) {
            startMarkerRef.current.setLngLat(toLngLat(startPoint) as any);
        }
        if (!endMarkerRef.current && endPoint) {
            const endEl = create3DPinElement('#ef4444', waypoints.length + 2);
            endMarkerRef.current = new mapboxgl.Marker({ element: endEl, anchor: 'center' as any, draggable: true })
                .setLngLat(toLngLat(endPoint) as any)
                .addTo(m)
                .on('dragend', () => {
                    const ll = endMarkerRef.current!.getLngLat();
                    setEndPoint({ lat: ll.lat, lng: ll.lng });
                    updateEndLabelFrom(ll.lng, ll.lat);
                });
        } else if (endMarkerRef.current && endPoint) {
            endMarkerRef.current.setLngLat(toLngLat(endPoint) as any);
        }
    }, [mapReady, startPoint, endPoint, updateStartLabelFrom, updateEndLabelFrom]);

    // Station markers effect
    useEffect(() => {
        if (!mapReady || !mapRef.current) return;

        // Clear existing station markers
        stationMarkersRef.current.forEach(marker => marker.remove());
        stationMarkersRef.current = [];

        // Add new station markers
        stations.forEach(station => {
            if (station.lat && station.lng) {
                const element = createStationMarkerElement(station, () => {
                    focusOnCoordinate({ lat: station.lat, lng: station.lng });
                });
                const marker = new mapboxgl.Marker({ element })
                    .setLngLat([station.lng, station.lat])
                    .addTo(mapRef.current!);
                stationMarkersRef.current.push(marker);
            }
        });
    }, [mapReady, stations, focusOnCoordinate]);

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        viaMarkersRef.current.forEach((mk) => mk.remove());
        viaMarkersRef.current = [];
        waypoints.forEach((wp, index) => {
            const wpEl = create3DPinElement('#1e40af', index + 2);
            const mk = new mapboxgl.Marker({ element: wpEl, anchor: 'center' as any }).setLngLat([wp.lng, wp.lat]).addTo(mapRef.current!);
            viaMarkersRef.current.push(mk);
        });

        // Update end marker number when waypoints change
        if (endMarkerRef.current && endPoint) {
            endMarkerRef.current.remove();
            const endEl = create3DPinElement('#ef4444', waypoints.length + 2);
            endMarkerRef.current = new mapboxgl.Marker({ element: endEl, anchor: 'center' as any, draggable: true })
                .setLngLat(toLngLat(endPoint) as any)
                .addTo(mapRef.current!)
                .on('dragend', () => {
                    const ll = endMarkerRef.current!.getLngLat();
                    setEndPoint({ lat: ll.lat, lng: ll.lng });
                    updateEndLabelFrom(ll.lng, ll.lat);
                });
        }
    }, [mapReady, waypoints, endPoint, create3DPinElement, updateEndLabelFrom]);

    const calculateRoute = useCallback(async (advancedOptions?: AdvancedOptions) => {
        if (!startPoint || !endPoint || !mapRef.current) return;
        const rawAnnotations = Array.isArray(advancedOptions?.annotations)
            ? advancedOptions.annotations.filter((item): item is string => typeof item === 'string')
            : undefined;
        const requestedAnnotations = Array.from(new Set([
            ...(rawAnnotations ?? []),
            'duration',
            'distance',
            'speed',
            'maxspeed',
            'congestion',
            'congestion_numeric',
        ]));
        setSelectedAnnotations(requestedAnnotations);
        setAnnotationMetrics({});
        setIsRouting(true);
        setInstructions([]);
        setRouteSummary(null);
        setRoutes([]);
        routesRef.current = [];
        setSelectedRouteIdx(0);
        const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string);
        const allPoints = [startPoint, ...waypoints, endPoint];
        const coordsParam = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');

        const profileMapbox = profile === 'walking' ? 'walking'
            : profile === 'cycling' ? 'cycling'
                : profile === 'driving-traffic' ? 'driving-traffic'
                    : 'driving';

        // Build URL with advanced options
        let url = `https://api.mapbox.com/directions/v5/mapbox/${profileMapbox}/${coordsParam}?`;

        const params = new URLSearchParams();

        if (advancedOptions) {
            // Basic routing options
            params.set('alternatives', advancedOptions.alternatives ? 'true' : 'false');
            params.set('geometries', advancedOptions.geometries || 'geojson');
            params.set('overview', advancedOptions.overview || 'full');
            params.set('steps', 'true');
            params.set('continue_straight', advancedOptions.continue_straight ? 'true' : 'false');

            // Language and voice
            params.set('language', advancedOptions.language || 'vi');
            if (advancedOptions.voice_instructions) {
                params.set('voice_instructions', 'true');
                params.set('voice_units', advancedOptions.voice_units || 'metric');
            }
            if (advancedOptions.banner_instructions) {
                params.set('banner_instructions', 'true');
            }

            // Exclusions
            if (advancedOptions.exclude && advancedOptions.exclude.length > 0) {
                params.set('exclude', advancedOptions.exclude.join(','));
            }

            // Time-based routing
            if (advancedOptions.depart_at) {
                params.set('depart_at', new Date(advancedOptions.depart_at).toISOString());
            }
            if (advancedOptions.arrive_by) {
                params.set('arrive_by', new Date(advancedOptions.arrive_by).toISOString());
            }

            // Vehicle specifications (for truck routing)
            if (advancedOptions.max_weight) {
                params.set('max_weight', (advancedOptions.max_weight * 1000).toString()); // convert to kg
            }
            if (advancedOptions.max_height) {
                params.set('max_height', advancedOptions.max_height.toString());
            }
            if (advancedOptions.max_width) {
                params.set('max_width', advancedOptions.max_width.toString());
            }
            if (advancedOptions.max_length) {
                params.set('max_length', advancedOptions.max_length.toString());
            }

            // Engine type
            if (advancedOptions.engine) {
                params.set('engine', advancedOptions.engine);
            }

            // Approaches and waypoint snapping
            if (advancedOptions.approaches && advancedOptions.approaches.length > 0) {
                params.set('approaches', new Array(allPoints.length).fill('unrestricted').join(';'));
            }
        } else {
            // Default options for basic routing - force driving-traffic for congestion data
            params.set('alternatives', 'false');
            params.set('geometries', 'geojson');
            params.set('overview', 'full');
            params.set('steps', 'true');
            params.set('language', 'vi'); // Default to Vietnamese
        }

        params.set('annotations', requestedAnnotations.join(','));
        params.set('access_token', token || '');
        url += params.toString();
        console.log('🚗 Making routing request with URL:', url);

        try {
            const res = await fetch(url);
            const data = await res.json();

            console.log('📦 Full API Response:', data);
            console.log('📊 First route legs:', data?.routes?.[0]?.legs);

            if (Array.isArray(data?.routes) && data.routes.length > 0) {
                // Log congestion data for debugging
                data.routes.forEach((route: any, index: number) => {
                    console.log(`🛣️ Route ${index} legs:`, route.legs?.length);
                    route.legs?.forEach((leg: any, legIndex: number) => {
                        const congestion = leg?.annotation?.congestion;
                        console.log(`  Leg ${legIndex} congestion:`, congestion?.length, 'segments');
                        console.log(`  Congestion types:`, [...new Set(congestion || [])]);
                    });
                });

                setRoutes(data.routes);
                routesRef.current = data.routes;
                setSelectedRouteIdx(0);
                applyRouteSelection(data.routes, 0, true);
            } else {
                console.error('❌ No routes found in API response:', data);
                setRoutes([]);
                routesRef.current = [];
                alert('Không tìm thấy tuyến đường.');
            }
        } catch (e) {
            console.error('[Mapbox] Directions fetch error:', e);
            alert('Lỗi khi gọi Directions API.');
        } finally {
            setIsRouting(false);
        }
    }, [startPoint, endPoint, waypoints, profile, keepZoom, simSpeed, applyRouteSelection]);

    const handleSelectRoute = useCallback((index: number) => {
        if (index === selectedRouteIdx) return;
        const currentRoutes = routesRef.current.length ? routesRef.current : routes;
        if (!Array.isArray(currentRoutes) || !currentRoutes[index]) return;
        setSelectedRouteIdx(index);
        applyRouteSelection(currentRoutes, index, true);
    }, [applyRouteSelection, routes, selectedRouteIdx]);

    useEffect(() => {
        if (!simPlaying) {
            if (simRAFRef.current != null) cancelAnimationFrame(simRAFRef.current);
            simRAFRef.current = null;
            lastTsRef.current = null;
            return;
        }
        if (!mapRef.current || !simMarkerRef.current || simTotalDistRef.current <= 0) return;
        const baseSpeed = 10; // m/s at 1x
        const step = (ts: number) => {
            if (!lastTsRef.current) lastTsRef.current = ts;
            const dtSec = Math.min(1, (ts - lastTsRef.current) / 1000);
            lastTsRef.current = ts;
            const advance = baseSpeed * simSpeed * dtSec;
            simDistRef.current = Math.min(simTotalDistRef.current, simDistRef.current + advance);
            const sample = positionAtDistance(simDistRef.current);
            if (sample) {
                const { pos, bearing } = sample;
                simMarkerRef.current!.setLngLat(pos as any);
                const el = simMarkerRef.current!.getElement() as HTMLDivElement;
                el.style.transform = `translateY(-4px) rotate(${bearing}deg)`;
                const trafficColor = getSegmentColorAtDistance(simDistRef.current);
                if (trafficColor && trafficColor !== simMarkerColorRef.current) {
                    updateVehicleMarkerElementColor(el, trafficColor);
                    simMarkerColorRef.current = trafficColor;
                }
                let camBearing = bearing;
                if (smoothTurns) {
                    const maxTurn = maxTurnRateDegPerSecRef.current * dtSec;
                    camBearing = stepBearingTowards(cameraBearingRef.current ?? bearing, bearing, maxTurn);
                    cameraBearingRef.current = camBearing;
                } else {
                    cameraBearingRef.current = bearing;
                }
                setHeadingDeg(camBearing);
                if (simFollow) {
                    const baseZoom = simLockedZoomRef.current != null ? simLockedZoomRef.current : mapRef.current!.getZoom();
                    const doubledZoom = Math.min(22, baseZoom);
                    const targetZoom = keepZoom ? doubledZoom : Math.max(doubledZoom, 18);
                    const targetPitch = Math.max(mapRef.current!.getPitch(), 60);
                    mapRef.current!.jumpTo({ center: pos as any, bearing: camBearing, zoom: targetZoom, pitch: targetPitch });
                }
                // Update metrics
                const remaining = Math.max(0, simTotalDistRef.current - simDistRef.current);
                setSimRemainingM(remaining);
                // Prefer ETA projected from routing API duration for consistency with route summary
                if (routeTotalDurationSecRef.current > 0) {
                    const fracRemaining = simTotalDistRef.current > 0 ? (remaining / simTotalDistRef.current) : 0;
                    setSimEtaSec(fracRemaining * routeTotalDurationSecRef.current);
                } else {
                    const v = baseSpeed * Math.max(0.1, simSpeed);
                    setSimEtaSec(remaining / v);
                }
                // Determine current and next step by cumulative arrays
                const starts = stepStartCumRef.current;
                const ends = stepEndCumRef.current;
                const nSteps = starts.length;
                if (nSteps > 0) {
                    let idx = nextStepIdxRef.current;
                    // Advance index while we've passed the end of the step
                    while (idx < nSteps && simDistRef.current >= (ends[idx] - 1e-6)) idx++;
                    // Determine indices for passed and upcoming instructions
                    const currentIdx = Math.min(nSteps - 1, idx); // step we are currently in
                    const curPassedIdx = currentIdx; // the maneuver at the start of the current step has just been passed
                    const nextIdx = Math.min(nSteps - 1, idx + 1); // upcoming step (next maneuver)
                    nextStepIdxRef.current = idx;
                    // Distance to next maneuver: distance from current position to END of current step
                    const toNextEnd = ends[currentIdx] ?? simTotalDistRef.current;
                    const toNext = Math.max(0, toNextEnd - simDistRef.current);
                    setSimToNextManeuverM(toNext);
                    if (mapRef.current) {
                        try {
                            // Build or update 'next' popup at next maneuver location
                            const nextStep = instructions[nextIdx];
                            const nextLoc = nextStep?.maneuver?.location as [number, number] | undefined;
                            if (nextLoc && (!nextPopupRef.current)) {
                                const html = renderInstructionPopupHTML(nextStep);
                                nextPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, closeButton: false, offset: 14, className: 'instruction-popup' })
                                    .setLngLat(nextLoc as any)
                                    .setHTML(html)
                                    .addTo(mapRef.current);
                            } else if (nextLoc && nextPopupRef.current) {
                                const html = renderInstructionPopupHTML(nextStep);
                                nextPopupRef.current.setLngLat(nextLoc as any).setHTML(html);
                            }
                            // Build/update 'passed' popup at current/past step location
                            const passedStep = instructions[curPassedIdx];
                            const passedLoc = passedStep?.maneuver?.location as [number, number] | undefined;
                            if (passedLoc && (!lastPassedPopupRef.current)) {
                                const html = renderInstructionPopupHTML(passedStep);
                                lastPassedPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, closeButton: false, offset: 14, className: 'instruction-popup' })
                                    .setLngLat(passedLoc as any)
                                    .setHTML(html)
                                    .addTo(mapRef.current);
                            } else if (passedLoc && lastPassedPopupRef.current) {
                                const html = renderInstructionPopupHTML(passedStep);
                                lastPassedPopupRef.current.setLngLat(passedLoc as any).setHTML(html);
                            }
                        } catch { }
                    }
                }
            }
            if (simDistRef.current >= simTotalDistRef.current) {
                setSimPlaying(false);
                // Cleanup popups at end
                if (lastPassedPopupRef.current) { lastPassedPopupRef.current.remove(); lastPassedPopupRef.current = null; }
                if (nextPopupRef.current) { nextPopupRef.current.remove(); nextPopupRef.current = null; }
                simRAFRef.current = null;
                return;
            }
            simRAFRef.current = requestAnimationFrame(step);
        };
        simRAFRef.current = requestAnimationFrame(step);
        return () => {
            if (simRAFRef.current != null) cancelAnimationFrame(simRAFRef.current);
            simRAFRef.current = null;
            if (lastPassedPopupRef.current) { lastPassedPopupRef.current.remove(); lastPassedPopupRef.current = null; }
            if (nextPopupRef.current) { nextPopupRef.current.remove(); nextPopupRef.current = null; }
        };
    }, [simPlaying, simSpeed, simFollow, positionAtDistance, keepZoom, instructions]);

    useEffect(() => {
        if (simPlaying && simFollow && mapRef.current) {
            if (simLockedZoomRef.current == null) {
                const currentZoom = mapRef.current.getZoom();
                simLockedZoomRef.current = keepZoom ? currentZoom : Math.max(currentZoom, 17);
            }
        } else {
            simLockedZoomRef.current = null;
        }
    }, [keepZoom, simPlaying, simFollow]);

    const focusStep = useCallback((index: number) => {
        if (!mapRef.current || !instructions[index]) return;
        setActiveStepIdx(index);
        const step = instructions[index];
        const data: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: step?.geometry ? [{ type: 'Feature', geometry: step.geometry as Geometry, properties: {} } as Feature<Geometry>] : [] };
        stepDataRef.current = data;
        const src = mapRef.current.getSource(stepSourceId) as mapboxgl.GeoJSONSource;
        src && src.setData(data);
        try {
            const coords = step.geometry.coordinates as [number, number][];
            if (coords && coords.length >= 2) {
                const [lon1, lat1] = coords[0];
                const [lon2, lat2] = coords[1];
                const bearing = computeBearing(lat1, lon1, lat2, lon2);
                cameraBearingRef.current = bearing;
                setHeadingDeg(bearing);
                const bounds = coords.reduce((b, c) => b.extend(c as any), new mapboxgl.LngLatBounds(coords[0] as any, coords[0] as any));
                const center = bounds.getCenter();
                mapRef.current.easeTo({ center: [center.lng, center.lat], bearing, pitch: 60, duration: 600 });
                if (!keepZoom) mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 18 });

                if (!showAllPopups) {
                    try {
                        const loc = step?.maneuver?.location as [number, number] | undefined;
                        if (loc && Array.isArray(loc) && loc.length >= 2) {
                            if (openStepPopupRef.current) {
                                openStepPopupRef.current.remove();
                                openStepPopupRef.current = null;
                            }
                            const html = renderInstructionPopupHTML(step);
                            openStepPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, offset: 10 })
                                .setLngLat(loc as any)
                                .setHTML(html)
                                .addTo(mapRef.current!);
                        }
                    } catch { }
                }
            }
        } catch { }
    }, [instructions, keepZoom]);

    useEffect(() => {
        if (!guidanceMode) return;
        if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
        if (geoWatchIdRef.current != null) return;
        const id = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, heading } = pos.coords as any;
                const cp = { lat: latitude, lng: longitude };
                ensureVehicleMarker(cp.lng, cp.lat);
                let targetBearing: number | null = null;
                if (typeof heading === 'number' && !Number.isNaN(heading)) {
                    targetBearing = heading;
                } else if (activeStepIdx != null && instructions[activeStepIdx]?.geometry?.coordinates?.length >= 2) {
                    const [lon1, lat1] = instructions[activeStepIdx].geometry.coordinates[0];
                    const [lon2, lat2] = instructions[activeStepIdx].geometry.coordinates[1];
                    targetBearing = computeBearing(lat1, lon1, lat2, lon2);
                }
                if (targetBearing != null) {
                    const now = performance.now();
                    const prevTs = lastGuidanceTsRef.current ?? now;
                    const dtSec = Math.min(1, (now - prevTs) / 1000);
                    lastGuidanceTsRef.current = now;
                    let camBearing = targetBearing;
                    if (smoothTurns) {
                        const maxTurn = maxTurnRateDegPerSecRef.current * dtSec;
                        camBearing = stepBearingTowards(cameraBearingRef.current ?? targetBearing, targetBearing, maxTurn);
                        cameraBearingRef.current = camBearing;
                    } else {
                        cameraBearingRef.current = targetBearing;
                    }
                    setHeadingDeg(camBearing);
                    mapRef.current?.easeTo({ center: [cp.lng, cp.lat], bearing: camBearing, duration: 250 });
                } else {
                    mapRef.current?.easeTo({ center: [cp.lng, cp.lat], duration: 250 });
                }
            },
            (err) => { console.warn('[Mapbox] Geolocation error:', err); },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );
        geoWatchIdRef.current = (id as unknown as number) ?? null;
        return () => {
            if (geoWatchIdRef.current != null) {
                navigator.geolocation.clearWatch(geoWatchIdRef.current);
                geoWatchIdRef.current = null;
            }
        };
    }, [guidanceMode, activeStepIdx, instructions]);

    useEffect(() => {
        if (!vehicleElRef.current) return;
        vehicleElRef.current.style.transform = `translateY(-4px) rotate(${headingDeg}deg)`;
    }, [headingDeg]);

    useEffect(() => {
        // Always rebuild markers; popups depend on simPlaying/showAllPopups
        stepMarkersRef.current.forEach((m) => m.remove());
        stepMarkersRef.current = [];
        // Remove any adhoc open step popup when rebuilding
        if (openStepPopupRef.current) {
            openStepPopupRef.current.remove();
            openStepPopupRef.current = null;
        }
        // When simulation is running, also remove any static step popups and skip creating them
        if (simPlaying) {
            stepPopupsRef.current.forEach((p) => p.remove());
            stepPopupsRef.current = [];
        }
        if (!mapReady || !mapRef.current) return;
        if (!instructions || instructions.length === 0) return;

        const makeStepEl = (modifier?: string, step?: any) => {
            const wrap = document.createElement('div');
            wrap.style.width = '28px';
            wrap.style.height = '28px';
            wrap.style.borderRadius = '9999px';
            wrap.style.background = '#ffffff';
            wrap.style.border = '2px solid #2563eb';
            wrap.style.boxShadow = '0 3px 6px rgba(0,0,0,0.25)';
            wrap.style.display = 'flex';
            wrap.style.alignItems = 'center';
            wrap.style.justifyContent = 'center';
            wrap.style.cursor = 'pointer';
            try {
                const { src } = pickManeuverIcon(step || { maneuver: { modifier } });
                const rotate = computeManeuverRotation(step || { maneuver: { modifier } });
                if (src) {
                    const img = document.createElement('img');
                    img.src = src;
                    img.width = 16;
                    img.height = 16;
                    img.style.display = 'block';
                    wrap.appendChild(img);
                    return wrap;
                }
            } catch { }
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.style.transform = `rotate(${computeManeuverRotation(step || { maneuver: { modifier } })}deg)`;
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', 'M12 2 L15 10 L12 8 L9 10 Z');
            path.setAttribute('fill', '#2563eb');
            svg.appendChild(path);
            wrap.appendChild(svg);
            return wrap;
        };

        instructions.forEach((step: any, idx: number) => {
            const loc = step?.maneuver?.location as [number, number] | undefined;
            if (!loc || !Array.isArray(loc) || loc.length < 2) return;
            const el = makeStepEl(step?.maneuver?.modifier, step);
            const mk = new mapboxgl.Marker({ element: el, anchor: 'center' as any })
                .setLngLat(loc as any)
                .addTo(mapRef.current!);
            if (showAllPopups && !simPlaying) {
                try {
                    const html = renderInstructionPopupHTML(step);
                    const pp = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'instruction-popup' })
                        .setLngLat(loc as any)
                        .setHTML(html)
                        .addTo(mapRef.current!);
                    stepPopupsRef.current.push(pp);
                } catch { }
            }
            el.addEventListener('click', () => {
                try {
                    const coords = step?.geometry?.coordinates as [number, number][] | undefined;
                    if (coords && coords.length >= 2) {
                        const [lon1, lat1] = coords[0];
                        const [lon2, lat2] = coords[1];
                        const br = computeBearing(lat1, lon1, lat2, lon2);
                        setActiveStepIdx(idx);
                        stepDataRef.current = { type: 'FeatureCollection', features: step?.geometry ? [{ type: 'Feature', geometry: step.geometry as Geometry, properties: {} } as Feature<Geometry>] : [] };
                        const src = mapRef.current!.getSource(stepSourceId) as mapboxgl.GeoJSONSource;
                        src && src.setData(stepDataRef.current);
                        cameraBearingRef.current = br;
                        const cam: any = { center: loc as any, bearing: br, pitch: Math.max(mapRef.current!.getPitch(), 60), duration: 500 };
                        if (!keepZoom) cam.zoom = Math.max(mapRef.current!.getZoom(), 17.5);
                        mapRef.current!.easeTo(cam);
                        setHeadingDeg(br);

                        if (!showAllPopups && !simPlaying) {
                            try {
                                if (openStepPopupRef.current) {
                                    openStepPopupRef.current.remove();
                                    openStepPopupRef.current = null;
                                }
                                const html = renderInstructionPopupHTML(step);
                                openStepPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, closeButton: false, offset: 14, className: 'instruction-popup' })
                                    .setLngLat(loc as any)
                                    .setHTML(html)
                                    .addTo(mapRef.current!);
                            } catch { }
                        }
                    }
                } catch { }
            });
            stepMarkersRef.current.push(mk);
        });

        return () => {
            stepMarkersRef.current.forEach((m) => m.remove());
            stepMarkersRef.current = [];
            if (openStepPopupRef.current) {
                openStepPopupRef.current.remove();
                openStepPopupRef.current = null;
            }
            stepPopupsRef.current.forEach((p) => p.remove());
            stepPopupsRef.current = [];
        };
    }, [instructions, mapReady, showAllPopups, simPlaying]);

    useEffect(() => {
        if (simPlaying) {
            // Suppress adhoc popup while simulating
            if (openStepPopupRef.current) {
                openStepPopupRef.current.remove();
                openStepPopupRef.current = null;
            }
            return;
        }
        if (showAllPopups) return;
        if (!mapReady || !mapRef.current) return;
        if (!instructions || instructions.length === 0) return;
        const idx = activeStepIdx != null ? activeStepIdx : 0;
        const step = instructions[idx];
        if (!step) return;
        const loc = step?.maneuver?.location as [number, number] | undefined;
        if (!loc || !Array.isArray(loc) || loc.length < 2) return;
        const html = renderInstructionPopupHTML(step);
        try {
            if (openStepPopupRef.current) {
                const cur = openStepPopupRef.current.getLngLat();
                if (cur && cur.lng === loc[0] && cur.lat === loc[1]) {
                    openStepPopupRef.current.setHTML(html);
                    return;
                }
                openStepPopupRef.current.remove();
                openStepPopupRef.current = null;
            }
            openStepPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, closeButton: false, offset: 14, className: 'instruction-popup' })
                .setLngLat(loc as any)
                .setHTML(html)
                .addTo(mapRef.current!);
        } catch { }
    }, [activeStepIdx, instructions, mapReady, showAllPopups, simPlaying]);

    useEffect(() => {
        if (!guidanceMode || activeStepIdx == null || !instructions[activeStepIdx]) return;
        const step = instructions[activeStepIdx];
        const coords: [number, number][] | undefined = step?.geometry?.coordinates;
        if (!coords || coords.length === 0) return;
        const toMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
            const R = 6371000;
            const dLat = ((b.lat - a.lat) * Math.PI) / 180;
            const dLon = ((b.lng - a.lng) * Math.PI) / 180;
            const lat1 = (a.lat * Math.PI) / 180;
            const lat2 = (b.lat * Math.PI) / 180;
            const s1 = Math.sin(dLat / 2);
            const s2 = Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2), Math.sqrt(1 - (s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2)));
            return R * c;
        };
        const [endLon, endLat] = coords[coords.length - 1];
        const center = mapRef.current?.getCenter();
        if (!center) return;
        const distToEnd = toMeters({ lat: center.lat, lng: center.lng }, { lat: endLat, lng: endLon });
        if (distToEnd <= autoAdvanceThresholdM) {
            const nextIdx = Math.min(instructions.length - 1, activeStepIdx + 1);
            if (nextIdx !== activeStepIdx) focusStep(nextIdx);
        }
    }, [guidanceMode, activeStepIdx, instructions, focusStep]);

    useEffect(() => {
        if (!courseUp || guidanceMode) return;
        if (!mapRef.current) return;
        let coords: [number, number][] | undefined;
        const idx = activeStepIdx ?? 0;
        const step = instructions[idx];
        if (step?.geometry?.coordinates) {
            coords = step.geometry.coordinates as [number, number][];
        } else {
            const routeGeom = routeDataRef.current?.features?.[0]?.geometry as any;
            if (routeGeom?.coordinates) coords = routeGeom.coordinates as [number, number][];
        }
        if (!coords || coords.length < 2) return;
        const [lon1, lat1] = coords[0];
        const [lon2, lat2] = coords[1];
        const br = computeBearing(lat1, lon1, lat2, lon2);
        setHeadingDeg(br);
        mapRef.current.easeTo({ bearing: br, pitch: Math.max(mapRef.current.getPitch(), 50), duration: 300 });
    }, [courseUp, guidanceMode, activeStepIdx, instructions]);

    return (
        <div className="w-full h-screen flex flex-col">
            <style>{`
                .mapboxgl-popup.instruction-popup { pointer-events: none; }
                .mapboxgl-popup.instruction-popup .mapboxgl-popup-content {
                    background: rgba(255,255,255,0.85);
                    backdrop-filter: blur(2px);
                    padding: 6px 8px;
                    border-radius: 8px;
                    box-shadow: 0 6px 16px rgba(0,0,0,0.18);
                    pointer-events: auto;
                }
                .mapboxgl-popup.instruction-popup .mapboxgl-popup-tip { display: none; }
            `}</style>
            <Toolbar
                is3D={is3D}
                angled={angled}
                keepZoom={keepZoom}
                showAllPopups={showAllPopups}
                onToggle3D={toggle3D}
                onToggleAngle={toggleAngle}
                onToggleKeepZoom={() => setKeepZoom(v => !v)}
                onToggleShowAllPopups={() => setShowAllPopups(v => !v)}
                onRotateLeft={() => rotateBy(-10)}
                onRotateRight={() => rotateBy(10)}
                onResetNorth={resetNorth}
                onPinMyLocation={handlePinMyLocation}
                toggleTraffic={toggleTraffic}
                isTrafficVisible={isTrafficVisible}
                toggleCongestion={toggleCongestion}
                isCongestionVisible={isCongestionVisible}
            />

            {/* Station List */}
            <div className="absolute top-80 right-4 z-10 w-80">
                <StationFilter
                    onStationClick={handleStationClick}
                    onStationDelete={handleStationDelete}
                    onStationAdded={handleStationAdded}
                    onStationNavigate={handleStationNavigate}
                    map={mapRef.current}
                />
            </div>
            {error ? (
                <div className="p-4 text-red-600 text-sm">{error}</div>
            ) : null}
            <div ref={mapContainer} style={{ height: "100%", width: "100%" }} />
            <ControlsPanel
                profile={profile}
                setProfile={(p) => setProfile(p)}
                isRouting={isRouting}
                calculateRoute={calculateRoute}
                instructions={instructions}
                routeSummary={routeSummary}
                selectedAnnotations={selectedAnnotations}
                annotationMetrics={annotationMetrics}
                activeStepIdx={activeStepIdx}
                focusStep={focusStep}
                onStartGuidance={() => { if (!instructions || instructions.length === 0) return; setGuidanceMode(true); focusStep(0); }}
                startPoint={startPoint}
                endPoint={endPoint}
                waypoints={waypoints}
                startLabel={startLabel}
                endLabel={endLabel}
                waypointLabels={waypointLabels}
                setWaypointLabels={setWaypointLabels}
                setStartPoint={setStartPoint}
                setEndPoint={setEndPoint}
                setWaypoints={setWaypoints}
                onPickStart={() => beginPicking({ type: 'start' })}
                onPickEnd={() => beginPicking({ type: 'end' })}
                onPickWaypoint={(index: number) => beginPicking({ type: 'via', index })}
                focusOnCoordinate={focusOnCoordinate}
                routeAlternatives={routeAlternatives}
                selectedRouteIndex={selectedRouteIdx}
                onSelectRoute={handleSelectRoute}
            />
            <SimulationPanel
                simPlaying={simPlaying}
                setSimPlaying={setSimPlaying}
                simSpeed={simSpeed}
                setSimSpeed={setSimSpeed}
                simFollow={simFollow}
                setSimFollow={setSimFollow}
                canSimulate={!!routeDataRef.current && simTotalDistRef.current > 0}
                onSimReset={() => {
                    simDistRef.current = 0;
                    lastTsRef.current = null;
                    nextStepIdxRef.current = 0;
                    setSimRemainingM(simTotalDistRef.current);
                    if (routeTotalDurationSecRef.current > 0) setSimEtaSec(routeTotalDurationSecRef.current);
                    else setSimEtaSec((simTotalDistRef.current / (10 * Math.max(0.1, simSpeed))) || 0);
                    setSimToNextManeuverM(Math.max(0, (stepEndCumRef.current[0] || 0) - 0));
                    const sample = positionAtDistance(0);
                    if (sample && simMarkerRef.current) {
                        simMarkerRef.current.setLngLat(sample.pos as any);
                        const el = simMarkerRef.current.getElement() as HTMLDivElement;
                        el.style.transform = `translateY(-4px) rotate(${sample.bearing}deg)`;
                        const resetColor = getSegmentColorAtDistance(0);
                        if (resetColor && resetColor !== simMarkerColorRef.current) {
                            updateVehicleMarkerElementColor(el, resetColor);
                            simMarkerColorRef.current = resetColor;
                        }
                        cameraBearingRef.current = sample.bearing;
                        if (simFollow && mapRef.current) {
                            const baseZoom = simLockedZoomRef.current != null ? simLockedZoomRef.current : mapRef.current.getZoom();
                            const doubledZoom = Math.min(22, baseZoom + 1);
                            const targetZoom = keepZoom ? doubledZoom : Math.max(doubledZoom, 18);
                            const targetPitch = Math.max(mapRef.current.getPitch(), 60);
                            mapRef.current.jumpTo({ center: sample.pos as any, bearing: cameraBearingRef.current, zoom: targetZoom, pitch: targetPitch });
                        }
                    }
                }}
                simRemainingM={simRemainingM}
                simEtaSec={simEtaSec}
                simToNextManeuverM={simToNextManeuverM}
            />
            <GuidanceHUD
                visible={guidanceMode}
                headingDeg={headingDeg}
                instructions={instructions}
                activeStepIdx={activeStepIdx}
                onPrev={() => focusStep(Math.max(0, (activeStepIdx || 0) - 1))}
                onNext={() => focusStep(Math.min(instructions.length - 1, (activeStepIdx || 0) + 1))}
                onStop={() => { setGuidanceMode(false); setActiveStepIdx(null); (mapRef.current?.getSource(stepSourceId) as mapboxgl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] } as any); }}
            />
        </div>
    );
}
