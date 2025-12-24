"use client";

import React, { useState, useEffect, useRef } from "react";
import { format, subDays, parse, isValid, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameDay, isWithinInterval, isSameMonth } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DateRange {
    from?: Date;
    to?: Date;
}

interface DateRangePickerProps {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    className?: string;
    placeholder?: string;
}

const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const weekdays = ['Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'CN'];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
    date,
    setDate,
    className,
    placeholder = "Chọn khoảng thời gian",
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempStart, setTempStart] = useState<Date | undefined>(date?.from);
    const [tempEnd, setTempEnd] = useState<Date | undefined>(date?.to);
    const [fromInput, setFromInput] = useState("");
    const [toInput, setToInput] = useState("");
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isSelecting, setIsSelecting] = useState(false);
    const [hoverDate, setHoverDate] = useState<Date | undefined>(undefined);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync with external date prop
    useEffect(() => {
        if (isOpen) {
            setTempStart(date?.from);
            setTempEnd(date?.to);
            setFromInput(date?.from ? format(date.from, "dd/MM/yyyy") : "");
            setToInput(date?.to ? format(date.to, "dd/MM/yyyy") : "");
            setCurrentMonth(date?.from || new Date());
            setIsSelecting(false);
            setHoverDate(undefined);
        }
    }, [isOpen, date]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowMonthDropdown(false);
                setShowYearDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Allow any input, parse on blur
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, setInput: (val: string) => void) => {
        setInput(e.target.value);
    };

    const parseDateSmart = (input: string): Date | null => {
        // Remove non-digit characters except separators
        const clean = input.replace(/[^0-9/.-]/g, '');

        // Try parsing various formats
        const formats = [
            'dd/MM/yyyy',
            'dd-MM-yyyy',
            'dd.MM.yyyy',
            'd/M/yyyy',
            'd-M-yyyy',
            'd.M.yyyy',
            'ddMMyyyy',
            'dMMyyyy'
        ];

        for (const fmt of formats) {
            const parsed = parse(clean, fmt, new Date());
            if (isValid(parsed) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
                return parsed;
            }
        }
        return null;
    };

    const handleFromInputBlur = () => {
        const parsedDate = parseDateSmart(fromInput);
        if (parsedDate) {
            setTempStart(parsedDate);
            setFromInput(format(parsedDate, "dd/MM/yyyy"));
            if (tempEnd && parsedDate > tempEnd) {
                setTempEnd(parsedDate);
                setToInput(format(parsedDate, "dd/MM/yyyy"));
            }
            setCurrentMonth(parsedDate);
        } else if (fromInput) {
            // Revert if invalid but keep empty if empty
            setFromInput(tempStart ? format(tempStart, "dd/MM/yyyy") : "");
        }
    };

    const handleToInputBlur = () => {
        const parsedDate = parseDateSmart(toInput);
        if (parsedDate) {
            setTempEnd(parsedDate);
            setToInput(format(parsedDate, "dd/MM/yyyy"));
            if (tempStart && parsedDate < tempStart) {
                setTempStart(parsedDate);
                setFromInput(format(parsedDate, "dd/MM/yyyy"));
            }
            setIsSelecting(false);
        } else if (toInput) {
            setToInput(tempEnd ? format(tempEnd, "dd/MM/yyyy") : "");
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isFrom: boolean) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleDateClick = (date: Date) => {
        if (!isSelecting) {
            setTempStart(date);
            setTempEnd(undefined);
            setIsSelecting(true);
            setFromInput(format(date, "dd/MM/yyyy"));
            setToInput("");
        } else {
            if (tempStart && date < tempStart) {
                setTempEnd(tempStart);
                setTempStart(date);
                setFromInput(format(date, "dd/MM/yyyy"));
                setToInput(format(tempStart, "dd/MM/yyyy"));
            } else {
                setTempEnd(date);
                setToInput(format(date, "dd/MM/yyyy"));
            }
            setIsSelecting(false);
            setHoverDate(undefined);
        }
    };

    const handleDateHover = (date: Date) => {
        if (isSelecting && tempStart) {
            setHoverDate(date);
        }
    };

    const handleApply = () => {
        if (tempStart && tempEnd) {
            setDate({ from: tempStart, to: tempEnd });
            setIsOpen(false);
        } else if (tempStart && !tempEnd) {
            // If only start date is selected, show alert or handle as needed
        }
    };

    const handlePreset = (days: number) => {
        const to = new Date();
        const from = subDays(to, days - 1);
        setTempStart(from);
        setTempEnd(to);
        setFromInput(format(from, "dd/MM/yyyy"));
        setToInput(format(to, "dd/MM/yyyy"));
        setIsSelecting(false);
        setHoverDate(undefined);
    };

    const changeMonth = (delta: number) => {
        setCurrentMonth(addMonths(currentMonth, delta));
    };

    const selectMonth = (monthIndex: number) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(monthIndex);
        setCurrentMonth(newDate);
        setShowMonthDropdown(false);
    };

    const selectYear = (year: number) => {
        const newDate = new Date(currentMonth);
        newDate.setFullYear(year);
        setCurrentMonth(newDate);
        setShowYearDropdown(false);
    };

    const generateCalendarDays = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const days: Date[] = [];
        let day = startDate;

        while (day <= endDate) {
            days.push(day);
            day = addDays(day, 1);
        }

        return days;
    };

    const isDayInRange = (day: Date) => {
        const start = tempStart;
        const end = isSelecting && hoverDate ? hoverDate : tempEnd;

        if (!start || !end) return false;

        const actualStart = start < end ? start : end;
        const actualEnd = start < end ? end : start;

        return isWithinInterval(day, { start: actualStart, end: actualEnd });
    };

    const isDayRangeStart = (day: Date) => {
        const start = tempStart;
        const end = isSelecting && hoverDate ? hoverDate : tempEnd;

        if (!start || !end) return false;

        const actualStart = start < end ? start : end;
        return isSameDay(day, actualStart);
    };

    const isDayRangeEnd = (day: Date) => {
        const start = tempStart;
        const end = isSelecting && hoverDate ? hoverDate : tempEnd;

        if (!start || !end) return false;

        const actualEnd = start < end ? end : start;
        return isSameDay(day, actualEnd);
    };

    const calendarDays = generateCalendarDays();
    const today = new Date();
    const currentYear = currentMonth.getFullYear();
    const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "justify-start text-left font-normal bg-white",
                        !date && "text-muted-foreground",
                        className
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
                        <span>{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 bg-white rounded-xl shadow-xl border-0 w-[320px]">
                    {/* Header: Editable Date Inputs */}
                    <div className="flex justify-between items-start mb-3 gap-4">
                        <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-indigo-600 text-[10px] font-medium mb-0.5">Từ ngày</label>
                            <input
                                type="text"
                                value={fromInput}
                                onChange={(e) => handleInputChange(e, setFromInput)}
                                onBlur={handleFromInputBlur}
                                onFocus={handleInputFocus}
                                onKeyDown={(e) => handleInputKeyDown(e, true)}
                                placeholder="dd/mm/yyyy"
                                className="w-full text-gray-900 text-sm font-bold border-none bg-transparent outline-none border-b border-transparent focus:border-indigo-600 transition-colors px-0 py-0.5"
                            />
                        </div>
                        <div className="flex flex-col flex-1 text-right min-w-0">
                            <label className="text-indigo-600 text-[10px] font-medium mb-0.5">Đến ngày</label>
                            <input
                                type="text"
                                value={toInput}
                                onChange={(e) => handleInputChange(e, setToInput)}
                                onBlur={handleToInputBlur}
                                onFocus={handleInputFocus}
                                onKeyDown={(e) => handleInputKeyDown(e, false)}
                                placeholder="dd/mm/yyyy"
                                className="w-full text-gray-900 text-sm font-bold border-none bg-transparent outline-none border-b border-transparent focus:border-indigo-600 transition-colors text-right px-0 py-0.5"
                            />
                        </div>
                    </div>

                    {/* Calendar Section */}
                    <div className="border-t border-b border-gray-200 py-3 mb-3">
                        {/* Calendar Header */}
                        <div className="flex justify-center items-center relative mb-2" ref={dropdownRef}>
                            <button
                                onClick={() => changeMonth(-1)}
                                className="absolute left-0 h-6 w-6 bg-transparent border-none rounded-full flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all cursor-pointer"
                            >
                                <ChevronLeft className="w-3 h-3" />
                            </button>

                            <div className="flex gap-1 items-center justify-center relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMonthDropdown(!showMonthDropdown);
                                        setShowYearDropdown(false);
                                    }}
                                    className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-semibold text-xs flex items-center gap-1 border-none cursor-pointer hover:bg-indigo-100"
                                >
                                    <span>{monthNames[currentMonth.getMonth()]}</span>
                                    <ChevronDown className="w-3 h-3" />
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowYearDropdown(!showYearDropdown);
                                        setShowMonthDropdown(false);
                                    }}
                                    className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-semibold text-xs flex items-center gap-1 border-none cursor-pointer hover:bg-indigo-100"
                                >
                                    <span>{currentMonth.getFullYear()}</span>
                                    <ChevronDown className="w-3 h-3" />
                                </button>

                                {/* Month Dropdown */}
                                {showMonthDropdown && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 p-1 z-50 max-h-48 overflow-y-auto min-w-[100px]">
                                        {monthNames.map((name, index) => (
                                            <div
                                                key={index}
                                                onClick={() => selectMonth(index)}
                                                className={cn(
                                                    "px-3 py-1.5 cursor-pointer rounded-md transition-colors text-xs font-medium text-gray-700",
                                                    index === currentMonth.getMonth()
                                                        ? "bg-indigo-600 text-white"
                                                        : "hover:bg-gray-100"
                                                )}
                                            >
                                                {name}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Year Dropdown */}
                                {showYearDropdown && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 p-1 z-50 max-h-48 overflow-y-auto min-w-[100px]">
                                        {yearOptions.map((year) => (
                                            <div
                                                key={year}
                                                onClick={() => selectYear(year)}
                                                className={cn(
                                                    "px-3 py-1.5 cursor-pointer rounded-md transition-colors text-xs font-medium text-gray-700",
                                                    year === currentMonth.getFullYear()
                                                        ? "bg-indigo-600 text-white"
                                                        : "hover:bg-gray-100"
                                                )}
                                            >
                                                {year}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => changeMonth(1)}
                                className="absolute right-0 h-6 w-6 bg-transparent border-none rounded-full flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all cursor-pointer"
                            >
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Weekdays */}
                        <div className="grid grid-cols-7 gap-0 mb-1">
                            {weekdays.map((day) => (
                                <div key={day} className="text-center text-gray-400 font-medium text-[10px] py-1">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days */}
                        <div className="grid grid-cols-7 gap-0">
                            {calendarDays.map((day, index) => {
                                const isOutside = !isSameMonth(day, currentMonth);
                                const isToday = isSameDay(day, today);
                                const isRangeStart = isDayRangeStart(day);
                                const isRangeEnd = isDayRangeEnd(day);
                                const isInRange = isDayInRange(day) && !isRangeStart && !isRangeEnd;
                                const isBothStartEnd = isRangeStart && isRangeEnd;

                                return (
                                    <div key={index} className="relative aspect-square">
                                        {/* Range background */}
                                        {isInRange && (
                                            <div className="absolute inset-0 bg-blue-50 z-0" />
                                        )}
                                        {isRangeStart && !isBothStartEnd && (
                                            <div className="absolute inset-0 left-1/2 bg-blue-50 z-0" />
                                        )}
                                        {isRangeEnd && !isBothStartEnd && (
                                            <div className="absolute inset-0 right-1/2 bg-blue-50 z-0" />
                                        )}

                                        {/* Day button */}
                                        <button
                                            onClick={() => !isOutside && handleDateClick(day)}
                                            onMouseEnter={() => !isOutside && handleDateHover(day)}
                                            disabled={isOutside}
                                            className={cn(
                                                "relative z-10 w-full h-full flex items-center justify-center text-xs transition-all cursor-pointer border-none bg-transparent",
                                                isOutside && "text-gray-300 opacity-50 cursor-default hidden",
                                                !isOutside && !isRangeStart && !isRangeEnd && "text-gray-700 hover:bg-gray-100 hover:rounded-full",
                                                isToday && !isRangeStart && !isRangeEnd && "bg-gray-100 font-semibold rounded-full text-indigo-600",
                                                (isRangeStart || isRangeEnd) && "bg-indigo-600 text-white font-semibold rounded-full shadow-sm hover:bg-indigo-700",
                                                isInRange && !isRangeStart && !isRangeEnd && "text-indigo-700 font-medium",
                                                isSelecting && hoverDate && "opacity-80"
                                            )}
                                        >
                                            {day.getDate()}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Presets */}
                    <div className="flex justify-between gap-2 mb-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreset(7)}
                            className="flex-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 text-[10px] h-7 px-0"
                        >
                            7 Ngày
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreset(14)}
                            className="flex-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 text-[10px] h-7 px-0"
                        >
                            14 Ngày
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreset(30)}
                            className="flex-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 text-[10px] h-7 px-0"
                        >
                            30 Ngày
                        </Button>
                    </div>

                    {/* Apply Button */}
                    <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-xs h-9"
                        onClick={handleApply}
                    >
                        Chọn ngày
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};
