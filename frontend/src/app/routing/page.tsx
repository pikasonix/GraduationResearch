"use client";

import dynamic from "next/dynamic";

const RoutingMap = dynamic(() => import("@/components/routing/RoutingMap"), { ssr: false });

export default function MapboxPage() {
    return <RoutingMap />;
}