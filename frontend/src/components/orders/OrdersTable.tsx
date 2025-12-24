"use client";

import React from "react";
import { Order, OrderStatus, PriorityLevel } from "@/lib/redux/services/orderApi";
import { format } from "date-fns";
import { MoreHorizontal, Edit, Eye, Trash, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface OrdersTableProps {
    orders: Order[];
    onOrderClick: (order: Order) => void;
    selectedOrderIds: string[];
    onSelectionChange: (ids: string[]) => void;
    onEdit?: (order: Order) => void;
    onDelete?: (orderId: string) => void;
    startIndex?: number;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
    orders,
    onOrderClick,
    selectedOrderIds,
    onSelectionChange,
    onEdit,
    onDelete,
    startIndex = 0,
}) => {
    const toggleSelectAll = () => {
        if (selectedOrderIds.length === orders.length) {
            onSelectionChange([]);
        } else {
            onSelectionChange(orders.map((o) => o.id));
        }
    };

    const toggleSelectOrder = (id: string) => {
        if (selectedOrderIds.includes(id)) {
            onSelectionChange(selectedOrderIds.filter((oid) => oid !== id));
        } else {
            onSelectionChange([...selectedOrderIds, id]);
        }
    };

    const getStatusColor = (status: OrderStatus) => {
        switch (status) {
            case "pending": return "bg-gray-100 text-gray-800";
            case "assigned": return "bg-yellow-100 text-yellow-800";
            case "in_transit": return "bg-blue-100 text-blue-800";
            case "picked_up": return "bg-purple-100 text-purple-800";
            case "delivered": return "bg-green-100 text-green-800";
            case "failed": return "bg-red-100 text-red-800";
            case "cancelled": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getStatusLabel = (status: OrderStatus) => {
        switch (status) {
            case "pending": return "Chờ xử lý";
            case "assigned": return "Đã gán";
            case "in_transit": return "Đang giao";
            case "picked_up": return "Đã lấy hàng";
            case "delivered": return "Hoàn thành";
            case "failed": return "Thất bại";
            case "cancelled": return "Đã hủy";
            default: return status;
        }
    };

    const getPriorityColor = (priority: PriorityLevel) => {
        switch (priority) {
            case "urgent": return "bg-red-600";
            case "normal": return "bg-blue-500";
            default: return "bg-blue-500";
        }
    };

    const getPriorityLabel = (priority: PriorityLevel) => {
        switch (priority) {
            case "urgent": return "Hỏa tốc";
            case "normal": return "Thường";
            default: return "Thường";
        }
    }

    return (
        <div className="w-full overflow-x-auto rounded-md border bg-white">
            <table className="w-full min-w-[900px] text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                        <th className="p-3 w-10 text-center">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                                onChange={toggleSelectAll}
                            />
                        </th>
                        <th className="p-3 text-center whitespace-nowrap">STT</th>
                        <th className="p-3 text-center whitespace-nowrap">Ngày tạo</th>
                        <th className="p-3 text-center whitespace-nowrap">Mã đơn hàng</th>
                        <th className="p-3 text-center whitespace-nowrap">Trạng thái</th>
                        <th className="p-3 text-center whitespace-nowrap">Độ ưu tiên</th>
                        <th className="p-3 whitespace-nowrap">Khách hàng</th>
                        <th className="p-3 whitespace-nowrap">Điểm lấy</th>
                        <th className="p-3 whitespace-nowrap">Điểm giao</th>
                        <th className="p-3 text-right whitespace-nowrap"><Settings className="h-4 w-4 ml-auto" /></th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {orders.length === 0 ? (
                        <tr>
                            <td colSpan={10} className="p-8 text-center text-gray-500">
                                Không có đơn hàng nào.
                            </td>
                        </tr>
                    ) : (
                        orders.map((order, index) => (
                            <tr
                                key={order.id}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => onOrderClick(order)}
                            >
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedOrderIds.includes(order.id)}
                                        onChange={() => toggleSelectOrder(order.id)}
                                    />
                                </td>
                                <td className="p-2 text-center text-gray-500 whitespace-nowrap">{startIndex + index + 1}</td>
                                <td className="p-2 text-center whitespace-nowrap">
                                    {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                                </td>
                                <td className="p-2 text-center font-medium whitespace-nowrap">{order.tracking_number}</td>
                                <td className="p-2 text-center whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </td>
                                <td className="p-2 text-center whitespace-nowrap">
                                    <Badge className={`${getPriorityColor(order.priority)} hover:${getPriorityColor(order.priority)} border-0 text-xs`}>
                                        {getPriorityLabel(order.priority)}
                                    </Badge>
                                </td>
                                <td className="p-2 whitespace-nowrap truncate max-w-[100px]" title={order.delivery_contact_name}>{order.delivery_contact_name}</td>
                                <td className="p-2 whitespace-nowrap truncate max-w-[100px]" title={order.pickup_address}>
                                    {order.pickup_address}
                                </td>
                                <td className="p-2 whitespace-nowrap truncate max-w-[100px]" title={order.delivery_address}>
                                    {order.delivery_address}
                                </td>
                                <td className="p-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" className="w-48 p-0">
                                            <div className="flex flex-col">
                                                <div className="px-4 py-2 text-sm font-medium text-gray-900">Hành động</div>
                                                <button
                                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                                    onClick={() => navigator.clipboard.writeText(order.tracking_number)}
                                                >
                                                    Sao chép mã vận đơn
                                                </button>
                                                <div className="h-px bg-gray-100 my-1" />
                                                <button
                                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                                >
                                                    <Eye className="mr-2 h-4 w-4" /> Xem chi tiết
                                                </button>
                                                <button
                                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                                    onClick={() => onEdit?.(order)}
                                                >
                                                    <Edit className="mr-2 h-4 w-4" /> Chỉnh sửa
                                                </button>
                                                <button
                                                    className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                                                    onClick={() => onDelete?.(order.id)}
                                                >
                                                    <Trash className="mr-2 h-4 w-4" /> Xóa đơn hàng
                                                </button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};
