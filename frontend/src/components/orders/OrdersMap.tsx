"use client";

import React from "react";
import { Order } from "@/lib/redux/services/orderApi";
import { UniversalMap } from "@/components/map/UniversalMap";

interface OrdersMapProps {
    orders: Order[];
    selectedOrderIds: string[];
    onOrderSelect?: (orderId: string) => void;
}

export const OrdersMap: React.FC<OrdersMapProps> = ({ 
    orders, 
    selectedOrderIds,
    onOrderSelect 
}) => {

    return (
        <UniversalMap
            orders={orders}
            selectedOrderIds={selectedOrderIds}
            onOrderSelect={onOrderSelect}
            showOrderLines={true}
            height="100%"
            zoom={11}
            className="h-full min-h-0"
        />
    );
};
