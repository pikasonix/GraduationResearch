"use client";

import React from 'react';
import type { TimelineNode } from '@/utils/dataModels';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface TimelineViewProps {
    nodes: TimelineNode[];
    selectedNode: TimelineNode | null;
    onSelectNode: (node: TimelineNode) => void;
}

export function TimelineView({ nodes, selectedNode, onSelectNode }: TimelineViewProps) {
    if (nodes.length === 0) {
        return (
            <Card className="p-8 text-center text-gray-500 border-gray-200">
                Không có dữ liệu timeline
            </Card>
        );
    }

    return (
        <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* Timeline nodes */}
            <div className="space-y-4">
                {nodes.map((node, index) => {
                    const isSelected = selectedNode?.metadata.id === node.metadata.id;
                    const isFirst = index === 0;
                    const hasParent = node.metadata.parent_solution_id !== null;

                    return (
                        <div
                            key={node.metadata.id}
                            className="relative flex items-start gap-4 group"
                        >
                            {/* Timeline marker */}
                            <div className="relative flex-shrink-0">
                                <div
                                    className={`
                                        w-8 h-8 rounded-full border-4 border-background
                                        flex items-center justify-center transition-all cursor-pointer
                                        ${isSelected
                                            ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2'
                                            : isFirst
                                            ? 'bg-blue-500 text-white hover:ring-2 hover:ring-blue-500 hover:ring-offset-2'
                                            : 'bg-blue-100 hover:bg-blue-200 hover:ring-2 hover:ring-blue-400 hover:ring-offset-2 text-blue-800'
                                        }
                                    `}
                                    onClick={() => onSelectNode(node)}
                                >
                                    <span className="text-xs font-bold">{index + 1}</span>
                                </div>

                                {/* Connection indicator for reoptimization */}
                                {hasParent && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs text-blue-500">
                                        ↓
                                    </div>
                                )}
                            </div>

                            {/* Node card */}
                            <Card
                                className={`
                                    flex-1 p-4 cursor-pointer transition-all relative z-10
                                    ${isSelected
                                        ? 'ring-2 ring-blue-600 shadow-lg border-blue-600'
                                        : 'hover:shadow-md hover:border-blue-400'
                                    }
                                `}
                                onClick={() => onSelectNode(node)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        {/* Solution name */}
                                        <h3 className="font-semibold text-base text-gray-800 truncate">
                                            {node.metadata.solution_name || `Solution ${node.metadata.id.slice(0, 8)}`}
                                        </h3>

                                        {/* Timestamp */}
                                        <p className="text-sm text-gray-500 mt-1">
                                            {format(new Date(node.timestamp), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                        </p>

                                        {/* Badges */}
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {isFirst && (
                                                <Badge className="bg-blue-600 text-white hover:bg-blue-700">
                                                    Gốc
                                                </Badge>
                                            )}
                                            {hasParent && (
                                                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200">
                                                    Tối ưu lại
                                                </Badge>
                                            )}
                                            {node.children.length > 0 && (
                                                <Badge className="bg-gray-100 text-gray-700 border border-gray-300">
                                                    {node.children.length} con
                                                </Badge>
                                            )}
                                        </div>
                                    </div>


                                </div>

                                {/* Quick stats */}
                                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-sm">
                                    <div>
                                        <span className="text-gray-500">Đơn hàng:</span>{' '}
                                        <span className="font-medium text-gray-800">
                                            {(() => {
                                                // Count unique non-depot nodes and divide by 2 (pickup + delivery = 1 order)
                                                const allNodes = new Set<number>();
                                                node.solution.routes.forEach(route => {
                                                    route.sequence.forEach(nodeId => {
                                                        if (nodeId !== 0) allNodes.add(nodeId);
                                                    });
                                                });
                                                return Math.floor(allNodes.size / 2);
                                            })()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Quãng đường:</span>{' '}
                                        <span className="font-medium text-gray-800">{node.metadata.total_distance_km.toFixed(1)} km</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Thời gian:</span>{' '}
                                        <span className="font-medium text-gray-800">{node.metadata.total_time_hours.toFixed(1)} h</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Số xe:</span>{' '}
                                        <span className="font-medium text-gray-800">{node.metadata.total_vehicles_used}</span>
                                    </div>
                                </div>

                                {/* Show parent info if reoptimization */}
                                {hasParent && (
                                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                                        Tối ưu lại từ: {node.metadata.parent_solution_id?.slice(0, 8)}...
                                    </div>
                                )}
                            </Card>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
