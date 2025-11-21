"use client";

import { useEffect, useState, useCallback } from "react";

interface ScrollHeaderProps {
    children: React.ReactNode;
    className?: string;
    threshold?: number;
    hideOnScrollDown?: boolean;
    showOnScrollUp?: boolean;
    duration?: number;
    easing?: string;
}

export default function ScrollHeader({
    children,
    className = "",
    threshold = 10,
    hideOnScrollDown = true,
    showOnScrollUp = true,
    duration = 300,
    easing = "ease-in-out"
}: ScrollHeaderProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);

    const handleScroll = useCallback(() => {
        const currentScrollY = window.scrollY;

        setIsScrolling(true);

        // Logic để ẩn/hiện header
        if (hideOnScrollDown && currentScrollY > lastScrollY && currentScrollY > threshold) {
            // Scroll xuống và vượt quá threshold -> ẩn header
            setIsVisible(false);
        } else if (showOnScrollUp && (currentScrollY < lastScrollY || currentScrollY <= threshold)) {
            // Scroll lên hoặc ở gần đầu trang -> hiện header  
            setIsVisible(true);
        }

        setLastScrollY(currentScrollY);

        // Reset isScrolling sau 150ms không có scroll
        setTimeout(() => setIsScrolling(false), 150);
    }, [lastScrollY, threshold, hideOnScrollDown, showOnScrollUp]);

    useEffect(() => {
        // Throttle scroll event để tối ưu performance
        let timeoutId: NodeJS.Timeout;
        const throttledHandleScroll = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(handleScroll, 10);
        };

        window.addEventListener("scroll", throttledHandleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", throttledHandleScroll);
            clearTimeout(timeoutId);
        };
    }, [handleScroll]);

    return (
        <div
            className={`${className}`}
            style={{
                transform: isVisible ? "translateY(0)" : "translateY(-100%)",
                transition: `transform ${duration}ms ${easing}`,
                willChange: "transform", // Optimize for animations
            }}
        >
            {children}
        </div>
    );
}