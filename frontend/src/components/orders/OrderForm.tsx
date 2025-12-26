'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Order, PriorityLevel, OrderStatus } from '@/lib/redux/services/orderApi';
import { toast } from 'sonner';
import { AlertCircle, MapPin, Package, Upload, Clock, ArrowRight, X } from 'lucide-react';
import UniversalMap from '../map/UniversalMap';
import { getGeocoder } from '@/services/geocoding';

interface OrderFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (order: Partial<Order>) => Promise<void>;
    editingOrder?: Order | null;
    organizationId: string;
}

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function OrderForm({
    open,
    onOpenChange,
    onSubmit,
    editingOrder,
    organizationId,
}: OrderFormProps) {
    const [formData, setFormData] = useState<Partial<Order>>({
        organization_id: organizationId,
        tracking_number: '',
        reference_code: '',
        product_name: '',
        product_value: undefined,
        weight: 0,
        volume: undefined,
        priority: 'normal',
        service_time_pickup: 10,
        service_time_delivery: 10,
        status: 'pending',
        internal_notes: '',

        // Pickup
        pickup_contact_name: '',
        pickup_contact_phone: '',
        pickup_address: '',
        pickup_latitude: 0,
        pickup_longitude: 0,
        pickup_time_start: '',
        pickup_time_end: '',
        pickup_notes: '',

        // Delivery
        delivery_contact_name: '',
        delivery_contact_phone: '',
        delivery_address: '',
        delivery_latitude: 0,
        delivery_longitude: 0,
        delivery_time_start: '',
        delivery_time_end: '',
        delivery_notes: '',
    });

    const [activeField, setActiveField] = useState<'pickup' | 'delivery' | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [pendingMapClick, setPendingMapClick] = useState<{ lat: number; lng: number; address: string } | null>(null);

    // Debounce addresses for geocoding
    const debouncedPickupAddress = useDebounce(formData.pickup_address, 1000);
    const debouncedDeliveryAddress = useDebounce(formData.delivery_address, 1000);

    // Initial Setup
    useEffect(() => {
        if (editingOrder) {
            setFormData({
                ...editingOrder,
                pickup_time_start: editingOrder.pickup_time_start?.slice(0, 16) || '',
                pickup_time_end: editingOrder.pickup_time_end?.slice(0, 16) || '',
                delivery_time_start: editingOrder.delivery_time_start?.slice(0, 16) || '',
                delivery_time_end: editingOrder.delivery_time_end?.slice(0, 16) || '',
            });
        } else {
            const timestamp = Date.now().toString().slice(-8);
            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
            setFormData(prev => ({
                ...prev,
                tracking_number: `WY${timestamp}${random}`,
                organization_id: organizationId,
            }));
        }
    }, [editingOrder, organizationId, open]);

    // Forward Geocoding: Pickup
    useEffect(() => {
        if (!debouncedPickupAddress || activeField !== 'pickup') return;

        const geocode = async () => {
            setIsGeocoding(true);
            try {
                const geocoder = getGeocoder();
                const result = await geocoder.geocode(debouncedPickupAddress);
                if (result) {
                    setFormData(prev => ({
                        ...prev,
                        pickup_latitude: result.center[1],
                        pickup_longitude: result.center[0],
                    }));
                }
            } catch (error) {
                console.error("Geocoding failed", error);
            } finally {
                setIsGeocoding(false);
            }
        };
        geocode();
    }, [debouncedPickupAddress]); // activeField removed to allow background updates, but might clash with map clicks. 
    // To properly prevent loops: only geocode if address changed AND checking if lat/lng matches. 
    // Actually simplicity: If address changes by typing, we geocode.

    // Forward Geocoding: Delivery
    useEffect(() => {
        if (!debouncedDeliveryAddress || activeField !== 'delivery') return;

        const geocode = async () => {
            setIsGeocoding(true);
            try {
                const geocoder = getGeocoder();
                const result = await geocoder.geocode(debouncedDeliveryAddress);
                if (result) {
                    setFormData(prev => ({
                        ...prev,
                        delivery_latitude: result.center[1],
                        delivery_longitude: result.center[0],
                    }));
                }
            } catch (error) {
                console.error("Geocoding failed", error);
            } finally {
                setIsGeocoding(false);
            }
        };
        geocode();
    }, [debouncedDeliveryAddress]);

    // Reverse Geocoding (Map Click)
    const handleMapClick = useCallback(async (lat: number, lng: number) => {
        // Determine which field to update based on user focus or explicit selection?
        // Current logic: If user focused on Pickup Address input recently, update pickup.
        // Or better: Use two buttons on map? No.
        // Simplest: Check which address field is empty? No.

        // Let's use the `activeField` logic. User clicks "Pick location" button or focuses the field.
        // For now, let's assume if we are editing text, we map-click to set THAT coordinate.

        // Default to Pickup if nothing active, or allow toggle?
        // Let's create a clearer UI for "Picking Mode".
        // Instead, let's just update the one that has valid coordinates closest to click? No.

        // Revised UX: Map Click should probably not do anything implicitly unless a mode is active.
        // Adding "Chọn trên bản đồ" buttons near address inputs.

    }, []);

    // Helper to update from map click manually (we will pass this to UniversalMap if we enable clicking)
    // For now, let's stick to Address -> Map as primary. 
    // If we want Map -> Address, we need to know WHAT we are setting (Pickup or Delivery).

    // Let's implement a simple "Pin mode" toggle or just deduce.
    // Actually, universal map `onMapClick` is simple.
    // Let's implement:
    // If user clicks map:
    // 1. If currently focused on Pickup Address -> Update Pickup
    // 2. If currently focused on Delivery Address -> Update Delivery
    // 3. Else ignore?

    // Mock order for map visualization
    const mapOrder = {
        ...formData,
        id: 'new-order',
        status: formData.status || 'pending',
    } as Order;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.tracking_number) {
            toast.error('Vui lòng nhập mã vận đơn');
            return;
        }

        if (!formData.pickup_contact_name || !formData.pickup_contact_phone) {
            toast.error('Vui lòng nhập người lấy/gửi và số điện thoại lấy hàng');
            return;
        }

        if (!formData.delivery_contact_name || !formData.delivery_contact_phone) {
            toast.error('Vui lòng nhập người nhận và số điện thoại giao hàng');
            return;
        }

        if (!formData.pickup_address || !formData.delivery_address) {
            toast.error('Vui lòng nhập đi đỉa chỉ lấy và giao hàng');
            return;
        }

        if (!formData.pickup_latitude || !formData.pickup_longitude) {
            toast.error('Chưa xác định được toạ độ lấy hàng. Vui lòng kiểm tra lại địa chỉ.');
            return;
        }

        if (!formData.delivery_latitude || !formData.delivery_longitude) {
            toast.error('Chưa xác định được toạ độ giao hàng. Vui lòng kiểm tra lại địa chỉ.');
            return;
        }

        if (formData.weight === undefined || Number.isNaN(formData.weight)) {
            toast.error('Vui lòng nhập trọng lượng hợp lệ');
            return;
        }

        try {
            const payload: Partial<Order> = {
                ...formData,
                // Avoid sending empty string to timestamptz columns
                pickup_time_start: formData.pickup_time_start ? formData.pickup_time_start : undefined,
                pickup_time_end: formData.pickup_time_end ? formData.pickup_time_end : undefined,
                delivery_time_start: formData.delivery_time_start ? formData.delivery_time_start : undefined,
                delivery_time_end: formData.delivery_time_end ? formData.delivery_time_end : undefined,

                // Optional text fields: keep undefined rather than empty string
                pickup_notes: formData.pickup_notes ? formData.pickup_notes : undefined,
                delivery_notes: formData.delivery_notes ? formData.delivery_notes : undefined,
                internal_notes: formData.internal_notes ? formData.internal_notes : undefined,
            };

            await onSubmit(payload);
            toast.success(editingOrder ? 'Đã cập nhật đơn hàng' : 'Đã tạo đơn hàng mới');
            onOpenChange(false);
        } catch (error) {
            console.error('Error submitting order:', error);
            toast.error(editingOrder ? 'Không thể cập nhật đơn hàng' : 'Không thể tạo đơn hàng');
        }
    };

    const handleSetLocationFromMap = async (lat: number, lng: number, type: 'pickup' | 'delivery') => {
        setIsGeocoding(true);
        try {
            const geocoder = getGeocoder();
            // Check if reverse geocoding is supported
            if (geocoder.reverse) {
                const address = await geocoder.reverse(lng, lat);
                setFormData(prev => ({
                    ...prev,
                    [type === 'pickup' ? 'pickup_latitude' : 'delivery_latitude']: lat,
                    [type === 'pickup' ? 'pickup_longitude' : 'delivery_longitude']: lng,
                    [type === 'pickup' ? 'pickup_address' : 'delivery_address']: address || prev[type === 'pickup' ? 'pickup_address' : 'delivery_address']
                }));
            } else {
                // Fallback if reverse not supported: just set coords
                setFormData(prev => ({
                    ...prev,
                    [type === 'pickup' ? 'pickup_latitude' : 'delivery_latitude']: lat,
                    [type === 'pickup' ? 'pickup_longitude' : 'delivery_longitude']: lng,
                }));
            }
        } catch (e) { console.error(e); }
        finally { setIsGeocoding(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:!max-w-[95vw] !w-[92vw] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden rounded-xl bg-white">
                {/* Compact Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between bg-white z-10 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Package className="w-4 h-4" />
                        {editingOrder ? 'Cập nhật đơn hàng' : 'Tạo đơn hàng mới'}
                    </DialogTitle>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 grid-rows-2 h-full overflow-hidden">
                        {/* 1. TOP LEFT: General Info - Compact 3-column grid */}
                        <div className="p-4 overflow-y-auto border-r border-b">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                <AlertCircle size={14} /> Thông tin chung
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label className="text-xs">Mã vận đơn <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.tracking_number}
                                        onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                                        placeholder="WY..."
                                        className="font-mono h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Tên hàng hóa</Label>
                                    <Input
                                        value={formData.product_name}
                                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                                        placeholder="VD: Quần áo"
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Mã tham chiếu</Label>
                                    <Input
                                        value={formData.reference_code}
                                        onChange={(e) => setFormData({ ...formData, reference_code: e.target.value })}
                                        placeholder="REF..."
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Giá trị (VND)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.product_value ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData({
                                                ...formData,
                                                product_value: value === '' ? undefined : Number.parseFloat(value),
                                            });
                                        }}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Trọng lượng (kg) <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.weight ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData({
                                                ...formData,
                                                weight: value === '' ? undefined : Number.parseFloat(value),
                                            });
                                        }}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Thể tích (m³)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        value={formData.volume ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData({
                                                ...formData,
                                                volume: value === '' ? undefined : Number.parseFloat(value),
                                            });
                                        }}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Độ ưu tiên</Label>
                                    <select
                                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as PriorityLevel })}
                                    >
                                        <option value="normal">Thường</option>
                                        <option value="urgent">Hoả tốc</option>
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-xs">Trạng thái</Label>
                                    <select
                                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as OrderStatus })}
                                    >
                                        <option value="pending">Chờ xử lý</option>
                                        <option value="assigned">Đã phân tuyến</option>
                                        <option value="in_transit">Đang vận chuyển</option>
                                        <option value="picked_up">Đã lấy hàng</option>
                                        <option value="delivered">Đã giao</option>
                                        <option value="failed">Thất bại</option>
                                        <option value="cancelled">Đã huỷ</option>
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-xs">Service (lấy/giao, phút)</Label>
                                    <div className="flex gap-1">
                                        <Input
                                            type="number"
                                            min="0"
                                            value={formData.service_time_pickup ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setFormData({
                                                    ...formData,
                                                    service_time_pickup: value === '' ? undefined : Number.parseInt(value, 10),
                                                });
                                            }}
                                            className="h-8 text-sm"
                                            placeholder="Lấy"
                                        />
                                        <Input
                                            type="number"
                                            min="0"
                                            value={formData.service_time_delivery ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setFormData({
                                                    ...formData,
                                                    service_time_delivery: value === '' ? undefined : Number.parseInt(value, 10),
                                                });
                                            }}
                                            className="h-8 text-sm"
                                            placeholder="Giao"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-3">
                                    <Label className="text-xs">Ghi chú nội bộ</Label>
                                    <Textarea
                                        value={formData.internal_notes || ''}
                                        onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                                        className="resize-none bg-white min-h-[50px] text-sm"
                                        placeholder="Ghi chú cho điều phối/CS..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. TOP RIGHT: Map */}
                        <div className="relative border-b h-full bg-gray-100 overflow-hidden">
                            <UniversalMap
                                orders={[mapOrder]}
                                className="h-full w-full"
                                interactive={true}
                                showOrderLines={true}
                                onMapClick={async (lat, lng) => {
                                    // Reverse geocode to get address
                                    setIsGeocoding(true);
                                    try {
                                        const geocoder = getGeocoder();
                                        let address = '';
                                        if (geocoder.reverse) {
                                            address = await geocoder.reverse(lng, lat) || '';
                                        }
                                        setPendingMapClick({ lat, lng, address });
                                    } catch (e) {
                                        console.error(e);
                                        setPendingMapClick({ lat, lng, address: '' });
                                    } finally {
                                        setIsGeocoding(false);
                                    }
                                }}
                                pendingMarker={pendingMapClick ? { lat: pendingMapClick.lat, lng: pendingMapClick.lng } : null}
                            />

                            {/* Map Click Popup - Choose Pickup or Delivery */}
                            {pendingMapClick && (
                                <div className="absolute bottom-2 right-2 bg-white rounded-xl shadow-2xl border z-20 min-w-[260px] max-w-[300px] overflow-hidden">
                                    {/* Header */}
                                    <div className="px-3 py-2.5 border-b bg-gray-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-100 text-blue-600 p-1.5 rounded-md">
                                                <MapPin size={14} />
                                            </div>
                                            <div>
                                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tọa độ</div>
                                                <div className="font-mono text-xs font-bold text-gray-700 select-all">
                                                    {pendingMapClick.lat.toFixed(5)}, {pendingMapClick.lng.toFixed(5)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a
                                                href={`https://www.google.com/maps?q=${pendingMapClick.lat},${pendingMapClick.lng}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                                                title="Mở Google Maps"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => setPendingMapClick(null)}
                                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="px-3 py-2 border-b">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Địa chỉ</div>
                                        <div className="text-[11px] text-gray-600 leading-snug line-clamp-2">
                                            {isGeocoding ? (
                                                <span className="flex items-center gap-1.5 text-blue-500 italic">
                                                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                                    Đang tìm...
                                                </span>
                                            ) : pendingMapClick.address ? (
                                                pendingMapClick.address
                                            ) : (
                                                <span className="italic text-gray-400">Không tìm thấy địa chỉ</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="p-2.5 flex gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs font-bold"
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    pickup_latitude: pendingMapClick.lat,
                                                    pickup_longitude: pendingMapClick.lng,
                                                    pickup_address: pendingMapClick.address || prev.pickup_address,
                                                }));
                                                setPendingMapClick(null);
                                                toast.success('Đã cập nhật điểm lấy hàng');
                                            }}
                                        >
                                            <Upload size={12} className="mr-1" /> Lấy hàng
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-xs font-bold"
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    delivery_latitude: pendingMapClick.lat,
                                                    delivery_longitude: pendingMapClick.lng,
                                                    delivery_address: pendingMapClick.address || prev.delivery_address,
                                                }));
                                                setPendingMapClick(null);
                                                toast.success('Đã cập nhật điểm giao hàng');
                                            }}
                                        >
                                            <MapPin size={12} className="mr-1" /> Giao hàng
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Compact Map Overlay Helper */}
                            {!pendingMapClick && (
                                <div className="absolute top-2 left-2 right-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-md shadow border text-[11px] text-gray-600 z-10">
                                    <span className="font-medium">📍 Tip:</span> Click bản đồ để chọn vị trí lấy/giao hàng
                                </div>
                            )}
                        </div>

                        {/* 3. BOTTOM LEFT: Pickup Info (Blue) - Compact */}
                        <div className="p-4 overflow-y-auto border-r bg-blue-50/30">
                            <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                <Upload size={14} /> Điểm lấy hàng
                            </h3>
                            <div className="space-y-3">
                                {/* Address + Coordinates on same row */}
                                <div className="flex gap-3">
                                    {/* Address Input */}
                                    <div className="flex-1">
                                        <Label className="text-xs text-blue-900 mb-1 block">Địa chỉ <span className="text-red-500">*</span></Label>
                                        <Textarea
                                            value={formData.pickup_address}
                                            onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                                            className="resize-none bg-white min-h-[60px] text-sm"
                                            placeholder="Nhập địa chỉ..."
                                        />
                                    </div>
                                    {/* Coordinate Input */}
                                    <div className="w-[160px]">
                                        <Label className="text-xs text-blue-900 mb-1 block">Tọa độ</Label>
                                        <Input
                                            value={formData.pickup_latitude && formData.pickup_longitude
                                                ? `${formData.pickup_latitude}, ${formData.pickup_longitude}`
                                                : ''}
                                            onChange={(e) => {
                                                const parts = e.target.value.split(',').map(s => s.trim());
                                                if (parts.length === 2) {
                                                    const lat = parseFloat(parts[0]);
                                                    const lng = parseFloat(parts[1]);
                                                    if (!isNaN(lat) && !isNaN(lng)) {
                                                        setFormData({ ...formData, pickup_latitude: lat, pickup_longitude: lng });
                                                    }
                                                }
                                            }}
                                            className="bg-white h-[60px] text-xs font-mono"
                                            placeholder="21.0278, 105.8342"
                                        />
                                    </div>
                                </div>

                                {/* Contact Info Row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-blue-900">Người gửi <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.pickup_contact_name}
                                            onChange={(e) => setFormData({ ...formData, pickup_contact_name: e.target.value })}
                                            className="bg-white h-8 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-blue-900">SĐT <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.pickup_contact_phone}
                                            onChange={(e) => setFormData({ ...formData, pickup_contact_phone: e.target.value })}
                                            className="bg-white h-8 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Time Window - Grouped */}
                                <div className="bg-blue-100/50 rounded-lg p-2 border border-blue-200">
                                    <Label className="text-xs text-blue-800 mb-2 flex items-center gap-1">
                                        <Clock size={12} /> Khung thời gian
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="datetime-local"
                                            value={formData.pickup_time_start}
                                            onChange={(e) => setFormData({ ...formData, pickup_time_start: e.target.value })}
                                            className="bg-white h-7 text-xs flex-1"
                                        />
                                        <ArrowRight size={14} className="text-blue-500 shrink-0" />
                                        <Input
                                            type="datetime-local"
                                            value={formData.pickup_time_end}
                                            onChange={(e) => setFormData({ ...formData, pickup_time_end: e.target.value })}
                                            className="bg-white h-7 text-xs flex-1"
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <Label className="text-xs text-blue-900">Ghi chú</Label>
                                    <Textarea
                                        value={formData.pickup_notes || ''}
                                        onChange={(e) => setFormData({ ...formData, pickup_notes: e.target.value })}
                                        className="resize-none bg-white min-h-[40px] text-sm"
                                        placeholder="VD: gọi trước khi đến..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 4. BOTTOM RIGHT: Delivery Info (Red) - Compact */}
                        <div className="p-4 overflow-y-auto bg-red-50/30">
                            <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                <MapPin size={14} /> Điểm giao hàng
                            </h3>
                            <div className="space-y-3">
                                {/* Address + Coordinates on same row */}
                                <div className="flex gap-3">
                                    {/* Address Input */}
                                    <div className="flex-1">
                                        <Label className="text-xs text-red-900 mb-1 block">Địa chỉ <span className="text-red-500">*</span></Label>
                                        <Textarea
                                            value={formData.delivery_address}
                                            onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                                            className="resize-none bg-white min-h-[60px] text-sm"
                                            placeholder="Nhập địa chỉ..."
                                        />
                                    </div>
                                    {/* Coordinate Input */}
                                    <div className="w-[160px]">
                                        <Label className="text-xs text-red-900 mb-1 block">Tọa độ</Label>
                                        <Input
                                            value={formData.delivery_latitude && formData.delivery_longitude
                                                ? `${formData.delivery_latitude}, ${formData.delivery_longitude}`
                                                : ''}
                                            onChange={(e) => {
                                                const parts = e.target.value.split(',').map(s => s.trim());
                                                if (parts.length === 2) {
                                                    const lat = parseFloat(parts[0]);
                                                    const lng = parseFloat(parts[1]);
                                                    if (!isNaN(lat) && !isNaN(lng)) {
                                                        setFormData({ ...formData, delivery_latitude: lat, delivery_longitude: lng });
                                                    }
                                                }
                                            }}
                                            className="bg-white h-[60px] text-xs font-mono"
                                            placeholder="21.0278, 105.8342"
                                        />
                                    </div>
                                </div>

                                {/* Contact Info Row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-red-900">Người nhận <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.delivery_contact_name}
                                            onChange={(e) => setFormData({ ...formData, delivery_contact_name: e.target.value })}
                                            className="bg-white h-8 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-red-900">SĐT <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.delivery_contact_phone}
                                            onChange={(e) => setFormData({ ...formData, delivery_contact_phone: e.target.value })}
                                            className="bg-white h-8 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Time Window - Grouped */}
                                <div className="bg-red-100/50 rounded-lg p-2 border border-red-200">
                                    <Label className="text-xs text-red-800 mb-2 flex items-center gap-1">
                                        <Clock size={12} /> Khung thời gian
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="datetime-local"
                                            value={formData.delivery_time_start}
                                            onChange={(e) => setFormData({ ...formData, delivery_time_start: e.target.value })}
                                            className="bg-white h-7 text-xs flex-1"
                                        />
                                        <ArrowRight size={14} className="text-red-500 shrink-0" />
                                        <Input
                                            type="datetime-local"
                                            value={formData.delivery_time_end}
                                            onChange={(e) => setFormData({ ...formData, delivery_time_end: e.target.value })}
                                            className="bg-white h-7 text-xs flex-1"
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <Label className="text-xs text-red-900">Ghi chú</Label>
                                    <Textarea
                                        value={formData.delivery_notes || ''}
                                        onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })}
                                        className="resize-none bg-white min-h-[40px] text-sm"
                                        placeholder="VD: giao giờ hành chính..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Compact Footer Actions */}
                    <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Huỷ bỏ
                        </Button>
                        <Button size="sm" onClick={handleSubmit} disabled={isGeocoding}>
                            {isGeocoding ? 'Đang xử lý...' : (editingOrder ? 'Cập nhật' : 'Tạo đơn hàng')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
