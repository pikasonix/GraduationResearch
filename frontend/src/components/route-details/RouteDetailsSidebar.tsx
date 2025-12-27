import React, { useState } from 'react';
import {
    PanelLeftClose,
    PanelLeftOpen,
    Upload,
    FileText,
    Play,
    Ban,
    Download,
    RotateCcw,
    Map as MapIcon,
    Settings2,
    Check,
    ChevronDown,
    Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SolverParametersForm, type SolverParams } from '../map/SolverParametersForm';
import { cn } from '@/lib/utils';

interface RouteDetailsSidebarProps {
    instance?: any | null;
    solution?: any | null;
    onInstanceUpload?: (file: File | React.ChangeEvent<HTMLInputElement>) => void;
    onSolutionUpload?: (file: File) => void;
    loadSampleInstance?: () => void;
    instanceText?: string;
    setInstanceText?: (text: string) => void;
    params?: SolverParams;
    handleParamChange?: (name: string, value: any) => void;
    runInstance?: () => void;
    loading?: boolean;
    jobProgress?: number;
    jobStatus?: string;
    onCancelJob?: () => void;
    resetParameters?: () => void;
    collapsed?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
}

const generateResultText = (solution: any, instance?: any | null): string => {
    let result = '';
    const instanceName = instance?.name || 'unknown-instance';
    const currentDate = new Date().getFullYear();

    result += `Instance name : ${instanceName}\n`;
    result += `Authors       : Pix\n`;
    result += `Date          : ${currentDate}\n`;
    result += `Reference     : Simplified Hybrid ACO + Pure Greedy\n`;
    result += `Solution\n`;

    solution.routes.forEach((route: any, index: number) => {
        const routeNumber = route.id ?? index;
        const sequence = (route.sequence || []).join(' ');
        result += `Route ${routeNumber} : ${sequence}\n`;
    });

    return result;
};

