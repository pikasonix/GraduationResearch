"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Map as MapIcon, BookOpen, LucideIcon, Truck, BarChart3, ListTodo, Eye, Package, Activity, Settings } from "lucide-react";
import { getLinksForContext, UserRole } from "@/config/mapLinks";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import { useGetUserQuery } from "@/lib/redux/services/userApi";

// Map of available icons
const ICON_MAP: Record<string, LucideIcon> = {
    LayoutDashboard,
    PlusCircle,
    Map: MapIcon,
    BookOpen,
    Truck,
    BarChart3,
    ListTodo,
    Eye,
    Package,
    Activity,
    Settings
};

export default function MapHeader() {
    const pathname = usePathname() || "/";
    const { data: sessionData } = useGetSessionQuery();
    const userId = sessionData?.user?.id;
    
    // Get user role from database instead of user_metadata
    const { data: dbUser } = useGetUserQuery(userId ?? "", {
        skip: !userId,
    });

    const userRole = dbUser?.role as UserRole | undefined;

    const isMap = pathname.startsWith("/map") || pathname.startsWith("/dispatch") || pathname.startsWith("/route-details");
    const context = isMap ? "map" : "default";

    const links = getLinksForContext(context, userRole);

    if (links.length === 0) return null;

    return (
        <div className="hidden md:flex bg-gray-100/80 p-1 rounded-full border border-gray-200/50 backdrop-blur-sm">
            {links.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                const Icon = ICON_MAP[link.icon];

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`
                            flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap
                            ${isActive
                                ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                            }
                        `}
                    >
                        {Icon && <Icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />}
                        <span>{link.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
