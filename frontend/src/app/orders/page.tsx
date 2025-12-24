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
import { DateRange } from "react-day-picker";
import { OrdersStats } from "@/components/orders/OrdersStats";
import { OrdersFilter } from "@/components/orders/OrdersFilter";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { OrdersMap } from "@/components/orders/OrdersMap";
import OrderForm from "@/components/orders/OrderForm";
import Pagination from "@/components/common/Pagination";
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

    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ordersPerPage = 10;

    const [createOrder] = useCreateOrderMutation();
    const [updateOrder] = useUpdateOrderMutation();
    const [deleteOrder] = useDeleteOrderMutation();

    // Fetch orders
    const { data: orders = [], isLoading: isOrdersLoading } = useGetOrdersQuery({
        organizationId: organizationId ?? "",
        // status: "all", // Optional
        search: searchTerm,
    }, { skip: !organizationId });

    // Filter by date client-side (Base filter for stats)
    const dateFilteredOrders = orders.filter(order => {
        if (!dateRange || !dateRange.from) return true;

        const orderDate = new Date(order.created_at);
        // Reset time parts for comparison to match date-only logic
        const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

        const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());

        if (!dateRange.to) {
            // Compare single date
            return orderDateOnly.getTime() === fromDate.getTime();
        }

        const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
        // Compare range
        return orderDateOnly.getTime() >= fromDate.getTime() && orderDateOnly.getTime() <= toDate.getTime();
    });

    // Apply specific widget filters (status/priority) - For table/map list
    const finalFilteredOrders = dateFilteredOrders.filter(order => {
        if (statusFilter && order.status !== statusFilter && !((statusFilter === 'failed' && order.status === 'cancelled'))) {
            // Handle 'failed' grouping carefully matching Stats logic
            if (statusFilter === 'failed') {
                if (order.status !== 'failed' && order.status !== 'cancelled') return false;
            } else {
                return false;
            }
        }
        if (priorityFilter && order.priority !== priorityFilter) return false;
        return true;
    });

    // Pagination calculations
    const totalPages = Math.ceil(finalFilteredOrders.length / ordersPerPage);
    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    const currentOrders = finalFilteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

    // Reset to first page when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, dateRange, statusFilter, priorityFilter]);

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
        <div className="w-full pt-2 px-4 space-y-4 md:space-y-2 bg-gray-50 min-h-[calc(100vh-4rem)]">
            {/* Header with Title and Stats */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Danh sách đơn hàng</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {organizationId ? `Organization ID: ${organizationId}` : "Đang tải..."}
                    </p>
                </div>

                {/* Statistics */}
                <div className="flex-shrink-0">
                    <OrdersStats
                        orders={dateFilteredOrders}
                        statusFilter={statusFilter}
                        priorityFilter={priorityFilter}
                        onStatusFilterChange={setStatusFilter}
                        onPriorityFilterChange={setPriorityFilter}
                    />
                </div>
            </div>

            {isProfileLoading && (
                <p className="text-sm text-gray-500">Đang tải thông tin tổ chức...</p>
            )}
            {!isProfileLoading && !organizationId && (
                <p className="text-sm text-red-500">Không tìm thấy thông tin tổ chức. Vui lòng kiểm tra tài khoản.</p>
            )}

            {isOrdersLoading && (
                <div className="text-center py-12">
                    <p className="text-gray-500">Đang tải đơn hàng...</p>
                </div>
            )}

            {!isOrdersLoading && orders.length === 0 && organizationId && (
                <div className="bg-white rounded-lg p-8 text-center">
                    <p className="text-gray-500 mb-4">Chưa có đơn hàng nào trong hệ thống.</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
                        <OrdersFilter
                            date={dateRange}
                            setDate={setDateRange}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            onCreateOrder={handleCreateOrder}
                            onPlanRoute={handlePlanRoute}
                        />
                        <OrdersTable
                            orders={currentOrders}
                            onOrderClick={(order) => setSelectedOrderIds([order.id])}
                            selectedOrderIds={selectedOrderIds}
                            onSelectionChange={setSelectedOrderIds}
                            onEdit={handleEditOrder}
                            onDelete={handleDeleteClick}
                            startIndex={indexOfFirstOrder}
                        />

                        {/* Pagination */}
                        {finalFilteredOrders.length > ordersPerPage && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                setCurrentPage={setCurrentPage}
                            />
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1 h-[400px] sm:h-[500px] lg:h-auto bg-white rounded-lg shadow-sm border p-1 lg:sticky lg:top-6">
                    <OrdersMap orders={finalFilteredOrders} selectedOrderIds={selectedOrderIds} />
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
