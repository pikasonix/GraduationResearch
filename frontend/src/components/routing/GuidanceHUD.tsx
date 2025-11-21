"use client";
import React from 'react';
import { formatDistance, formatInstructionVI } from './formatters';
import { pickManeuverIcon } from './maneuvers';
import { ChevronLeft, ChevronRight, Square, Ruler } from 'lucide-react';

type Props = {
    visible: boolean;
    headingDeg: number; // kept in props for compatibility, no longer displayed
    instructions: any[];
    activeStepIdx: number | null;
    onPrev: () => void;
    onNext: () => void;
    onStop: () => void;
};

export const GuidanceHUD: React.FC<Props> = ({ visible, /* headingDeg */ headingDeg, instructions, activeStepIdx, onPrev, onNext, onStop }) => {
    if (!visible || activeStepIdx == null) return null;

    const step = instructions?.[activeStepIdx] ?? null;
    const icon = step ? pickManeuverIcon(step) : { src: undefined as string | undefined };

    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-6 z-[400] w-[380px] animate-in fade-in-0 slide-in-from-top-4 duration-300">
            {/* Unified card with closer spacing */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-5">
                {/* Main instruction section */}
                <div className="flex items-start gap-4 mb-4">
                    {/* Maneuver icon from local library */}
                    <div className="flex-shrink-0 relative">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg flex items-center justify-center overflow-hidden">
                            {icon.src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={icon.src} alt="maneuver" width={24} height={24} className="block" />
                            ) : (
                                <div className="text-white text-lg font-bold">●</div>
                            )}
                        </div>
                        <div className="absolute inset-0 rounded-xl bg-blue-400 animate-pulse opacity-25"></div>
                    </div>

                    {/* Instruction content */}
                    <div className="flex-1 min-w-0">
                        <div className="text-base font-semibold text-gray-900 leading-relaxed mb-2">
                            {formatInstructionVI(step)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                <span>Bước {activeStepIdx + 1} / {instructions.length}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Ruler className="w-3.5 h-3.5" />
                                <span>{formatDistance(step?.distance || 0)}</span>
                            </div>
                        </div>
                        {step?.name ? (
                            <div className="text-xs text-gray-500 mt-2 truncate">{step.name}</div>
                        ) : null}
                    </div>
                </div>

                {/* Control section */}
                <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onPrev}
                                className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm inline-flex items-center gap-1.5"
                            >
                                <ChevronLeft className="w-4 h-4" /> Trước
                            </button>
                            <button
                                onClick={onNext}
                                className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm inline-flex items-center gap-1.5"
                            >
                                Tiếp <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onStop}
                                className="px-3 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm inline-flex items-center gap-1.5"
                            >
                                <Square className="w-4 h-4" /> Dừng
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};