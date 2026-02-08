"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { SolutionDiff } from '@/utils/dataModels';
import { ArrowRight, Plus, Minus, AlertCircle } from 'lucide-react';

interface ChangesSummaryProps {
    diff: SolutionDiff | null;
}

export function ChangesSummary({ diff }: ChangesSummaryProps) {
    if (!diff) {
        return (
            <Card className="border-gray-200">
                <CardContent className="p-8 text-center text-gray-500">
                    Chọn một solution để xem thay đổi
                </CardContent>
            </Card>
        );
    }

    const { summary, ordersReassigned, routesAdded, routesRemoved, routesModified } = diff;

    return (
        <Card className="border-gray-200">
            <CardHeader>
                <CardTitle className="text-gray-800">Thay đổi chi tiết</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-3 pb-4 border-b">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{summary.totalChanges}</div>
                        <div className="text-xs text-gray-600 mt-1">Tổng thay đổi</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{summary.ordersAffected}</div>
                        <div className="text-xs text-gray-600 mt-1">Đơn hàng bị ảnh hưởng</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{summary.routesAffected}</div>
                        <div className="text-xs text-gray-600 mt-1">Routes bị ảnh hưởng</div>
                    </div>
                </div>

                {/* Detailed Changes Accordion */}
                <Accordion type="multiple" className="w-full">
                        {/* Orders Reassigned */}
                        {ordersReassigned.length > 0 && (
                            <AccordionItem value="orders">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-blue-600" />
                                        <span>Đơn hàng được phân lại ({ordersReassigned.length})</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Node ID</TableHead>
                                                <TableHead>Order ID</TableHead>
                                                <TableHead>Loại</TableHead>
                                                <TableHead>Từ Route</TableHead>
                                                <TableHead></TableHead>
                                                <TableHead>Đến Route</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {ordersReassigned.map((order) => (
                                                <TableRow key={order.nodeId}>
                                                    <TableCell className="font-mono text-sm">
                                                        {order.nodeId}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        {order.orderId?.slice(0, 8) || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className="capitalize bg-gray-100 text-gray-700 border border-gray-300">
                                                            {order.kind}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {order.fromRoute !== null ? (
                                                            <Badge className="bg-orange-100 text-orange-700">
                                                                Route {order.fromRoute}
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-green-100 text-green-700 border border-green-300">
                                                                <Plus className="h-3 w-3 mr-1" />
                                                                Mới
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <ArrowRight className="h-4 w-4 text-gray-400" />
                                                    </TableCell>
                                                    <TableCell>
                                                        {order.toRoute !== null ? (
                                                            <Badge className="bg-blue-600 text-white">
                                                                Route {order.toRoute}
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-red-100 text-red-700 border border-red-300">
                                                                <Minus className="h-3 w-3 mr-1" />
                                                                Xóa
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Routes Added */}
                        {routesAdded.length > 0 && (
                            <AccordionItem value="routes-added">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Plus className="h-4 w-4 text-green-600" />
                                        <span>Routes thêm mới ({routesAdded.length})</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="flex flex-wrap gap-2">
                                        {routesAdded.map((routeId) => (
                                            <Badge key={routeId} className="bg-green-600 text-white">
                                                Route {routeId}
                                            </Badge>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Routes Removed */}
                        {routesRemoved.length > 0 && (
                            <AccordionItem value="routes-removed">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Minus className="h-4 w-4 text-red-600" />
                                        <span>Routes bị xóa ({routesRemoved.length})</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="flex flex-wrap gap-2">
                                        {routesRemoved.map((routeId) => (
                                            <Badge key={routeId} className="bg-red-600 text-white">
                                                Route {routeId}
                                            </Badge>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Routes Modified */}
                        {routesModified.length > 0 && (
                            <AccordionItem value="routes-modified">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                                        <span>Routes thay đổi ({routesModified.length})</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Route ID</TableHead>
                                                <TableHead>Đơn hàng thêm</TableHead>
                                                <TableHead>Đơn hàng xóa</TableHead>
                                                <TableHead>Thay đổi thứ tự</TableHead>
                                                <TableHead>Chi phí Δ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {routesModified.map((route) => (
                                                <TableRow key={route.routeId}>
                                                    <TableCell>
                                                        <Badge className="bg-blue-100 text-blue-700">Route {route.routeId}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {route.ordersAdded.length > 0 ? (
                                                            <Badge className="font-mono text-xs bg-green-100 text-green-700 border border-green-300">
                                                                +{route.ordersAdded.length}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {route.ordersRemoved.length > 0 ? (
                                                            <Badge className="font-mono text-xs bg-red-100 text-red-700 border border-red-300">
                                                                -{route.ordersRemoved.length}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {route.sequenceChanged ? (
                                                            <Badge className="bg-orange-100 text-orange-700">Có</Badge>
                                                        ) : (
                                                            <span className="text-gray-400">Không</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={route.metricsChange.cost < 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                                            {route.metricsChange.cost > 0 ? '+' : ''}
                                                            {route.metricsChange.cost.toFixed(2)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* No Changes */}
                        {summary.totalChanges === 0 && (
                            <div className="text-center text-gray-500 py-8">
                                Không có thay đổi giữa hai solutions này
                            </div>
                        )}
                    </Accordion>
                </CardContent>
            </Card>
    );
}
