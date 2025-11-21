'use client';

import React, { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole, roleLabels } from "../types";

interface AnalyticsSectionProps {
    role: Extract<UserRole, "SUPPLIER" | "TECH">;
}

type TimeRange = "7d" | "30d" | "90d";

type Metric = {
    label: string;
    value: string;
    delta: number;
    description: string;
};

type SeriesPoint = {
    label: string;
    value: number;
};

type Dataset = {
    revenueSeries: SeriesPoint[];
    sessionsSeries: SeriesPoint[];
    metrics: Metric[];
};

const baseLabels: Record<TimeRange, string[]> = {
    "7d": ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    "30d": ["1", "5", "10", "15", "20", "25", "30"],
    "90d": ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7"],
};

const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({ role }) => {
    const [range, setRange] = useState<TimeRange>("30d");

    const dataset: Dataset = useMemo(() => {
        const labels = baseLabels[range];

        if (role === "SUPPLIER") {
            const revenueValues = range === "7d" ? [52, 60, 48, 70, 66, 74, 81] : range === "30d" ? [32, 41, 45, 52, 60, 68, 74] : [18, 28, 35, 44, 55, 61, 72];
            const sessions = range === "7d" ? [120, 96, 134, 150, 160, 170, 190] : range === "30d" ? [90, 110, 132, 155, 172, 195, 210] : [70, 82, 94, 120, 140, 168, 189];

            const metrics: Metric[] = [
                {
                    label: "Doanh thu",
                    value: "175 triệu",
                    delta: 12.5,
                    description: "Tổng doanh thu từ phí sạc trong kỳ",
                },
                {
                    label: "Phiên sạc thành công",
                    value: "1.245",
                    delta: 8.7,
                    description: "Số lượt sạc hoàn tất tại toàn bộ trạm",
                },
                {
                    label: "Tỷ lệ sử dụng trạm",
                    value: "84%",
                    delta: 5.2,
                    description: "So với kỳ trước",
                },
            ];

            return {
                revenueSeries: labels.map((label, index) => ({ label, value: revenueValues[index] ?? 0 })),
                sessionsSeries: labels.map((label, index) => ({ label, value: sessions[index] ?? 0 })),
                metrics,
            };
        }

        const revenueValues = range === "7d" ? [12, 16, 20, 18, 22, 27, 30] : range === "30d" ? [8, 12, 15, 18, 22, 24, 28] : [4, 8, 12, 16, 21, 25, 31];
        const sessions = range === "7d" ? [8, 12, 10, 14, 16, 18, 20] : range === "30d" ? [6, 9, 11, 13, 15, 16, 18] : [4, 6, 8, 10, 12, 14, 16];

        const metrics: Metric[] = [
            {
                label: "Doanh thu cứu hộ",
                value: "28 triệu",
                delta: 9.1,
                description: "Tổng doanh thu dịch vụ cứu hộ",
            },
            {
                label: "Ca cứu hộ hoàn thành",
                value: "156",
                delta: 11.3,
                description: "Tăng trưởng số ca xử lý thành công",
            },
            {
                label: "Thời gian phản hồi trung bình",
                value: "18 phút",
                delta: -3.6,
                description: "Giảm so với kỳ trước",
            },
        ];

        return {
            revenueSeries: labels.map((label, index) => ({ label, value: revenueValues[index] ?? 0 })),
            sessionsSeries: labels.map((label, index) => ({ label, value: sessions[index] ?? 0 })),
            metrics,
        };
    }, [range, role]);

    return (
        <section className="space-y-6" aria-labelledby="analytics-section">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h2 id="analytics-section" className="text-xl font-semibold text-gray-900">
                        Phân tích hiệu suất – {roleLabels[role]}
                    </h2>
                    <p className="text-sm text-gray-600 max-w-3xl">
                        Nắm bắt các chỉ số vận hành chính: doanh thu, lượt sạc/cứu hộ theo thời gian và các chỉ số hiệu suất trọng yếu.
                    </p>
                </div>
                <Select value={range} onValueChange={(value: TimeRange) => setRange(value)}>
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="Chọn phạm vi" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">7 ngày</SelectItem>
                        <SelectItem value="30d">30 ngày</SelectItem>
                        <SelectItem value="90d">90 ngày</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dataset.metrics.map((metric) => (
                    <MetricCard key={metric.label} metric={metric} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title={role === "SUPPLIER" ? "Doanh thu trạm sạc" : "Doanh thu dịch vụ rescue"}
                    subtitle="Triệu đồng"
                    icon={<TrendingUp className="size-5 text-blue-600" />}
                    series={dataset.revenueSeries}
                />
                <ChartCard
                    title={role === "SUPPLIER" ? "Số phiên sạc" : "Số ca cứu hộ"}
                    subtitle={role === "SUPPLIER" ? "Phiên" : "Ca"}
                    icon={<BarChart3 className="size-5 text-indigo-600" />}
                    series={dataset.sessionsSeries}
                />
            </div>
        </section>
    );
};

const MetricCard: React.FC<{ metric: Metric }> = ({ metric }) => {
    const isPositive = metric.delta >= 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-3">
            <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{metric.label}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{metric.value}</p>
            </div>
            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                }`}>
                <Icon className="size-4" />
                {Math.abs(metric.delta).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% so với kỳ trước
            </div>
            <p className="text-xs text-gray-500">{metric.description}</p>
        </div>
    );
};

const ChartCard: React.FC<{
    title: string;
    subtitle: string;
    series: SeriesPoint[];
    icon: React.ReactNode;
}> = ({ title, subtitle, series, icon }) => {
    const maxValue = Math.max(...series.map((point) => point.value), 1);
    const points = series
        .map((point, index) => {
            const x = (index / (series.length - 1 || 1)) * 100;
            const y = 100 - (point.value / maxValue) * 100;
            return `${x},${y}`;
        })
        .join(" ");

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                    <p className="text-xs text-gray-500">Đơn vị: {subtitle}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    {icon}
                </div>
            </div>
            <div className="relative h-48">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-50/60 via-white to-white rounded-lg border border-dashed border-gray-200" />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-3 w-[calc(100%-24px)] h-[calc(100%-24px)]">
                    <polyline
                        fill="none"
                        stroke="url(#chartGradient)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        points={points}
                    />
                    <defs>
                        <linearGradient id="chartGradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
                            <stop offset="0%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.4} />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="absolute inset-3 flex items-end justify-between">
                    {series.map((point) => (
                        <div key={point.label} className="text-[10px] text-gray-400">
                            {point.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsSection;
