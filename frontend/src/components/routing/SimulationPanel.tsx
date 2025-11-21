"use client";
import React, { useMemo, useState } from 'react';
import { PanelLeftOpen, PanelRightOpen, Play, Pause, Lock, RotateCcw } from 'lucide-react';
import { formatDistance } from './formatters';

type SimulationPanelProps = {
    simPlaying: boolean;
    setSimPlaying: (v: boolean) => void;
    simSpeed: number;
    setSimSpeed: (v: number) => void;
    simFollow: boolean;
    setSimFollow: (v: boolean) => void;
    canSimulate: boolean;
    onSimReset: () => void;
    // Metrics
    simRemainingM?: number; // distance to destination in meters
    simEtaSec?: number; // estimated seconds to destination
    simToNextManeuverM?: number; // distance to next maneuver in meters
};

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
    simPlaying,
    setSimPlaying,
    simSpeed,
    setSimSpeed,
    simFollow,
    setSimFollow,
    canSimulate,
    onSimReset,
    simRemainingM = 0,
    simEtaSec = 0,
    simToNextManeuverM = 0,
}) => {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

    const formatEta = (sec: number) => {
        if (!Number.isFinite(sec) || sec <= 0) return '0:00:00';
        const totalSeconds = Math.round(sec);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`;
    };

    const speedOptions = useMemo(() => (
        [
            { value: 0.5, label: '0.5x' },
            { value: 1, label: '1x' },
            { value: 2, label: '2x' },
        ]
    ), []);

    const summaryCompact = useMemo(() => {
        const parts = [
            `CL ${formatDistance(simRemainingM || 0)}`,
            `ETA ${formatEta(simEtaSec || 0)}`,
            `RẼ ${formatDistance(simToNextManeuverM || 0)}`,
        ];
        return parts.join(' · ');
    }, [simRemainingM, simEtaSec, simToNextManeuverM]);

    const collapsedMetrics = useMemo(() => ([
        {
            label: 'Còn lại',
            value: formatDistance(simRemainingM || 0),
        },
        {
            label: 'ETA',
            value: formatEta(simEtaSec || 0),
        },
        {
            label: 'Đến rẽ',
            value: formatDistance(simToNextManeuverM || 0),
        },
    ]), [simRemainingM, simEtaSec, simToNextManeuverM]);
    const controlButtonBase = 'inline-flex h-9 items-center justify-center gap-2 rounded-md px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <div className="absolute top-33 right-12 z-[360]">
            {isCollapsed ? (
                <div className="flex w-[350px] max-w-[85vw] items-center gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow backdrop-blur">
                    <div className="flex flex-1 flex-col gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Giả lập hành trình</span>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-700">
                            {collapsedMetrics.map((metric, index) => (
                                <div
                                    key={metric.label}
                                    className={`flex items-center gap-1 ${index > 0 ? 'pl-1 border-l border-gray-200' : ''}`}
                                >
                                    <span className="uppercase tracking-wide text-[8px] text-gray-500">{metric.label}</span>
                                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">{metric.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSimPlaying(!simPlaying)}
                        disabled={!canSimulate}
                        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${simPlaying ? 'bg-yellow-600 text-white hover:bg-yellow-500' : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                        title="Bắt đầu/Tạm dừng giả lập"
                    >
                        {simPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-400"
                        title="Mở giả lập"
                    >
                        <PanelRightOpen size={16} />
                    </button>
                </div>
            ) : (
                <div className="bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-3 w-[340px] max-w-[90vw] space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-800">Giả lập hành trình</div>
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                            title="Thu gọn bảng giả lập"
                        >
                            <PanelLeftOpen size={18} />
                        </button>
                    </div>

                    <div className="flex w-full items-center gap-1.5">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setSimPlaying(!simPlaying)}
                                disabled={!canSimulate}
                                className={`${controlButtonBase} ${simPlaying ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                                title="Bắt đầu/Tạm dừng giả lập di chuyển"
                            >
                                {simPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>

                            <button
                                type="button"
                                onClick={onSimReset}
                                disabled={!canSimulate}
                                className={`${controlButtonBase} border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100`}
                                title="Về đầu tuyến"
                            >
                                <RotateCcw size={16} />
                            </button>

                            <button
                                type="button"
                                onClick={() => setSimFollow(!simFollow)}
                                disabled={!canSimulate}
                                className={`${controlButtonBase} ${simFollow ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                                title={simFollow ? 'Đang theo dõi phương tiện' : 'Không theo dõi phương tiện'}
                            >
                                <Lock size={16} />
                            </button>
                        </div>

                        <div className="ml-auto flex h-9 flex-1 items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2">
                            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600">Tốc độ</span>
                            <div className="flex items-center gap-1">
                                {speedOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setSimSpeed(opt.value)}
                                        disabled={!canSimulate}
                                        className={`flex h-7 w-10 items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${simSpeed === opt.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                        {[
                            {
                                label: 'Còn lại',
                                value: formatDistance(simRemainingM || 0),
                            },
                            {
                                label: 'ETA',
                                value: formatEta(simEtaSec || 0),
                            },
                            {
                                label: 'Đến rẽ tiếp',
                                value: formatDistance(simToNextManeuverM || 0),
                            },
                        ].map((item) => (
                            <div key={item.label} className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{item.label}</div>
                                <div className="mt-0.5 text-sm font-semibold text-gray-900">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};