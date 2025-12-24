"use client";

import React from "react";
import { DateRange } from "react-day-picker";
import { Filter, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface OrdersFilterProps {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onCreateOrder: () => void;
    onPlanRoute: () => void;
}

export const OrdersFilter: React.FC<OrdersFilterProps> = ({
    date,
    setDate,
    searchTerm,
    setSearchTerm,
    onCreateOrder,
    onPlanRoute,
}) => {
    return (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4 py-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-1">
                {/* Search */}
                <div className="relative w-full sm:max-w-sm">
                    <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        type="search"
                        placeholder="Tìm kiếm đơn hàng..."
                        className="pl-9 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Picker */}
                <DateRangePicker
                    date={date}
                    setDate={setDate}
                    className="w-full sm:w-[260px]"
                />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                    onClick={onPlanRoute}
                    variant="outline"
                    className="flex items-center justify-center w-full sm:w-auto bg-white"
                >
                    <MapPin className="mr-2 h-4 w-4" />
                    Lập lộ trình
                </Button>
                <Button
                    onClick={onCreateOrder}
                    className="flex items-center justify-center w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Tạo đơn hàng
                </Button>
            </div>
        </div>
    );
};
