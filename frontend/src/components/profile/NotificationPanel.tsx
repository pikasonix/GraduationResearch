"use client";

import React from "react";
import NotificationItem, { NotificationItemProps } from "./NotificationItem";

// MOCK DATA
const mockNotifications: NotificationItemProps[] = [
    {
        id: "1",
        status: "info",
        title: "Dự án của bạn đã được tải lên thành công",
        description: "Chúng tôi đã nhận được dự án của bạn. Hệ thống sẽ tiến hành duyệt trong vòng 24 giờ.",
        isUnread: true,
    },
    {
        id: "2",
        status: "success",
        title: "Dự án của bạn đã được duyệt",
        description: "Dự án đáp ứng đầy đủ tiêu chí cộng đồng và đã được xuất bản trên thư viện số.",
        isUnread: true,
    },
    {
        id: "3",
        status: "info",
        title: "Cập nhật trạng thái dự án",
        description: "Mô tả dự án đã được chỉnh sửa theo yêu cầu của ban biên tập.",
        isUnread: true,
    },
    {
        id: "4",
        status: "error",
        title: "Dự án của bạn chưa được duyệt",
        description: "Dự án bị từ chối do thiếu thông tin mô tả rõ ràng và tài liệu không đạt định dạng yêu cầu (PDF). Vui lòng chỉnh sửa và gửi lại.",
        isUnread: false,
    },
];

const NotificationPanel: React.FC = () => {
    const groupedNotifications: Record<string, NotificationItemProps[]> = {
        "Hôm nay": mockNotifications.slice(0, 4),
        "Ngày hôm qua": mockNotifications.slice(0, 4),
    };

    const unreadCount = mockNotifications.filter((n) => n.isUnread).length;

    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
            {/* Header */}
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 px-2">Thông báo</h2>

            {/* Summary */}
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="text-sm text-gray-600">Bạn có <span className="font-semibold">{unreadCount}</span> thông báo chưa đọc</div>
                <div>
                    <button className="text-sm text-blue-600 underline">Đánh dấu đã đọc</button>
                </div>
            </div>

            {/* Groups */}
            <div className="space-y-6">
                {Object.entries(groupedNotifications).map(([groupTitle, notifications]) => (
                    <div key={groupTitle}>
                        <p className="text-sm font-semibold text-gray-600 mb-2 px-2">{groupTitle}</p>
                        <div className="space-y-2">
                            {notifications.map((notification) => (
                                <NotificationItem key={notification.id} {...notification} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NotificationPanel;
