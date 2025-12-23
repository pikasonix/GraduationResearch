import React from "react";
import { Card } from "@/components/ui/card";
import { Order } from "@/lib/redux/services/orderApi";

interface OrdersStatsProps {
    orders: Order[];
}

export const OrdersStats: React.FC<OrdersStatsProps> = ({ orders }) => {
    const totalOrders = orders.length;
    // TODO: Add Express logic if needed. Assuming internal priority for now.
    const expressOrders = orders.filter((o) => o.priority === "high" || o.priority === "urgent").length;

    const statusCounts = {
        pending: orders.filter((o) => o.status === "pending").length, // Grey
        assigned: orders.filter((o) => o.status === "assigned").length, // Yellow
        in_transit: orders.filter((o) => o.status === "in_transit").length, // Blue
        delivered: orders.filter((o) => o.status === "delivered").length, // Green
        failed: orders.filter((o) => o.status === "failed" || o.status === "cancelled").length, // Red
    };

    return (
        <div className="flex items-center space-x-8 py-4 bg-background rounded-lg">
            <div className="flex flex-col">
                <span className="text-sm text-gray-500">Tổng đơn hàng</span>
                <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold">{totalOrders}</span>
                    {/* <span className="text-xs text-green-500">TODO %</span> */}
                </div>
            </div>

            <div className="flex flex-col">
                <span className="text-sm text-gray-500">Hỏa tốc</span>
                <span className="text-2xl font-bold">{expressOrders}</span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-4" />

            <div className="flex items-center space-x-4">
                {/* Status items */}
                <StatusItem count={statusCounts.pending} color="bg-gray-200 text-gray-700" label="Chờ xử lý" />
                <StatusItem count={statusCounts.assigned} color="bg-yellow-100 text-yellow-700" label="Đã gán" />
                <StatusItem count={statusCounts.in_transit} color="bg-blue-100 text-blue-700" label="Đang giao" />
                <StatusItem count={statusCounts.delivered} color="bg-green-100 text-green-700" label="Hoàn thành" />
                <StatusItem count={statusCounts.failed} color="bg-red-100 text-red-700" label="Thất bại" />
            </div>
        </div>
    );
};

const StatusItem = ({ count, color, label }: { count: number; color: string; label: string }) => (
    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${color} font-bold text-sm`} title={label}>
        {count}
    </div>
);
