'use client';

import React, { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ChargingPortType =
    | "CCS2"
    | "CHAdeMO"
    | "Type 2"
    | "Tesla"
    | "GB/T"
    | string;

export interface CarInfo {
    id: string;
    brand: string;
    model: string;
    chargingPort: ChargingPortType;
    batteryCapacityKwh: string;
    rangeKm: string;
    notes?: string;
}

interface CarInfoSectionProps {
    cars?: CarInfo[];
    onChange?: (cars: CarInfo[]) => void;
}

const defaultCars: CarInfo[] = [
    {
        id: "car_01",
        brand: "VinFast",
        model: "VF8 Plus",
        chargingPort: "CCS2",
        batteryCapacityKwh: "87.7",
        rangeKm: "400",
        notes: "Xe gia đình sử dụng hằng ngày",
    },
    {
        id: "car_02",
        brand: "Hyundai",
        model: "Kona Electric",
        chargingPort: "Type 2",
        batteryCapacityKwh: "64",
        rangeKm: "305",
        notes: "Sử dụng cho các chuyến đi công tác",
    },
];

const emptyForm: Omit<CarInfo, "id"> = {
    brand: "",
    model: "",
    chargingPort: "CCS2",
    batteryCapacityKwh: "",
    rangeKm: "",
    notes: "",
};

const CarInfoSection: React.FC<CarInfoSectionProps> = ({ cars, onChange }) => {
    const [carList, setCarList] = useState<CarInfo[]>(cars ?? defaultCars);
    const [formValues, setFormValues] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);

    const isEditing = Boolean(editingId);

    const handleFieldChange = (
        field: keyof Omit<CarInfo, "id">
    ) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const resetForm = () => {
        setFormValues(emptyForm);
        setEditingId(null);
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formValues.brand.trim() || !formValues.model.trim()) {
            return;
        }

        if (isEditing && editingId) {
            const newCars = carList.map((car) =>
                car.id === editingId ? { ...car, ...formValues, id: editingId } : car
            );
            setCarList(newCars);
            onChange?.(newCars);
            resetForm();
            return;
        }

        const newCar: CarInfo = {
            id: `car_${Date.now()}`,
            ...formValues,
        };

        const newCars = [...carList, newCar];
        setCarList(newCars);
        onChange?.(newCars);
        resetForm();
    };

    const handleEdit = (car: CarInfo) => {
        setEditingId(car.id);
        setFormValues({
            brand: car.brand,
            model: car.model,
            chargingPort: car.chargingPort,
            batteryCapacityKwh: car.batteryCapacityKwh,
            rangeKm: car.rangeKm,
            notes: car.notes ?? "",
        });
    };

    const handleDelete = (id: string) => {
        const newCars = carList.filter((car) => car.id !== id);
        setCarList(newCars);
        onChange?.(newCars);
        if (editingId === id) {
            resetForm();
        }
    };

    const totalCapacity = useMemo(() => {
        return carList.reduce((sum, car) => sum + Number(car.batteryCapacityKwh || 0), 0);
    }, [carList]);

    return (
        <section className="space-y-6" aria-labelledby="car-info-section">
            <div className="flex flex-col gap-3">
                <h2 id="car-info-section" className="text-xl font-semibold text-gray-900">
                    Thông tin xe điện của bạn
                </h2>
                <p className="text-sm text-gray-600 max-w-2xl">
                    Theo dõi danh sách phương tiện đã thêm, cập nhật thông số kỹ thuật và quản lý cấu hình sạc yêu thích. Giao diện demo lưu dữ liệu tạm thời.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                    <header>
                        <h3 className="text-base font-semibold text-gray-900">
                            {isEditing ? "Chỉnh sửa thông tin xe" : "Thêm xe mới"}
                        </h3>
                        <p className="text-xs text-gray-500">
                            Điền các thông số cơ bản của xe điện để tính toán kế hoạch sạc phù hợp.
                        </p>
                    </header>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Hãng xe" htmlFor="car-brand">
                                <Input
                                    id="car-brand"
                                    placeholder="VD: VinFast"
                                    value={formValues.brand}
                                    onChange={handleFieldChange("brand")}
                                    required
                                />
                            </Field>
                            <Field label="Mẫu xe" htmlFor="car-model">
                                <Input
                                    id="car-model"
                                    placeholder="VD: VF8 Plus"
                                    value={formValues.model}
                                    onChange={handleFieldChange("model")}
                                    required
                                />
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Loại cổng sạc" htmlFor="car-port">
                                <Input
                                    id="car-port"
                                    placeholder="VD: CCS2"
                                    value={formValues.chargingPort}
                                    onChange={handleFieldChange("chargingPort")}
                                    required
                                />
                            </Field>
                            <Field label="Dung lượng pin (kWh)" htmlFor="car-battery">
                                <Input
                                    id="car-battery"
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    placeholder="VD: 87.7"
                                    value={formValues.batteryCapacityKwh}
                                    onChange={handleFieldChange("batteryCapacityKwh")}
                                    required
                                />
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Quãng đường lý thuyết (km)" htmlFor="car-range">
                                <Input
                                    id="car-range"
                                    type="number"
                                    min="0"
                                    placeholder="VD: 400"
                                    value={formValues.rangeKm}
                                    onChange={handleFieldChange("rangeKm")}
                                />
                            </Field>
                            <Field label="Ghi chú" htmlFor="car-notes">
                                <Input
                                    id="car-notes"
                                    placeholder="Ví dụ: Xe gia đình"
                                    value={formValues.notes}
                                    onChange={handleFieldChange("notes")}
                                />
                            </Field>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <Button type="submit" className="flex items-center gap-2">
                                {isEditing ? (
                                    <>
                                        <Pencil className="size-4" /> Cập nhật xe
                                    </>
                                ) : (
                                    <>
                                        <Plus className="size-4" /> Thêm vào danh sách
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
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Danh sách xe đã thêm</h3>
                            <p className="text-xs text-gray-500">
                                Tổng dung lượng pin hiện có: <strong>{totalCapacity.toFixed(1)} kWh</strong>
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium">
                            {carList.length} phương tiện
                        </span>
                    </div>
                    {carList.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm text-gray-500">
                            Chưa có xe nào được thêm. Bắt đầu với biểu mẫu bên trái nhé!
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {carList.map((car) => (
                                <li key={car.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {car.brand} {car.model}
                                        </p>
                                        <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-500 max-w-xl">
                                            <span>Cổng sạc: <strong className="text-gray-700">{car.chargingPort}</strong></span>
                                            <span>Pin: <strong className="text-gray-700">{car.batteryCapacityKwh} kWh</strong></span>
                                            <span>Quãng đường: <strong className="text-gray-700">{car.rangeKm || "—"} km</strong></span>
                                            {car.notes && (
                                                <span className="col-span-full">Ghi chú: {car.notes}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-start sm:self-auto">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEdit(car)}
                                            className="flex items-center gap-1"
                                        >
                                            <Pencil className="size-4" />
                                            Sửa
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleDelete(car.id)}
                                            className="flex items-center gap-1"
                                        >
                                            <Trash2 className="size-4" />
                                            Xóa
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
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

export default CarInfoSection;
