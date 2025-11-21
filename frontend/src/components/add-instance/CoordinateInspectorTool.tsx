"use client";

import React from 'react';
import { Crosshair } from 'lucide-react';

export interface CoordinateInspectorToolProps {
    active: boolean;
    onToggle: () => void;
}

const CoordinateInspectorTool: React.FC<CoordinateInspectorToolProps> = ({ active, onToggle }) => {
    return (
        <button
            onClick={onToggle}
            title={active ? 'Tắt tra tọa độ' : 'Bật tra tọa độ trên bản đồ'}
            className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border ${active
                    ? 'bg-emerald-600 border-emerald-700 text-white'
                    : 'bg-gray-50 hover:bg-gray-100 text-emerald-700'
                }`}
        >
            <Crosshair size={24} />
            <span className="text-[12px] mt-1">Tra tọa độ</span>
        </button>
    );
};

export default CoordinateInspectorTool;
