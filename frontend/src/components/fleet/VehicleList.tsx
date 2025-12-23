import React, { useRef, useState } from 'react';
import { Vehicle, createVehicle, updateVehicle, deleteVehicle } from '@/services/driverService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Edit2,
    Trash2,
    Plus,
    Truck,
    Check,
    AlertCircle,
    Hash,
    Weight
} from 'lucide-react';
import { cn } from "@/lib/utils";
import MotobikeIcon from '@/components/icon/components/vehicle/Motorbike';
import MiniTruckIcon from '@/components/icon/components/vehicle/MiniTruck';
import BigTruckIcon from '@/components/icon/components/vehicle/BigTruck';

interface VehicleListProps {
    vehicles: Vehicle[];
    onRefresh: () => void;
    teamId?: string;
    organizationId?: string;
}

const vehicleTypes = [
    {
        value: 'motorcycle',
        label: 'Xe máy',
        icon: MotobikeIcon,
        color: 'from-orange-100 to-orange-200',
        activeColor: 'from-orange-500 to-red-500',
        textColor: 'text-orange-600',
        selectedBg: 'bg-orange-700',
        selectedBorder: 'border-orange-700',
        capacity: '150kg'
    },
    {
        value: 'truck_small',
        label: 'Xe tải nhỏ',
        icon: MiniTruckIcon,
        color: 'from-green-100 to-green-200',
        activeColor: 'from-green-500 to-emerald-600',
        textColor: 'text-green-600',
        selectedBg: 'bg-emerald-700',
        selectedBorder: 'border-emerald-700',
        capacity: '1000kg'
    },
    {
        value: 'truck_large',
        label: 'Xe tải lớn',
        icon: BigTruckIcon,
        color: 'from-red-100 to-red-200',
        activeColor: 'from-red-500 to-rose-700',
        textColor: 'text-red-600',
        selectedBg: 'bg-red-700',
        selectedBorder: 'border-red-700',
        capacity: '5000kg+'
    }
];

