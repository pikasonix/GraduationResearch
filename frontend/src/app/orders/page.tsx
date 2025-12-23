"use client";

import React, { useState } from "react";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import { useGetUserProfileOverviewQuery } from "@/lib/redux/services/userApi";
import { 
    useGetOrdersQuery, 
    Order, 
    useCreateOrderMutation,
    useUpdateOrderMutation,
    useDeleteOrderMutation 
} from "@/lib/redux/services/orderApi";
import { OrdersStats } from "@/components/orders/OrdersStats";
import { OrdersFilter } from "@/components/orders/OrdersFilter";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { OrdersMap } from "@/components/orders/OrdersMap";
import OrderForm from "@/components/orders/OrderForm";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function OrdersPage() {
    const router = useRouter();
    // We need to get the user's organization ID.
    // Assuming we have a way to get the current user ID, then fetch profile
    // For now, let's assume we can get it from the userApi or auth slice.
    // If not readily available in slice, we might need to fetch session first.
    // But let's try assuming the profile query is cached or we can get user id.

    // Get current session to find userId
    const { data: sessionData } = useGetSessionQuery();
    const userId = sessionData?.session?.user?.id;

    // Fetch user profile to get organization_id
    const { data: userProfile, isLoading: isProfileLoading } = useGetUserProfileOverviewQuery(
        userId ?? "", { skip: !userId }
    );

    const organizationId = userProfile?.organization?.id;

    // Debug: log organization ID
    React.useEffect(() => {
        if (organizationId) {
            console.log('Current user organization_id:', organizationId);
        }
    }, [organizationId]);

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);

    const [createOrder] = useCreateOrderMutation();
    const [updateOrder] = useUpdateOrderMutation();
    const [deleteOrder] = useDeleteOrderMutation();

    // Fetch orders
    const { data: orders = [], isLoading: isOrdersLoading } = useGetOrdersQuery({
        organizationId: organizationId ?? "",
        // status: "all", // Optional
        search: searchTerm,
    }, { skip: !organizationId });

    // Filter by date client-side for now as API might not support simple date match yet
    const filteredOrders = orders.filter(order => {
        if (!date) return true;
        const orderDate = new Date(order.created_at);
        return orderDate.toDateString() === date.toDateString();
    });

    const handleCreateOrder = () => {
        setEditingOrder(null);
        setIsFormOpen(true);
    };

    const handleEditOrder = (order: Order) => {
        setEditingOrder(order);
        setIsFormOpen(true);
    };

    const handleDeleteClick = (orderId: string) => {
        setDeleteOrderId(orderId);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteOrderId) return;
        
        try {
            await deleteOrder(deleteOrderId).unwrap();
            toast.success('Đã xóa đơn hàng');
            setDeleteOrderId(null);
        } catch (error: any) {
            console.error('Error deleting order:', error);
            toast.error(error?.error || 'Không thể xóa đơn hàng');
        }
    };

    const handleFormSubmit = async (orderData: Partial<Order>) => {
        if (editingOrder) {
            await updateOrder({ id: editingOrder.id, ...orderData }).unwrap();
        } else {
            await createOrder(orderData).unwrap();
        }
    };

    const handlePlanRoute = () => {
        // router.push("/routing"); // Or open modal
        toast.info("Chuyển đến trang lập lộ trình...");
        router.push("/map");
    }

    return (
        <div className="w-full p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 bg-gray-50 min-h-screen">
            <div className="flex flex-col space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Danh sách đơn hàng</h1>
                {isProfileLoading && (
                    <p className="text-sm text-gray-500">Đang tải thông tin tổ chức...</p>
                )}
                {!isProfileLoading && !organizationId && (
                    <p className="text-sm text-red-500">Không tìm thấy thông tin tổ chức. Vui lòng kiểm tra tài khoản.</p>
                )}
                {organizationId && (
                    <p className="text-xs text-gray-400">Organization ID: {organizationId}</p>
                )}
            </div>

            <OrdersStats orders={filteredOrders} />

            {isOrdersLoading && (
                <div className="text-center py-12">
                    <p className="text-gray-500">Đang tải đơn hàng...</p>
                </div>
            )}

            {!isOrdersLoading && orders.length === 0 && organizationId && (
                <div className="bg-white rounded-lg p-8 text-center">
                    <p className="text-gray-500 mb-4">Chưa có đơn hàng nào trong hệ thống.</p>
                    <p className="text-sm text-gray-400 mb-2">Organization ID hiện tại: {organizationId}</p>
                    <p className="text-sm text-gray-400">Orders được seed cho org: 2d80e39d-698c-4532-9fb7-408772744c8d</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
                        <OrdersFilter
                            date={date}
                            setDate={setDate}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            onCreateOrder={handleCreateOrder}
                            onPlanRoute={handlePlanRoute}
                        />
                        <OrdersTable
                            orders={filteredOrders}
                            onOrderClick={(order) => setSelectedOrderIds([order.id])}
                            selectedOrderIds={selectedOrderIds}
                            onSelectionChange={setSelectedOrderIds}
                            onEdit={handleEditOrder}
                            onDelete={handleDeleteClick}
                        />
                    </div>
                </div>

                <div className="lg:col-span-1 h-[400px] sm:h-[500px] lg:h-auto bg-white rounded-lg shadow-sm border p-1 lg:sticky lg:top-6">
                    <OrdersMap orders={filteredOrders} selectedOrderIds={selectedOrderIds} />
                </div>
            </div>

            {/* Order Form Modal */}
            <OrderForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={handleFormSubmit}
                editingOrder={editingOrder}
                organizationId={organizationId ?? ''}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa đơn hàng</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn có chắc chắn muốn xóa đơn hàng này? Hành động này không thể hoàn tác.
                            {deleteOrderId && <br />}
                            {deleteOrderId && 'Lưu ý: Không thể xóa đơn hàng đã được gán vào lộ trình.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                            Xóa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
