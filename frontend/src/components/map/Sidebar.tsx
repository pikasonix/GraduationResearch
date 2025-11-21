import React, { useState } from 'react';
import { PanelLeftOpen, PanelRightOpen, FileCheck, FileCode, PencilLine, Download, Grid2x2Check, Play, RotateCw, LoaderCircle, Map } from 'lucide-react';

// --- Types ---
// Use broad/any types here to avoid collisions with other module-local types
interface SidebarProps {
    instance?: any | null;
    solution?: any | null;
    onInstanceUpload?: (file: File | React.ChangeEvent<HTMLInputElement>) => void;
    onSolutionUpload?: (file: File) => void;
    onLoadSample?: () => void;
    loadSampleInstance?: () => void;
    onDebugSolution?: () => void;
    onDebugInstance?: () => void;
    onViewChange?: (view: string) => void;
    selectedNodes?: any[];
    selectedRoute?: any | null;
    onRouteSelect?: (route: any) => void;
    useRealRouting?: boolean;
    onToggleRealRouting?: () => void;
    getCacheStats?: () => any;
    showCacheInfo?: () => void;
    clearRoutingCache?: () => void;
    instanceText?: string;
    setInstanceText?: (text: string) => void;
    params?: Record<string, any>;
    handleParamChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    runInstance?: () => void;
    loading?: boolean;
    resetParameters?: () => void;
    // optional parent control: if false, parent hides component entirely
    sidebarVisible?: boolean;
    // optional parent toggle to open/close sidebar
    toggleSidebar?: () => void;
    // controlled collapsed state (optional). If provided, Sidebar will be controlled by parent
    collapsed?: boolean;
    // notify parent when collapsed state changes
    onCollapseChange?: (collapsed: boolean) => void;
}

// Function to generate result text for download
const generateResultText = (solution: any, instance?: any | null): string => {
    let result = '';

    // Header information in the specified format
    const instanceName = instance?.name || 'unknown-instance';
    const currentDate = new Date().getFullYear();

    result += `Instance name : ${instanceName}\n`;
    result += `Authors       : Pix\n`;
    result += `Date          : ${currentDate}\n`;
    result += `Reference     : Simplified Hybrid ACO + Pure Greedy\n`;
    result += `Solution\n`;

    // Route details in the specified format
    solution.routes.forEach((route: any, index: number) => {
        const routeNumber = route.id ?? index;
        const sequence = (route.sequence || []).join(' ');
        result += `Route ${routeNumber} : ${sequence}\n`;
    });

    return result;
};

