"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';

export interface NodeRow {
    id: number;
    type: 'depot' | 'pickup' | 'delivery' | 'none';
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

    const labelClass = dense ? 'text-[11px] text-gray-500' : 'text-xs text-gray-600';
    const helpClass = dense ? 'text-[10px] text-gray-400' : 'text-xs text-gray-400';
    const inputBaseClass = `w-full rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${dense ? 'h-8 px-2 text-xs' : 'py-2 px-2 text-sm'}`;
    const inputDisabledClass = 'bg-gray-100 text-gray-500';
    const groupPrefixClass = dense ? 'text-[10px] text-gray-400 font-mono' : 'text-xs text-gray-400 font-mono';
    const groupInputPad = dense ? 'pl-10' : 'pl-12';

    const DenseInputGroup: React.FC<{ prefix: string; children: React.ReactNode }>
        = ({ prefix, children }) => (
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <span className={groupPrefixClass}>{prefix}</span>
                </div>
                {children}
            </div>
        );

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
            className={`${dense ? 'space-y-2' : 'space-y-4'} text-gray-700`}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!(edited.type === 'delivery' && !edited.pickupId)) handleSave();
                }
            }}
        >
            {/* ID & Type */}
            <div className={dense ? 'flex items-end gap-2' : 'grid grid-cols-12 gap-2'}>
                {showId && (
                    <div className={dense ? 'shrink-0' : 'col-span-3'}>
                        <label className={`${dense ? labelClass : 'text-[10px] font-bold text-gray-400 uppercase tracking-wider'} mb-1 block`}>ID</label>
                        <div className={`${dense ? 'px-2 h-8' : 'px-2 py-1.5'} flex items-center justify-center bg-gray-100 border rounded text-xs font-mono font-bold text-gray-600 min-w-[52px]`}>
                            {edited.id}
                        </div>
                    </div>
                )}
                <div className={dense ? 'flex-1' : (showId ? 'col-span-9' : 'col-span-12')}>
                    {dense ? (
                        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                            <button
                                type="button"
                                onClick={() => setNodeType('depot')}
                                aria-pressed={edited.type === 'depot'}
                                className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium shadow-sm ${edited.type === 'depot' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                                title="Depot"
                            >
                                Depot
                            </button>
                            <button
                                type="button"
                                onClick={() => setNodeType('pickup')}
                                aria-pressed={edited.type === 'pickup'}
                                className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium shadow-sm ${edited.type === 'pickup' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                                title="Pickup"
                            >
                                Pickup
                            </button>
                            <button
                                type="button"
                                onClick={() => setNodeType('delivery')}
                                aria-pressed={edited.type === 'delivery'}
                                className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium shadow-sm ${edited.type === 'delivery' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                                title="Delivery"
                            >
                                Delivery
                            </button>
                            <button
                                type="button"
                                onClick={() => setNodeType('none')}
                                aria-pressed={edited.type === 'none'}
                                className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium shadow-sm ${edited.type === 'none' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                                title="None"
                            >
                                None
                            </button>
                        </div>
                    ) : (
                        <>
                            <label className={`${dense ? labelClass : 'text-[10px] font-bold text-gray-400 uppercase tracking-wider'} mb-1 block`}>Loại</label>
                            <select
                                value={edited.type}
                                onChange={e => setNodeType(e.target.value as any)}
                                className={`${inputBaseClass} ${dense ? '' : ''}`}
                            >
                                <option value="depot">Depot</option>
                                <option value="pickup">Pickup</option>
                                <option value="delivery">Delivery</option>
                                <option value="none">None</option>
                            </select>
                        </>
                    )}
                </div>
            </div>

            {/* Coordinates */}
            {showCoords && (
                <div>
                    <div className={dense ? 'grid grid-cols-[1fr_1fr_auto] gap-2 items-end' : 'flex rounded-md shadow-sm'}>
                        {dense ? (
                            <>
                                <div>
                                    <DenseInputGroup prefix="Lat">
                                        <input
                                            type="number"
                                            value={edited.lat}
                                            onChange={e => setEdited(p => ({ ...p, lat: Number(e.target.value) }))}
                                            className={`${inputBaseClass} ${groupInputPad}`}
                                            title="Latitude"
                                        />
                                    </DenseInputGroup>
                                </div>
                                <div>
                                    <DenseInputGroup prefix="Lng">
                                        <input
                                            type="number"
                                            value={edited.lng}
                                            onChange={e => setEdited(p => ({ ...p, lng: Number(e.target.value) }))}
                                            className={`${inputBaseClass} ${groupInputPad}`}
                                            title="Longitude"
                                        />
                                    </DenseInputGroup>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onStartPick?.()}
                                    title="Chọn trên bản đồ"
                                    className="h-8 px-3 inline-flex items-center justify-center rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <MapPin size={14} className="text-blue-600" />
                                </button>
                            </>
                        ) : (
                            <>
                                <label className={`${dense ? labelClass : 'text-[10px] font-bold text-gray-400 uppercase tracking-wider'} mb-1 block`}>Tọa độ</label>
                                <div className="relative flex-grow focus-within:z-10">
                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                        <span className="text-gray-400 text-xs font-mono">Lat</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={edited.lat}
                                        onChange={e => setEdited(p => ({ ...p, lat: Number(e.target.value) }))}
                                        className={`block w-full pl-8 pr-2 py-2 text-xs border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500 border-r-0`}
                                        placeholder="Lat"
                                    />
                                </div>
                                <div className="relative flex-grow focus-within:z-10">
                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                        <span className="text-gray-400 text-xs font-mono">Lng</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={edited.lng}
                                        onChange={e => setEdited(p => ({ ...p, lng: Number(e.target.value) }))}
                                        className={`block w-full pl-8 pr-2 py-2 text-xs border-gray-300 focus:ring-blue-500 focus:border-blue-500`}
                                        placeholder="Lng"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onStartPick?.()}
                                    title="Chọn trên bản đồ"
                                    className="-ml-px relative inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <MapPin size={14} className="text-blue-600" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Main numeric fields */}
            <div className={dense ? 'grid grid-cols-2 gap-2' : 'space-y-4'}>
                {/* Demand */}
                <div className={dense ? '' : ''}>
                    {dense ? (
                        <DenseInputGroup prefix={'Dem'}>
                            <input
                                type="number"
                                value={edited.demand}
                                disabled={demandDisabled}
                                onChange={e => setEdited(p => ({ ...p, demand: Number(e.target.value) }))}
                                className={`${inputBaseClass} ${groupInputPad} ${demandDisabled ? inputDisabledClass : ''}`}
                                title={demandDisabled ? 'Demand (auto cho Delivery)' : 'Demand'}
                            />
                        </DenseInputGroup>
                    ) : (
                        <>
                            <label className={`${dense ? labelClass : 'text-[10px] font-bold text-gray-400 uppercase tracking-wider'} mb-1 block`}>
                                Demand {demandDisabled && <span className={helpClass}> (auto)</span>}
                            </label>
                            <input
                                type="number"
                                value={edited.demand}
                                disabled={demandDisabled}
                                onChange={e => setEdited(p => ({ ...p, demand: Number(e.target.value) }))}
                                className={`${inputBaseClass} ${demandDisabled ? inputDisabledClass : ''}`}
                            />
                        </>
                    )}
                </div>

                {/* Service */}
                <div>
                    {dense ? (
                        <DenseInputGroup prefix="Svc">
                            <input
                                type="number"
                                value={edited.serviceDuration}
                                onChange={e => setEdited(p => ({ ...p, serviceDuration: Number(e.target.value) }))}
                                className={`${inputBaseClass} ${groupInputPad}`}
                                title="Service duration (phút)"
                            />
                        </DenseInputGroup>
                    ) : (
                        <>
                            <label className={`${dense ? labelClass : 'text-[10px] font-bold text-gray-400 uppercase tracking-wider'} mb-1 block`}>Service (phút)</label>
                            <input
                                type="number"
                                value={edited.serviceDuration}
                                onChange={e => setEdited(p => ({ ...p, serviceDuration: Number(e.target.value) }))}
                                className={inputBaseClass}
                            />
                        </>
                    )}
                </div>

                {/* Time window */}
                <div>
                    {dense ? (
                        <DenseInputGroup prefix="ETW">
                            <input
                                type="number"
                                value={edited.earliestTime}
                                onChange={e => setEdited(p => ({ ...p, earliestTime: Number(e.target.value) }))}
                                className={`${inputBaseClass} ${groupInputPad}`}
                                title="Earliest time window"
                            />
                        </DenseInputGroup>
                    ) : (
                        <>
                            <label className={`${dense ? labelClass : 'text-[10px] font-bold text-gray-400 uppercase tracking-wider'} mb-1 block`}>ETW</label>
                            <input
                                type="number"
                                value={edited.earliestTime}
                                onChange={e => setEdited(p => ({ ...p, earliestTime: Number(e.target.value) }))}
                                className={inputBaseClass}
                                placeholder="Min"
                            />
                        </>
                    )}
                </div>
                <div>
                    {dense ? (
                        <DenseInputGroup prefix="LTW">
                            <input
                                type="number"
                                value={edited.latestTime}
                                onChange={e => setEdited(p => ({ ...p, latestTime: Number(e.target.value) }))}
                                className={`${inputBaseClass} ${groupInputPad}`}
                                title="Latest time window"
                            />
                        </DenseInputGroup>
                    ) : (
                        <>
                            <label className={`${dense ? labelClass : 'text-[10px] font-bold text-gray-400 uppercase tracking-wider'} mb-1 block`}>LTW</label>
                            <input
                                type="number"
                                value={edited.latestTime}
                                onChange={e => setEdited(p => ({ ...p, latestTime: Number(e.target.value) }))}
                                className={inputBaseClass}
                                placeholder="Max"
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Delivery - Pickup Constraint */}
            {edited.type === 'delivery' && (
                <div className={`${dense ? 'p-0' : 'bg-red-50 border border-red-100 rounded-md p-2'}`}>
                    {dense ? (
                        <DenseInputGroup prefix="Pickup">
                            <select
                                value={edited.pickupId || ''}
                                onChange={e => handlePickupSelection(Number(e.target.value))}
                                className={`block w-full rounded-md border ${edited.pickupId ? 'border-gray-300' : 'border-red-300'} bg-white text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-8 px-2 ${groupInputPad}`}
                            >
                                <option value="">-- Chọn --</option>
                                {availablePickups.map(p => <option key={p.id} value={p.id}>#{p.id} (Dem: {p.demand})</option>)}
                            </select>
                        </DenseInputGroup>
                    ) : (
                        <>
                            <label className={`${dense ? labelClass : 'block text-[10px] font-bold text-red-700 uppercase'} mb-1 block`}>Pickup *</label>
                            <select
                                value={edited.pickupId || ''}
                                onChange={e => handlePickupSelection(Number(e.target.value))}
                                className={`block w-full rounded-md border ${edited.pickupId ? 'border-gray-300' : 'border-red-300'} bg-white text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${dense ? 'h-8 px-2' : 'py-2 px-2'}`}
                            >
                                <option value="">-- Chọn điểm lấy hàng --</option>
                                {availablePickups.map(p => <option key={p.id} value={p.id}>#{p.id} (Demand: {p.demand})</option>)}
                            </select>
                        </>
                    )}
                    {!edited.pickupId && <p className="mt-1 text-[10px] text-red-600 font-medium">Bắt buộc chọn pickup.</p>}
                </div>
            )}

            {edited.type === 'pickup' && (
                <div className={dense ? 'text-[11px] text-gray-500' : 'bg-blue-50 border border-blue-100 rounded p-2 text-blue-700 text-xs'}>
                    {dense ? (
                        <span>Pickup có thể ghép Delivery sau.</span>
                    ) : (
                        <>
                            <span className="font-semibold">Lưu ý:</span> Bạn có thể tạo điểm Delivery sau và ghép với điểm Pickup này.
                        </>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className={`${dense ? 'pt-1' : 'pt-2'} flex items-center gap-2`}>
                <button
                    onClick={handleSave}
                    disabled={edited.type === 'delivery' && !edited.pickupId}
                    className={`flex-1 flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors ${dense ? 'h-8 text-xs' : 'py-2 text-sm'} ${dense ? '' : 'shadow-sm'}`}
                >
                    Lưu
                </button>
                <button
                    onClick={() => { if (confirm('Xóa node này?')) onDelete(edited.id); }}
                    className={`flex items-center justify-center px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-md transition-colors ${dense ? 'h-8 text-xs' : 'py-2 text-sm'} ${dense ? '' : 'shadow-sm'}`}
                    title="Xóa node"
                >
                    <span className="font-medium">Xóa</span>
                </button>
            </div>
        </div>
    );
};

export default NodeEditor;