"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const RoutingMap = dynamic(() => import("@/components/routing/RoutingMap"), { ssr: false });

export default function MapboxPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Đang tải bản đồ...</div>}>
            <RoutingMap />
        </Suspense>
    );
}