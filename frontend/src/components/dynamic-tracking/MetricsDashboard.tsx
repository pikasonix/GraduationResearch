"use client";

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TimelineNode, MetricsChange } from '@/utils/dataModels';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface MetricsDashboardProps {
    nodes: TimelineNode[];
    selectedNode: TimelineNode | null;
    metricsChange?: MetricsChange | null;
}

function formatNumber(num: number, decimals: number = 2): string {
    return num.toFixed(decimals);
}

function formatPercent(num: number): string {
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}%`;
}

export function MetricsDashboard({ nodes, selectedNode, metricsChange }: MetricsDashboardProps) {
    const baselineNode = nodes.length > 0 ? nodes[0] : null;
    const currentNode = selectedNode || nodes[nodes.length - 1];

    if (!currentNode) {
        return (
            <Card className="border-blue-200 bg-white shadow-sm">
                <CardContent className="p-8 text-center text-blue-700">
                    Không có dữ liệu chỉ số
                </CardContent>
            </Card>
        );
    }

    // Calculate deltas vs baseline
    const vsBaseline = baselineNode ? {
        cost: currentNode.metadata.total_cost - baselineNode.metadata.total_cost,
        distance: currentNode.metadata.total_distance_km - baselineNode.metadata.total_distance_km,
        time: currentNode.metadata.total_time_hours - baselineNode.metadata.total_time_hours,
        vehicles: currentNode.metadata.total_vehicles_used - baselineNode.metadata.total_vehicles_used,
        costPercent: baselineNode.metadata.total_cost > 0 
            ? ((currentNode.metadata.total_cost - baselineNode.metadata.total_cost) / baselineNode.metadata.total_cost) * 100 
            : 0,
    } : null;

    // Prepare chart data
    const labels = nodes.map((_, idx) => `S${idx + 1}`);
    const costData = nodes.map(n => n.metadata.total_cost);
    const distanceData = nodes.map(n => n.metadata.total_distance_km);
    const timeData = nodes.map(n => n.metadata.total_time_hours);
    const vehiclesData = nodes.map(n => n.metadata.total_vehicles_used);

    const chartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        },
        scales: {
            y: {
                beginAtZero: false
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* Trend Charts */}
            {nodes.length > 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Distance Trend */}
                    <Card className="border-blue-200 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base text-blue-900">Xu hướng Quãng đường</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-48">
                                <Line
                                    options={chartOptions}
                                    data={{
                                        labels,
                                        datasets: [{
                                            label: 'Quãng đường (km)',
                                            data: distanceData,
                                            borderColor: 'rgb(16, 185, 129)',
                                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                            tension: 0.3
                                        }]
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Vehicles Trend */}
                    <Card className="border-blue-200 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base text-blue-900">Xu hướng Số xe sử dụng</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-48">
                                <Line
                                    options={chartOptions}
                                    data={{
                                        labels,
                                        datasets: [{
                                            label: 'Số xe',
                                            data: vehiclesData,
                                            borderColor: 'rgb(139, 92, 246)',
                                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                            tension: 0.3
                                        }]
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
