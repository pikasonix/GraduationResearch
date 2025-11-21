'use client';

import React, { useState } from "react";
import { Building2, MapPin, Pencil, Plus, Power, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type StationStatus = "ACTIVE" | "INACTIVE";

export interface StationItem {
    id: string;
    name: string;
    address: string;
    status: StationStatus;
    connectors: number;
}

interface StationManagementSectionProps {
    stations?: StationItem[];
    onChange?: (stations: StationItem[]) => void;
}

const defaultStations: StationItem[] = [
    {
        id: "station_01",
        name: "WAYO Station Nguyễn Trãi",
        address: "89 Nguyễn Trãi, Quận 5, TP.HCM",
        status: "ACTIVE",
        connectors: 8,
    },
    {
        id: "station_02",
        name: "WAYO Station Phú Mỹ Hưng",
        address: "15 Đường Tân Phú, Quận 7, TP.HCM",
        status: "ACTIVE",
        connectors: 12,
    },
    {
        id: "station_03",
        name: "WAYO Station Trường Sơn",
        address: "102 Trường Sơn, Quận Tân Bình, TP.HCM",
        status: "INACTIVE",
        connectors: 6,
    },
];

const emptyStationForm = {
    name: "",
    address: "",
    connectors: "",
};

const StationManagementSection: React.FC<StationManagementSectionProps> = ({
    stations,
    onChange,
}) => {
    const [StationFilter, setStationFilter] = useState<StationItem[]>(
        stations ?? defaultStations
    );
    const [formValues, setFormValues] = useState(emptyStationForm);
    const [editingId, setEditingId] = useState<string | null>(null);

    const isEditing = Boolean(editingId);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formValues.name.trim() || !formValues.address.trim()) {
            return;
        }

        if (isEditing && editingId) {
            const updated = StationFilter.map((station) =>
                station.id === editingId
                    ? {
                        ...station,
                        name: formValues.name.trim(),
                        address: formValues.address.trim(),
                        connectors: Number(formValues.connectors || 0),
                    }
                    : station
            );
            setStationFilter(updated);
            onChange?.(updated);
            resetForm();
            return;
        }

        const newStation: StationItem = {
            id: `station_${Date.now()}`,
            name: formValues.name.trim(),
            address: formValues.address.trim(),
            connectors: Number(formValues.connectors || 0),
            status: "INACTIVE",
        };

        const updated = [...StationFilter, newStation];
        setStationFilter(updated);
        onChange?.(updated);
        resetForm();
    };

    const resetForm = () => {
        setFormValues(emptyStationForm);
        setEditingId(null);
    };

    const toggleStationStatus = (id: string) => {
        const updated = StationFilter.map((station) => {
            if (station.id !== id) {
                return station;
            }
            const nextStatus: StationStatus =
                station.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            return {
                ...station,
                status: nextStatus,
            };
        });
        setStationFilter(updated);
        onChange?.(updated);
    };

    const handleEdit = (station: StationItem) => {
        setEditingId(station.id);
        setFormValues({
            name: station.name,
            address: station.address,
            connectors: station.connectors.toString(),
        });
    };

    return (
        <section className="space-y-6" aria-labelledby="station-management-section">
            <div className="flex flex-col gap-3">
                <h2 id="station-management-section" className="text-xl font-semibold text-gray-900">
                    Quản lý trạm sạc
                </h2>
                <p className="text-sm text-gray-600 max-w-3xl">
                    Bảng điều khiển giúp chủ trạm theo dõi trạng thái hoạt động, cập nhật thông tin chi tiết và bật/tắt trạm ngay lập tức. Giao diện này mô phỏng luồng quản trị thường gặp ở doanh nghiệp vận hành hạ tầng sạc.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_2.3fr] gap-6">
                <form
                    className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4"
                    onSubmit={handleSubmit}
                >
                    <header className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <Plus className="size-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">
                                {isEditing ? "Chỉnh sửa trạm sạc" : "Thêm trạm mới"}
                            </h3>
                            <p className="text-xs text-gray-500">
                                Nhập thông tin địa điểm và số lượng cổng sạc khả dụng.
                            </p>
                        </div>
                    </header>

                    <div className="space-y-4">
                        <Field label="Tên trạm" htmlFor="station-name">
                            <Input
                                id="station-name"
                                placeholder="VD: WAYO Station Nguyễn Trãi"
                                value={formValues.name}
                                onChange={(event) =>
                                    setFormValues((prev) => ({ ...prev, name: event.target.value }))
                                }
                                required
                            />
                        </Field>
                        <Field label="Địa chỉ" htmlFor="station-address">
                            <Input
                                id="station-address"
                                placeholder="VD: 89 Nguyễn Trãi, Quận 5"
                                value={formValues.address}
                                onChange={(event) =>
                                    setFormValues((prev) => ({ ...prev, address: event.target.value }))
                                }
                                required
                            />
                        </Field>
                        <Field label="Số lượng cổng sạc" htmlFor="station-connectors">
                            <Input
                                id="station-connectors"
                                type="number"
                                min="0"
                                placeholder="VD: 8"
                                value={formValues.connectors}
                                onChange={(event) =>
                                    setFormValues((prev) => ({ ...prev, connectors: event.target.value }))
                                }
                            />
                        </Field>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <Button type="submit" className="flex items-center gap-2">
                            {isEditing ? (
                                <>
                                    <Pencil className="size-4" /> Cập nhật trạm
                                </>
                            ) : (
                                <>
                                    <Plus className="size-4" /> Thêm trạm
                                </>
                            )}
                        </Button>
                        {isEditing && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-xs text-gray-500 underline"
                            >
                                Huỷ chỉnh sửa
                            </button>
                        )}
                    </div>
                </form>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Danh sách trạm sạc</h3>
                            <p className="text-xs text-gray-500">
                                {StationFilter.length} trạm được quản lý trong hệ thống
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Tên trạm</th>
                                    <th className="px-6 py-3 font-medium">Địa chỉ</th>
                                    <th className="px-6 py-3 font-medium text-center">Cổng sạc</th>
                                    <th className="px-6 py-3 font-medium">Trạng thái</th>
                                    <th className="px-6 py-3 font-medium text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                {StationFilter.map((station) => (
                                    <tr key={station.id} className="hover:bg-gray-50/60">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="size-4 text-gray-400" />
                                                <span className="font-medium text-gray-900">{station.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600 flex items-start gap-2">
                                            <MapPin className="size-4 mt-[2px] text-gray-400" />
                                            <span>{station.address}</span>
                                        </td>
                                        <td className="px-6 py-3 text-center text-gray-600">
                                            {station.connectors}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${station.status === "ACTIVE"
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : "bg-gray-100 text-gray-500"
                                                    }`}
                                            >
                                                {station.status === "ACTIVE" ? (
                                                    <Power className="size-3" />
                                                ) : (
                                                    <WifiOff className="size-3" />
                                                )}
                                                {station.status === "ACTIVE" ? "Đang hoạt động" : "Ngưng hoạt động"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEdit(station)}
                                                    className="flex items-center gap-1"
                                                >
                                                    <Pencil className="size-4" />
                                                    Sửa
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={station.status === "ACTIVE" ? "destructive" : "default"}
                                                    onClick={() => toggleStationStatus(station.id)}
                                                    className="flex items-center gap-1"
                                                >
                                                    {station.status === "ACTIVE" ? (
                                                        <>
                                                            <WifiOff className="size-4" /> Tắt
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Power className="size-4" /> Bật
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
};

interface FieldProps {
    label: string;
    htmlFor: string;
    children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, htmlFor, children }) => (
    <div className="flex flex-col gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
            {label}
        </Label>
        {children}
    </div>
);

export default StationManagementSection;
