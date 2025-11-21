import React, { useState, useEffect } from 'react';

interface NodeListProps {
    instance?: any | null;
    onClickNode?: (node: any) => void;
    highlightMarkers?: (node: any, on: boolean) => void;
    selectedNodes?: any[] | null;
}

const NodeList: React.FC<NodeListProps> = ({ instance, onClickNode, highlightMarkers, selectedNodes }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const toggleDropdown = () => {
        setIsDropdownOpen(prev => !prev);
    };

    useEffect(() => {
        // Clear selection when dropdown closes
        if (!isDropdownOpen && selectedNodes && highlightMarkers) {
            selectedNodes.forEach(node => highlightMarkers(node, false));
        }
    }, [isDropdownOpen, selectedNodes, highlightMarkers]);

    if (!instance || !instance.nodes || instance.nodes.length === 0) {
        return null;
    }

    return (
        <div className="border-b border-gray-200">
            <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors duration-200"
                onClick={toggleDropdown}
            >
                <div className="flex items-center space-x-3">
                    <i className="fa fa-map-marker-alt text-blue-600"></i>
                    <span className="font-medium text-gray-700">Nodes</span>
                </div>
                <i className={`fa fa-angle-down text-gray-400 transform transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
            </button>
            <div
                id="nodes_dropdown"
                className={`bg-gray-50 max-h-40 overflow-y-auto ${isDropdownOpen ? 'block' : 'hidden'}`}
            >
                {/* Build depot rows and pickup-delivery pairs */}
                {(() => {
                    const nodes: any[] = instance.nodes || [];
                    const nodesById = new Map(nodes.map(n => [n.id, n]));

                    // Helpers to read time window and demand from various possible shapes
                    const formatTimeWindow = (node: any) => {
                        if (!node) return '-';
                        // Support array form: [start, end]
                        if (Array.isArray(node.time_window) && node.time_window.length >= 2) {
                            const [s0, e0] = node.time_window;
                            return `${s0 ?? '-'} - ${e0 ?? '-'}`;
                        }
                        const start = node.time_window?.start ?? node.tw_start ?? node.time_window_start ?? node.earliest ?? node.start;
                        const end = node.time_window?.end ?? node.tw_end ?? node.time_window_end ?? node.latest ?? node.end;
                        if (start == null && end == null) return '-';
                        const s = (typeof start === 'number' || typeof start === 'string') ? start : (start && start.toString());
                        const e = (typeof end === 'number' || typeof end === 'string') ? end : (end && end.toString());
                        return `${s ?? '-'} - ${e ?? '-'}`;
                    };

                    const getDemand = (node: any) => {
                        if (!node) return '-';
                        return node.demand ?? node.quantity ?? node.load ?? node.qty ?? '-';
                    };

                    const depots = nodes.filter(n => n.is_depot);

                    const used = new Set<any>();
                    const pairs: Array<{ left: any | null; right: any | null }> = [];

                    // First, pair pickups with their deliveries using pair id if available
                    for (const node of nodes) {
                        if (node.is_depot) continue;
                        if (used.has(node.id)) continue;

                        if (node.is_pickup) {
                            const possible = nodesById.get(node.pair) || nodes.find((x: any) => x.pair === node.id && x.is_delivery) || null;
                            pairs.push({ left: node, right: possible });
                            used.add(node.id);
                            if (possible) used.add(possible.id);
                        }
                    }

                    // Then add remaining deliveries that weren't paired above
                    for (const node of nodes) {
                        if (node.is_depot) continue;
                        if (used.has(node.id)) continue;
                        if (node.is_delivery) {
                            const possible = nodesById.get(node.pair) || nodes.find((x: any) => x.pair === node.id && x.is_pickup) || null;
                            if (possible && !used.has(possible.id)) {
                                pairs.push({ left: possible, right: node });
                                used.add(possible.id);
                                used.add(node.id);
                            } else {
                                pairs.push({ left: null, right: node });
                                used.add(node.id);
                            }
                        }
                    }

                    // Any remaining nodes (neither pickup nor delivery) render as single rows
                    for (const node of nodes) {
                        if (node.is_depot) continue;
                        if (used.has(node.id)) continue;
                        pairs.push({ left: node, right: null });
                        used.add(node.id);
                    }

                    // Render depots first (each on its own line)
                    const rows: any[] = [];
                    for (const d of depots) {
                        rows.push({ depot: d });
                    }
                    for (const p of pairs) rows.push(p);

                    return rows.map((row, idx) => {
                        if (row.depot) {
                            const node = row.depot;
                            const name = (typeof node.string_name === 'function') ? node.string_name() : (`Depot ${node.id}`);
                            const tw = formatTimeWindow(node);
                            const demand = getDemand(node);
                            return (
                                <div key={`depot-${node.id}`} className="flex items-center px-4 py-2 border-b border-gray-100">
                                    <div className="w-full flex items-center space-x-3">
                                        <div className="flex-shrink-0"><i className="fa fa-square depot-icon"></i></div>
                                        <div className="text-sm text-gray-700">
                                            <div className="font-medium">{name}</div>
                                            <div className="text-xs text-gray-500">ID: {node.id} • TW: {tw} • Demand: {demand}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // pickup-delivery pair row
                        const left = row.left as any;
                        const right = row.right as any;
                        return (
                            <div key={`pair-${idx}`} className="flex items-center px-4 py-2 border-b border-gray-100">
                                {/* Left side (pickup) */}
                                <div className="w-3/7 pr-3">
                                    {left ? (
                                        <a
                                            href="#"
                                            className={`node-item ${selectedNodes && (selectedNodes.some((n: any) => n.id === left.id) || (left.pair && selectedNodes.some((n: any) => n.id === left.pair))) ? 'selected' : ''} flex items-start space-x-3`}
                                            onClick={(e) => { e.preventDefault(); onClickNode && onClickNode(left); }}
                                            onMouseEnter={() => { if (!selectedNodes && highlightMarkers) highlightMarkers(left, true); }}
                                            onMouseLeave={() => { if (!selectedNodes && highlightMarkers) highlightMarkers(left, false); }}
                                        >
                                            <div className="flex-shrink-0"><i className={`fa fa-circle ${left.is_pickup ? 'pickup-icon' : left.is_delivery ? 'delivery-icon' : ''}`} style={{ color: left.is_pickup ? '#1e90ff' : '' }}></i></div>
                                            <div className="text-sm text-gray-700 text-left">
                                                <div className="font-medium">{(typeof left.string_name === 'function') ? left.string_name() : `Node ${left.id}`}</div>
                                                <div className="text-xs text-gray-500">ID: {left.id} • TW: {formatTimeWindow(left)} • Demand: {getDemand(left)}</div>
                                            </div>
                                        </a>
                                    ) : (
                                        <div />
                                    )}
                                </div>
                                {/* Center arrow */}
                                <div className="w-1/7 flex justify-center items-center text-gray-400">
                                    {left && right ? <i className="fa fa-arrow-right" aria-hidden="true"></i> : null}
                                </div>

                                {/* Right side (delivery) */}
                                <div className="w-3/7 pl-3">
                                    {right ? (
                                        <a
                                            href="#"
                                            className={`node-item ${selectedNodes && (selectedNodes.some((n: any) => n.id === right.id) || (right.pair && selectedNodes.some((n: any) => n.id === right.pair))) ? 'selected' : ''} flex items-start space-x-3`}
                                            onClick={(e) => { e.preventDefault(); onClickNode && onClickNode(right); }}
                                            onMouseEnter={() => { if (!selectedNodes && highlightMarkers) highlightMarkers(right, true); }}
                                            onMouseLeave={() => { if (!selectedNodes && highlightMarkers) highlightMarkers(right, false); }}
                                        >
                                            <div className="flex-shrink-0"><i className={`fa fa-circle ${right.is_delivery ? 'delivery-icon' : right.is_pickup ? 'pickup-icon' : ''}`} style={{ color: right.is_delivery ? '#dc2626' : '' }}></i></div>
                                            <div className="text-sm text-gray-700 text-left">
                                                <div className="font-medium">{(typeof right.string_name === 'function') ? right.string_name() : `Node ${right.id}`}</div>
                                                <div className="text-xs text-gray-500">ID: {right.id} • TW: {formatTimeWindow(right)} • Demand: {getDemand(right)}</div>
                                            </div>
                                        </a>
                                    ) : (
                                        <div />
                                    )}
                                </div>
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
    );
};

export default NodeList;
