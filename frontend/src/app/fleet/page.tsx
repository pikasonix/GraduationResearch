"use client";

import React from 'react';
import AdminCheck from '@/app/admin/_AdminCheck';
import FleetManagement from '@/components/fleet/FleetManagement';
import { ShieldAlert } from 'lucide-react';

export default function FleetPage() {
    return (
        // <AdminCheck
        //     fallback={
        //         <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        //             <div className="bg-red-50 p-4 rounded-full mb-4">
        //                 <ShieldAlert size={48} className="text-red-500" />
        //             </div>
        //             <h1 className="text-2xl font-bold text-gray-900 mb-2">Truy cập bị từ chối</h1>
        //             <p className="text-gray-600 max-w-md">
        //                 Bạn không có quyền truy cập vào trang quản lý đội xe (Manager/Admin Only).
        //                 Vui lòng liên hệ quản trị viên nếu bạn tin rằng đây là lỗi.
        //             </p>
        //         </div>
        //     }
        // >
        <FleetManagement />
        // </AdminCheck>
    );
}
