"use client";

import React, { useState, useEffect } from 'react';
import { Zap, Wrench, MapPin, Phone, Clock, Trash2, Edit, Info, PanelLeftOpen, PanelRightOpen, Star, Navigation } from 'lucide-react';
import { StationService } from './StationService';
import type { Station, StationType } from './StationPinTool';
import { formatDistance } from './formatters';
import { StationPinTool } from './StationPinTool';
import type mapboxgl from 'mapbox-gl';

type StationListItem = Station & {
    distance?: number | null;
    status?: string | null;
    rating?: number | null;
    ratingProvider?: string | null;
    connectors?: string[] | null;
};

interface StationFilterProps {
    onStationClick?: (station: Station) => void;
    onStationEdit?: (station: Station) => void;
    onStationDelete?: (stationId: string) => void;
    onStationAdded?: (station: Station) => void;
    onStationNavigate?: (station: Station) => void;
    map?: mapboxgl.Map | null;
    className?: string;
}

export const StationFilter: React.FC<StationFilterProps> = ({
    onStationClick,
    onStationEdit,
    onStationDelete,
    onStationAdded,
    onStationNavigate,
    map,
    className = '',
}) => {
    const [stations, setStations] = useState<StationListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | StationType>('all');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isPinToolActive, setIsPinToolActive] = useState(false);

    useEffect(() => {
        loadStations();
    }, [filter]);

    const loadStations = async () => {
        try {
            setLoading(true);
            setError(null);

            let data: StationListItem[];
            if (filter === 'all') {
                data = await StationService.getAllStations();
            } else {
                data = await StationService.getStationsByType(filter);
            }

            setStations(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi không xác định');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (stationId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa trạm này?')) return;

        try {
            setDeletingId(stationId);
            await StationService.deleteStation(stationId);
            setStations(prev => prev.filter(s => s.id !== stationId));
            onStationDelete?.(stationId);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Không thể xóa trạm');
        } finally {
            setDeletingId(null);
        }
    };

    const getStationIcon = (type: StationType) => {
        return type === 'rescue' ? Wrench : Zap;
    };

    const getStationTypeText = (type: StationType) => {
        return type === 'rescue' ? 'Cứu hộ' : 'Sạc điện';
    };

    const formatCoordinate = (value: number | undefined) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return '—';
        return value.toFixed(3);
    };

    const formatDate = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const filteredStations = stations;

    const formatStationDistance = (distance?: number | null) => {
        if (typeof distance !== 'number' || Number.isNaN(distance)) return null;
        const normalizedMeters = distance > 200 ? distance : distance * 1000;
        return formatDistance(normalizedMeters);
    };

    if (isCollapsed) {
        return (
            <div className={`fixed bottom-4 right-4 z-[360] w-[340px] max-w-[90vw] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur ${className}`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-1 flex-col leading-tight">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Danh sách trạm</span>
                        <span className="text-[10px] font-medium text-slate-500">{stations.length} trạm · {filter === 'all' ? 'Tất cả' : getStationTypeText(filter)}</span>
                    </div>
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-400"
                        title="Mở danh sách trạm"
                    >
                        <PanelRightOpen className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed bottom-4 right-4 z-[350] flex max-h-[calc(60vh-2rem)] w-[370px] max-w-[90vw] flex-col rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur ${className}`}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạm sạc và Cứu hộ</span>
                    <h3 className="text-base font-semibold text-slate-900">Danh sách trạm</h3>
                </div>

                <div className="flex items-center gap-2">
                    {map ? (
                        <StationPinTool
                            map={map}
                            isActive={isPinToolActive}
                            onToggle={() => setIsPinToolActive((prev) => !prev)}
                            onStationAdded={async (station) => {
                                setIsPinToolActive(false);
                                onStationAdded?.(station);
                                await loadStations();
                            }}
                        />
                    ) : (
                        <button
                            disabled
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-400"
                            title="Bản đồ đang khởi tạo"
                        >
                            <MapPin className="h-4 w-4" />
                            Thêm trạm
                        </button>
                    )}

                    <button
                        onClick={() => {
                            setIsPinToolActive(false);
                            setIsCollapsed(true);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        title="Thu gọn danh sách trạm"
                    >
                        <PanelLeftOpen className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Filter */}
            <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {[
                        { key: 'all' as const, label: `Tốt nhất (${stations.length})`, icon: null },
                        { key: 'charging' as const, label: 'Trạm sạc', icon: Zap },
                        { key: 'rescue' as const, label: 'Cứu hộ', icon: Wrench },
                    ].map(({ key, label, icon: IconComponent }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 transition-colors ${filter === key
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                        >
                            {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Station List */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 text-sm">
                {loading && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-slate-500">
                        Đang tải danh sách trạm...
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-500">
                        {error}
                        <button
                            onClick={loadStations}
                            className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-500"
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                {!loading && !error && filteredStations.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                        {filter === 'all' ? 'Chưa có trạm nào' : `Chưa có trạm ${getStationTypeText(filter).toLowerCase()}`}
                    </div>
                )}

                {!loading && !error && filteredStations.map((station) => {
                    const Icon = getStationIcon(station.type);
                    const stationTypeText = getStationTypeText(station.type);
                    const distanceText = formatStationDistance((station as StationListItem).distance);
                    const statusLabel = (station as StationListItem).status ?? null;
                    const ratingValue = (station as StationListItem).rating;
                    const ratingProvider = (station as StationListItem).ratingProvider ?? '';
                    const connectors = (station as StationListItem).connectors ?? [];

                    return (
                        <div
                            key={station.id}
                            className="mb-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition-all hover:-translate-y-[1px] hover:border-blue-200 hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-1 items-start gap-3">
                                    <span
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${station.type === 'rescue' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </span>

                                    <div className="min-w-0 space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {onStationClick ? (
                                                <button
                                                    onClick={() => onStationClick(station)}
                                                    className="truncate text-left text-sm font-semibold text-slate-900 hover:text-blue-600"
                                                >
                                                    {station.name}
                                                </button>
                                            ) : (
                                                <span className="truncate text-sm font-semibold text-slate-900">
                                                    {station.name}
                                                </span>
                                            )}

                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${station.type === 'rescue' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {stationTypeText}
                                            </span>

                                            {statusLabel && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                                                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                                                    {statusLabel}
                                                </span>
                                            )}
                                        </div>

                                        {station.description && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Info className="h-3.5 w-3.5 text-slate-300" />
                                                <span className="line-clamp-2 leading-snug">{station.description}</span>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                            <span className="inline-flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5 text-slate-300" />
                                                <span className="tabular-nums">{formatCoordinate(station.lat)}, {formatCoordinate(station.lng)}</span>
                                            </span>

                                            {station.contact && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Phone className="h-3.5 w-3.5 text-slate-300" />
                                                    <span className="truncate">{station.contact}</span>
                                                </span>
                                            )}

                                            {connectors && connectors.length > 0 && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                    {connectors.join(' · ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 text-right">
                                    {distanceText && (
                                        <span className="text-sm font-semibold text-slate-700">{distanceText}</span>
                                    )}

                                    {typeof ratingValue === 'number' && Number.isFinite(ratingValue) && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                                            <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                                            {ratingValue.toFixed(1)} {ratingProvider && <span className="text-[10px] font-medium text-amber-500">{ratingProvider}</span>}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t rounded-b-2xl border-slate-100 pt-3 text-xs text-slate-500">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 text-slate-300" />
                                        <span>{formatDate(station.created_at)}</span>
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {onStationNavigate && (
                                        <button
                                            onClick={() => onStationNavigate(station)}
                                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 transition-colors hover:bg-blue-100"
                                            title="Đặt làm điểm đến"
                                        >
                                            <Navigation className="h-3.5 w-3.5" />
                                            Chỉ đường
                                        </button>
                                    )}

                                    <div className="flex items-center gap-1">
                                        {onStationEdit && (
                                            <button
                                                onClick={() => onStationEdit(station)}
                                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                                                title="Chỉnh sửa"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                        )}

                                        {onStationDelete && (
                                            <button
                                                onClick={() => handleDelete(station.id!)}
                                                disabled={deletingId === station.id}
                                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                title="Xóa"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Refresh Button */}
            {!loading && (
                <div className="border-t rounded-b-2xl border-slate-200 bg-slate-50 px-4 py-3">
                    <button
                        onClick={loadStations}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                    >
                        Làm mới danh sách
                    </button>
                </div>
            )}
        </div>
    );
};