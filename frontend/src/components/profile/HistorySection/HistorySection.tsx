'use client';

import React, { useMemo, useState } from "react";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole, roleLabels } from "../types";

export interface HistoryEntry {
    id: string;
    title: string;
    description: string;
    date: string; // ISO string
    amount?: string;
    status?: string;
    meta?: string;
}

interface HistorySectionProps {
    role: UserRole;
    entries?: HistoryEntry[];
}

type RangeFilter = "7days" | "30days" | "all";

const defaultHistoryByRole: Record<UserRole, HistoryEntry[]> = {
    CUSTOMER: [
        {
            id: "his_cus_01",
            title: "Phiên sạc tại WAYO Station Nguyễn Trãi",
            description: "Sạc nhanh 45 phút – tiêu thụ 32 kWh",
            date: new Date().toISOString(),
            amount: "125.000đ",
            status: "Hoàn tất",
        },
        {
            id: "his_cus_02",
            title: "Phiên sạc tại WAYO Station Phú Mỹ Hưng",
            description: "Sạc tiêu chuẩn 90 phút – tiêu thụ 24 kWh",
            date: subDays(new Date(), 3).toISOString(),
            amount: "92.000đ",
            status: "Hoàn tất",
        },
        {
            id: "his_cus_03",
            title: "Đặt lịch sạc ưu tiên",
            description: "Thanh toán qua Vietcombank Visa",
            date: subDays(new Date(), 12).toISOString(),
            amount: "50.000đ",
            status: "Đã hủy",
        },
    ],
    SUPPLIER: [
        {
            id: "his_sup_01",
            title: "Thanh toán từ khách hàng VietFast",
            description: "Phiên sạc VF8 – 32 kWh",
            date: subDays(new Date(), 1).toISOString(),
            amount: "+118.000đ",
            status: "Đã đối soát",
        },
        {
            id: "his_sup_02",
            title: "Thanh toán từ khách hàng EcoRide",
            description: "Phiên sạc Kona – 28 kWh",
            date: subDays(new Date(), 5).toISOString(),
            amount: "+96.000đ",
            status: "Chờ đối soát",
        },
        {
            id: "his_sup_03",
            title: "Chi phí bảo trì trạm",
            description: "Trạm Nguyễn Trãi – Thay dây sạc",
            date: subDays(new Date(), 20).toISOString(),
            amount: "-450.000đ",
            status: "Hoàn tất",
        },
    ],
    TECH: [
        {
            id: "his_tech_01",
            title: "Ca cứu hộ EV-2024-145",
            description: "Hỗ trợ xe VF8 hết pin tại QL1A",
            date: subDays(new Date(), 2).toISOString(),
            amount: "3.200.000đ",
            status: "Hoàn thành",
        },
        {
            id: "his_tech_02",
            title: "Ca cứu hộ EV-2024-142",
            description: "Sạc lưu động – khách hàng Future City",
            date: subDays(new Date(), 8).toISOString(),
            amount: "2.450.000đ",
            status: "Khách đánh giá 5★",
        },
        {
            id: "his_tech_03",
            title: "Ca cứu hộ EV-2024-131",
            description: "Vận chuyển xe Tesla Model 3 tới gara",
            date: subDays(new Date(), 27).toISOString(),
            amount: "4.800.000đ",
            status: "Hoàn thành",
        },
    ],
};

const HistorySection: React.FC<HistorySectionProps> = ({ role, entries }) => {
    const [range, setRange] = useState<RangeFilter>("7days");

    const combinedEntries = entries && entries.length > 0 ? entries : defaultHistoryByRole[role];

    const filteredEntries = useMemo(() => {
        if (range === "all") {
            return combinedEntries;
        }
        const boundary = range === "7days" ? subDays(new Date(), 7) : subDays(new Date(), 30);
        return combinedEntries.filter((entry) => new Date(entry.date) >= boundary);
    }, [combinedEntries, range]);

    return (
        <section className="space-y-6" aria-labelledby="history-section">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h2 id="history-section" className="text-xl font-semibold text-gray-900">
                        Lịch sử hoạt động – {roleLabels[role]}
                    </h2>
                    <p className="text-sm text-gray-600 max-w-3xl">
                        Thống kê các phiên sạc, giao dịch thanh toán hoặc ca cứu hộ đã thực hiện. Chọn phạm vi thời gian để xem dữ liệu phù hợp.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={range} onValueChange={(value: RangeFilter) => setRange(value)}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="7 ngày gần nhất" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7days">7 ngày gần nhất</SelectItem>
                            <SelectItem value="30days">30 ngày gần nhất</SelectItem>
                            <SelectItem value="all">Toàn bộ lịch sử</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="flex items-center gap-2">
                        <CalendarClock className="size-4" /> Xuất báo cáo
                    </Button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                {filteredEntries.length === 0 ? (
                    <div className="px-6 py-12 text-center text-sm text-gray-500">
                        Không có hoạt động nào trong phạm vi thời gian đã chọn.
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {filteredEntries.map((entry) => {
                            const date = new Date(entry.date);
                            const distance = formatDistanceToNow(date, { addSuffix: true, locale: vi });
                            const formatted = format(date, "dd/MM/yyyy HH:mm", { locale: vi });
                            return (
                                <li key={entry.id} className="px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-gray-900">{entry.title}</p>
                                        <p className="text-xs text-gray-500 mt-1">{entry.description}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                            <span className="font-medium text-gray-700">{entry.amount ?? "—"}</span>
                                            {entry.status && (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                                                    {entry.status}
                                                </span>
                                            )}
                                            {entry.meta && <span>{entry.meta}</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start sm:items-end text-xs text-gray-500">
                                        <span>{formatted}</span>
                                        <span className="mt-1 text-gray-400">{distance}</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
};

export default HistorySection;
export type { HistorySectionProps };
