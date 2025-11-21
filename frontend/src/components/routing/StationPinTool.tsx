"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Zap, Wrench, X, Save, MapPinIcon } from 'lucide-react';
import { supabase } from '@/supabase/client';

export type StationType = 'rescue' | 'charging';

export interface Station {
    id?: string;
    name: string;
    type: StationType;
    lat: number;
    lng: number;
    description?: string;
    contact?: string;
    created_at?: string;
    updated_at?: string;
}

interface StationPinToolProps {
    map: mapboxgl.Map;
    isActive: boolean;
    onToggle: () => void;
    onStationAdded: (station: Station) => void;
}

export const StationPinTool: React.FC<StationPinToolProps> = ({
    map,
    isActive,
    onToggle,
    onStationAdded,
}) => {
    const [pendingStation, setPendingStation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'rescue' as StationType,
        description: '',
        contact: '',
    });
    const [isLoading, setSaving] = useState(false);
    const [portalNode, setPortalNode] = useState<Element | null>(null);
    const mapClickHandlerRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);

    useEffect(() => {
        setPortalNode(document.body);
    }, []);

    useEffect(() => {
        if (isActive && map) {
            map.getCanvas().style.cursor = 'crosshair';

            const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
                const { lng, lat } = e.lngLat;
                setPendingStation({ lat, lng });
                setIsFormVisible(true);
            };

            mapClickHandlerRef.current = handleMapClick;
            map.on('click', handleMapClick);
        } else {
            if (map) {
                map.getCanvas().style.cursor = '';
            }
            if (mapClickHandlerRef.current) {
                map?.off('click', mapClickHandlerRef.current);
                mapClickHandlerRef.current = null;
            }
        }

        return () => {
            if (map && mapClickHandlerRef.current) {
                map.off('click', mapClickHandlerRef.current);
            }
        };
    }, [isActive, map]);

    const handleSaveStation = async () => {
        if (!pendingStation || !formData.name.trim()) return;

        setSaving(true);
        try {
            const station: Station = {
                name: formData.name.trim(),
                type: formData.type,
                lat: pendingStation.lat,
                lng: pendingStation.lng,
                description: formData.description.trim() || undefined,
                contact: formData.contact.trim() || undefined,
            };

            const { data, error } = await supabase
                .from('stations')
                .insert(station)
                .select()
                .single();

            if (error) throw error;

            onStationAdded({ ...station, id: data.id });

            // Reset form
            handleCancelPin();

        } catch (error) {
            console.error('Lỗi khi lưu trạm:', error);
            alert('Không thể lưu trạm. Vui lòng thử lại.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelPin = () => {
        setPendingStation(null);
        setIsFormVisible(false);
        setFormData({
            name: '',
            type: 'rescue',
            description: '',
            contact: '',
        });
    };

    return (
        <>
            {/* Tool Button */}
            <button
                onClick={onToggle}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 ${isActive
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                title="Thêm trạm cứu hộ/sạc"
            >
                <MapPinIcon className="h-3.5 w-3.5" />
                Thêm trạm
            </button>

            {/* Station Form Modal */}
            {isFormVisible && pendingStation && portalNode && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 px-4 py-8">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Thêm trạm mới</h3>
                                <p className="mt-1 text-sm text-slate-500">Nhấp lên bản đồ để chọn vị trí, sau đó điền thông tin chi tiết cho trạm.</p>
                            </div>
                            <button
                                onClick={handleCancelPin}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
                                aria-label="Đóng"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-5 space-y-4">
                            {/* Station Name */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Tên trạm *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="Nhập tên trạm"
                                    autoFocus
                                />
                            </div>

                            {/* Station Type */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Loại trạm
                                </label>
                                <div className="flex gap-3 text-sm">
                                    <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${formData.type === 'rescue' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>
                                        <input
                                            type="radio"
                                            value="rescue"
                                            checked={formData.type === 'rescue'}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value as StationType })}
                                            className="h-4 w-4 text-orange-500 focus:ring-orange-400"
                                        />
                                        <span className="inline-flex items-center gap-1">
                                            <Wrench className="h-4 w-4" />
                                            Cứu hộ
                                        </span>
                                    </label>
                                    <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${formData.type === 'charging' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>
                                        <input
                                            type="radio"
                                            value="charging"
                                            checked={formData.type === 'charging'}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value as StationType })}
                                            className="h-4 w-4 text-emerald-500 focus:ring-emerald-400"
                                        />
                                        <span className="inline-flex items-center gap-1">
                                            <Zap className="h-4 w-4" />
                                            Trạm sạc
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Mô tả
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="Mô tả về trạm (tùy chọn)"
                                    rows={3}
                                />
                            </div>

                            {/* Contact */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Liên hệ
                                </label>
                                <input
                                    type="text"
                                    value={formData.contact}
                                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="Số điện thoại hoặc email (tùy chọn)"
                                />
                            </div>

                            {/* Coordinates */}
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                Tọa độ đã chọn: <span className="font-semibold text-slate-800">{pendingStation.lat.toFixed(6)}, {pendingStation.lng.toFixed(6)}</span>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={handleCancelPin}
                                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveStation}
                                disabled={!formData.name.trim() || isLoading}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
                            >
                                <Save className="h-4 w-4" />
                                {isLoading ? 'Đang lưu...' : 'Lưu trạm'}
                            </button>
                        </div>
                    </div>
                </div>,
                portalNode
            )}
        </>
    );
};