"use client";

import { useEffect, useState, useCallback } from "react";

interface UseScrollDirectionOptions {
    threshold?: number;
    throttleDelay?: number;
}

export const useScrollDirection = ({
    threshold = 0,
    throttleDelay = 10
}: UseScrollDirectionOptions = {}) => {
    const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const [lastScrollY, setLastScrollY] = useState(0);

    const handleScroll = useCallback(() => {
        const currentScrollY = window.scrollY;
        setScrollY(currentScrollY);
        setIsScrolling(true);

        // Chỉ update direction nếu scroll vượt quá threshold
        if (Math.abs(currentScrollY - lastScrollY) > threshold) {
            if (currentScrollY > lastScrollY) {
                setScrollDirection('down');
            } else if (currentScrollY < lastScrollY) {
                setScrollDirection('up');
            }
            setLastScrollY(currentScrollY);
        }

        // Reset isScrolling sau 150ms
        const timeoutId = setTimeout(() => setIsScrolling(false), 150);
        return () => clearTimeout(timeoutId);
    }, [lastScrollY, threshold]);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const throttledHandleScroll = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(handleScroll, throttleDelay);
        };

        window.addEventListener("scroll", throttledHandleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", throttledHandleScroll);
            clearTimeout(timeoutId);
        };
    }, [handleScroll, throttleDelay]);

    return {
        scrollDirection,
        isScrolling,
        scrollY,
        isScrolledToTop: scrollY === 0,
        isScrollingDown: scrollDirection === 'down',
        isScrollingUp: scrollDirection === 'up'
    };
};