'use client';

import React, { useState } from "react";
import { Phone, Plus, Truck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export type DriverStatus = "AVAILABLE" | "ON_DUTY" | "OFFLINE";

export interface DriverItem {
    id: string;
    name: string;
    phone: string;
    status: DriverStatus;
    notes?: string;
}

interface DriverManagementSectionProps {
    drivers?: DriverItem[];
    onChange?: (drivers: DriverItem[]) => void;
}

const defaultDrivers: DriverItem[] = [
    {
        id: "driver_01",
        name: "Phạm Minh Khoa",
        phone: "0912 345 678",
        status: "AVAILABLE",
        notes: "Ca sáng 8h-16h",
    },
    {
        id: "driver_02",
        name: "Lê Thanh Tùng",
        phone: "0987 654 321",
        status: "ON_DUTY",
        notes: "Đang hỗ trợ tuyến QL1A",
    },
    {
        id: "driver_03",
        name: "Nguyễn Quốc Việt",
        phone: "0903 123 456",
        status: "OFFLINE",
        notes: "Nghỉ phép đến 30/09",
    },
];

const emptyDriverForm = {
    name: "",
    phone: "",
    status: "AVAILABLE" as DriverStatus,
    notes: "",
};

const statusLabel: Record<DriverStatus, string> = {
    AVAILABLE: "Sẵn sàng",
    ON_DUTY: "Đang thực hiện",
    OFFLINE: "Không hoạt động",
};

const statusColors: Record<DriverStatus, string> = {
    AVAILABLE: "bg-emerald-50 text-emerald-600",
    ON_DUTY: "bg-blue-50 text-blue-600",
    OFFLINE: "bg-gray-100 text-gray-500",
};

const DriverManagementSection: React.FC<DriverManagementSectionProps> = ({
    drivers,
    onChange,
}) => {
    const [driverList, setDriverList] = useState<DriverItem[]>(drivers ?? defaultDrivers);
    const [formValues, setFormValues] = useState(emptyDriverForm);
    const [editingId, setEditingId] = useState<string | null>(null);

    const isEditing = Boolean(editingId);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formValues.name.trim() || !formValues.phone.trim()) {
            return;
        }

        if (isEditing && editingId) {
            const updated = driverList.map((driver) =>
                driver.id === editingId
                    ? {
                        ...driver,
                        name: formValues.name.trim(),
                        phone: formValues.phone.trim(),
                        status: formValues.status,
                        notes: formValues.notes.trim() || undefined,
                    }
                    : driver
            );
            setDriverList(updated);
            onChange?.(updated);
            resetForm();
            return;
        }

        const newDriver: DriverItem = {
            id: `driver_${Date.now()}`,
            name: formValues.name.trim(),
            phone: formValues.phone.trim(),
            status: formValues.status,
            notes: formValues.notes.trim() || undefined,
        };

        const updated = [...driverList, newDriver];
        setDriverList(updated);
        onChange?.(updated);
        resetForm();
    };

    const resetForm = () => {
        setFormValues(emptyDriverForm);
        setEditingId(null);
    };

    const handleEdit = (driver: DriverItem) => {
        setEditingId(driver.id);
        setFormValues({
            name: driver.name,
            phone: driver.phone,
            status: driver.status,
            notes: driver.notes ?? "",
        });
    };

    const removeDriver = (id: string) => {
        const updated = driverList.filter((driver) => driver.id !== id);
        setDriverList(updated);
        onChange?.(updated);
        if (editingId === id) {
            resetForm();
        }
    };

    return (
        <section className="space-y-6" aria-labelledby="driver-management-section">
            <div className="flex flex-col gap-3">
                <h2 id="driver-management-section" className="text-xl font-semibold text-gray-900">
                    Quản lý đội ngũ tài xế cứu hộ
                </h2>
                <p className="text-sm text-gray-600 max-w-3xl">
                    Theo dõi tình trạng hoạt động, phân công lịch trực và cập nhật thông tin liên lạc của từng tài xế. Giao diện demo mô phỏng bảng điều khiển dành cho gara chuyên trách.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_2.4fr] gap-6">
                <form
                    className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4"
                    onSubmit={handleSubmit}
                >
                    <header className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <UserCog className="size-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">
                                {isEditing ? "Chỉnh sửa tài xế" : "Thêm tài xế mới"}
                            </h3>
                            <p className="text-xs text-gray-500">Cập nhật thông tin liên hệ và trạng thái sẵn sàng.</p>
                        </div>
                    </header>

                    <div className="space-y-4">
                        <Field label="Họ và tên" htmlFor="driver-name">
                            <Input
                                id="driver-name"
                                placeholder="VD: Phạm Minh Khoa"
                                value={formValues.name}
                                onChange={(event) =>
                                    setFormValues((prev) => ({ ...prev, name: event.target.value }))
                                }
                                required
                            />
                        </Field>
                        <Field label="Số điện thoại" htmlFor="driver-phone">
                            <Input
                                id="driver-phone"
                                placeholder="VD: 0912 345 678"
                                value={formValues.phone}
                                onChange={(event) =>
                                    setFormValues((prev) => ({ ...prev, phone: event.target.value }))
                                }
                                required
                            />
                        </Field>
                        <Field label="Trạng thái" htmlFor="driver-status">
                            <Select
                                value={formValues.status}
                                onValueChange={(value: DriverStatus) =>
                                    setFormValues((prev) => ({ ...prev, status: value }))
                                }
                            >
                                <SelectTrigger id="driver-status">
                                    <SelectValue placeholder="Chọn trạng thái" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AVAILABLE">Sẵn sàng nhận lệnh</SelectItem>
                                    <SelectItem value="ON_DUTY">Đang thực hiện cứu hộ</SelectItem>
                                    <SelectItem value="OFFLINE">Ngoài ca làm việc</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Ghi chú" htmlFor="driver-notes">
                            <Input
                                id="driver-notes"
                                placeholder="Ví dụ: Ca trực, khu vực ưu tiên"
                                value={formValues.notes}
                                onChange={(event) =>
                                    setFormValues((prev) => ({ ...prev, notes: event.target.value }))
                                }
                            />
                        </Field>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <Button type="submit" className="flex items-center gap-2">
                            {isEditing ? (
                                <>
                                    <Plus className="size-4 rotate-45" /> Cập nhật
                                </>
                            ) : (
                                <>
                                    <Plus className="size-4" /> Thêm tài xế
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
                            <h3 className="text-base font-semibold text-gray-900">Danh sách tài xế</h3>
                            <p className="text-xs text-gray-500">{driverList.length} thành viên trong đội cứu hộ</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Tài xế</th>
                                    <th className="px-6 py-3 font-medium">Điện thoại</th>
                                    <th className="px-6 py-3 font-medium">Trạng thái</th>
                                    <th className="px-6 py-3 font-medium">Ghi chú</th>
                                    <th className="px-6 py-3 font-medium text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                {driverList.map((driver) => (
                                    <tr key={driver.id} className="hover:bg-gray-50/60">
                                        <td className="px-6 py-3 flex items-center gap-2">
                                            <Truck className="size-4 text-gray-400" />
                                            <span className="font-medium text-gray-900">{driver.name}</span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600 flex items-center gap-2">
                                            <Phone className="size-4 text-gray-400" />
                                            <span>{driver.phone}</span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span
                                                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[driver.status]}`}
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full bg-current opacity-70" />
                                                {statusLabel[driver.status]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-500">
                                            {driver.notes || "—"}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEdit(driver)}
                                                >
                                                    Sửa
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => removeDriver(driver.id)}
                                                >
                                                    Xoá
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

export default DriverManagementSection;
