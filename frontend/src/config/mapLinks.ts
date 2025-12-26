// Centralized navigation links configuration for navbar
import { LucideIcon } from "lucide-react";

export type UserRole = "super_admin" | "admin" | "manager" | "driver" | "user";

export type NavLinkContext = "default" | "map" | "all";

export interface NavLink {
    href: string;
    label: string;
    icon: string; // String key for icon mapping in components
    roles?: UserRole[]; // If undefined, accessible by all
    context?: NavLinkContext[]; // If undefined, accessible in all contexts
}

export const NAV_LINKS: NavLink[] = [
    // Dashboard / Map Pages
    // {
    //     href: "/map",
    //     label: "Dashboard",
    //     icon: "LayoutDashboard",
    //     context: ["default", "map"]
    // },
    {
        href: "/dispatch",
        label: "Điều phối",
        icon: "Map",
        roles: ["super_admin", "admin", "manager"],
        context: ["map"]
    },
    {
        href: "/route-details",
        label: "Chi tiết tuyến",
        icon: "Eye",
        roles: ["super_admin", "admin", "manager"],
        context: ["map"]
    },

    // Operations Pages
    // {
    //     href: "/add-instance",
    //     label: "Tạo Instance",
    //     icon: "PlusCircle",
    //     roles: ["super_admin", "admin", "manager"],
    //     context: ["default", "map"]
    // },
    {
        href: "/orders",
        label: "Đơn hàng",
        icon: "Package",
        context: ["default"]
    },
    {
        href: "/monitor",
        label: "Giám sát",
        icon: "Activity",
        roles: ["super_admin", "admin", "manager"],
        context: ["default"]
    },

    // Management Pages
    {
        href: "/fleet",
        label: "Quản lý Đội xe",
        icon: "Truck",
        roles: ["super_admin", "admin", "manager"],
        context: ["default"]
    },

    // Admin Pages
    {
        href: "/admin",
        label: "Quản trị",
        icon: "Settings",
        roles: ["super_admin", "admin"],
        context: ["default"]
    },
];

/**
 * Get navigation links filtered by context and user role
 * Managers see all their permitted links regardless of context
 */
export const getLinksForContext = (context: "map" | "default", role?: UserRole): NavLink[] => {
    return NAV_LINKS.filter(link => {
        // Filter by role first
        if (link.roles && link.roles.length > 0) {
            if (!role) return false; // Protected link but user not logged in
            if (!link.roles.includes(role)) return false; // User doesn't have required role
        }

        // Managers see all their permitted links on all screens
        if (role === "manager" || role === "admin" || role === "super_admin") {
            return true;
        }

        // For other roles, filter by context
        const linkContexts = link.context || ["default"];
        if (linkContexts.includes("all")) return true;
        return linkContexts.includes(context);
    });
};

// Backward compatibility
export default NAV_LINKS;
