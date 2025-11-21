"use client";
import React, { useState, useCallback } from 'react';
import {
    Settings,
    Clock,
    Route as RouteIcon,
    Navigation,
    MapPin,
    Zap,
    Fuel,
    Car,
    Truck,
    TreePine,
    Shield,
    Globe,
    ChevronDown,
    ChevronUp,
    Info
} from 'lucide-react';

type Profile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';

interface AdvancedOptions {
    // Routing preferences
    alternatives: boolean;
    geometries: 'geojson' | 'polyline' | 'polyline6';
    overview: 'full' | 'simplified' | 'false';
    continue_straight: boolean;

    // Traffic and timing
    depart_at?: string; // ISO timestamp for future departure
    arrive_by?: string; // ISO timestamp for arrival constraint

    // Route optimization
    approaches: string[]; // 'unrestricted', 'curb', 'opposite'
    waypoint_snapping: string[]; // 'any', 'map_snap'

    // Exclusions
    exclude: string[]; // 'toll', 'motorway', 'ferry', 'unpaved', 'cash_only_tolls'

    // Annotations
    annotations: string[]; // 'duration', 'distance', 'speed', 'congestion', 'maxspeed'

    // Language and units
    language: string;
    voice_instructions: boolean;
    voice_units: 'imperial' | 'metric';
    banner_instructions: boolean;

    // Vehicle specifications (for truck routing)
    max_weight?: number;
    max_height?: number;
    max_width?: number;
    max_length?: number;
}

interface AdvancedRoutingPanelProps {
    profile: Profile;
    onCalculateRoute: (options: AdvancedOptions) => void;
    isRouting: boolean;
}

