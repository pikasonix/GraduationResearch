"use client";

import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface OrdersDateFilterProps {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
}

export const OrdersDateFilter: React.FC<OrdersDateFilterProps> = ({
    date,
    setDate,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempDate, setTempDate] = useState<DateRange | undefined>(date);

    // Sync tempDate with date prop when popover opens or prop changes
    useEffect(() => {
        if (isOpen) {
            setTempDate(date);
        }
    }, [isOpen, date]);

    const handleApply = () => {
        setDate(tempDate);
        setIsOpen(false);
    };

    const handlePreset = (days: number) => {
        const to = new Date();
        const from = subDays(to, days);
        setTempDate({ from, to });
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal bg-white",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                        date.to ? (
                            <>
                                {format(date.from, "dd/MM/yyyy")} -{" "}
                                {format(date.to, "dd/MM/yyyy")}
                            </>
                        ) : (
                            format(date.from, "dd/MM/yyyy")
                        )
                    ) : (
                        <span>Chọn khoảng thời gian</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 bg-white rounded-lg shadow-lg border w-[320px]">
                    {/* Header: From - To */}
                    <div className="flex justify-between items-center mb-4 text-sm">
                        <div className="flex flex-col">
                            <span className="text-blue-600 font-medium">Từ ngày</span>
                            <span className="font-bold text-gray-800">
                                {tempDate?.from ? format(tempDate.from, "dd/MM/yyyy") : "--/--/----"}
                            </span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-blue-600 font-medium">Đến ngày</span>
                            <span className="font-bold text-gray-800">
                                {tempDate?.to ? format(tempDate.to, "dd/MM/yyyy") : "--/--/----"}
                            </span>
                        </div>
                    </div>

                    <div className="border-t border-b border-gray-100 py-2">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={tempDate?.from}
                            selected={tempDate}
                            onSelect={setTempDate}
                            numberOfMonths={1}
                            locale={vi}
                            className="p-0 pointer-events-auto"
                            classNames={{
                                month: "space-y-4",
                                caption: "flex justify-center pt-1 relative items-center",
                                caption_label: "text-sm font-medium bg-blue-600 text-white py-1 px-4 rounded-full",
                                nav: "space-x-1 flex items-center",
                                nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                                nav_button_previous: "absolute left-1",
                                nav_button_next: "absolute right-1",
                                table: "w-full border-collapse space-y-1",
                                head_row: "flex",
                                head_cell: "text-blue-800 rounded-md w-9 font-bold text-[0.8rem]",
                                row: "flex w-full mt-2",
                                cell: "text-center text-sm p-0 rdp-p-0 relative [&:has([aria-selected])]:bg-blue-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-full",
                                day_range_start: "day-range-start bg-cyan-400 text-white hover:bg-cyan-500 rounded-full",
                                day_range_end: "day-range-end bg-cyan-400 text-white hover:bg-cyan-500 rounded-full",
                                day_selected: "bg-cyan-400 text-white hover:bg-cyan-400 hover:text-white focus:bg-cyan-400 focus:text-white rounded-full",
                                day_today: "bg-gray-100 text-gray-900 rounded-full",
                                day_outside: "text-gray-300 opacity-50",
                                day_disabled: "text-gray-300 opacity-50",
                                day_range_middle: "aria-selected:bg-blue-50 aria-selected:text-blue-900 rounded-none",
                                day_hidden: "invisible",
                            }}
                        />
                    </div>

                    {/* Presets */}
                    <div className="flex justify-between gap-2 mt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreset(6)} // 7 days including today
                            className="flex-1 rounded-full border-blue-500 text-blue-600 hover:bg-blue-50 text-xs h-8"
                        >
                            7 Ngày
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreset(14)} // 15 days
                            className="flex-1 rounded-full border-blue-500 text-blue-600 hover:bg-blue-50 text-xs h-8"
                        >
                            15 Ngày
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreset(29)} // 30 days
                            className="flex-1 rounded-full border-blue-500 text-blue-600 hover:bg-blue-50 text-xs h-8"
                        >
                            30 Ngày
                        </Button>
                    </div>

                    {/* Apply Button */}
                    <Button
                        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
                        onClick={handleApply}
                    >
                        Chọn ngày
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};
