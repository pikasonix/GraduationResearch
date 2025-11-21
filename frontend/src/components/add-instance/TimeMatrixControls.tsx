"use client";

import React from 'react';
import { LoaderCircle, Grid3x3, Trash2 } from 'lucide-react';

interface TimeMatrixControlsProps {
    nodesLength: number;
    isGenerating: boolean;
    matrixLength: number;
    progress: number; // 0..1
    onGenerate: () => void;
    onClear: () => void;
}

const TimeMatrixControls: React.FC<TimeMatrixControlsProps> = ({
    nodesLength,
    isGenerating,
    matrixLength,
    progress,
    onGenerate,
    onClear,
}) => {
    const hasMatrix = matrixLength > 0;

    return (
        <div className='border-l-1 border-gray-200 pl-2'>
            {/* Single button initially; connected two-button group during generation or after created */}
            {(!isGenerating && !hasMatrix) ? (
                <button
                    onClick={onGenerate}
                    disabled={nodesLength < 2}
                    title={'Tạo ma trận thời gian'}
                    className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border ${nodesLength < 2 ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed' : 'bg-purple-600 border-purple-700 text-white'}`}
                >
                    <Grid3x3 size={24} />
                    <span className="text-[10px] mt-1">Tạo ma trận</span>
                </button>
            ) : (
                <div className="inline-flex items-stretch h-16 rounded-md overflow-hidden border border-gray-300">
                    {/* Left: Generate/Regenerate */}
                    <button
                        onClick={onGenerate}
                        disabled={nodesLength < 2 || isGenerating}
                        title={hasMatrix ? 'Tạo lại ma trận thời gian' : 'Tạo ma trận thời gian'}
                        className={`w-22 h-full flex flex-col items-center justify-end pb-1 transition-colors border-0 ${nodesLength < 2 || isGenerating ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-purple-600 text-white'}`}
                    >
                        {isGenerating ? <LoaderCircle size={24} className="animate-spin" /> : <Grid3x3 size={24} />}
                        <span className="text-[10px] mt-1">{hasMatrix ? 'Tạo lại ma trận' : 'Tạo ma trận'}</span>
                    </button>

                    {/* Right: Progress while generating OR Delete after created */}
                    <button
                        onClick={!isGenerating && hasMatrix ? onClear : undefined}
                        disabled={isGenerating || !hasMatrix}
                        aria-label={isGenerating ? 'Đang tạo ma trận' : 'Xóa ma trận thời gian'}
                        title={isGenerating ? 'Đang tạo ma trận' : 'Xóa ma trận thời gian'}
                        className={`relative w-14 h-full border-l border-gray-300 flex flex-col items-center justify-end pb-1 ${isGenerating ? 'bg-gray-200 text-purple-700' : hasMatrix ? 'bg-purple-200 hover:bg-purple-300 text-purple-600' : 'bg-purple-300 text-purple-400'}`}
                    >
                        {isGenerating ? (
                            <>
                                <div
                                    className="absolute left-0 top-0 h-full bg-purple-500/30 transition-all"
                                    style={{ width: `${(progress * 100)}%` }}
                                />
                                <span className="text-[10px] mt-1 relative z-10">{`${Math.round(progress * 100)}%`}</span>
                            </>
                        ) : (
                            hasMatrix ? (
                                <>
                                    <Trash2 size={20} />
                                    <span className="text-[10px] mt-1">Xóa</span>
                                </>
                            ) : (
                                <span className="text-[10px] mt-1">—</span>
                            )
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TimeMatrixControls;