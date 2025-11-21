"use client";
import React, { useCallback, useEffect, useRef } from 'react';
import {
    Box,
    ScanEye,
    Compass,
    Map,
    MapPin,
    Maximize,
    MessageSquare,
    RotateCcw,
    RotateCw,
    TrafficCone,
    Activity
} from 'lucide-react';

type ToolbarProps = {
    is3D: boolean;
    angled: boolean;
    keepZoom: boolean;
    showAllPopups: boolean;
    onToggle3D: () => void;
    onToggleAngle: () => void;
    onToggleKeepZoom: () => void;
    onToggleShowAllPopups: () => void;
    onRotateLeft: () => void;
    onRotateRight: () => void;
    onResetNorth: () => void;
    onPinMyLocation: () => void;
    toggleTraffic?: () => void;
    isTrafficVisible?: boolean;
    toggleCongestion?: () => void;
    isCongestionVisible?: boolean;
};

export const Toolbar: React.FC<ToolbarProps> = ({
    is3D,
    angled,
    keepZoom,
    showAllPopups,
    onToggle3D,
    onToggleAngle,
    onToggleKeepZoom,
    onToggleShowAllPopups,
    onRotateLeft,
    onRotateRight,
    onResetNorth,
    onPinMyLocation,
    toggleTraffic,
    isTrafficVisible,
    toggleCongestion,
    isCongestionVisible
}) => {
    const rotateLeftTimer = useRef<number | null>(null);
    const rotateRightTimer = useRef<number | null>(null);

    const startHold = useCallback((action: () => void, ref: React.MutableRefObject<number | null>) => {
        action();
        ref.current = window.setInterval(action, 180);
    }, []);

    const stopHold = useCallback((ref: React.MutableRefObject<number | null>) => {
        if (ref.current !== null) {
            window.clearInterval(ref.current);
            ref.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            stopHold(rotateLeftTimer);
            stopHold(rotateRightTimer);
        };
    }, [stopHold]);

    const keepZoomLabel = keepZoom ? 'Khóa Zoom' : 'Tự động Zoom';
    const allPopupLabel = showAllPopups ? 'Thông báo mọi điểm' : 'Chỉ bước được chọn';
    const toggleBtnBase = 'inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300';

    return (
        <div className="p-3 border-b text-sm bg-white flex flex-wrap items-center gap-2 md:gap-3">
            <h1 className="text-lg font-semibold mr-2">Chỉ đường</h1>
            <div className="ml-auto flex flex-wrap items-center gap-2 md:gap-3">
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600">
                        Bản đồ
                    </span>
                    <button
                        onClick={onToggle3D}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium shadow-sm ${is3D ? 'bg-blue-600 text-white' : 'bg-white-100 text-gray-700'}`}
                        title="Bật hoặc tắt hiển thị 3D (địa hình + tòa nhà)"
                    >
                        <Box size={14} />
                        <span>3D</span>
                    </button>
                    <button
                        onClick={onToggleAngle}
                        className={`inline-flex items-center gap-1 rounded text-white px-2 py-1 text-xs font-medium shadow-sm ${angled ? 'bg-blue-600' : 'bg-amber-600'}`}
                        title="Chuyển đổi giữa góc nhìn nghiêng và nhìn từ trên xuống"
                    >
                        <ScanEye size={14} />
                        <span>{angled ? 'Nghiêng' : 'Trên xuống'}</span>
                    </button>
                    {toggleTraffic && (
                        <button
                            onClick={toggleTraffic}
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium shadow-sm ${isTrafficVisible ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                            title={isTrafficVisible ? 'Ẩn traffic trên bản đồ' : 'Hiển thị traffic trên bản đồ'}
                        >
                            <TrafficCone size={14} />
                            <span>Traffic</span>
                        </button>
                    )}
                    {toggleCongestion && (
                        <button
                            onClick={toggleCongestion}
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium shadow-sm ${isCongestionVisible ? 'bg-orange-500 text-white' : 'bg-white text-gray-700'}`}
                            title={isCongestionVisible ? 'Ẩn thông tin kẹt xe trên tuyến' : 'Hiển thị thông tin kẹt xe trên tuyến'}
                        >
                            <Activity size={14} />
                            <span>Kẹt xe</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600">
                        Điều hướng
                    </span>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); startHold(onRotateLeft, rotateLeftTimer); }}
                        onMouseUp={() => stopHold(rotateLeftTimer)}
                        onMouseLeave={() => stopHold(rotateLeftTimer)}
                        onTouchStart={(e) => { e.preventDefault(); startHold(onRotateLeft, rotateLeftTimer); }}
                        onTouchEnd={() => stopHold(rotateLeftTimer)}
                        onTouchCancel={() => stopHold(rotateLeftTimer)}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100"
                        title="Xoay trái 10° (Q — giữ chuột hoặc phím để xoay liên tục)"
                    >
                        <RotateCcw size={14} />
                        <span>Q</span>
                    </button>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); startHold(onRotateRight, rotateRightTimer); }}
                        onMouseUp={() => stopHold(rotateRightTimer)}
                        onMouseLeave={() => stopHold(rotateRightTimer)}
                        onTouchStart={(e) => { e.preventDefault(); startHold(onRotateRight, rotateRightTimer); }}
                        onTouchEnd={() => stopHold(rotateRightTimer)}
                        onTouchCancel={() => stopHold(rotateRightTimer)}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100"
                        title="Xoay phải 10° (E — giữ chuột hoặc phím để xoay liên tục)"
                    >
                        <RotateCw size={14} />
                        <span>E</span>
                    </button>
                    <button
                        onClick={onResetNorth}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100"
                        title="Đưa bản đồ về hướng Bắc (R)"
                    >
                        <Compass size={14} />
                        <span>R</span>
                    </button>
                </div>

                <button
                    onClick={onToggleKeepZoom}
                    className={`${toggleBtnBase} ${keepZoom ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                    title="Bật chế độ khóa mức zoom khi hệ thống căn khung"
                >
                    <Maximize size={16} />
                    <span>{keepZoomLabel}</span>
                </button>

                <button
                    onClick={onToggleShowAllPopups}
                    className={`${toggleBtnBase} ${showAllPopups ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                    title="Bật hiển thị tất cả thông báo/hướng dẫn trên tuyến"
                >
                    <MessageSquare size={16} />
                    <span>{allPopupLabel}</span>
                </button>

                <button
                    onClick={onPinMyLocation}
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-300"
                    title="Đặt pin và phóng to tại vị trí hiện tại của bạn"
                >
                    <MapPin size={16} />
                    <span>Vị trí của tôi</span>
                </button>
            </div>
        </div>
    );
};
