"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Map as MapIcon, BookOpen, LucideIcon, Truck, BarChart3, ListTodo, Eye } from "lucide-react";

// Map of available icons
const ICON_MAP: Record<string, LucideIcon> = {
    LayoutDashboard,
    PlusCircle,
    Map: MapIcon,
    BookOpen,
    Truck,
    BarChart3,
    ListTodo,
    Eye
};

export type NavLink = {
    href: string;
    label: string;
    icon?: string; // Changed from LucideIcon to string
};

export default function MapHeader({
    defaultLinks = [],
    mapLinks = [],
}: {
    defaultLinks?: NavLink[];
    mapLinks?: NavLink[];
}) {
    const pathname = usePathname() || "/";
    const isMap = pathname.startsWith("/map") || pathname.startsWith("/dispatch") || pathname.startsWith("/route-details");

    const links = isMap && mapLinks.length > 0 ? mapLinks : defaultLinks;

    return (
        <div className="hidden md:flex ml-6 bg-gray-100/80 p-1 rounded-full border border-gray-200/50 backdrop-blur-sm">
            {links.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                const Icon = link.icon ? ICON_MAP[link.icon] : null;

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`
                            flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
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
