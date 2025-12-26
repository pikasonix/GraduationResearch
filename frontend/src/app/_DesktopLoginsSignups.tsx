"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGetSessionQuery, useLogoutMutation } from "@/lib/redux/services/auth";
import { useGetUserQuery, useGetUserProfileOverviewQuery } from "@/lib/redux/services/userApi";
import { useGetOrdersQuery } from "@/lib/redux/services/orderApi";
import { User, LogOut, ChevronDown, PieChart, MessageSquare, Bell } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar } from "@/components/common/Avatar";
import { getAvatarUrl } from "@/lib/utils/avatar";

export const DesktopLoginsSignups: React.FC = () => {
    const { data, isLoading } = useGetSessionQuery();
    const [logout] = useLogoutMutation();
    const router = useRouter();

    const authUser = data?.user;
    const userId = authUser?.id;

    // Get user data from database
    const { data: dbUser } = useGetUserQuery(userId ?? "", {
        skip: !userId,
    });

    // Get user profile with organization info
    const { data: userProfile } = useGetUserProfileOverviewQuery(userId ?? "", {
        skip: !userId,
    });

    const organizationId = userProfile?.organization?.id ?? null;

    // Fetch orders for the organization
    const { data: orders = [] } = useGetOrdersQuery(
        { organizationId: organizationId ?? "", limit: 500 },
        { skip: !organizationId }
    );

    // Calculate today's orders count
    const todayOrdersCount = useMemo(() => {
        if (!orders || orders.length === 0) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return orders.filter((order) => {
            const orderDate = new Date(order.created_at);
            orderDate.setHours(0, 0, 0, 0);
            return orderDate.getTime() === today.getTime();
        }).length;
    }, [orders]);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    if (isLoading) return null;

    if (authUser) {
        // Display name or email
        const displayName = dbUser?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "User";
        const roleMap: Record<string, string> = {
            super_admin: "Super Admin",
            admin: "Quản trị viên",
            manager: "Quản lý",
            driver: "Tài xế",
            user: "Người dùng",
        };
        const role = roleMap[dbUser?.role || "user"] || "Người dùng";

        // Get avatar with priority: db avatar -> oauth avatar -> null (will show initials)
        const avatarUrl = getAvatarUrl(dbUser?.avatar_url, authUser.user_metadata?.avatar_url);

        return (
            <div className="flex items-center gap-3 lg:gap-4 xl:gap-6">
                {/* Stats Section */}
                <div className="hidden xl:flex items-center">
                    <span className="text-2xl font-bold text-gray-800 mr-2">{todayOrdersCount}</span>
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs text-gray-500 font-medium">Đơn hàng</span>
                        <span className="text-xs text-gray-500 font-medium">hôm nay</span>
                    </div>
                </div>

                {/* Icons Section - Hidden on smaller screens */}
                <div className="hidden xl:flex items-center gap-3 border-l border-r border-gray-200 px-3 h-8">
                    <button className="text-gray-500 hover:text-blue-600 transition-colors" aria-label="Statistics">
                        <PieChart size={20} strokeWidth={1.5} />
                    </button>
                    <button className="text-gray-500 hover:text-blue-600 transition-colors" aria-label="Messages">
                        <MessageSquare size={20} strokeWidth={1.5} />
                    </button>
                    <button className="text-gray-500 hover:text-blue-600 transition-colors relative" aria-label="Notifications">
                        <Bell size={20} strokeWidth={1.5} />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] flex items-center justify-center rounded-full">
                            1
                        </span>
                    </button>
                </div>

                {/* Profile Section */}
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 lg:gap-3 focus:outline-none group">
                            <Avatar
                                src={avatarUrl}
                                name={displayName}
                                size={32}
                                className="lg:w-9 lg:h-9 group-hover:ring-2 group-hover:ring-blue-200 transition-all"
                            />
                            <div className="hidden xl:flex flex-col items-start text-left mr-1">
                                <span className="text-sm font-bold text-gray-800 leading-none mb-1 truncate max-w-[120px]">
                                    {displayName}
                                </span>
                                <span className="text-xs text-gray-500 font-medium">
                                    {role}
                                </span>
                            </div>
                            <ChevronDown size={16} className="hidden lg:block text-gray-400 group-hover:text-gray-600" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-42 p-2 mt-3" align="end" side="bottom" sideOffset={8}>
                        <div className="grid gap-1">
                            <div className="px-2 py-1.5 text-sm font-semibold border-b border-gray-100 mb-1">
                                Tài khoản
                            </div>
                            <Link
                                href="/profile"
                                className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer"
                            >
                                <User size={16} />
                                <span>Hồ sơ cá nhân</span>
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 w-full px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                                <LogOut size={16} />
                                <span>Đăng xuất</span>
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 whitespace-nowrap">
                Đăng nhập
            </Link>
            <Link
                href="/signup"
                className="inline-block px-2.5 sm:px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
                Đăng ký
            </Link>
        </div>
    );
};

export default DesktopLoginsSignups;