export const RouteDetailsSidebar: React.FC<RouteDetailsSidebarProps> = ({
    instance,
    solution,
    onInstanceUpload,
    onSolutionUpload,
    loadSampleInstance,
    instanceText,
    setInstanceText,
    params,
    handleParamChange,
    runInstance,
    loading,
    jobProgress = 0,
    jobStatus = '',
    onCancelJob,
    resetParameters,
    collapsed,
    onCollapseChange,
}) => {
    const [showParams, setShowParams] = useState(false);

    // If collapsed is handled by parent, we use the prop
    // We assume parent handles the state if onCollapseChange is provided

    const handleCollapse = (val: boolean) => {
        onCollapseChange?.(val);
    };

    if (collapsed) {
        return (
            <div className="h-full w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 shadow-sm z-10 transition-all duration-300">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCollapse(false)}
                    title="Mở rộng"
                >
                    <PanelLeftOpen className="h-5 w-5 text-gray-500" />
                </Button>

                <div className="w-8 h-[1px] bg-gray-200" />

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => document.getElementById('sidebar_load_solution')?.click()}
                    title="Load Solution"
                >
                    <Upload className="h-5 w-5 text-green-600" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => document.getElementById('sidebar_load_instance')?.click()}
                    title="Load Instance"
                >
                    <FileText className="h-5 w-5 text-blue-600" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCollapse(false)}
                    title="Chạy Solver"
                >
                    <Play className="h-5 w-5 text-orange-500" />
                </Button>
            </div>
        );
    }

    return (
        <div className="h-full w-80 bg-white border-r border-gray-200 flex flex-col shadow-xl z-20 transition-all duration-300">
            {/* Headers */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-gray-900">Control Panel</h2>
                    <p className="text-xs text-gray-500">Instance & Solver Tools</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCollapse(true)}
                    className="h-8 w-8"
                >
                    <PanelLeftClose className="h-4 w-4 text-gray-500" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 1. File Uploads */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dữ liệu đầu vào</h3>

                    <div className="grid grid-cols-2 gap-2">
                        <input
                            id="sidebar_load_instance"
                            type="file"
                            accept=".txt"
                            className="hidden"
                            onChange={(e) => onInstanceUpload?.(e)}
                        />
                        <Button
                            variant="outline"
                            className="w-full justify-start text-xs h-9"
                            onClick={() => document.getElementById('sidebar_load_instance')?.click()}
                        >
                            <FileText className="mr-2 h-3.5 w-3.5 text-blue-500" />
                            Load Instance
                        </Button>

                        <input
                            id="sidebar_load_solution"
                            type="file"
                            accept=".txt"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onSolutionUpload?.(file);
                            }}
                        />
                        <Button
                            variant="outline"
                            className="w-full justify-start text-xs h-9"
                            onClick={() => document.getElementById('sidebar_load_solution')?.click()}
                        >
                            <Upload className="mr-2 h-3.5 w-3.5 text-green-500" />
                            Load Solution
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-700">Nội dung Instance</label>
                            <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs text-blue-600"
                                onClick={loadSampleInstance}
                            >
                                Dùng mẫu thử
                            </Button>
                        </div>
                        <Textarea
                            value={instanceText || ''}
                            onChange={(e) => setInstanceText?.(e.target.value)}
                            placeholder="Paste nội dung instance tại đây..."
                            className="h-[100px] text-xs font-mono placeholder:font-sans resize-none focus-visible:ring-1"
                        />
                    </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* 2. Solver Configuration */}
                <div className="space-y-3">
                    <div
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setShowParams(!showParams)}
                    >
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-900 transition-colors">
                            Cấu hình Saver
                        </h3>
                        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", showParams && "rotate-180")} />
                    </div>

                    {showParams && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                            {/* Presets */}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Nhanh', time: '2m', params: { iterations: 10000, max_non_improving: 2000, time_limit: 120, acceptance: 'greedy' }, activeColor: 'bg-blue-50 border-blue-200 text-blue-700' },
                                    { label: 'Cân bằng', time: '5m', params: { iterations: 50000, max_non_improving: 10000, time_limit: 300, acceptance: 'rtr' }, activeColor: 'bg-green-50 border-green-200 text-green-700' },
                                    { label: 'Cao', time: '10m', params: { iterations: 100000, max_non_improving: 20000, time_limit: 600, acceptance: 'rtr' }, activeColor: 'bg-purple-50 border-purple-200 text-purple-700' },
                                ].map((preset) => {
                                    const isActive = params?.iterations === preset.params.iterations &&
                                        params?.time_limit === preset.params.time_limit &&
                                        params?.acceptance === preset.params.acceptance;

                                    return (
                                        <div
                                            key={preset.label}
                                            onClick={() => {
                                                handleParamChange?.('iterations', preset.params.iterations);
                                                handleParamChange?.('max_non_improving', preset.params.max_non_improving);
                                                handleParamChange?.('time_limit', preset.params.time_limit);
                                                handleParamChange?.('acceptance', preset.params.acceptance);
                                            }}
                                            className={cn(
                                                "cursor-pointer border rounded-md p-2 text-center transition-all hover:bg-gray-50",
                                                isActive ? preset.activeColor : "border-gray-200"
                                            )}
                                        >
                                            <div className="font-bold text-xs">{preset.label}</div>
                                            <div className="text-[10px] opacity-70">{preset.time}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                {params && handleParamChange && (
                                    <SolverParametersForm
                                        params={params}
                                        onChange={handleParamChange}
                                    />
                                )}
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetParameters}
                                className="w-full text-xs text-gray-500 h-7"
                            >
                                <RotateCcw className="w-3 h-3 mr-1.5" />
                                Khôi phục mặc định
                            </Button>
                        </div>
                    )}
                </div>

                {/* 3. Action Buttons */}
                <div className="space-y-3">
                    {!loading ? (
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
                            onClick={runInstance}
                            disabled={!instanceText}
                        >
                            <Play className="w-4 h-4 mr-2 fill-current" />
                            Chạy Solver
                        </Button>
                    ) : (
                        <div className="space-y-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <div className="flex items-center justify-between text-xs font-medium text-blue-800">
                                <span>{jobStatus}</span>
                                <span>{jobProgress}%</span>
                            </div>
                            <div className="h-2 w-full bg-blue-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${jobProgress}%` }}
                                />
                            </div>
                            {onCancelJob && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full h-8 text-xs"
                                    onClick={onCancelJob}
                                >
                                    <Ban className="w-3 h-3 mr-1.5" />
                                    Hủy tác vụ
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* 4. Results */}
                {solution && solution.routes?.length > 0 && (
                    <div className="pt-2">
                        <Badge variant="outline" className="w-full flex justify-between py-2 mb-2 bg-green-50 text-green-700 border-green-200">
                            <span>Cost: {Number(solution.total_cost).toFixed(2)}</span>
                            <span>Routes: {solution.routes.length}</span>
                        </Badge>
                        <Button
                            variant="secondary"
                            className="w-full text-xs"
                            onClick={() => {
                                const resultText = generateResultText(solution, instance);
                                const blob = new Blob([resultText], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'solution_result.txt';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <Download className="w-3.5 h-3.5 mr-2" />
                            Tải kết quả (.txt)
                        </Button>
                    </div>
                )}



            </div>
        </div>
    );
};
