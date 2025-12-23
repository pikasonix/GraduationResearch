import React, { useState } from 'react';
import { Driver, createDriverWithAccount, linkExistingUserToDriver, checkEmailExists, updateDriver, deleteDriver } from '@/services/driverService';
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
import { Edit2, Trash2, Plus, Phone, User as UserIcon, CheckCircle2, AlertCircle } from 'lucide-react';

interface DriverListProps {
    drivers: Driver[];
    onRefresh: () => void;
    teamId?: string;
    organizationId?: string;
}

export default function DriverList({ drivers, onRefresh, teamId, organizationId }: DriverListProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const [emailCheckStep, setEmailCheckStep] = useState<'check' | 'new' | 'link'>('check');
    const [existingUserId, setExistingUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        is_active: true,
        email: '',
        password: '',
    });

    const handleEdit = (driver: Driver) => {
        setEditingDriver(driver);
        setEmailCheckStep('check');
        setExistingUserId(null);
        setFormData({
            full_name: driver.full_name,
            phone: driver.phone,
            is_active: driver.is_active,
            email: '',
            password: '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa tài xế này?')) {
            try {
                await deleteDriver(id);
                toast.success('Đã xóa tài xế');
                onRefresh();
            } catch (error) {
                console.error(error);
                toast.error('Không thể xóa tài xế');
            }
        }
    };

    const handleCheckEmail = async () => {
        if (!formData.email) {
            toast.error('Vui lòng nhập email');
            return;
        }

        try {
            const result = await checkEmailExists(formData.email);
            if (result.exists) {
                setExistingUserId(result.userId || null);
                setEmailCheckStep('link');
                toast.info('Email đã tồn tại. Sẽ liên kết với tài khoản hiện có.');
            } else {
                setEmailCheckStep('new');
                toast.success('Email chưa được đăng ký. Tiếp tục tạo tài khoản mới.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Không thể kiểm tra email');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingDriver) {
                // Update - only update driver info, not account
                await updateDriver(editingDriver.id, {
                    full_name: formData.full_name,
                    phone: formData.phone,
                    is_active: formData.is_active
                });
                toast.success('Đã cập nhật tài xế');
            } else {
                if (!organizationId) {
                    toast.error('Không xác định được tổ chức');
                    return;
                }

                if (emailCheckStep === 'link') {
                    // Link existing user to driver
                    if (!existingUserId) {
                        toast.error('Không tìm thấy user ID');
                        return;
                    }
                    await linkExistingUserToDriver({
                        user_id: existingUserId,
                        full_name: formData.full_name,
                        phone: formData.phone,
                        organization_id: organizationId,
                        team_id: teamId || null,
                        is_active: formData.is_active
                    });
                    toast.success('Đã liên kết tài xế với tài khoản hiện có');
                } else if (emailCheckStep === 'new') {
                    // Create new account and driver
                    if (!formData.password) {
                        toast.error('Vui lòng nhập mật khẩu');
                        return;
                    }
                    
                    await createDriverWithAccount({
                        email: formData.email,
                        password: formData.password,
                        full_name: formData.full_name,
                        phone: formData.phone,
                        organization_id: organizationId,
                        team_id: teamId || null,
                        is_active: formData.is_active
                    });
                    
                    toast.success('Đã thêm tài xế và tạo tài khoản mới');
                } else {
                    toast.error('Vui lòng kiểm tra email trước');
                    return;
                }
            }
            
            setIsModalOpen(false);
            setEditingDriver(null);
            setEmailCheckStep('check');
            setExistingUserId(null);
            setFormData({
                full_name: '',
                phone: '',
                is_active: true,
                email: '',
                password: ''
            });
            onRefresh();
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : 'Có lỗi xảy ra';
            toast.error(errorMessage);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Danh sách Tài xế</h2>
                <Button onClick={() => {
                    setEditingDriver(null);
                    setEmailCheckStep('check');
                    setExistingUserId(null);
                    setFormData({
                        full_name: '',
                        phone: '',
                        is_active: true,
                        email: '',
                        password: ''
                    });
                    setIsModalOpen(true);
                }}>
                    <Plus size={16} className="mr-2" /> Thêm tài xế
                </Button>
            </div>

            <div className="bg-white rounded-lg shadowoverflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã T/X</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ tên</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số điện thoại</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {drivers.map((driver) => (
                            <tr key={driver.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{driver.driver_code}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex items-center">
                                        <UserIcon size={16} className="mr-2 text-gray-400" />
                                        {driver.full_name}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex items-center">
                                        <Phone size={16} className="mr-2 text-gray-400" />
                                        {driver.phone}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${driver.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {driver.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleEdit(driver)} className="text-blue-600 hover:text-blue-900 mr-3">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(driver.id)} className="text-red-600 hover:text-red-900">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {drivers.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Chưa có tài xế nào</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingDriver ? 'Cập nhật thông tin tài xế' : 'Thêm tài xế mới'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Step 1: Email Check - only show when creating new driver */}
                        {!editingDriver && emailCheckStep === 'check' && (
                            <div className="space-y-4 border rounded-lg p-4 bg-blue-50">
                                <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                                    <AlertCircle size={16} className="text-blue-600" />
                                    Bước 1: Kiểm tra email
                                </h4>
                                <p className="text-sm text-gray-600">
                                    Nhập email để kiểm tra xem tài khoản đã tồn tại chưa
                                </p>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="email"
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="email@example.com"
                                            className="flex-1"
                                        />
                                        <Button type="button" onClick={handleCheckEmail}>
                                            Kiểm tra
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2a: Link existing account */}
                        {!editingDriver && emailCheckStep === 'link' && (
                            <>
                                <div className="space-y-4 border rounded-lg p-4 bg-green-50">
                                    <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                                        <CheckCircle2 size={16} className="text-green-600" />
                                        Email đã tồn tại
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                        Email <strong>{formData.email}</strong> đã có tài khoản. Nhập thông tin bên dưới để liên kết với hồ sơ tài xế.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setEmailCheckStep('check');
                                            setExistingUserId(null);
                                            setFormData({ ...formData, email: '', full_name: '', phone: '' });
                                        }}
                                    >
                                        ← Thay đổi email
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* Step 2b: Create new account */}
                        {!editingDriver && emailCheckStep === 'new' && (
                            <>
                                <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                                    <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                                        <CheckCircle2 size={16} className="text-blue-600" />
                                        Tạo tài khoản mới
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                        Email <strong>{formData.email}</strong> chưa được đăng ký. Nhập mật khẩu bên dưới để tạo tài khoản mới.
                                    </p>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Mật khẩu <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            required
                                            minLength={6}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="Tối thiểu 6 ký tự"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setEmailCheckStep('check');
                                            setFormData({ ...formData, email: '', password: '', full_name: '', phone: '' });
                                        }}
                                    >
                                        ← Thay đổi email
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* Driver info fields - show only for edit or new driver creation */}
                        {(editingDriver || emailCheckStep === 'new') && (
                            <div className="space-y-4">
                                <h4 className="font-medium text-sm text-gray-900 border-b pb-2">
                                    {editingDriver ? 'Thông tin tài xế' : 'Bước 2: Thông tin cá nhân'}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="full_name">Họ và tên <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="full_name"
                                            required
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            placeholder="Nguyễn Văn A"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="phone">Số điện thoại <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            required
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="0912345678"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status */}
                        {(editingDriver || emailCheckStep !== 'check') && (
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <Label htmlFor="is_active" className="cursor-pointer">Trạng thái hoạt động</Label>
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => {
                                setIsModalOpen(false);
                                setEmailCheckStep('check');
                                setExistingUserId(null);
                            }}>
                                Hủy
                            </Button>
                            {(editingDriver || emailCheckStep !== 'check') && (
                                <Button type="submit">
                                    {editingDriver ? 'Cập nhật' : 'Thêm tài xế'}
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
