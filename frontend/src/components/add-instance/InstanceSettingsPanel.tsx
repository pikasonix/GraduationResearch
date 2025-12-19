"use client";

import React, { useState } from 'react';
import { PanelLeftOpen, PanelRightOpen, MapPinPlus, X } from 'lucide-react';
import type { NodeRow } from './NodeEditor';

export interface InstanceMeta {
    name: string;
    location: string;
    comment: string;
    routeTime: number;
    timeWindow: number;
    capacity: number;
}

interface InstanceSettingsPanelProps {
    settingsCollapsed: boolean;
    onSetCollapsed: (collapsed: boolean) => void;
    isAddingNode: boolean;
    onToggleAddNode: () => void;
    instanceData: InstanceMeta;
    onUpdateInstance: (patch: Partial<InstanceMeta>) => void;
    nodes: NodeRow[];
    updateNode: (id: number, patch: Partial<NodeRow>) => void;
    timeMatrixLength: number;
    isGeneratingMatrix: boolean;
    matrixGenerationProgress: number;
    instancePreview: string;
    onNodeClick: (node: NodeRow) => void;
}

const InstanceSettingsPanel: React.FC<InstanceSettingsPanelProps> = ({
    settingsCollapsed,
    onSetCollapsed,
    isAddingNode,
    onToggleAddNode,
    instanceData,
    onUpdateInstance,
    nodes,
    updateNode,
    timeMatrixLength,
    isGeneratingMatrix,
    matrixGenerationProgress,
    instancePreview,
    onNodeClick,
}) => {
    // Local collapsible section states
    const [showBasicInfo, setShowBasicInfo] = useState(true);
    const [showConstraints, setShowConstraints] = useState(true);
    const [showNodesList, setShowNodesList] = useState(true);

    if (settingsCollapsed) {
        return (
            <div className="w-14 bg-white shadow-xl border-r border-gray-200 flex flex-col items-center py-4 space-y-4">
                <button
                    onClick={() => onSetCollapsed(false)}
                    className="p-2 rounded bg-blue-600 hover:bg-blue-500 text-white transition"
                    title="Mở bảng cài đặt"
                >
                    <PanelLeftOpen size={18} />
                </button>
                <button
                    onClick={onToggleAddNode}
                    className={`p-2 rounded ${isAddingNode ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'} transition`}
                    title={isAddingNode ? 'Hủy thêm node' : 'Thêm node'}
                >
                    {isAddingNode ? <X size={16} /> : <MapPinPlus size={16} />}
                </button>
            </div>
        );
    }

    return (
        <div className="w-80 bg-white shadow-xl border-r border-gray-200 overflow-y-auto flex flex-col">
            <div className="bg-blue-600 text-white px-4 py-3 flex items-center space-x-2 sticky top-0 z-10">
                <i className="fas fa-cog"></i>
                <span className="font-semibold flex-1">Cài đặt Instance</span>
                <button
                    onClick={() => onSetCollapsed(true)}
                    className="ml-auto text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                    title="Thu gọn"
                >
                    <PanelRightOpen size={14} />
                </button>
            </div>
            <div className="p-4 space-y-6">
                {/* Basic info */}
                <div className="space-y-3">
                    <button onClick={() => setShowBasicInfo(s => !s)} className="w-full flex items-center justify-between px-0">
                        <h3 className="text-sm font-semibold text-gray-700">Thông tin cơ bản</h3>
                        <svg className={`w-4 h-4 transform transition-transform ${showBasicInfo ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showBasicInfo && (
                        <>
                            <div>
                                <label className="block text-xs font-medium mb-1">Tên Instance</label>
                                <input value={instanceData.name} onChange={e => onUpdateInstance({ name: e.target.value })} className="w-full border px-2 py-1 rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Địa điểm</label>
                                <input value={instanceData.location} onChange={e => onUpdateInstance({ location: e.target.value })} className="w-full border px-2 py-1 rounded" placeholder="vd: Hanoi, Vietnam" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Ghi chú</label>
                                <textarea value={instanceData.comment} onChange={e => onUpdateInstance({ comment: e.target.value })} className="w-full border px-2 py-1 rounded" placeholder="Mô tả ngắn về instance này" />
                            </div>
                        </>
                    )}
                </div>

                {/* Constraints */}
                <div className="space-y-3">
                    <button onClick={() => setShowConstraints(s => !s)} className="w-full flex items-center justify-between px-0">
                        <h3 className="text-sm font-semibold text-gray-700">Ràng buộc</h3>
                        <svg className={`w-4 h-4 transform transition-transform ${showConstraints ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showConstraints && (
                        <div className="space-y-2">
                            <div>
                                <label className="block text-xs font-medium mb-1">Thời gian route tối đa (phút)</label>
                                <input type="number" value={instanceData.routeTime} onChange={e => onUpdateInstance({ routeTime: parseInt(e.target.value || '0') })} className="w-full border px-2 py-1 rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Độ rộng time window (phút)</label>
                                <input type="number" value={instanceData.timeWindow} onChange={e => onUpdateInstance({ timeWindow: parseInt(e.target.value || '0') })} className="w-full border px-2 py-1 rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Sức chứa xe</label>
                                <input type="number" value={instanceData.capacity} onChange={e => onUpdateInstance({ capacity: parseInt(e.target.value || '0') })} className="w-full border px-2 py-1 rounded" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Nodes overview */}
                <div className="space-y-3">
                    <button onClick={() => setShowNodesList(s => !s)} className="w-full flex items-center justify-between px-0">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center">Nodes <span className="text-xs text-gray-500 ml-2">({nodes.length})</span></h3>
                        <svg className={`w-4 h-4 transform transition-transform ${showNodesList ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showNodesList && (
                        <>
                            <div className="max-h-84 overflow-y-auto border rounded divide-y">
                                {(() => {
                                    const pickupMap = new Map<number, NodeRow>();
                                    const deliveryMap = new Map<number, NodeRow>();
                                    nodes.forEach(n => { if (n.type === 'pickup') pickupMap.set(n.id, n); if (n.type === 'delivery') deliveryMap.set(n.id, n); });
                                    const paired: Array<{ pickup: NodeRow; delivery: NodeRow; }> = [];
                                    pickupMap.forEach(p => {
                                        if (p.deliveryId && deliveryMap.has(p.deliveryId)) {
                                            paired.push({ pickup: p, delivery: deliveryMap.get(p.deliveryId)! });
                                        }
                                    });
                                    const pairedPickupIds = new Set(paired.map(x => x.pickup.id));
                                    const pairedDeliveryIds = new Set(paired.map(x => x.delivery.id));
                                    const unpairedPickups = nodes.filter(n => n.type === 'pickup' && !pairedPickupIds.has(n.id));
                                    const unpairedDeliveries = nodes.filter(n => n.type === 'delivery' && !pairedDeliveryIds.has(n.id));
                                    const depots = nodes.filter(n => n.type === 'depot');
                                    const nones = nodes.filter(n => n.type === 'none');

                                    const renderNodeRow = (n: NodeRow) => (
                                        <div key={n.id} className="flex items-center justify-between p-2 text-xs cursor-pointer hover:bg-gray-100" onClick={() => onNodeClick(n)}>
                                            <div className="truncate">
                                                <div className="font-medium">#{n.id} {n.type === 'depot' && '(Depot)'} {n.type === 'pickup' && 'P'} {n.type === 'delivery' && 'D'}</div>
                                                <div className="text-[10px] text-gray-600">{n.lat.toFixed(4)}, {n.lng.toFixed(4)} • d={n.demand}</div>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <button onClick={(e) => { e.stopPropagation(); updateNode(n.id, { demand: n.demand + 1 }); }} className="px-1 py-0.5 bg-gray-100 rounded">+D</button>
                                                <button onClick={(e) => { e.stopPropagation(); updateNode(n.id, { demand: n.demand - 1 }); }} className="px-1 py-0.5 bg-gray-100 rounded">-D</button>
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <div className="divide-y">
                                            {paired.length > 0 && (
                                                <div className="bg-gray-50">
                                                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-600">Cặp Pickup-Delivery ({paired.length})</div>
                                                    {paired.map(pair => (
                                                        <div key={pair.pickup.id} className="p-2 space-y-1 cursor-pointer hover:bg-gray-100" onClick={() => onNodeClick(pair.pickup)}>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="font-medium text-blue-600">Pickup #{pair.pickup.id}</div>
                                                                <span className="text-[10px] text-gray-500">d={pair.pickup.demand}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs" onClick={(e) => { e.stopPropagation(); onNodeClick(pair.delivery); }}>
                                                                <div className="font-medium text-red-600">Delivery #{pair.delivery.id}</div>
                                                                <span className="text-[10px] text-gray-500">d={pair.delivery.demand}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {unpairedPickups.length > 0 && (
                                                <div>
                                                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-600">Pickup chưa ghép ({unpairedPickups.length})</div>
                                                    {unpairedPickups.map(renderNodeRow)}
                                                </div>
                                            )}
                                            {unpairedDeliveries.length > 0 && (
                                                <div>
                                                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-600">Delivery chưa hợp lệ ({unpairedDeliveries.length})</div>
                                                    {unpairedDeliveries.map(renderNodeRow)}
                                                </div>
                                            )}
                                            {nones.length > 0 && (
                                                <div>
                                                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-600">None ({nones.length})</div>
                                                    {nones.map(renderNodeRow)}
                                                </div>
                                            )}
                                            {depots.length > 0 && (
                                                <div>
                                                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-600">Depot ({depots.length})</div>
                                                    {depots.map(renderNodeRow)}
                                                </div>
                                            )}
                                            {nodes.length === 0 && <div className="p-2 text-[11px] text-gray-500">Chưa có node nào.</div>}
                                        </div>
                                    );
                                })()}
                            </div>
                        </>
                    )}
                </div>

                {/* Time matrix status */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Ma trận thời gian</h3>
                    <div className={`p-3 rounded-lg border ${timeMatrixLength > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center space-x-2">
                            <i className={`fas ${timeMatrixLength > 0 ? 'fa-check-circle text-green-600' : 'fa-exclamation-triangle text-gray-500'}`}></i>
                            <span className="text-xs font-medium">
                                {timeMatrixLength > 0 ? `Ma trận đã tạo (${timeMatrixLength}x${timeMatrixLength})` : 'Chưa có ma trận thời gian'}
                            </span>
                        </div>
                        {isGeneratingMatrix && (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-600">
                                    <span>Tiến độ:</span>
                                    <span>{(matrixGenerationProgress * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                    <div className="h-2 bg-purple-600 transition-all" style={{ width: `${(matrixGenerationProgress * 100)}%` }}></div>
                                </div>
                                <div className="text-[10px] text-gray-500 text-center">Đang gọi OSRM API...</div>
                            </div>
                        )}
                    </div>
                    {/* Time matrix action buttons are in the top toolbar */}
                </div>

                {/* Instance preview */}
                {nodes.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700">Xem trước Instance</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <pre className="text-[10px] text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">{instancePreview}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InstanceSettingsPanel;
