"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import type { TimelineNode } from '@/utils/dataModels';

interface TimelineSliderProps {
    nodes: TimelineNode[];
    selectedNode: TimelineNode | null;
    onSelectNode: (node: TimelineNode) => void;
}

export function TimelineSlider({ nodes, selectedNode, onSelectNode }: TimelineSliderProps) {
    const [timelineIndex, setTimelineIndex] = React.useState(
        selectedNode ? nodes.findIndex(n => n.metadata.id === selectedNode.metadata.id) : nodes.length - 1
    );

    // Update when selectedNode changes externally
    React.useEffect(() => {
        if (selectedNode) {
            const index = nodes.findIndex(n => n.metadata.id === selectedNode.metadata.id);
            if (index !== -1 && index !== timelineIndex) {
                setTimelineIndex(index);
            }
        }
    }, [selectedNode, nodes, timelineIndex]);

    const currentNode = nodes[timelineIndex] || null;

    const handleSliderChange = (value: number[]) => {
        const newIndex = value[0];
        setTimelineIndex(newIndex);
        if (nodes[newIndex]) {
            onSelectNode(nodes[newIndex]);
        }
    };

    if (nodes.length === 0) {
        return null;
    }

    return (
        <Card className="border-blue-200 bg-white shadow-sm">
            <CardHeader>
                <CardTitle className="text-base text-blue-900">Timeline Slider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Timeline Slider */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Solution {timelineIndex + 1} of {nodes.length}
                        </span>
                        {currentNode && (
                            <Badge variant="outline">
                                {currentNode.metadata.solution_name || `S${timelineIndex + 1}`}
                            </Badge>
                        )}
                    </div>
                    <Slider
                        value={[timelineIndex]}
                        onValueChange={handleSliderChange}
                        min={0}
                        max={nodes.length - 1}
                        step={1}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-blue-600">Baseline</span>
                        <span className="text-blue-600">Latest</span>
                    </div>
                </div>

                {/* Current Solution Info */}
                {currentNode && (
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t text-sm">
                        <div>
                            <span className="text-muted-foreground">Cost:</span>{' '}
                            <span className="font-semibold">{currentNode.metadata.total_cost.toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Distance:</span>{' '}
                            <span className="font-semibold">{currentNode.metadata.total_distance_km.toFixed(1)} km</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Vehicles:</span>{' '}
                            <span className="font-semibold">{currentNode.metadata.total_vehicles_used}</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
