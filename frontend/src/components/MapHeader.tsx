"use client"
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

export default function MapHeader({
    defaultLinks = [],
    mapLinks = [],
}: {
    defaultLinks?: NavLink[];
    mapLinks?: NavLink[];
}) {
    const pathname = usePathname() || "/";
    const isMap = pathname.startsWith("/map");

    const links = isMap && mapLinks.length > 0 ? mapLinks : defaultLinks;

    return (
        <div className="hidden md:flex ml-10 space-x-8">
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className="font-bold text-gray-700 hover:text-gray-900"
                >
                    {link.label}
                </Link>
            ))}
        </div>
    );
}
