"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TimelineNode, Route, Instance, Solution, Node } from '@/utils/dataModels';
import { createInstance, createNode } from '@/utils/dataModels';
import dynamic from 'next/dynamic';
import { useSolutionDiff } from './useSolutionDiff';

// Dynamically import MapboxComponent to avoid SSR issues
const MapboxComponent = dynamic(
    () => import('@/components/map/MapboxComponent'),
    { ssr: false }
);

interface TimelineMapProps {
    nodes: TimelineNode[];
    selectedNode: TimelineNode | null;
    onSelectNode: (node: TimelineNode) => void;
}

export function TimelineMap({ nodes, selectedNode, onSelectNode }: TimelineMapProps) {
    const [selectedNodes, setSelectedNodes] = useState<Node[] | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

    const currentNode = selectedNode || nodes[nodes.length - 1];
    const selectedIndex = currentNode ? nodes.findIndex(n => n.metadata.id === currentNode.metadata.id) : -1;
    const previousNode = selectedIndex > 0 ? nodes[selectedIndex - 1] : null;

    // Compute diff to highlight changes
    const diff = useSolutionDiff(previousNode, currentNode);

    // Prepare instance and solution for MapboxComponent
    const { instance, solution, highlightedRoutes } = useMemo(() => {
        if (!currentNode) return { instance: null, solution: null, highlightedRoutes: new Set<number>() };

        // Build instance from metadata
        const inst = createInstance();
        const mappingIds = currentNode.metadata.mapping_ids || [];
        
        console.log('[TimelineMap] Building instance:', {
            solutionId: currentNode.metadata.id,
            mappingIdsCount: mappingIds.length,
            routesCount: currentNode.solution.routes.length
        });
        
        if (mappingIds.length === 0) {
            console.warn('[TimelineMap] No mapping_ids found for solution:', currentNode.metadata.id);
            return { instance: null, solution: null, highlightedRoutes: new Set<number>() };
        }
        
        inst.name = currentNode.solution.instance_name || 'Solution';
        inst.type = 'persisted';
        inst.capacity = 100; // Default capacity
        inst.location = '';
        
        inst.nodes = mappingIds.map((m: any, idx: number) => {
            const lat = Number(m?.lat || 0);
            const lng = Number(m?.lng || 0);
            const kind = String(m?.kind || '');
            const isPickup = kind === 'pickup';
            const isDelivery = kind === 'delivery';
            const demand = Number(m?.demand ?? 0);
            const twStart = Number(m?.time_window_start ?? 0);
            const twEnd = Number(m?.time_window_end ?? 480);
            const serviceTime = Number(m?.service_time ?? 5);
            
            const node = createNode(
                idx,
                [Number.isFinite(lat) ? lat : 0, Number.isFinite(lng) ? lng : 0],
                demand,
                [twStart, twEnd],
                serviceTime,
                isPickup,
                isDelivery
            );
            
            // Add metadata
            (node as any).order_id = m?.order_id || null;
            (node as any).location_id = m?.location_id || null;
            (node as any).kind = kind;
            
            return node;
        });
        
        inst.all_coords = inst.nodes.map((n) => n.coords);
        inst.size = inst.nodes.length;
        inst.times = [];

        // Determine which routes have changes for highlighting
        const changedRouteIds = new Set<number>();
        if (diff && previousNode) {
            diff.routesAdded.forEach(id => changedRouteIds.add(id));
            diff.routesModified.forEach(mod => changedRouteIds.add(mod.routeId));
            diff.ordersReassigned.forEach(o => {
                if (o.toRoute) changedRouteIds.add(o.toRoute);
            });
        }

        // Build solution with enhanced styling for changed routes
        const routes = currentNode.solution.routes.map((route: Route) => {
            // Clone route to avoid mutating original
            return { ...route };
        });

        const sol: Solution = {
            instance_name: inst.name,
            reference: currentNode.metadata.solution_name || currentNode.metadata.id,
            date: currentNode.metadata.created_at,
            author: 'system',
            routes
        };

        return { instance: inst, solution: sol, highlightedRoutes: changedRouteIds };
    }, [currentNode, diff, previousNode]);

    if (nodes.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Không có dữ liệu để hiển thị
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Map Display */}
            <Card>
                <CardContent className="p-0">
                    <div className="h-[600px] relative">
                        {instance && solution && instance.nodes.length > 0 && solution.routes.length > 0 ? (
                            <MapboxComponent
                                instance={instance}
                                solution={solution}
                                selectedNodes={selectedNodes}
                                setSelectedNodes={setSelectedNodes}
                                selectedRoute={selectedRoute}
                                setSelectedRoute={setSelectedRoute}
                                useRealRouting={true}
                                hidePanels={false}
                                mapHeight="100%"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                {!currentNode ? 'Không có solution được chọn' :
                                 !instance || instance.nodes.length === 0 ? 'Không có dữ liệu nodes' :
                                 !solution || solution.routes.length === 0 ? 'Không có routes' :
                                 'Không có dữ liệu bản đồ'}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Route Legend */}
            {currentNode && currentNode.solution.routes.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Routes Legend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {currentNode.solution.routes.map((route: Route) => {
                                return (
                                    <div
                                        key={route.id}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card"
                                    >
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: route.color }}
                                        />
                                        <span className="text-sm font-medium">Route {route.id}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({route.sequence.length - 2} stops)
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
