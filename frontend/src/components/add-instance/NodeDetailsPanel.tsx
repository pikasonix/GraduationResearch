"use client";

import React from 'react';
import NodeEditor, { NodeRow } from './NodeEditor';
import { X, MapPin } from 'lucide-react';

type Variant = 'panel' | 'popover';

interface NodeDetailsPanelProps {
    variant: Variant;
    node: NodeRow | null;
    nodes: NodeRow[];
    onUpdate: (updatedNode: NodeRow) => void;
    onDelete: (nodeId: number) => void;
    showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
    onClose?: () => void;
    onStartPickCoordinates?: () => void;
}

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
    variant,
    node,
    nodes,
    onUpdate,
    onDelete,
    showNotification,
    onClose,
    onStartPickCoordinates,
}) => {
    if (variant === 'popover') {
        return (
            <div className="w-full min-w-[170px] max-w-[260px] rounded overflow-hidden shadow-lg">
                <div className="bg-green-600 text-white px-3 py-2 flex items-center">
                    <h3 className="text-sm font-semibold flex-1">Chỉnh sửa Node {node ? `#${node.id}` : ''}</h3>
                </div>
                <div className="p-3 bg-white max-h-[420px] overflow-auto">
                    {node ? (
                        <NodeEditor
                            node={node}
                            nodes={nodes}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            showNotification={showNotification}
                            dense
                            onSaved={onClose}
                            showId={false}
                            showCoords={true}
                            onStartPick={onStartPickCoordinates}
                        />
                    ) : (
                        <div className="text-center text-gray-500 py-6 text-sm">Không có node được chọn</div>
                    )}
                </div>
            </div>
        );
    }

    // panel variant
    return (
        <div className="w-full h-full flex flex-col">
            <div className="bg-green-600 text-white p-4">
                <div className="flex items-center space-x-3">
                    <i className="fas fa-edit text-xl"></i>
                    <h3 className="text-lg font-semibold">Chỉnh sửa Node</h3>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {node ? (
                    <NodeEditor node={node} nodes={nodes} onUpdate={onUpdate} onDelete={onDelete} showNotification={showNotification} />
                ) : (
                    <div className="text-center text-gray-500 py-8">
                        <i className="fas fa-mouse-pointer text-4xl mb-4"></i>
                        <p>Chọn một node trên bản đồ để chỉnh sửa</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NodeDetailsPanel;
