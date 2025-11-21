"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';

export interface NodeRow {
    id: number;
    type: 'depot' | 'pickup' | 'delivery' | 'regular';
    lat: number;
    lng: number;
    demand: number;
    earliestTime: number; // minutes
    latestTime: number; // minutes
    serviceDuration: number; // minutes
    pickupId?: number; // for delivery nodes: the pickup they correspond to
    deliveryId?: number; // for pickup nodes: the delivery they are paired with
}

interface NodeEditorProps {
    node: NodeRow;
    nodes: NodeRow[];
    onUpdate: (n: NodeRow) => void;
    onDelete: (id: number) => void;
    showNotification: (t: 'success' | 'error' | 'info', m: string) => void;
    dense?: boolean; // compact layout for popovers
    onSaved?: () => void; // callback when saved successfully (e.g., to close popover)
    showId?: boolean; // show ID field
    showCoords?: boolean; // show Lat/Lng fields
    // Called to start interactive coordinate picking on the map for this node
    onStartPick?: () => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({ node, nodes, onUpdate, onDelete, showNotification, dense = false, onSaved, showId = true, showCoords = true, onStartPick }) => {
    const [edited, setEdited] = useState<NodeRow>({ ...node });

    // Controls fill their grid cell; we use 2-col grids in dense mode for paired fields
    const inputWidthClass = 'w-full';

    useEffect(() => { setEdited({ ...node }); }, [node]);

    const handleSave = () => {
        if (edited.type === 'delivery' && !edited.pickupId) {
            showNotification('error', 'Delivery cần chọn pickup');
            return;
        }
        onUpdate(edited);
        showNotification('success', 'Node saved');
        onSaved?.();
    };

    const setNodeType = (type: NodeRow['type']) => {
        setEdited(prev => {
            let next: NodeRow = { ...prev, type };
            if (type !== 'delivery') {
                next.pickupId = undefined; // delivery-only field
            }
            if (type !== 'pickup') {
                next.deliveryId = undefined; // pickup-only field (legacy)
            }
            return next;
        });
    };

    const numericInput = (label: string, value: number, onChange: (v: number) => void, extra?: { min?: number, disabled?: boolean }) => (
        <div>
            <label className={`${dense ? 'text-[11px]' : 'text-xs'} block`}>{label}</label>
            <input
                type="number"
                value={value}
                min={extra?.min}
                disabled={extra?.disabled}
                onChange={e => !extra?.disabled && onChange(Number(e.target.value))}
                className={`${inputWidthClass} border ${dense ? 'px-2 py-1 h-8 text-xs' : 'px-2 py-1'} rounded ${extra?.disabled ? 'bg-gray-100 text-gray-500' : ''}`}
            />
        </div>
    );

    // Pickups that are not yet paired with any delivery OR the current assigned pickup (when editing an existing delivery)
    const currentAssignedPickupId = edited.type === 'delivery' ? edited.pickupId : undefined;
    const availablePickups = useMemo(() => {
        return nodes.filter(p => p.type === 'pickup' && (
            !nodes.some(d => d.type === 'delivery' && d.pickupId === p.id && p.id !== currentAssignedPickupId)
        ));
    }, [nodes, currentAssignedPickupId]);

    // Auto sync demand for delivery when pickup changes
    useEffect(() => {
        if (edited.type === 'delivery' && edited.pickupId) {
            const pickup = nodes.find(n => n.id === edited.pickupId);
            if (pickup) {
                const expected = -Math.abs(pickup.demand);
                if (edited.demand !== expected) {
                    setEdited(p => ({ ...p, demand: expected }));
                }
            }
        }
    }, [edited.type, edited.pickupId, edited.demand, nodes]);

    const handlePickupSelection = (pickupId: number) => {
        if (!pickupId) {
            setEdited(p => ({ ...p, pickupId: undefined }));
            return;
        }
        const pickup = nodes.find(n => n.id === pickupId);
        if (!pickup) return;
        setEdited(p => ({ ...p, pickupId, demand: -Math.abs(pickup.demand) }));
    };

    const demandDisabled = edited.type === 'delivery';

    return (
        <div
            className={`${dense ? 'space-y-2 text-xs' : 'space-y-3 text-sm'}`}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // Avoid saving if delivery invalid
                    if (!(edited.type === 'delivery' && !edited.pickupId)) handleSave();
                }
            }}
        >
            <div className={`grid ${dense ? 'grid-cols-2' : 'grid-cols-2'} gap-2 items-end`}>
                {showId && numericInput('ID', edited.id, v => setEdited(p => ({ ...p, id: v })))}
                {/* Type and Demand on same row: Type select + Demand numeric input */}
                <div className="flex space-x-2">
                    <div className="flex-1">
                        <label className={`${dense ? 'text-[11px]' : 'text-xs'} block`}>Type</label>
                        <select value={edited.type} onChange={e => setNodeType(e.target.value as any)} className={`${inputWidthClass} border ${dense ? 'px-2 py-1 h-8 text-xs' : 'px-2 py-1'} rounded`}>
                            <option value="depot">Depot</option>
                            <option value="pickup">Pickup</option>
                            <option value="delivery">Delivery</option>
                            <option value="regular">Regular</option>
                        </select>
                    </div>
                </div>
                <div className="flex-1">
                    {numericInput(`Demand${demandDisabled ? ' (auto)' : ''}`, edited.demand, v => setEdited(p => ({ ...p, demand: v })), { disabled: demandDisabled })}
                </div>
            </div>
            {showCoords && (
                <div className={`flex items-start gap-2`}>
                    <div className="flex-1">
                        <label className={`${dense ? 'text-[11px]' : 'text-xs'} block`}>Lat</label>
                        <input
                            type="number"
                            value={edited.lat}
                            onChange={e => setEdited(p => ({ ...p, lat: Number(e.target.value) }))}
                            className={`${inputWidthClass} border ${dense ? 'px-2 py-1 h-8 text-xs' : 'px-2 py-1'} rounded`}
                        />
                    </div>
                    <div className="flex-1">
                        <label className={`${dense ? 'text-[11px]' : 'text-xs'} block`}>Lng</label>
                        <input
                            type="number"
                            value={edited.lng}
                            onChange={e => setEdited(p => ({ ...p, lng: Number(e.target.value) }))}
                            className={`${inputWidthClass} border ${dense ? 'px-2 py-1 h-8 text-xs' : 'px-2 py-1'} rounded`}
                        />
                    </div>
                    <div className="flex items-end">
                        <button type="button" onClick={() => onStartPick?.()} title="Chọn tọa độ trên bản đồ" className="ml-2 p-2 rounded bg-gray-100 hover:bg-gray-200 border">
                            <MapPin className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
            <div className={`grid ${dense ? 'grid-cols-2' : 'grid-cols-2'} gap-2`}>
                {numericInput('Earliest', edited.earliestTime, v => setEdited(p => ({ ...p, earliestTime: v })))}
                {numericInput('Latest', edited.latestTime, v => setEdited(p => ({ ...p, latestTime: v })))}
            </div>
            {numericInput('Service (max)', edited.serviceDuration, v => setEdited(p => ({ ...p, serviceDuration: v })))}

            {edited.type === 'pickup' && (
                <p className="text-[11px] text-gray-500">Pickup không cần chọn delivery ngay; tạo delivery sau.</p>
            )}
            {edited.type === 'delivery' && (
                <div className="space-y-1">
                    <label className={`${dense ? 'text-[11px]' : 'text-xs'} block`}>Chọn Pickup</label>
                    <select
                        value={edited.pickupId || ''}
                        onChange={e => handlePickupSelection(Number(e.target.value))}
                        className={`${inputWidthClass} border ${dense ? 'px-2 py-1 h-8 text-xs' : 'px-2 py-1'} rounded`}
                    >
                        <option value="">-- Chọn pickup --</option>
                        {availablePickups.map(p => <option key={p.id} value={p.id}>#{p.id} d={p.demand}</option>)}
                    </select>
                    {!edited.pickupId && <p className="text-[11px] text-red-600">Bắt buộc.</p>}
                </div>
            )}
            <div className="flex space-x-2 pt-2">
                <button onClick={handleSave} disabled={edited.type === 'delivery' && !edited.pickupId} className={`flex-1 ${dense ? 'h-8 px-2 text-sm' : 'px-3 py-2'} bg-blue-600 text-white rounded disabled:opacity-50`}>Lưu</button>
                <button onClick={() => { if (confirm('Xóa node này?')) onDelete(edited.id); }} className={`${dense ? 'h-8 px-2 text-sm' : 'px-3 py-2'} bg-red-600 text-white rounded`}>Xóa</button>
            </div>
        </div>
    );
};

export default NodeEditor;