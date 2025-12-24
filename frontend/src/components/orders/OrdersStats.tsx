"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Order } from "@/lib/redux/services/orderApi";
import { Package, Zap } from "lucide-react";
import { Doughnut } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    ChartOptions
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface OrdersStatsProps {
    orders: Order[];
    statusFilter: string | null;
    priorityFilter: string | null;
    onStatusFilterChange: (status: string | null) => void;
    onPriorityFilterChange: (priority: string | null) => void;
}

export const OrdersStats: React.FC<OrdersStatsProps> = ({
    orders,
    statusFilter,
    priorityFilter,
    onStatusFilterChange,
    onPriorityFilterChange
}) => {
    const totalOrders = orders.length;
    const urgentOrders = orders.filter((o) => o.priority === "urgent").length;
    const normalOrders = orders.filter((o) => o.priority === "normal").length;

    const statusCounts = {
        delivered: orders.filter((o) => o.status === "delivered").length,
        failed: orders.filter((o) => o.status === "failed" || o.status === "cancelled").length,
        assigned: orders.filter((o) => o.status === "assigned").length,
        in_transit: orders.filter((o) => o.status === "in_transit").length,
        pending: orders.filter((o) => o.status === "pending").length,
    };

    // Status Chart Data
    const statusChartData = {
        labels: ["Hoàn thành", "Thất bại", "Đã gán", "Đang giao", "Chờ xử lý"],
        datasets: [
            {
                data: [
                    statusCounts.delivered,
                    statusCounts.failed,
                    statusCounts.assigned,
                    statusCounts.in_transit,
                    statusCounts.pending,
                ],
                backgroundColor: [
                    "rgba(34, 197, 94, 1)",   // green
                    "rgba(239, 68, 68, 1)",   // red
                    "rgba(251, 191, 36, 1)",  // yellow
                    "rgba(59, 130, 246, 1)",  // blue
                    "rgba(156, 163, 175, 1)", // gray
                ],
                borderColor: "rgba(255, 255, 255, 1)",
                borderWidth: 3,
                borderRadius: 20,
            },
        ],
    };

    // Priority Chart Data
    const priorityChartData = {
        labels: ["Thường", "Hoả tốc"],
        datasets: [
            {
                data: [normalOrders, urgentOrders],
                backgroundColor: [
                    "rgba(59, 130, 246, 1)",  // blue
                    "rgba(239, 68, 68, 1)",   // red
                ],
                borderColor: "rgba(255, 255, 255, 1)",
                borderWidth: 3,
                borderRadius: 20,
            },
        ],
    };

    // State for hover information
    const [hoverStatus, setHoverStatus] = React.useState<{ label: string; value: number; color: string } | null>(null);
    const [hoverPriority, setHoverPriority] = React.useState<{ label: string; value: number; color: string } | null>(null);

    // Common options base
    const baseOptions: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "75%",
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }, // Disable default tooltip
        },
    };

    const statusOptions: ChartOptions<'doughnut'> = {
        ...baseOptions,
        onHover: (_, elements, chart) => {
            if (elements && elements.length > 0) {
                const index = elements[0].index;
                const dataset = chart.data.datasets[0];
                const value = dataset.data[index] as number;
                const label = chart.data.labels?.[index] as string;
                const backgroundColor = dataset.backgroundColor as string[];
                const color = backgroundColor[index];
                setHoverStatus((prev) => {
                    if (prev?.label === label && prev?.value === value && prev?.color === color) return prev;
                    return { label, value, color };
                });
            } else {
                setHoverStatus(null);
            }
        },
        onClick: (_, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                // Map index to internal status string
                const statusMap = ["delivered", "failed", "assigned", "in_transit", "pending"];
                const selectedStatus = statusMap[index];

                if (statusFilter === selectedStatus) {
                    onStatusFilterChange(null); // Toggle off
                } else {
                    onStatusFilterChange(selectedStatus);
                }
            }
        }
    };

    const priorityOptions: ChartOptions<'doughnut'> = {
        ...baseOptions,
        onHover: (_, elements, chart) => {
            if (elements && elements.length > 0) {
                const index = elements[0].index;
                const dataset = chart.data.datasets[0];
                const value = dataset.data[index] as number;
                const label = chart.data.labels?.[index] as string;
                const backgroundColor = dataset.backgroundColor as string[];
                const color = backgroundColor[index];
                setHoverPriority((prev) => {
                    if (prev?.label === label && prev?.value === value && prev?.color === color) return prev;
                    return { label, value, color };
                });
            } else {
                setHoverPriority(null);
            }
        },
        onClick: (_, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                // Map index to internal priority string
                const priorityMap = ["normal", "urgent"];
                const selectedPriority = priorityMap[index];

                if (priorityFilter === selectedPriority) {
                    onPriorityFilterChange(null);
                } else {
                    onPriorityFilterChange(selectedPriority);
                }
            }
        }
    };

    // Mappings for Label/Color lookup
    const statusMap = ["delivered", "failed", "assigned", "in_transit", "pending"];
    const statusLabels = ["Hoàn thành", "Thất bại", "Đã gán", "Đang giao", "Chờ xử lý"];
    const statusColors = [
        "rgba(34, 197, 94, 1)",
        "rgba(239, 68, 68, 1)",
        "rgba(251, 191, 36, 1)",
        "rgba(59, 130, 246, 1)",
        "rgba(156, 163, 175, 1)",
    ];
    const statusValues = [
        statusCounts.delivered,
        statusCounts.failed,
        statusCounts.assigned,
        statusCounts.in_transit,
        statusCounts.pending,
    ];

    const priorityMap = ["normal", "urgent"];
    const priorityLabels = ["Thường", "Hoả tốc"];
    const priorityColors = [
        "rgba(59, 130, 246, 1)",
        "rgba(239, 68, 68, 1)",
    ];
    const priorityValues = [normalOrders, urgentOrders];

    // Helper to get display data
    const getDisplayData = (
        hoverData: { label: string; value: number; color: string } | null,
        filter: string | null,
        map: string[],
        labels: string[],
        values: number[],
        colors: string[],
        defaultLabel: string,
        defaultValue: number
    ) => {
        if (hoverData) return hoverData;
        if (filter) {
            const index = map.indexOf(filter);
            if (index !== -1) {
                return {
                    label: labels[index],
                    value: values[index],
                    color: colors[index],
                };
            }
        }
        return {
            label: defaultLabel,
            value: defaultValue,
            color: '#111827' // gray-900
        };
    };

    const statusDisplay = getDisplayData(
        hoverStatus,
        statusFilter,
        statusMap,
        statusLabels,
        statusValues,
        statusColors,
        "Đơn hôm nay",
        totalOrders
    );

    const priorityDisplay = getDisplayData(
        hoverPriority,
        priorityFilter,
        priorityMap,
        priorityLabels,
        priorityValues,
        priorityColors,
        "Ưu tiên",
        totalOrders
    );

    return (
        <div className="flex gap-3 flex-wrap items-center">
            {/* Status Chart Card */}
            <Card className={`p-3 bg-white border min-w-[200px] cursor-pointer transition-all ${statusFilter ? 'ring-2 ring-indigo-500 border-transparent' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col min-w-[80px]">
                        <span
                            className="text-3xl font-bold transition-colors duration-200"
                            style={{ color: statusDisplay.color }}
                        >
                            {statusDisplay.value}
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                            {statusDisplay.label}
                        </span>
                    </div>
                    <div className="relative w-20 h-20">
                        {totalOrders > 0 ? (
                            <>
                                <Doughnut data={statusChartData} options={statusOptions} />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center pointer-events-auto transition-colors ${statusFilter ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' : 'bg-gray-100 text-gray-600'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onStatusFilterChange(null);
                                        }}
                                        title={statusFilter ? "Bỏ lọc" : ""}
                                    >
                                        <Package className="w-4 h-4" />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Package className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Priority Chart Card */}
            <Card className={`p-3 bg-white border min-w-[200px] cursor-pointer transition-all ${priorityFilter ? 'ring-2 ring-red-500 border-transparent' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col min-w-[80px]">
                        <span
                            className="text-3xl font-bold transition-colors duration-200"
                            style={{ color: priorityDisplay.color }}
                        >
                            {priorityDisplay.value}
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                            {priorityDisplay.label}
                        </span>
                    </div>
                    <div className="relative w-20 h-20">
                        {totalOrders > 0 ? (
                            <>
                                <Doughnut data={priorityChartData} options={priorityOptions} />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center pointer-events-auto transition-colors ${priorityFilter ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-600'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPriorityFilterChange(null);
                                        }}
                                        title={priorityFilter ? "Bỏ lọc" : ""}
                                    >
                                        <Zap className="w-4 h-4" />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};
