"use client";

import React from "react";
import { Check, Upload } from "lucide-react";

// Định nghĩa kiểu cho props
export interface NotificationItemProps {
    id: string;
    status: "success" | "error" | "info";
    title: string;
    description: string;
    isUnread: boolean;
    onClick?: () => void;
}

const Exclamation: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={props.width ?? 16}
        height={props.height ?? 16}
        fill="currentColor"
        viewBox="0 0 16 16"
        {...props}
    >
        <path d="M7.001 4a1 1 0 1 1 2 0l-.002 4a1 1 0 0 1-2 0L7.001 4z" />
        <path d="M8 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
    </svg>
);

const statusConfig: Record<
    NotificationItemProps["status"],
    {
        Icon: React.FC<any> | React.ComponentType<any>;
        iconClass: string;
        borderClass: string;
        ringClass1: string;
        ringClass2: string;
    }
> = {
    success: {
        Icon: Check,
        iconClass: "text-green-500",
        borderClass: "border-green-600",
        ringClass1: "border-green-600/10",
        ringClass2: "border-green-600/30",
    },
    error: {
        Icon: Exclamation,
        iconClass: "text-red-500",
        borderClass: "border-red-600",
        ringClass1: "border-red-600/10",
        ringClass2: "border-red-600/30",
    },
    info: {
        Icon: Upload,
        iconClass: "text-blue-500",
        borderClass: "border-blue-600",
        ringClass1: "border-blue-600/10",
        ringClass2: "border-blue-600/30",
    },
};

const NotificationItem: React.FC<NotificationItemProps> = ({
    status,
    title,
    description,
    isUnread,
    onClick,
}) => {
    const config = statusConfig[status];

    return (
        <div
            onClick={onClick}
            className={`flex items-start gap-4 p-4 rounded-lg border-1 border-gray-300 cursor-pointer hover:bg-gray-50 ${isUnread
                    ? "shadow-[0_4px_6px_-2px_rgba(16,24,40,0.03),_0_12px_16px_-4px_rgba(16,24,40,0.08)]"
                    : ""
                }`}
        >
            {/* Icon */}
            <div
                className={`flex-shrink-0 w-10 h-10 rounded-md border ${config.borderClass} p-2 flex items-center justify-center ${config.iconClass}`}
            >
                <config.Icon width={18} height={18} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 line-clamp-1">{title}</p>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{description}</p>
            </div>

            {/* Unread */}
            {isUnread && <div className="flex-shrink-0 w-2.5 h-2.5 bg-red-200 rounded-full mt-1.5"></div>}
        </div>
    );
};

export default NotificationItem;
