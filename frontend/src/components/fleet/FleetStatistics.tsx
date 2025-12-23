import React from 'react';
import { TeamStatistics } from '@/services/driverService';
import FleetCharts from './FleetCharts';

interface FleetStatisticsProps {
    statistics: TeamStatistics;
    teamName?: string;
    className?: string; // Kept for compatibility but might wrap the whole block
    gridClassName?: string; // specific chart layout if needed
}

export default function FleetStatistics({ statistics, teamName, className }: FleetStatisticsProps) {
    return (
        <div className={className || "mb-8"}>
            {teamName && (
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                        Tổng quan đội: {teamName}
                    </h2>
                </div>
            )}

            {/* Charts Component handles specific layout internally (vertical stack) */}
            <FleetCharts statistics={statistics} />
        </div>
    );
}