const AdvancedRoutingPanel: React.FC<AdvancedRoutingPanelProps> = ({
    profile,
    onCalculateRoute,
    isRouting
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [options, setOptions] = useState<AdvancedOptions>({
        alternatives: false,
        geometries: 'geojson',
        overview: 'full',
        continue_straight: false,
        approaches: [],
        waypoint_snapping: [],
        exclude: [],
        annotations: ['duration', 'distance', 'speed'],
        language: 'vi', // Vietnamese language
        voice_instructions: true,
        voice_units: 'metric',
        banner_instructions: true
    });

    const toggleArrayValue = useCallback((key: keyof AdvancedOptions, value: string) => {
        setOptions(prev => {
            const currentArray = (prev[key] as string[]) || [];
            const newArray = currentArray.includes(value)
                ? currentArray.filter(item => item !== value)
                : [...currentArray, value];
            return { ...prev, [key]: newArray };
        });
    }, []);

    const handleCalculateRoute = useCallback(() => {
        onCalculateRoute(options);
    }, [options, onCalculateRoute]);

    if (!isExpanded) {
        return (
            <div className="w-full mb-4">
                <div className="bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-3">
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <Settings size={16} className="text-blue-600" />
                            Tùy chọn nâng cao
                        </span>
                        <ChevronDown size={16} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mb-4">
            <div className="bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Settings size={16} className="text-blue-600" />
                        Tùy chọn nâng cao
                    </h3>
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <ChevronUp size={16} />
                    </button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {/* Basic Route Options */}
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-xs">
                            <input
                                type="checkbox"
                                checked={options.alternatives}
                                onChange={(e) => setOptions(prev => ({ ...prev, alternatives: e.target.checked }))}
                                className="rounded"
                            />
                            <span>Tuyến thay thế</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                            <input
                                type="checkbox"
                                checked={options.continue_straight}
                                onChange={(e) => setOptions(prev => ({ ...prev, continue_straight: e.target.checked }))}
                                className="rounded"
                            />
                            <span>Đi thẳng ưu tiên</span>
                        </label>
                    </div>

                    {/* Route Quality */}
                    <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <RouteIcon size={14} />
                            Chất lượng tuyến đường
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                            {(['full', 'simplified', 'false'] as const).map(level => (
                                <button
                                    key={level}
                                    onClick={() => setOptions(prev => ({ ...prev, overview: level }))}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${options.overview === level
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {level === 'full' ? 'Đầy đủ' : level === 'simplified' ? 'Đơn giản' : 'Tắt'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Exclusions */}
                    <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Shield size={14} />
                            Tránh đường
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                                { value: 'toll', label: 'Phí đường', icon: <Fuel size={12} /> },
                                { value: 'motorway', label: 'Đường cao tốc', icon: <Car size={12} /> },
                                { value: 'ferry', label: 'Phà', icon: <Navigation size={12} /> },
                                { value: 'unpaved', label: 'Đường đất', icon: <TreePine size={12} /> }
                            ].map(exclusion => (
                                <label key={exclusion.value} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={options.exclude.includes(exclusion.value)}
                                        onChange={() => toggleArrayValue('exclude', exclusion.value)}
                                        className="rounded"
                                    />
                                    <span className="flex items-center gap-1">
                                        {exclusion.icon}
                                        {exclusion.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Language & Voice */}
                    <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Globe size={14} />
                            Ngôn ngữ & Giọng nói
                        </h4>
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setOptions(prev => ({ ...prev, language: 'vi' }))}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${options.language === 'vi'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    🇻🇳 Tiếng Việt
                                </button>
                                <button
                                    onClick={() => setOptions(prev => ({ ...prev, language: 'en' }))}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${options.language === 'en'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    🇺🇸 English
                                </button>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={options.voice_instructions}
                                        onChange={(e) => setOptions(prev => ({ ...prev, voice_instructions: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span>Hướng dẫn giọng nói</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={options.banner_instructions}
                                        onChange={(e) => setOptions(prev => ({ ...prev, banner_instructions: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span>Banner chỉ dẫn</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Annotations */}
                    <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Info size={14} />
                            Thông tin bổ sung
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                                { value: 'duration', label: 'Thời gian' },
                                { value: 'distance', label: 'Khoảng cách' },
                                { value: 'speed', label: 'Tốc độ' },
                                { value: 'congestion', label: 'Tắc đường' }
                            ].map(annotation => (
                                <label key={annotation.value} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={options.annotations.includes(annotation.value)}
                                        onChange={() => toggleArrayValue('annotations', annotation.value)}
                                        className="rounded"
                                    />
                                    <span>{annotation.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Vehicle Specifications (for truck profile if added) */}
                    {profile === 'driving' && (
                        <div>
                            <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                                <Truck size={14} />
                                Thông số xe (tùy chọn)
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <label className="block mb-1">Trọng lượng (kg)</label>
                                    <input
                                        type="number"
                                        placeholder="Max weight"
                                        value={options.max_weight || ''}
                                        onChange={(e) => setOptions(prev => ({
                                            ...prev,
                                            max_weight: e.target.value ? Number(e.target.value) : undefined
                                        }))}
                                        className="w-full px-2 py-1 border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1">Chiều cao (m)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="Max height"
                                        value={options.max_height || ''}
                                        onChange={(e) => setOptions(prev => ({
                                            ...prev,
                                            max_height: e.target.value ? Number(e.target.value) : undefined
                                        }))}
                                        className="w-full px-2 py-1 border rounded"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timing Options */}
                    <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Clock size={14} />
                            Thời gian (tùy chọn)
                        </h4>
                        <div className="space-y-2 text-xs">
                            <div>
                                <label className="block mb-1">Khởi hành lúc:</label>
                                <input
                                    type="datetime-local"
                                    value={options.depart_at || ''}
                                    onChange={(e) => setOptions(prev => ({ ...prev, depart_at: e.target.value || undefined }))}
                                    className="w-full px-2 py-1 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block mb-1">Đến nơi trước:</label>
                                <input
                                    type="datetime-local"
                                    value={options.arrive_by || ''}
                                    onChange={(e) => setOptions(prev => ({ ...prev, arrive_by: e.target.value || undefined }))}
                                    className="w-full px-2 py-1 border rounded"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action button */}
                <div className="border-t pt-3 mt-4">
                    <button
                        onClick={handleCalculateRoute}
                        disabled={isRouting}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-md transition-colors flex items-center justify-center gap-2"
                    >
                        <Zap size={16} />
                        {isRouting ? 'Đang tìm đường nâng cao...' : 'Tìm đường với tùy chọn nâng cao'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedRoutingPanel;
export type { AdvancedOptions };