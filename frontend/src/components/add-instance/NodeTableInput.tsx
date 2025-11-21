"use client";

import React from 'react';
import { MapPin, Plus, Trash2, Check, X } from 'lucide-react';

export interface NodeTableRow {
    id: number | string;
    type: 'depot' | 'pickup' | 'delivery' | 'regular' | string;
    lat: number | string;
    lng: number | string;
    demand: number | string;
    earliestTime: number | string;
    latestTime: number | string;
    serviceDuration: number | string;
    pickupId?: number | string;
    deliveryId?: number | string;
}

interface NodeTableInputProps {
    rows: NodeTableRow[];
    isDirty: boolean;
    isSelecting: boolean;
    selectedIndex: number | null;
    onAddRow: () => void;
    onRemoveRow: (index: number) => void;
    onChangeCell: (index: number, key: keyof NodeTableRow, value: any) => void;
    onApply: () => void;
    onStartPick: (index: number) => void;
    onCancelPick: () => void;
    onClose: () => void;
}

const NodeTableInput: React.FC<NodeTableInputProps> = ({
    rows,
    isDirty,
    isSelecting,
    selectedIndex,
    onAddRow,
    onRemoveRow,
    onChangeCell,
    onApply,
    onStartPick,
    onCancelPick,
    onClose,
}) => {
    return (
        <div className="bg-white border-t border-gray-200 p-4">
            {isSelecting && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center text-blue-800">
                        <i className="fas fa-crosshairs mr-2"></i>
                        <span className="font-medium">Đang chọn vị trí cho dòng {selectedIndex != null ? selectedIndex + 1 : ''}. Click vào bản đồ để chọn tọa độ.</span>
                        <button onClick={onCancelPick} className="ml-auto px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Hủy</button>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Bảng nhập liệu Node</h3>
                <div className="flex space-x-2">
                    <button onClick={onAddRow} className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 inline-flex items-center gap-1"><Plus size={16} /> Thêm dòng</button>
                    <button onClick={onApply} disabled={!isDirty && rows.length > 0} className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 inline-flex items-center gap-1"><Check size={16} /> Áp dụng ({rows.length} nodes)</button>
                    <button onClick={onClose} className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 inline-flex items-center gap-1"><X size={16} /> Đóng</button>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[33vh] overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left border-b border-gray-200">ID</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200">Loại</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200">Tọa độ</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200">Demand</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200">Time Window</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200">Service</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200">Liên kết</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50 border-b border-gray-100">
                                <td className="px-3 py-2"><input type="number" value={row.id as any} onChange={(e) => onChangeCell(index, 'id', e.target.value)} className="w-16 px-2 py-1 text-sm border rounded" /></td>
                                <td className="px-3 py-2">
                                    <select value={row.type} onChange={(e) => onChangeCell(index, 'type', e.target.value)} className="w-24 px-2 py-1 text-sm border rounded">
                                        <option value="depot">Depot</option>
                                        <option value="pickup">Pickup</option>
                                        <option value="delivery">Delivery</option>
                                        <option value="regular">Regular</option>
                                    </select>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center space-x-1">
                                        <input type="number" step="0.000001" value={row.lat as any} onChange={(e) => onChangeCell(index, 'lat', e.target.value)} className="w-28 px-2 py-1 text-sm border rounded" placeholder="Latitude" />
                                        <input type="number" step="0.000001" value={row.lng as any} onChange={(e) => onChangeCell(index, 'lng', e.target.value)} className="w-28 px-2 py-1 text-sm border rounded" placeholder="Longitude" />
                                        <button onClick={() => onStartPick(index)} className={`px-2 py-1 text-xs rounded transition-colors ${isSelecting && selectedIndex === index ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}><MapPin size={18} /></button>
                                    </div>
                                </td>
                                <td className="px-3 py-2"><input type="number" value={row.demand as any} onChange={(e) => onChangeCell(index, 'demand', e.target.value)} className="w-20 px-2 py-1 text-sm border rounded" /></td>
                                <td className="px-3 py-2">
                                    <div className="flex space-x-1">
                                        <input type="number" value={row.earliestTime as any} onChange={(e) => onChangeCell(index, 'earliestTime', e.target.value)} className="w-16 px-2 py-1 text-sm border rounded" placeholder="ETW" />
                                        <input type="number" value={row.latestTime as any} onChange={(e) => onChangeCell(index, 'latestTime', e.target.value)} className="w-16 px-2 py-1 text-sm border rounded" placeholder="LTW" />
                                    </div>
                                </td>
                                <td className="px-3 py-2"><input type="number" value={row.serviceDuration as any} onChange={(e) => onChangeCell(index, 'serviceDuration', e.target.value)} className="w-16 px-2 py-1 text-sm border rounded" /></td>
                                <td className="px-3 py-2">
                                    <div className="flex space-x-1">
                                        <input type="number" value={row.pickupId as any} onChange={(e) => onChangeCell(index, 'pickupId', e.target.value)} className="w-12 px-2 py-1 text-sm border rounded" placeholder="P" />
                                        <input type="number" value={row.deliveryId as any} onChange={(e) => onChangeCell(index, 'deliveryId', e.target.value)} className="w-12 px-2 py-1 text-sm border rounded" placeholder="D" />
                                    </div>
                                </td>
                                <td className="px-3 py-2"><button onClick={() => onRemoveRow(index)} className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"><Trash2 size={20} /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.length === 0 && (
                <div className="text-center py-8 text-gray-500"><i className="fas fa-table text-4xl mb-4"></i><p>Chưa có dữ liệu. Nhấn "Thêm dòng" để bắt đầu.</p></div>
            )}
        </div>
    );
};

export default NodeTableInput;