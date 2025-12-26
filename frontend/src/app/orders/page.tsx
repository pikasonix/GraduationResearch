"use client";

import React, { useState } from "react";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import { useGetUserProfileOverviewQuery, useUpdateOrganizationMutation } from "@/lib/redux/services/userApi";
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
import Pagination from "@/components/common/Pagination";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DEFAULT_DISPATCH_SETTINGS,
    normalizeDispatchSettings,
    type DispatchOrderStatus,
    type DispatchSettings,
} from "@/lib/dispatchSettings";

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMergePreserveUnknown(base: unknown, patch: unknown): unknown {
    if (Array.isArray(patch)) return patch.slice();
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch;

    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch)) {
        const existing = out[k];
        if (isPlainObject(existing) && isPlainObject(v)) {
            out[k] = deepMergePreserveUnknown(existing, v);
        } else if (Array.isArray(v)) {
            out[k] = v.slice();
        } else {
            out[k] = v;
        }
    }
    return out;
}

type DateRange = {
    from?: Date;
    to?: Date;
};

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
    const organization = userProfile?.organization ?? null;

    const [updateOrganization, { isLoading: isSavingDispatchSettings }] =
        useUpdateOrganizationMutation();

    const [dispatchSettingsOpen, setDispatchSettingsOpen] = useState(false);
    const [dispatchSettingsDraft, setDispatchSettingsDraft] = useState<DispatchSettings>(() =>
        normalizeDispatchSettings(organization?.dispatch_settings ?? DEFAULT_DISPATCH_SETTINGS)
    );

    React.useEffect(() => {
        setDispatchSettingsDraft(
            normalizeDispatchSettings(organization?.dispatch_settings ?? DEFAULT_DISPATCH_SETTINGS)
        );
    }, [organization?.dispatch_settings]);

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

    const toggleAllowedStatus = (status: DispatchOrderStatus) => {
        setDispatchSettingsDraft((prev) => {
            const exists = prev.allowed_statuses.includes(status);
            const nextAllowed = exists
                ? prev.allowed_statuses.filter((s) => s !== status)
                : [...prev.allowed_statuses, status];
            return { ...prev, allowed_statuses: nextAllowed };
        });
    };

    const handleSaveDispatchSettings = async () => {
        if (!organizationId) {
            toast.error("Chưa tải được thông tin tổ chức");
            return;
        }

        // IMPORTANT: Supabase update replaces the whole jsonb value.
        // Merge with current org settings to preserve unknown keys (future-proof & safer across tabs).
        const baseRaw = (organization?.dispatch_settings ?? {}) as unknown;
        const mergedRaw = deepMergePreserveUnknown(baseRaw, dispatchSettingsDraft) as unknown;
        const normalizedKnown = normalizeDispatchSettings(mergedRaw);
        const finalToSave = deepMergePreserveUnknown(mergedRaw, normalizedKnown) as unknown;
        try {
            await updateOrganization({
                id: organizationId,
                dispatch_settings: finalToSave as any,
            }).unwrap();
            toast.success("Đã lưu Dispatch Settings");
            setDispatchSettingsOpen(false);
        } catch (e: unknown) {
            console.error("Failed to save dispatch settings:", e);
            toast.error("Không thể lưu Dispatch Settings");
        }
    };

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
        } catch (error: unknown) {
            console.error('Error deleting order:', error);
            const message =
                typeof error === "object" &&
                    error !== null &&
                    "error" in error &&
                    typeof (error as { error?: unknown }).error === "string"
                    ? String((error as { error: string }).error)
                    : error instanceof Error
                        ? error.message
                        : 'Không thể xóa đơn hàng';
            toast.error(message);
        }
    };

    const handleFormSubmit = async (orderData: Partial<Order>) => {
        if (editingOrder) {
            await updateOrder({ id: editingOrder.id, ...orderData }).unwrap();
        } else {
            await createOrder(orderData).unwrap();
        }
    };

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

                <div className="flex flex-wrap items-stretch gap-3">
                    {/* Statistics - Charts first */}
                    <OrdersStats
                        orders={dateFilteredOrders}
                        statusFilter={statusFilter}
                        priorityFilter={priorityFilter}
                        onStatusFilterChange={setStatusFilter}
                        onPriorityFilterChange={setPriorityFilter}
                    />

                    {/* Dispatch Actions - Stacked vertically */}
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                        {/* Settings Card */}
                        <div
                            onClick={() => setDispatchSettingsOpen(true)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer transition-all hover:border-gray-300 hover:shadow-sm flex items-center gap-3 flex-1"
                        >
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-800">Cài đặt</span>
                                <span className="text-xs text-gray-500">Cấu hình điều phối</span>
                            </div>
                        </div>

                        {/* Go to Dispatch Card */}
                        <div
                            onClick={() => router.push("/orders/dispatch")}
                            className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-500 rounded-lg cursor-pointer transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-md flex items-center gap-3 flex-1"
                        >
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-white">Điều phối đơn</span>
                                <span className="text-xs text-blue-100">Bắt đầu dispatch</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isProfileLoading && (
                <p className="text-sm text-gray-500">Đang tải thông tin tổ chức...</p>
            )}
            {
                !isProfileLoading && !organizationId && (
                    <p className="text-sm text-red-500">Không tìm thấy thông tin tổ chức. Vui lòng kiểm tra tài khoản.</p>
                )
            }

            {
                isOrdersLoading && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">Đang tải đơn hàng...</p>
                    </div>
                )
            }

            {
                !isOrdersLoading && orders.length === 0 && organizationId && (
                    <div className="bg-white rounded-lg p-8 text-center">
                        <p className="text-gray-500 mb-4">Chưa có đơn hàng nào trong hệ thống.</p>
                    </div>
                )
            }

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
                        <OrdersFilter
                            date={dateRange}
                            setDate={setDateRange}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            onCreateOrder={handleCreateOrder}
                        />
                        <OrdersTable
                            orders={currentOrders}
                            allOrderIds={finalFilteredOrders.map(o => o.id)}
                            onOrderClick={(order) => setSelectedOrderIds([order.id])}
                            selectedOrderIds={selectedOrderIds}
                            onSelectionChange={setSelectedOrderIds}
                            onEdit={handleEditOrder}
                            onDelete={handleDeleteClick}
                            dispatchSettings={organization?.dispatch_settings ?? undefined}
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
                    <OrdersMap
                        orders={finalFilteredOrders}
                        selectedOrderIds={selectedOrderIds}
                        onOrderSelect={(orderId) => setSelectedOrderIds([orderId])}
                    />
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

            <Dialog open={dispatchSettingsOpen} onOpenChange={setDispatchSettingsOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Cài đặt điều phối</DialogTitle>
                        <DialogDescription>
                            Các cài đặt này được lưu theo tổ chức và sử dụng cho Điều phối.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-sm font-medium">Trạng thái được phép điều phối</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(
                                    [
                                        { key: "WAITING", label: "Đang chờ" },
                                        { key: "IN_TRANSIT", label: "Đang giao" },
                                        { key: "DISPATCHED", label: "Đã điều phối" },
                                        { key: "COMPLETED", label: "Hoàn thành" },
                                        { key: "CANCELLED", label: "Đã hủy" },
                                    ] as const
                                ).map((item) => (
                                    <label
                                        key={item.key}
                                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={dispatchSettingsDraft.allowed_statuses.includes(item.key)}
                                            onChange={() => toggleAllowedStatus(item.key)}
                                        />
                                        <span>{item.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm font-medium">Quy tắc động</div>
                            <div className="space-y-2">
                                <label className="flex items-center justify-between gap-3 text-sm rounded-md border px-3 py-2">
                                    <span>Khoảng tái tối ưu (phút)</span>
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        className="h-9 w-24 rounded-md border px-2 text-sm"
                                        value={dispatchSettingsDraft.dynamic.reopt_interval_minutes}
                                        onChange={(e) => {
                                            const raw = Number.parseInt(e.target.value, 10);
                                            const next = Number.isFinite(raw) && raw > 0 ? raw : 1;
                                            setDispatchSettingsDraft((prev) => ({
                                                ...prev,
                                                dynamic: { ...prev.dynamic, reopt_interval_minutes: next },
                                            }));
                                        }}
                                    />
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={dispatchSettingsDraft.dynamic.reopt_on_new_order}
                                        onChange={(e) =>
                                            setDispatchSettingsDraft((prev) => ({
                                                ...prev,
                                                dynamic: { ...prev.dynamic, reopt_on_new_order: e.target.checked },
                                            }))
                                        }
                                    />
                                    <span>Tái tối ưu khi có đơn mới</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={dispatchSettingsDraft.dynamic.reopt_on_delay}
                                        onChange={(e) =>
                                            setDispatchSettingsDraft((prev) => ({
                                                ...prev,
                                                dynamic: { ...prev.dynamic, reopt_on_delay: e.target.checked },
                                            }))
                                        }
                                    />
                                    <span>Tái tối ưu khi có delay</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={dispatchSettingsDraft.dynamic.reopt_on_cancellation}
                                        onChange={(e) =>
                                            setDispatchSettingsDraft((prev) => ({
                                                ...prev,
                                                dynamic: { ...prev.dynamic, reopt_on_cancellation: e.target.checked },
                                            }))
                                        }
                                    />
                                    <span>Tái tối ưu khi đơn bị hủy</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={dispatchSettingsDraft.dynamic.lock_completed}
                                        onChange={(e) =>
                                            setDispatchSettingsDraft((prev) => ({
                                                ...prev,
                                                dynamic: { ...prev.dynamic, lock_completed: e.target.checked },
                                            }))
                                        }
                                    />
                                    <span>Khóa tuyến đường đã hoàn thành</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={dispatchSettingsDraft.dynamic.allow_reorder}
                                        onChange={(e) =>
                                            setDispatchSettingsDraft((prev) => ({
                                                ...prev,
                                                dynamic: { ...prev.dynamic, allow_reorder: e.target.checked },
                                            }))
                                        }
                                    />
                                    <span>Cho phép sắp xếp lại điểm dừng</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={dispatchSettingsDraft.dynamic.allow_vehicle_change}
                                        onChange={(e) =>
                                            setDispatchSettingsDraft((prev) => ({
                                                ...prev,
                                                dynamic: {
                                                    ...prev.dynamic,
                                                    allow_vehicle_change: e.target.checked,
                                                },
                                            }))
                                        }
                                    />
                                    <span>Cho phép đổi xe sau khi điều phối</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDispatchSettingsOpen(false)}
                            disabled={isSavingDispatchSettings}
                        >
                            Hủy
                        </Button>
                        <Button onClick={handleSaveDispatchSettings} disabled={isSavingDispatchSettings}>
                            Lưu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