const Sidebar: React.FC<SidebarProps> = ({
    instance,
    solution,
    onInstanceUpload,
    onSolutionUpload,
    loadSampleInstance,
    onToggleRealRouting,
    instanceText,
    setInstanceText,
    params,
    handleParamChange,
    runInstance,
    loading,
    resetParameters,
    sidebarVisible,
    toggleSidebar,
    collapsed: collapsedProp,
    onCollapseChange,
}) => {
    const [showParams, setShowParams] = useState(false);
    // support controlled/uncontrolled collapse state
    const [collapsedLocal, setCollapsedLocal] = useState(false);
    const collapsed = typeof collapsedProp === 'boolean' ? collapsedProp : collapsedLocal;

    // unified setter: notify parent when controlled, otherwise update local state
    const setCollapsed = (val: boolean) => {
        if (typeof collapsedProp === 'boolean') {
            onCollapseChange && onCollapseChange(val);
        } else {
            setCollapsedLocal(val);
        }
    };

    // if parent explicitly hides sidebar, don't render
    if (typeof sidebarVisible === 'boolean' && !sidebarVisible) return null;

    return (
        <>
            {/* hidden inputs for file uploads (triggered by buttons) */}
            <input
                id="load_solution"
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onSolutionUpload) onSolutionUpload(file);
                }}
            />
            <input
                id="load_instance"
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onInstanceUpload) onInstanceUpload(file);
                }}
            />

            {collapsed ? (
                <div className="fixed top-16 left-0 bottom-0 w-16 bg-white shadow-xl border-r border-gray-200 flex flex-col z-40 items-center py-4 space-y-3">
                    <button
                        onClick={() => setCollapsed(false)}
                        aria-label="Mở thanh bên"
                        className="p-2 rounded bg-blue-500 text-white hover:bg-blue-400 transition-colors"
                    >
                        <PanelLeftOpen size={18} color="#fff" />
                    </button>

                    <button title="Load Solution" onClick={() => document.getElementById('load_solution')?.click()} className="p-2 rounded hover:bg-gray-100">
                        <FileCheck className="text-green-500" size={20} />
                    </button>

                    <button title="Load Instance" onClick={() => document.getElementById('load_instance')?.click()} className="p-2 rounded hover:bg-gray-100">
                        <FileCode className="text-blue-500" size={20} />
                    </button>

                    <button
                        title="Nhập nội dung instance"
                        onClick={() => {
                            setCollapsed(false);
                            setTimeout(() => document.getElementById('instance_textarea')?.focus(), 50);
                        }}
                        className="p-2 rounded hover:bg-gray-100"
                    >
                        <PencilLine className="text-blue-500" size={20} />
                    </button>

                    <button
                        title="Thay đổi tham số"
                        onClick={() => {
                            setCollapsed(false);
                            setTimeout(() => setShowParams(true), 50);
                        }}
                        className="p-2 rounded hover:bg-gray-100"
                    >
                        <Grid2x2Check className="text-orange-500" size={20} />
                    </button>

                    <button title="Chạy giải bài toán" onClick={() => runInstance && runInstance()} className="p-2 rounded hover:bg-gray-100">
                        <Play className="text-green-600" size={20} />
                    </button>

                    <button title="Hiển thị đường đi thực tế" onClick={() => onToggleRealRouting && onToggleRealRouting()} className="p-2 rounded hover:bg-gray-100">
                        <Map className={`${onToggleRealRouting ? 'text-green-600' : 'text-gray-600'}`} size={20} />
                    </button>
                </div>
            ) : (
                <div className="fixed top-16 left-0 bottom-0 w-80 bg-white shadow-xl border-r border-gray-200 flex flex-col z-40">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-blue-600">
                        <h2 className="text-lg font-semibold text-white">Dashboard</h2>
                        <button
                            onClick={() => setCollapsed(true)}
                            aria-label="Thu nhỏ thanh bên"
                            className="p-2 rounded bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            <PanelRightOpen size={18} color="#fff" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-white">
                        {/* Load Solution */}
                        <div className="p-4 border-b border-gray-200 space-y-2">
                            <label htmlFor="load_solution" className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors cursor-pointer">
                                <FileCheck className="text-green-500" size={18} />
                                <span className="font-medium text-gray-700">Load Solution</span>
                            </label>
                        </div>

                        {/* Load Instance */}
                        <div className="p-4 border-b border-gray-200">
                            <label htmlFor="load_instance" className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors cursor-pointer">
                                <FileCode className="text-blue-500" size={18} />
                                <span className="font-medium text-gray-700">Load Instance</span>
                            </label>
                        </div>

                        {/* Instance textarea */}
                        <div className="p-4 border-b border-gray-200">
                            <label htmlFor="instance_textarea" className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors cursor-pointer mb-2">
                                <PencilLine className="text-blue-500" size={18} />
                                <span className="font-medium text-gray-700">Nhập nội dung instance</span>
                            </label>

                            <textarea
                                id="instance_textarea"
                                rows={6}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm font-sans"
                                placeholder="Paste nội dung instance.txt hoặc click 'Load ví dụ' để thử..."
                                value={instanceText || ''}
                                onChange={(e) => setInstanceText && setInstanceText(e.target.value)}
                            />

                            <button
                                type="button"
                                onClick={() => loadSampleInstance && loadSampleInstance()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors mt-2"
                            >
                                <Download className="text-white" size={18} />
                                <span>Load ví dụ instance</span>
                            </button>

                            <div className="mt-4">
                                <button
                                    type="button"
                                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors font-semibold text-md text-gray-700"
                                    onClick={() => setShowParams((p) => !p)}
                                >
                                    <Grid2x2Check className="text-orange-500" size={18} />
                                    <span>Thay đổi tham số</span>
                                    <svg className={`w-5 h-5 transform transition-transform ${showParams ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {showParams && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            {Object.keys(params || {}).map((key) => (
                                                <div key={key}>
                                                    <label className="block text-sm font-medium text-gray-700">{key}</label>
                                                    <input
                                                        type="number"
                                                        name={key}
                                                        value={params ? params[key] : ''}
                                                        onChange={handleParamChange}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => resetParameters && resetParameters()}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors mt-4"
                                        >
                                            <RotateCw className="text-white" size={18} />
                                            <span>Reset tham số mặc định</span>
                                        </button>
                                    </>
                                )}
                            </div>

                            <button
                                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 mt-4 rounded font-medium transition-colors"
                                onClick={() => runInstance && runInstance()}
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2 justify-center">
                                        <LoaderCircle className="animate-spin" size={18} />
                                        <span>Đang chạy...</span>
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 justify-center">
                                        <Play className="text-white" size={18} />
                                        <span>Chạy giải bài toán</span>
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Real Routing Controls */}
                        <div className="p-4 border-b border-gray-200 space-y-2">
                            <button
                                id="toggle_routing_btn"
                                onClick={() => onToggleRealRouting && onToggleRealRouting()}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-white text-sm rounded transition-colors ${onToggleRealRouting ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                            >
                                <Map className="text-white" size={18} />
                                <span>Bật/tắt đường thực tế</span>
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => (typeof window !== 'undefined' && window.alert && window.alert('Cache info not implemented'))}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                                >
                                    <i className="fas fa-info-circle" />
                                    <span>Cache Info</span>
                                </button>
                                <button
                                    onClick={() => (typeof window !== 'undefined' && window.alert && window.alert('Clear cache not implemented'))}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                                >
                                    <i className="fas fa-trash" />
                                    <span>Xóa Cache</span>
                                </button>
                            </div>
                        </div>

                        {/* Result Download Section */}
                        {solution && solution.routes && solution.routes.length > 0 && (
                            <div className="p-4 border-b border-gray-200">
                                <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                                    <i className="fas fa-download text-blue-600" />
                                    <span>Kết quả</span>
                                </h3>
                                <div className="bg-gray-50 p-3 rounded mb-3">
                                    <div className="text-xs text-gray-600 space-y-1">
                                        <div>Tổng số routes: <span className="font-medium">{solution.routes.length}</span></div>
                                        <div>Tổng chi phí: <span className="font-medium">{solution.total_cost}</span></div>
                                        <div>Thời gian thực hiện: <span className="font-medium">{solution.execution_time}</span></div>
                                    </div>
                                </div>
                                <button
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
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                >
                                    <i className="fas fa-file-download" />
                                    <span>Tải xuống kết quả</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
