"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Pagination from "./Pagination";

interface PaginationClientProps {
    initialPage: number;
    totalPages: number;
    baseHref?: string; // e.g. '/news?page='
}

/**
 * Client-side wrapper around the existing `Pagination` component.
 * - Keeps local state for `currentPage` (required by Pagination).
 * - Navigates to `baseHref + page` when page changes, so the server page
 *   can fetch the corresponding data based on query params.
 */
export default function PaginationClient({
    initialPage,
    totalPages,
    baseHref = "/news?page=",
}: PaginationClientProps) {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState<number>(initialPage);

    // Keep local state in sync when server provides a different initial page
    useEffect(() => {
        setCurrentPage(initialPage);
    }, [initialPage]);

    // When user clicks to change the page, navigate to the new URL so the
    // server can re-render with the proper `searchParams` and fetch data.
    useEffect(() => {
        if (currentPage !== initialPage) {
            const href = `${baseHref}${currentPage}`;
            // push a new URL which will trigger a server render of the page
            router.push(href);
        }
        // We intentionally only depend on `currentPage` and `initialPage`.
        // `router` and `baseHref` are stable in this usage.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, initialPage]);

    return (
        <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
        />
    );
}
