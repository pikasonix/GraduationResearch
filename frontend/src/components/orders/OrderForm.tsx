'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Order, PriorityLevel } from '@/lib/redux/services/orderApi';
import { toast } from 'sonner';
import { AlertCircle, MapPin, Clock, Package, User } from 'lucide-react';

interface OrderFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (order: Partial<Order>) => Promise<void>;
    editingOrder?: Order | null;
    organizationId: string;
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
        product_value: 0,
        weight: 0,
        volume: 0,
        priority: 'normal',
        service_time_pickup: 10,
        service_time_delivery: 10,
        status: 'pending',
        
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
            // Generate tracking number for new orders
            const timestamp = Date.now().toString().slice(-8);
            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
            setFormData(prev => ({
                ...prev,
                tracking_number: `WY${timestamp}${random}`,
                organization_id: organizationId,
            }));
        }
    }, [editingOrder, organizationId, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (!formData.pickup_address || !formData.delivery_address) {
            toast.error('Vui lòng nhập đầy đủ địa chỉ lấy hàng và giao hàng');
            return;
        }

        if (!formData.pickup_contact_name || !formData.delivery_contact_name) {
            toast.error('Vui lòng nhập đầy đủ thông tin người liên hệ');
            return;
        }

        if (!formData.weight || formData.weight <= 0) {
            toast.error('Vui lòng nhập trọng lượng hợp lệ');
            return;
        }

        // Time window validation
        if (formData.pickup_time_start && formData.pickup_time_end) {
            if (new Date(formData.pickup_time_start) >= new Date(formData.pickup_time_end)) {
                toast.error('Thời gian bắt đầu lấy hàng phải trước thời gian kết thúc');
                return;
            }
        }

        if (formData.delivery_time_start && formData.delivery_time_end) {
            if (new Date(formData.delivery_time_start) >= new Date(formData.delivery_time_end)) {
                toast.error('Thời gian bắt đầu giao hàng phải trước thời gian kết thúc');
                return;
            }
        }

        try {
            await onSubmit(formData);
            toast.success(editingOrder ? 'Đã cập nhật đơn hàng' : 'Đã tạo đơn hàng mới');
            onOpenChange(false);
        } catch (error) {
            console.error('Error submitting order:', error);
            toast.error(editingOrder ? 'Không thể cập nhật đơn hàng' : 'Không thể tạo đơn hàng');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package size={20} />
                        {editingOrder ? 'Cập nhật đơn hàng' : 'Tạo đơn hàng mới'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                        <h3 className="font-medium text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            Thông tin cơ bản
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tracking_number">Mã vận đơn <span className="text-red-500">*</span></Label>
                                <Input
                                    id="tracking_number"
                                    required
                                    value={formData.tracking_number}
                                    onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                                    placeholder="WY12345678"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reference_code">Mã tham chiếu</Label>
                                <Input
                                    id="reference_code"
                                    value={formData.reference_code || ''}
                                    onChange={(e) => setFormData({ ...formData, reference_code: e.target.value })}
                                    placeholder="REF-001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="product_name">Tên hàng hóa</Label>
                                <Input
                                    id="product_name"
                                    value={formData.product_name || ''}
                                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                                    placeholder="Điện tử, quần áo..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="product_value">Giá trị (VNĐ)</Label>
                                <Input
                                    id="product_value"
                                    type="number"
                                    min="0"
                                    value={formData.product_value || 0}
                                    onChange={(e) => setFormData({ ...formData, product_value: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="weight">Trọng lượng (kg) <span className="text-red-500">*</span></Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={formData.weight || 0}
                                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="volume">Thể tích (m³)</Label>
                                <Input
                                    id="volume"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.volume || 0}
                                    onChange={(e) => setFormData({ ...formData, volume: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="priority">Ưu tiên</Label>
                                <select
                                    id="priority"
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as PriorityLevel })}
                                >
                                    <option value="low">Thấp</option>
                                    <option value="normal">Bình thường</option>
                                    <option value="high">Cao</option>
                                    <option value="urgent">Khẩn cấp</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Pickup Information */}
                    <div className="space-y-4 border rounded-lg p-4 bg-blue-50">
                        <h3 className="font-medium text-sm flex items-center gap-2">
                            <MapPin size={16} className="text-blue-600" />
                            Thông tin lấy hàng
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="pickup_address">Địa chỉ <span className="text-red-500">*</span></Label>
                                <Textarea
                                    id="pickup_address"
                                    required
                                    value={formData.pickup_address}
                                    onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                                    placeholder="123 Đường ABC, Phường XYZ, Quận 1, TP.HCM"
                                    rows={2}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pickup_latitude">Vĩ độ <span className="text-red-500">*</span></Label>
                                <Input
                                    id="pickup_latitude"
                                    type="number"
                                    required
                                    step="0.00000001"
                                    value={formData.pickup_latitude}
                                    onChange={(e) => setFormData({ ...formData, pickup_latitude: parseFloat(e.target.value) })}
                                    placeholder="10.7769"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pickup_longitude">Kinh độ <span className="text-red-500">*</span></Label>
                                <Input
                                    id="pickup_longitude"
                                    type="number"
                                    required
                                    step="0.00000001"
                                    value={formData.pickup_longitude}
                                    onChange={(e) => setFormData({ ...formData, pickup_longitude: parseFloat(e.target.value) })}
                                    placeholder="106.7009"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pickup_contact_name">Người liên hệ <span className="text-red-500">*</span></Label>
                                <Input
                                    id="pickup_contact_name"
                                    required
                                    value={formData.pickup_contact_name}
                                    onChange={(e) => setFormData({ ...formData, pickup_contact_name: e.target.value })}
                                    placeholder="Nguyễn Văn A"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pickup_contact_phone">Số điện thoại <span className="text-red-500">*</span></Label>
                                <Input
                                    id="pickup_contact_phone"
                                    type="tel"
                                    required
                                    value={formData.pickup_contact_phone}
                                    onChange={(e) => setFormData({ ...formData, pickup_contact_phone: e.target.value })}
                                    placeholder="0901234567"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pickup_time_start">Thời gian bắt đầu</Label>
                                <Input
                                    id="pickup_time_start"
                                    type="datetime-local"
                                    value={formData.pickup_time_start}
                                    onChange={(e) => setFormData({ ...formData, pickup_time_start: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pickup_time_end">Thời gian kết thúc</Label>
                                <Input
                                    id="pickup_time_end"
                                    type="datetime-local"
                                    value={formData.pickup_time_end}
                                    onChange={(e) => setFormData({ ...formData, pickup_time_end: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="service_time_pickup">Thời gian xử lý (phút)</Label>
                                <Input
                                    id="service_time_pickup"
                                    type="number"
                                    min="0"
                                    value={formData.service_time_pickup}
                                    onChange={(e) => setFormData({ ...formData, service_time_pickup: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="pickup_notes">Ghi chú</Label>
                                <Textarea
                                    id="pickup_notes"
                                    value={formData.pickup_notes || ''}
                                    onChange={(e) => setFormData({ ...formData, pickup_notes: e.target.value })}
                                    placeholder="Ghi chú về địa điểm lấy hàng..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Delivery Information */}
                    <div className="space-y-4 border rounded-lg p-4 bg-green-50">
                        <h3 className="font-medium text-sm flex items-center gap-2">
                            <MapPin size={16} className="text-green-600" />
                            Thông tin giao hàng
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="delivery_address">Địa chỉ <span className="text-red-500">*</span></Label>
                                <Textarea
                                    id="delivery_address"
                                    required
                                    value={formData.delivery_address}
                                    onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                                    placeholder="456 Đường DEF, Phường UVW, Quận 3, TP.HCM"
                                    rows={2}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delivery_latitude">Vĩ độ <span className="text-red-500">*</span></Label>
                                <Input
                                    id="delivery_latitude"
                                    type="number"
                                    required
                                    step="0.00000001"
                                    value={formData.delivery_latitude}
                                    onChange={(e) => setFormData({ ...formData, delivery_latitude: parseFloat(e.target.value) })}
                                    placeholder="10.7850"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delivery_longitude">Kinh độ <span className="text-red-500">*</span></Label>
                                <Input
                                    id="delivery_longitude"
                                    type="number"
                                    required
                                    step="0.00000001"
                                    value={formData.delivery_longitude}
                                    onChange={(e) => setFormData({ ...formData, delivery_longitude: parseFloat(e.target.value) })}
                                    placeholder="106.7050"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delivery_contact_name">Người liên hệ <span className="text-red-500">*</span></Label>
                                <Input
                                    id="delivery_contact_name"
                                    required
                                    value={formData.delivery_contact_name}
                                    onChange={(e) => setFormData({ ...formData, delivery_contact_name: e.target.value })}
                                    placeholder="Trần Thị B"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delivery_contact_phone">Số điện thoại <span className="text-red-500">*</span></Label>
                                <Input
                                    id="delivery_contact_phone"
                                    type="tel"
                                    required
                                    value={formData.delivery_contact_phone}
                                    onChange={(e) => setFormData({ ...formData, delivery_contact_phone: e.target.value })}
                                    placeholder="0907654321"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delivery_time_start">Thời gian bắt đầu</Label>
                                <Input
                                    id="delivery_time_start"
                                    type="datetime-local"
                                    value={formData.delivery_time_start}
                                    onChange={(e) => setFormData({ ...formData, delivery_time_start: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delivery_time_end">Thời gian kết thúc</Label>
                                <Input
                                    id="delivery_time_end"
                                    type="datetime-local"
                                    value={formData.delivery_time_end}
                                    onChange={(e) => setFormData({ ...formData, delivery_time_end: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="service_time_delivery">Thời gian xử lý (phút)</Label>
                                <Input
                                    id="service_time_delivery"
                                    type="number"
                                    min="0"
                                    value={formData.service_time_delivery}
                                    onChange={(e) => setFormData({ ...formData, service_time_delivery: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="delivery_notes">Ghi chú</Label>
                                <Textarea
                                    id="delivery_notes"
                                    value={formData.delivery_notes || ''}
                                    onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })}
                                    placeholder="Ghi chú về địa điểm giao hàng..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Hủy
                        </Button>
                        <Button type="submit">
                            {editingOrder ? 'Cập nhật' : 'Tạo đơn hàng'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
