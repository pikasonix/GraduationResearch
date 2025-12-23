"use client";

import React from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    ChartData,
    ChartOptions
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { TeamStatistics } from '@/services/driverService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

interface FleetChartsProps {
    statistics: TeamStatistics;
}

export default function FleetCharts({ statistics }: FleetChartsProps) {
    // Data for Drivers Chart
    const inactiveDrivers = statistics.total_drivers - statistics.active_drivers;
    const driverData: ChartData<'doughnut'> = {
        labels: ['Hoạt động', 'Không hoạt động'],
        datasets: [
            {
                data: [statistics.active_drivers, inactiveDrivers],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)', // Green for Active
                    'rgba(229, 231, 235, 0.8)', // Gray for Inactive
                ],
                borderColor: [
                    'rgba(34, 197, 94, 1)',
                    'rgba(229, 231, 235, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    // Data for Vehicles Chart
    const inactiveVehicles = statistics.total_vehicles - statistics.active_vehicles;
    const vehicleData: ChartData<'doughnut'> = {
        labels: ['Hoạt động', 'Không hoạt động'],
        datasets: [
            {
                data: [statistics.active_vehicles, inactiveVehicles],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)', // Blue for Active
                    'rgba(229, 231, 235, 0.8)', // Gray for Inactive
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(229, 231, 235, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    const options: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
                position: 'right' as const,
                labels: {
                    boxWidth: 8,
                    font: {
                        size: 10
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        let label = context.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed !== null) {
                            label += context.parsed;
                        }
                        return label;
                    }
                }
            }
        },
        cutout: '85%',
    };

    // Helper to render center text
    const CenterText = ({ active, total, label }: { active: number, total: number, label: string }) => (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 pointer-events-none">
            <span className="text-sm font-bold text-gray-900 leading-none">{active}/{total}</span>
            <span className="text-[8px] text-gray-500 font-medium uppercase mt-0.5">{label}</span>
        </div>
    );

    return (
        <div className="grid grid-cols-2 gap-2 max-w-[80%] mx-auto">
            {/* Drivers Chart */}
            <Card>
                <CardHeader className="pb-1 pt-2 px-3">
                    <CardTitle className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Tài xế</CardTitle>
                </CardHeader>
                <CardContent className="pb-2 px-3">
                    <div className="relative h-[75px] w-full">
                        <Doughnut data={driverData} options={options} />
                        <CenterText active={statistics.active_drivers} total={statistics.total_drivers} label="Sẵn sàng" />
                    </div>
                </CardContent>
            </Card>

            {/* Vehicles Chart */}
            <Card>
                <CardHeader className="pb-1 pt-2 px-3">
                    <CardTitle className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Phương tiện</CardTitle>
                </CardHeader>
                <CardContent className="pb-2 px-3">
                    <div className="relative h-[75px] w-full">
                        <Doughnut data={vehicleData} options={options} />
                        <CenterText active={statistics.active_vehicles} total={statistics.total_vehicles} label="Sẵn sàng" />
                    </div>
                </CardContent>
            </Card>

            {/* Summary / Capacity Card (Optional - kept simple text) */}
            <Card className="col-span-2">
                <CardHeader className="pb-1 pt-2 px-3">
                    <CardTitle className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Sẵn sàng</CardTitle>
                </CardHeader>
                <CardContent className="pb-2 px-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-base font-bold text-gray-900">
                                {Math.min(statistics.active_drivers, statistics.active_vehicles)}
                            </div>
                            <div className="text-[10px] text-gray-400">cặp tài xế & xe</div>
                        </div>
                        <div className={`h-2 w-2 rounded-full ${statistics.active_drivers > 0 && statistics.active_vehicles > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