export default function VehicleList({ vehicles, onRefresh, teamId, organizationId }: VehicleListProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [formData, setFormData] = useState<{
        license_plate: string;
        vehicle_type: Vehicle['vehicle_type'];
        capacity_weight: number;
        is_active: boolean;
    }>({
        license_plate: '',
        vehicle_type: 'motorcycle',
        capacity_weight: 150, // Default for motorcycle
        is_active: true,
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const licensePlateInputRef = useRef<HTMLInputElement>(null);

    const parsePlateParts = (raw: string) => {
        const normalized = (raw || '').toUpperCase().replace(/\s+/g, '');
        let province = '';
        let series = '';
        let number = '';

        for (const ch of normalized) {
            if (province.length < 2) {
                if (ch >= '0' && ch <= '9') {
                    province += ch;
                }
                continue;
            }

            if (series.length < 2) {
                if (ch >= 'A' && ch <= 'Z') {
                    series += ch;
                    continue;
                }
                // Ignore hyphen and other chars while series is not complete
                if (ch === '-') continue;
                // If user starts typing digits early, we treat series as done (must be >= 1 later for validity)
                if (ch >= '0' && ch <= '9') {
                    // fallthrough to number handling
                } else {
                    continue;
                }
            }

            if (number.length < 5) {
                if (ch >= '0' && ch <= '9') {
                    number += ch;
                }
            }
        }

        return { province, series, number };
    };

    const formatPlate = (raw: string) => {
        const { province, series, number } = parsePlateParts(raw);
        const prefix = `${province}${series}`;
        // Feel natural: only show '-' once number starts
        if (number.length > 0) return `${prefix}-${number}`;
        return prefix;
    };

    const formatPlateWithCaret = (raw: string, caretPos: number) => {
        const before = raw.slice(0, caretPos);
        const acceptedBefore = parsePlateParts(before);
        const formatted = formatPlate(raw);
        const { province, series, number } = acceptedBefore;
        const acceptedCount = province.length + series.length + number.length;

        // Map acceptedCount back into formatted string index
        let mapped = acceptedCount;
        const formattedHasHyphen = formatted.includes('-');
        const prefixLen = Math.min(4, (parsePlateParts(raw).province + parsePlateParts(raw).series).length);
        // If hyphen exists and caret is in number part, shift by 1
        if (formattedHasHyphen && acceptedCount > prefixLen) {
            mapped += 1;
        }
        mapped = Math.min(mapped, formatted.length);
        return { formatted, caret: mapped };
    };

    const handleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setFormData({
            license_plate: vehicle.license_plate,
            vehicle_type: vehicle.vehicle_type,
            capacity_weight: vehicle.capacity_weight,
            is_active: vehicle.is_active,
        });
        setFormErrors({});
        setIsModalOpen(true);
        setTimeout(() => licensePlateInputRef.current?.focus(), 0);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa xe này?')) {
            try {
                await deleteVehicle(id);
                toast.success('Đã xóa xe');
                onRefresh();
            } catch (error) {
                console.error(error);
                toast.error('Không thể xóa xe');
            }
        }
    };

    const validateForm = () => {
        const errors: Record<string, string> = {};

        // Enforce format: 23A-12345 or 23AB-12335
        const plateToValidate = (formData.license_plate || '').toUpperCase().trim();
        if (!plateToValidate) {
            errors.license_plate = 'Vui lòng nhập biển số xe';
        } else if (!/^\d{2}[A-Z]{1,2}-\d{5}$/.test(plateToValidate)) {
            errors.license_plate = 'Biển số phải đúng format: 23A-12345 hoặc 23AB-12335';
        }

        if (formData.capacity_weight <= 0) {
            errors.capacity_weight = 'Tải trọng phải lớn hơn 0';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const normalizedPlate = formatPlate(formData.license_plate).toUpperCase();
        if (formData.license_plate !== normalizedPlate) {
            setFormData(prev => ({ ...prev, license_plate: normalizedPlate }));
        }

        if (!validateForm()) {
            return;
        }

        try {
            if (editingVehicle) {
                // Update
                await updateVehicle(editingVehicle.id, { ...formData, license_plate: normalizedPlate });
                toast.success('Đã cập nhật xe');
            } else {
                // Create
                await createVehicle({
                    license_plate: normalizedPlate,
                    vehicle_type: formData.vehicle_type,
                    capacity_weight: formData.capacity_weight,
                    capacity_volume: null,
                    fuel_consumption: null,
                    cost_per_km: null,
                    cost_per_hour: null,
                    fixed_cost: null,
                    is_active: formData.is_active,
                    notes: null,
                    organization_id: organizationId || '00000000-0000-0000-0000-000000000000',
                });
                toast.success('Đã thêm xe mới');
            }
            setIsModalOpen(false);
            setEditingVehicle(null);
            // Reset to defaults
            setFormData({ license_plate: '', vehicle_type: 'motorcycle', capacity_weight: 150, is_active: true });
            onRefresh();
        } catch (error) {
            console.error(error);
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleTypeSelect = (typeValue: string) => {
        const type = vehicleTypes.find(t => t.value === typeValue);
        // Auto-set weight recommendation based on type if it's currently at a default value or user hasn't heavily customized it?
        // Simplification: just update the type.
        setFormData(prev => ({
            ...prev,
            vehicle_type: typeValue as any,
            // Optional: auto-adjust weight if switching types drastically? Keeping it simple for now. 
        }));
    };

    // Fallback for types that might exist in DB but aren't in our new strict list
    const getTypeInfo = (typeValue: string) => {
        return vehicleTypes.find(t => t.value === typeValue) || {
            value: typeValue,
            label: typeValue || 'Unknown',
            icon: Truck,
            color: 'from-gray-100 to-gray-200',
            activeColor: 'from-gray-500 to-gray-600',
            textColor: 'text-gray-600',
            selectedBg: 'bg-gray-600',
            selectedBorder: 'border-gray-600',
            capacity: 'unknown'
        };
    };

    const selectedType = getTypeInfo(formData.vehicle_type);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-gray-900">Danh sách Phương tiện</h2>
                    <p className="text-sm text-gray-500 mt-1">Quản lý và theo dõi đội xe của bạn</p>
                </div>
                <Button
                    onClick={() => {
                        setEditingVehicle(null);
                        setFormData({ license_plate: '', vehicle_type: 'motorcycle', capacity_weight: 150, is_active: true });
                        setFormErrors({});
                        setIsModalOpen(true);
                        setTimeout(() => licensePlateInputRef.current?.focus(), 0);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                    <Plus size={16} className="mr-2" /> Thêm xe
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Thông tin xe</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Loại xe</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tải trọng</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {vehicles.map((vehicle) => {
                            const typeInfo = getTypeInfo(vehicle.vehicle_type);
                            const TypeIcon = typeInfo.icon;

                            return (
                                <tr key={vehicle.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={cn("h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg shadow-sm border border-black/5", typeInfo.selectedBg)}>
                                                {/* Adjust size for custom icons vs Lucide icons */}
                                                <TypeIcon width={24} height={24} className="text-white" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-semibold text-gray-900">{vehicle.license_plate}</div>
                                                <div className="text-xs text-gray-500">ID: {vehicle.id.slice(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", typeInfo.textColor, "bg-gray-50")}>
                                            {typeInfo.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                        {vehicle.capacity_weight.toLocaleString()} kg
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                                            vehicle.is_active
                                                ? "bg-green-50 text-green-700 border-green-200"
                                                : "bg-red-50 text-red-700 border-red-200"
                                        )}>
                                            <span className={cn("h-1.5 w-1.5 rounded-full", vehicle.is_active ? "bg-green-500" : "bg-red-500")} />
                                            {vehicle.is_active ? 'Sẵn sàng' : 'Ngừng hoạt động'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleEdit(vehicle)}
                                            className="text-gray-400 hover:text-blue-600 transition-colors mr-3 p-1 rounded-md hover:bg-blue-50"
                                            title="Sửa"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(vehicle.id)}
                                            className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                                            title="Xóa"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {vehicles.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-gray-500">
                                        <div className="p-4 rounded-full bg-gray-50 mb-3">
                                            <Truck size={40} className="text-gray-300" />
                                        </div>
                                        <p className="text-base font-medium text-gray-900">Chưa có phương tiện nào</p>
                                        <p className="text-sm mt-1">Thêm phương tiện để bắt đầu quản lý đội xe</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden gap-0">
                    <div className="grid grid-cols-1 md:grid-cols-5 h-full min-h-[500px]">
                        {/* Left Sidebar: Visual Preview */}
                        <div className={cn(
                            "md:col-span-2 p-6 flex flex-col justify-between text-white relative overflow-hidden transition-colors duration-500 bg-gradient-to-br",
                            selectedType.activeColor
                        )}>
                            {/* Decorative Background Patterns */}
                            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
                            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-black/10 blur-3xl" />

                            <div className="relative z-10">
                                <h3 className="text-lg font-semibold text-white/90 mb-1">
                                    {editingVehicle ? 'Cập nhật xe' : 'Thêm xe mới'}
                                </h3>
                            </div>

                            <div className="relative z-10 flex flex-col items-center justify-center flex-1 py-8">
                                <div className="p-6 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 mb-12 scale-150">
                                    {(() => {
                                        const PreviewIcon = selectedType.icon as any;
                                        return <PreviewIcon width={64} height={64} className="text-white drop-shadow-lg" />;
                                    })()}
                                </div>
                                <h4 className="text-2xl font-bold tracking-tight">{formData.license_plate || '...'}</h4>
                                <p className="text-white/80 font-medium mt-1">{selectedType.label}</p>
                            </div>

                            <div className="relative z-10">
                                <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 text-xs text-white/80">
                                    <div className="flex justify-between mb-1">
                                        <span>Tải trọng tối đa:</span>
                                        <span className="font-mono font-bold">{formData.capacity_weight} kg</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Trạng thái:</span>
                                        <span className="font-bold">{formData.is_active ? 'Sẵn sàng' : 'Ngừng hoạt động'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Content: Form */}
                        <div className="md:col-span-3 bg-white p-6 flex flex-col h-full overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <DialogTitle className="text-xl font-bold text-gray-900">Thông tin chi tiết</DialogTitle>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 space-y-6">
                                {/* Type Selection - Horizontal Scroll / Grid */}
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold text-gray-700">Loại phương tiện</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {vehicleTypes.map((type) => {
                                            const isSelected = formData.vehicle_type === type.value;
                                            const TypeIcon = type.icon;
                                            // Dynamic icon size based on vehicle type
                                            const iconSize = type.value === 'motorcycle' ? 36 : 52;
                                            return (
                                                <div
                                                    key={type.value}
                                                    onClick={() => handleTypeSelect(type.value as any)}
                                                    className={cn(
                                                        "cursor-pointer relative p-3 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all duration-200",
                                                        isSelected
                                                            ? cn(type.selectedBg, type.selectedBorder, "ring-2 ring-offset-2", type.selectedBorder, "shadow-lg scale-[1.05]")
                                                            : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 hover:shadow-sm"
                                                    )}
                                                >
                                                    <TypeIcon
                                                        width={iconSize}
                                                        height={iconSize}
                                                        className={cn(
                                                            "transition-all duration-300",
                                                            isSelected
                                                                ? "filter drop-shadow-md"
                                                                : (type.value === 'truck_small' || type.value === 'motorcycle')
                                                                    // Keep two-tone, but reduce contrast so gray looks closer to BigTruck
                                                                    ? "opacity-40 grayscale contrast-75"
                                                                    : "opacity-40 grayscale"
                                                        )}
                                                    />
                                                    <span className={cn(
                                                        "text-xs font-bold text-center",
                                                        isSelected ? "text-white" : "text-gray-600"
                                                    )}>
                                                        {type.label}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5">
                                    {/* License Plate */}
                                    <div className="space-y-2">
                                        <Label htmlFor="license_plate" className="flex items-center gap-2">
                                            <Hash size={14} className="text-gray-500" />
                                            Biển số xe
                                        </Label>
                                        <Input
                                            id="license_plate"
                                            ref={licensePlateInputRef}
                                            inputMode="text"
                                            placeholder="23AB-12345"
                                            className={cn(
                                                "uppercase font-mono text-center text-lg tracking-wider border-gray-300 focus:border-blue-500 focus:ring-blue-500",
                                                formErrors.license_plate && "border-red-500 focus:ring-red-200"
                                            )}
                                            value={formData.license_plate}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const caretPos = e.target.selectionStart ?? raw.length;
                                                const { formatted, caret } = formatPlateWithCaret(raw, caretPos);

                                                setFormData(prev => ({ ...prev, license_plate: formatted }));
                                                if (formErrors.license_plate) {
                                                    const next = { ...formErrors };
                                                    delete next.license_plate;
                                                    setFormErrors(next);
                                                }

                                                requestAnimationFrame(() => {
                                                    licensePlateInputRef.current?.setSelectionRange(caret, caret);
                                                });
                                            }}
                                        />
                                        {formErrors.license_plate && (
                                            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                                <AlertCircle size={12} /> {formErrors.license_plate}
                                            </p>
                                        )}
                                    </div>

                                    {/* Capacity */}
                                    <div className="space-y-2">
                                        <Label htmlFor="capacity_weight" className="flex items-center gap-2">
                                            <Weight size={14} className="text-gray-500" />
                                            Tải trọng (kg)
                                        </Label>
                                        <Input
                                            id="capacity_weight"
                                            type="number"
                                            required
                                            min="1"
                                            className={cn(
                                                "border-gray-300",
                                                formErrors.capacity_weight && "border-red-500"
                                            )}
                                            value={formData.capacity_weight}
                                            onChange={(e) => setFormData({ ...formData, capacity_weight: parseInt(e.target.value) || 0 })}
                                            placeholder="Example: 1000"
                                        />
                                        {formErrors.capacity_weight && (
                                            <p className="text-xs text-red-500 mt-1">
                                                {formErrors.capacity_weight}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Active Toggle */}
                                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex items-center h-5">
                                        <input
                                            type="checkbox"
                                            id="vehicleActive"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <Label htmlFor="vehicleActive" className="font-medium text-gray-900 cursor-pointer">
                                            Kích hoạt xe
                                        </Label>
                                        <span className="text-xs text-gray-500">
                                            Xe đang hoạt động sẽ được điều phối
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-3 mt-auto">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsModalOpen(false)}
                                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                    >
                                        Hủy
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-6"
                                    >
                                        {editingVehicle ? 'Cập nhật' : 'Thêm mới'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
