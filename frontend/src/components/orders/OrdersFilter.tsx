"use client";

import React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Filter, Plus, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface OrdersFilterProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
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
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-full sm:w-auto justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Chọn ngày</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                    onClick={onPlanRoute}
                    variant="outline"
                    className="flex items-center justify-center w-full sm:w-auto"
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
