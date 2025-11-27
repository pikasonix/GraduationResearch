import React from 'react';
import { MapPin, Navigation, ArrowRight, Clock, Truck, Package, Hourglass, Calendar } from 'lucide-react';

interface RouteSegment {
    from: { lat: number; lng: number; address?: string };
    to: { lat: number; lng: number; address?: string };
    index: number;
    metrics?: {
        distance: number;
        travelTime: number;
        arrivalTime: number;
        waitTime: number;
        demand: number;
        load: number;
        serviceDuration: number;
    };
}

interface RouteSegmentsListProps {
    segments: RouteSegment[];
    selectedSegmentIndex?: number | null;
    onSelectSegment: (segment: RouteSegment) => void;
    className?: string;
}

const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}p`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}p` : `${h}h`;
};

const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
};

export const RouteSegmentsList: React.FC<RouteSegmentsListProps> = ({
    segments,
    selectedSegmentIndex,
    onSelectSegment,
    className = '',
}) => {
    if (!segments || segments.length === 0) return null;

    return (
        <div className={`fixed bottom-4 right-4 z-[350] flex max-h-[calc(60vh-2rem)] w-[340px] max-w-[90vw] flex-col rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur ${className}`}>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lộ trình</span>
                    <h3 className="text-sm font-bold text-slate-800">Danh sách chặng</h3>
                </div>
                <div className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {segments.length}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                {segments.map((segment, idx) => {
                    const isSelected = selectedSegmentIndex === segment.index;
                    return (
                        <div 
                            key={idx}
                            className={`group relative flex flex-col gap-1.5 rounded-lg border p-2 transition-all cursor-pointer
                                ${isSelected 
                                    ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500' 
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                                }`}
                            onClick={() => onSelectSegment(segment)}
                        >
                            <div className="flex items-center justify-between mb-0.5">
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                                    ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                    {idx + 1}
                                </span>
                                {segment.metrics && (
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                        <span className="flex items-center gap-0.5" title="Thời gian đến">
                                            <Clock size={10} />
                                            {formatTime(segment.metrics.arrivalTime)}
                                        </span>
                                        <span className="flex items-center gap-0.5" title="Khoảng cách">
                                            <Navigation size={10} />
                                            {formatDistance(segment.metrics.distance)}
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-start gap-1.5">
                                    <div className="mt-1 min-w-[12px] flex justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 ring-1 ring-green-100" />
                                    </div>
                                    <span className="text-slate-700 line-clamp-1 leading-tight">
                                        {segment.from.address || `${segment.from.lat.toFixed(6)}, ${segment.from.lng.toFixed(6)}`}
                                    </span>
                                </div>
                                
                                <div className="ml-[5px] border-l border-dashed border-slate-300 h-2" />
                                
                                <div className="flex items-start gap-1.5">
                                    <div className="mt-1 min-w-[12px] flex justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-red-100" />
                                    </div>
                                    <span className="text-slate-700 line-clamp-1 leading-tight font-medium">
                                        {segment.to.address || `${segment.to.lat.toFixed(6)}, ${segment.to.lng.toFixed(6)}`}
                                    </span>
                                </div>
                            </div>

                            {segment.metrics && (
                                <div className="mt-1 pt-1.5 border-t border-slate-100 grid grid-cols-3 gap-1">
                                    <div className="flex flex-col items-center p-1 bg-slate-50 rounded">
                                        <span className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Di chuyển</span>
                                        <div className="flex items-center gap-0.5 text-slate-700 font-semibold text-[10px]">
                                            <Truck size={10} className="text-blue-500" />
                                            {formatDuration(segment.metrics.travelTime)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center p-1 bg-slate-50 rounded">
                                        <span className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Hàng hóa</span>
                                        <div className="flex items-center gap-0.5 text-slate-700 font-semibold text-[10px]">
                                            <Package size={10} className="text-orange-500" />
                                            {segment.metrics.demand} / {segment.metrics.load}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center p-1 bg-slate-50 rounded">
                                        <span className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Chờ đợi</span>
                                        <div className="flex items-center gap-0.5 text-slate-700 font-semibold text-[10px]">
                                            <Hourglass size={10} className={segment.metrics.waitTime > 0 ? "text-red-500" : "text-slate-400"} />
                                            {formatDuration(segment.metrics.waitTime)}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {isSelected && (
                                <button className="mt-1 w-full py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm">
                                    <Navigation size={10} />
                                    Đang xem chặng này
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
