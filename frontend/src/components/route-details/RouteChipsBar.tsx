"use client";
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface RouteChipsBarProps {
    routes: { id: number | string; cost?: number }[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onOpenNewTab?: (id: number | string) => void;
    className?: string;
}

/* Responsive horizontal scroll bar with:
   - Mobile (<640px): hidden, replaced by native <select>
   - Desktop: scrollable chip list with fade edges + arrow buttons when overflow
*/
export const RouteChipsBar: React.FC<RouteChipsBarProps> = ({ routes, selectedId, onSelect, onOpenNewTab, className = '' }) => {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 8);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    }, []);

    useEffect(() => {
        updateScrollState();
        const el = scrollerRef.current;
        if (!el) return;
        const handler = () => updateScrollState();
        el.addEventListener('scroll', handler, { passive: true });
        window.addEventListener('resize', handler);
        return () => {
            el.removeEventListener('scroll', handler);
            window.removeEventListener('resize', handler);
        };
    }, [updateScrollState]);

    const scrollBy = (dir: number) => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * (el.clientWidth * 0.6), behavior: 'smooth' });
    };

    return (
        <div className={`relative hidden sm:block ${className}`}>
            {/* Fade overlays */}
            {canScrollLeft && <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-white to-transparent" />}
            {canScrollRight && <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent" />}
            {/* Arrow buttons */}
            {canScrollLeft && (
                <button aria-label="scroll left" onClick={() => scrollBy(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow rounded-full w-7 h-7 flex items-center justify-center text-gray-600 border border-gray-200">
                    <i className="fas fa-chevron-left text-xs" />
                </button>
            )}
            {canScrollRight && (
                <button aria-label="scroll right" onClick={() => scrollBy(1)} className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow rounded-full w-7 h-7 flex items-center justify-center text-gray-600 border border-gray-200">
                    <i className="fas fa-chevron-right text-xs" />
                </button>
            )}
            <div ref={scrollerRef} className="flex gap-2 overflow-x-auto no-scrollbar py-1 pr-2 pl-2 scrollbar-thin">
                {routes.length === 0 && <div className="p-2 text-xs text-gray-500">Không có route.</div>}
                {routes.map(r => {
                    const active = String(r.id) === String(selectedId);
                    return (
                        <div
                            key={r.id}
                            className={`flex items-center space-x-2 flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border cursor-pointer transition-colors select-none ${active ? 'bg-blue-100 border-blue-500 text-blue-600' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                            onClick={() => onSelect(String(r.id))}
                            title={r.cost ? `Cost: ${r.cost}` : ''}
                            onDoubleClick={() => onOpenNewTab?.(r.id)}
                        >
                            <span>Route #{r.id}</span>
                            {active && <i className="fas fa-check text-[10px]" />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RouteChipsBar;
