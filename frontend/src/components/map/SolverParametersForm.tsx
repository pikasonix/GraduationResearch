import React, { useState } from 'react';
import { Settings, Clock, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface SolverParams {
    // LNS parameters
    iterations?: number;
    max_non_improving?: number;
    time_limit?: number;
    min_destroy?: number;
    max_destroy?: number;
    min_destroy_count?: number;
    max_destroy_count?: number;
    acceptance?: 'sa' | 'rtr' | 'greedy';
    
    // General configuration
    seed?: number;
    max_vehicles?: number;
    log_level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    authors?: string;
    reference?: string;
    
    // Instance format
    format?: 'lilim' | 'sartori';
}

interface SolverParametersFormProps {
    params: SolverParams;
    onChange: (name: string, value: any) => void;
}

export const SolverParametersForm: React.FC<SolverParametersFormProps> = ({ params, onChange }) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showMetadata, setShowMetadata] = useState(false);

    // Time options in seconds
    const timeOptions = [
        { label: '1p', value: 60 },
        { label: '5p', value: 300 },
        { label: '10p', value: 600 },
        { label: '30p', value: 1800 }
    ];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'number') {
            onChange(name, value === '' ? undefined : Number(value));
        } else {
            onChange(name, value);
        }
    };

    const setTimeLimit = (seconds: number) => {
        onChange('time_limit', seconds);
    };

    return (
        <div className="space-y-3">
            {/* Basic Parameters Section */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 border-b pb-1">Tham số</h4>
                
                {/* Time Limit */}
                <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                            Thời gian
                        </span>
                        <div className="flex items-center gap-1">
                            {timeOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setTimeLimit(opt.value)}
                                    className={`flex h-7 w-10 items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors ${
                                        params.time_limit === opt.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                            Tùy chỉnh
                        </span>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                name="time_limit"
                                value={params.time_limit ?? ''}
                                onChange={handleInputChange}
                                placeholder="Nhập số"
                                step="1"
                                min="10"
                                className="h-7 w-20 px-2 text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-0"
                            />
                            <span className="text-xs text-gray-500">giây</span>
                        </div>
                    </div>
                </div>

                {/* Format */}
                <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2">
                    <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600">Format dữ liệu</span>
                    <select
                        name="format"
                        value={params.format ?? 'lilim'}
                        onChange={handleInputChange}
                        className="h-7 px-2 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                    >
                        <option value="lilim">Li & Lim</option>
                        <option value="sartori">Sartori</option>
                    </select>
                </div>

                {/* Iterations */}
                <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2">
                    <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                        Vòng lặp
                        <Tooltip content="Số lần lặp tối đa của LNS" />
                    </span>
                    <input
                        type="number"
                        name="iterations"
                        value={params.iterations ?? ''}
                        onChange={handleInputChange}
                        placeholder="100000"
                        step="1000"
                        min="100"
                        className="h-7 w-28 px-2 text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-0"
                    />
                </div>

                {/* Acceptance */}
                <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2">
                    <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                        Chấp nhận
                        <Tooltip content="RTR (khuyến nghị): cân bằng tốc độ/chất lượng. SA: khám phá rộng hơn. Greedy: nhanh nhất." />
                    </span>
                    <select
                        name="acceptance"
                        value={params.acceptance ?? 'rtr'}
                        onChange={handleInputChange}
                        className="h-7 px-2 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                    >
                        <option value="rtr">RTR</option>
                        <option value="sa">SA</option>
                        <option value="greedy">Greedy</option>
                    </select>
                </div>
            </div>

            {/* Advanced Parameters Toggle */}
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            >
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Tham số nâng cao
                </span>
            </button>

            {/* Advanced Parameters Section */}
            {showAdvanced && (
                <div className="space-y-2 p-3 bg-gray-50 rounded border border-gray-200">
                    {/* Max Non-Improving */}
                    <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-white px-2">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                            Dừng sớm
                            <Tooltip content="Dừng sớm nếu không tìm được giải pháp tốt hơn sau N vòng lặp." />
                        </span>
                        <input
                            type="number"
                            name="max_non_improving"
                            value={params.max_non_improving ?? ''}
                            onChange={handleInputChange}
                            placeholder="20000"
                            step="1000"
                            className="h-7 w-24 px-2 text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-0"
                        />
                    </div>

                    {/* Max Vehicles */}
                    <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-white px-2">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600">Số xe tối đa</span>
                        <input
                            type="number"
                            name="max_vehicles"
                            value={params.max_vehicles ?? ''}
                            onChange={handleInputChange}
                            placeholder="0"
                            className="h-7 w-20 px-2 text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-0"
                        />
                    </div>

                    {/* Min Destroy */}
                    <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-white px-2">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                            Destroy min
                            <Tooltip content="Tỷ lệ phá huỷ tối thiểu của LNS" />
                        </span>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                name="min_destroy"
                                value={params.min_destroy !== undefined ? Math.round(params.min_destroy * 100) : ''}
                                onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : Number(e.target.value) / 100;
                                    onChange('min_destroy', val);
                                }}
                                placeholder="10"
                                step="5"
                                min="0"
                                max="100"
                                className="h-7 w-16 text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-0"
                            />
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    </div>

                    {/* Max Destroy */}
                    <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-white px-2">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                            Destroy max
                            <Tooltip content="Tỷ lệ phá huỷ tối đa của LNS" />
                        </span>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                name="max_destroy"
                                value={params.max_destroy !== undefined ? Math.round(params.max_destroy * 100) : ''}
                                onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : Number(e.target.value) / 100;
                                    onChange('max_destroy', val);
                                }}
                                placeholder="40"
                                step="5"
                                min="0"
                                max="100"
                                className="h-7 w-16 text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-0"
                            />
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    </div>

                    {/* Seed */}
                    <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-white px-2">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                            Seed
                            <Tooltip content="Giá trị khởi tạo cho bộ sinh số ngẫu nhiên. Giữ seed cố định để tái tạo kết quả, đổi seed để thử giải pháp khác." />
                        </span>
                        <input
                            type="number"
                            name="seed"
                            value={params.seed ?? ''}
                            onChange={handleInputChange}
                            placeholder="42"
                            className="h-7 w-20 px-2 text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-0"
                        />
                    </div>

                    {/* Log Level */}
                    <div className="flex h-9 items-center justify-between rounded-md border border-gray-200 bg-white px-2">
                        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-600">Mức độ log</span>
                        <select
                            name="log_level"
                            value={params.log_level ?? 'info'}
                            onChange={handleInputChange}
                            className="h-7 px-2 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                        >
                            <option value="error">Error</option>
                            <option value="warn">Warning</option>
                            <option value="info">Info</option>
                            <option value="debug">Debug</option>
                            <option value="trace">Trace</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Metadata Toggle */}
            <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            >
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    {showMetadata ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Thông tin bổ sung
                </span>
            </button>

            {/* Metadata Section */}
            {showMetadata && (
                <div className="space-y-3 p-3 bg-gray-50 rounded border border-gray-200">
                    <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Tác giả</label>
                        <input
                            type="text"
                            name="authors"
                            value={params.authors ?? ''}
                            onChange={handleInputChange}
                            placeholder="Nhập tên tác giả"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Tham chiếu</label>
                        <input
                            type="text"
                            name="reference"
                            value={params.reference ?? ''}
                            onChange={handleInputChange}
                            placeholder="VD: LNS with RTR"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
