"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TimelineView } from '@/components/dynamic-tracking/TimelineView';
import { MetricsDashboard } from '@/components/dynamic-tracking/MetricsDashboard';
import { ChangesSummary } from '@/components/dynamic-tracking/ChangesSummary';
import { TimelineMap } from '@/components/dynamic-tracking/TimelineMap';
import { TimelineSlider } from '@/components/dynamic-tracking/TimelineSlider';
import { useSolutionTimeline } from '@/components/dynamic-tracking/useSolutionTimeline';
import { useSolutionDiff } from '@/components/dynamic-tracking/useSolutionDiff';
import { useSolutionHistory } from '@/components/route-details/useSolutionHistory';
import { Loader2, Clock, List } from 'lucide-react';
import type { TimelineNode } from '@/utils/dataModels';

function DynamicTrackingContent() {
    const searchParams = useSearchParams();
    const urlRootSolutionId = searchParams?.get('rootSolution') || null;
    
    const [selectedRootId, setSelectedRootId] = useState<string | null>(urlRootSolutionId);
    const [selectedNode, setSelectedNode] = useState<TimelineNode | null>(null);

    // Fetch solution history for selector dropdown
    const { solutions: availableSolutions, loading: historyLoading, organizationId } = useSolutionHistory({ limit: 50 });

    // Fetch timeline based on selected root or all org solutions
    const { timelineNodes, rootNode, loading: timelineLoading, error: timelineError } = useSolutionTimeline({
        rootSolutionId: selectedRootId,
        organizationId: !selectedRootId ? organizationId : undefined
    });

    // Auto-select first node when timeline loads
    useEffect(() => {
        if (timelineNodes.length > 0 && !selectedNode) {
            setSelectedNode(timelineNodes[0]);
        }
    }, [timelineNodes, selectedNode]);

    // Auto-select last node when root changes
    useEffect(() => {
        if (timelineNodes.length > 0 && selectedRootId) {
            setSelectedNode(timelineNodes[timelineNodes.length - 1]);
        }
    }, [selectedRootId, timelineNodes]);

    // Compute diff between selected node and previous
    const selectedIndex = selectedNode ? timelineNodes.findIndex(n => n.metadata.id === selectedNode.metadata.id) : -1;
    const previousNode = selectedIndex > 0 ? timelineNodes[selectedIndex - 1] : null;
    const diff = useSolutionDiff(previousNode, selectedNode);

    const isLoading = historyLoading || timelineLoading;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-white">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Clock className="h-6 w-6" />
                                Dynamic Routing Timeline
                            </h1>
                        </div>

                        {/* Solution Selector */}
                        <div className="flex items-center gap-4">
                            <div className="w-80">
                                <label className="text-sm font-medium mb-2 block">
                                    Select Solution
                                </label>
                                <Select
                                    value={selectedRootId || 'all'}
                                    onValueChange={(value) => {
                                        setSelectedRootId(value === 'all' ? null : value);
                                        setSelectedNode(null);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Chọn solution..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Tất cả Solutions (Timeline)
                                        </SelectItem>
                                        {availableSolutions.map((sol) => (
                                            <SelectItem key={sol.id} value={sol.id}>
                                                {sol.solution_name || `Solution ${sol.id.slice(0, 8)}`}
                                                {' '}
                                                ({sol.total_vehicles_used} xe, {sol.total_cost.toFixed(0)} chi phí)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="container mx-auto px-4 py-12">
                    <Card className="border-blue-200 bg-white shadow-md">
                        <CardContent className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
                            <span className="text-lg text-blue-900">Đang tải timeline...</span>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Error State */}
            {timelineError && !isLoading && (
                <div className="container mx-auto px-4 py-12">
                    <Card className="border-red-200 bg-red-50 shadow-md">
                        <CardContent className="p-8 text-center">
                            <p className="text-red-600 font-medium">{timelineError}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !timelineError && timelineNodes.length === 0 && (
                <div className="container mx-auto px-4 py-12">
                    <Card className="border-blue-200 bg-white shadow-md">
                        <CardContent className="p-12 text-center">
                            <Clock className="h-16 w-16 mx-auto text-blue-300 mb-4" />
                            <h3 className="text-xl font-semibold text-blue-900 mb-2">Không có dữ liệu timeline</h3>
                            <p className="text-blue-700 mb-6">
                                Vui lòng chọn solution hoặc tạo solution mới từ trang routing
                            </p>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.location.href = '/routing'}>
                                Đi tới Routing
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Main Content */}
            {!isLoading && !timelineError && timelineNodes.length > 0 && (
                <div className="container mx-auto px-4 py-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left: Timeline */}
                        <div className="lg:col-span-4">
                            <Card className="border-blue-200 bg-white shadow-md">
                                <CardContent className="p-4">
                                    <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                                        <List className="h-5 w-5 text-blue-600" />
                                        Timeline Solution
                                    </h2>
                                    <div className="max-h-[calc(100vh-300px)] overflow-y-auto px-3 py-2">
                                        <TimelineView
                                            nodes={timelineNodes}
                                            selectedNode={selectedNode}
                                            onSelectNode={setSelectedNode}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right: All Details Combined */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* Timeline Slider */}
                            <div>
                                <TimelineSlider
                                    nodes={timelineNodes}
                                    selectedNode={selectedNode}
                                    onSelectNode={setSelectedNode}
                                />
                            </div>

                            {/* Map Section */}
                            <div>
                                <TimelineMap
                                    nodes={timelineNodes}
                                    selectedNode={selectedNode}
                                    onSelectNode={setSelectedNode}
                                />
                            </div>

                            {/* Metrics Section */}
                            <div>
                                <MetricsDashboard
                                    nodes={timelineNodes}
                                    selectedNode={selectedNode}
                                    metricsChange={diff?.metricsChange}
                                />
                            </div>

                            {/* Changes Section */}
                            <div>
                                <ChangesSummary diff={diff} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DynamicTrackingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <DynamicTrackingContent />
        </Suspense>
    );
}
