import React, { useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface TimelineEvent {
    id: string;
    type: 'pickup' | 'delivery' | 'driving' | 'break' | 'depot';
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    status: 'completed' | 'in_progress' | 'pending' | 'delayed';
    label?: string;
    seqIndex?: number;
    serviceMinutes?: number;
    waitMinutes?: number;
    orderId?: string | null;
    orderInfo?: {
        tracking_number?: string;
        pickup_address?: string;
        delivery_address?: string;
        pickup_contact_name?: string;
        delivery_contact_name?: string;
        pickup_contact_phone?: string;
        delivery_contact_phone?: string;
        weight?: number;
        notes?: string;
    };
}

export interface DriverTimeline {
    driverId: string;
    driverName: string;
    vehiclePlate: string;
    events: TimelineEvent[];
    color?: string;
    orderCount?: number;
}

interface MonitorTimelineProps {
    timelines: DriverTimeline[];
    currentTime: string;
}

// SVG Icons
const PickupIcon = ({ color = "white", size = 12 }: { color?: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
);

const DeliveryIcon = ({ color = "white", size = 12 }: { color?: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
);

const DepotIcon = ({ color = "white", size = 12 }: { color?: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
);

const VehicleIcon = ({ color = "white", size = 14 }: { color?: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2L8 10h8L12 2zM12 22l4-8H8l4 8z"/>
    </svg>
);

const DRIVER_COL_WIDTH = 200;

// Order Detail Popup Component
const OrderDetailPopup = ({ event, onClose }: { event: TimelineEvent; onClose: () => void }) => {
    const info = event.orderInfo;
    const isPickup = event.type === 'pickup';
    const statusColor = event.status === 'completed' ? 'text-green-600' : 
                       event.status === 'in_progress' ? 'text-amber-600' : 'text-gray-600';
    const statusLabel = event.status === 'completed' ? 'Hoàn thành' :
                       event.status === 'in_progress' ? 'Đang thực hiện' : 'Chưa thực hiện';

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/30 z-[100]" 
                onClick={onClose}
            />
            
            {/* Popup */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[101] w-[500px] max-w-[90vw]">
                {/* Header */}
                <div className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-t-lg border-b",
                    isPickup ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"
                )}>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            isPickup ? "bg-blue-500" : "bg-red-500"
                        )}>
                            {isPickup ? <PickupIcon size={16} /> : <DeliveryIcon size={16} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">
                                {isPickup ? 'Lấy hàng' : 'Giao hàng'}
                            </h3>
                            <p className="text-sm text-gray-600">{event.startTime}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Status */}
                    <div className="flex items-center justify-between pb-3 border-b">
                        <span className="text-sm text-gray-600">Trạng thái:</span>
                        <span className={cn("text-sm font-semibold", statusColor)}>
                            {statusLabel}
                        </span>
                    </div>

                    {/* Order ID */}
                    {event.orderId && (
                        <div className="space-y-1">
                            <div className="text-xs text-gray-500 uppercase font-medium">Mã đơn hàng</div>
                            <div className="text-sm font-mono bg-gray-50 px-3 py-2 rounded border">
                                {event.orderId}
                            </div>
                        </div>
                    )}

                    {/* Tracking Number */}
                    {info?.tracking_number && (
                        <div className="space-y-1">
                            <div className="text-xs text-gray-500 uppercase font-medium">Mã vận đơn</div>
                            <div className="text-sm font-semibold text-gray-800">
                                {info.tracking_number}
                            </div>
                        </div>
                    )}

                    {/* Pickup Info */}
                    {info?.pickup_address && (
                        <div className="space-y-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                    <PickupIcon size={12} />
                                </div>
                                <div className="text-xs text-gray-500 uppercase font-medium">Điểm lấy hàng</div>
                            </div>
                            <div className="text-sm text-gray-800">{info.pickup_address}</div>
                            {info.pickup_contact_name && (
                                <div className="text-xs text-gray-600">
                                    <span className="font-medium">Người gửi:</span> {info.pickup_contact_name}
                                    {info.pickup_contact_phone && ` • ${info.pickup_contact_phone}`}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Delivery Info */}
                    {info?.delivery_address && (
                        <div className="space-y-2 bg-red-50 p-3 rounded-lg border border-red-100">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                                    <DeliveryIcon size={12} />
                                </div>
                                <div className="text-xs text-gray-500 uppercase font-medium">Điểm giao hàng</div>
                            </div>
                            <div className="text-sm text-gray-800">{info.delivery_address}</div>
                            {info.delivery_contact_name && (
                                <div className="text-xs text-gray-600">
                                    <span className="font-medium">Người nhận:</span> {info.delivery_contact_name}
                                    {info.delivery_contact_phone && ` • ${info.delivery_contact_phone}`}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Service Time */}
                    {event.serviceMinutes && event.serviceMinutes > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Thời gian phục vụ:</span>
                            <span className="font-semibold text-gray-800">{event.serviceMinutes} phút</span>
                        </div>
                    )}

                    {/* Wait Time */}
                    {event.waitMinutes && event.waitMinutes > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Thời gian chờ:</span>
                            <span className="font-semibold text-amber-600">{event.waitMinutes} phút</span>
                        </div>
                    )}

                    {/* Weight */}
                    {info?.weight && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Khối lượng:</span>
                            <span className="font-semibold text-gray-800">{info.weight} kg</span>
                        </div>
                    )}

                    {/* Notes */}
                    {info?.notes && (
                        <div className="space-y-1">
                            <div className="text-xs text-gray-500 uppercase font-medium">Ghi chú</div>
                            <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border">
                                {info.notes}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default function MonitorTimeline({ timelines, currentTime }: MonitorTimelineProps) {
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
    
    // Auto-calculate time range from data
    const { START_HOUR, TOTAL_HOURS } = React.useMemo(() => {
        if (timelines.length === 0) {
            return { START_HOUR: 0, TOTAL_HOURS: 24 };
        }
        
        let minHour = 24;
        let maxHour = 0;
        
        timelines.forEach(timeline => {
            timeline.events.forEach(event => {
                const [startH] = event.startTime.split(':').map(Number);
                const [endH] = event.endTime.split(':').map(Number);
                minHour = Math.min(minHour, startH, endH);
                maxHour = Math.max(maxHour, startH, endH);
            });
        });
        
        // Add padding
        const start = Math.max(0, Math.floor(minHour) - 1);
        const end = Math.min(24, Math.ceil(maxHour) + 2);
        const total = end - start;
        
        return { START_HOUR: start, TOTAL_HOURS: total };
    }, [timelines]);
    
    const TOTAL_MINUTES = TOTAL_HOURS * 60;
    const PX_PER_MINUTE = 12;
    const TIMELINE_WIDTH = TOTAL_MINUTES * PX_PER_MINUTE;

    const headerScrollRef = useRef<HTMLDivElement>(null);
    const contentScrollRef = useRef<HTMLDivElement>(null);
    const driverScrollRef = useRef<HTMLDivElement>(null);
    const isSyncingRef = useRef(false);

    const timeToPixels = (time: string): number => {
        const [h, m] = time.split(':').map(Number);
        const totalMinutes = (h - START_HOUR) * 60 + m;
        return Math.max(0, Math.min(TIMELINE_WIDTH, totalMinutes * PX_PER_MINUTE));
    };

    const minutesToPixels = (minutes: number): number => minutes * PX_PER_MINUTE;

    // Generate time markers every 10 minutes
    const timeMarkers10min: { hour: number; minute: number }[] = [];
    for (let h = START_HOUR; h <= START_HOUR + TOTAL_HOURS; h++) {
        for (let m = 0; m < 60; m += 10) {
            if (h === START_HOUR + TOTAL_HOURS && m > 0) break;
            timeMarkers10min.push({ hour: h, minute: m });
        }
    }

    const currentTimePx = timeToPixels(currentTime);

    // Sync horizontal scroll between header and content
    const handleHeaderScroll = useCallback(() => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        if (contentScrollRef.current && headerScrollRef.current) {
            contentScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
        }
        requestAnimationFrame(() => { isSyncingRef.current = false; });
    }, []);

    const handleContentScroll = useCallback(() => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        if (headerScrollRef.current && contentScrollRef.current) {
            headerScrollRef.current.scrollLeft = contentScrollRef.current.scrollLeft;
        }
        // Sync vertical scroll with driver column
        if (driverScrollRef.current && contentScrollRef.current) {
            driverScrollRef.current.scrollTop = contentScrollRef.current.scrollTop;
        }
        requestAnimationFrame(() => { isSyncingRef.current = false; });
    }, []);

    const handleDriverScroll = useCallback(() => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        if (contentScrollRef.current && driverScrollRef.current) {
            contentScrollRef.current.scrollTop = driverScrollRef.current.scrollTop;
        }
        requestAnimationFrame(() => { isSyncingRef.current = false; });
    }, []);

    return (
        <div className="bg-white border-t flex flex-col h-full overflow-hidden">
            {/* Header / Time Axis */}
            <div className="flex border-b bg-gray-50 h-8 shrink-0">
                {/* Fixed driver column header */}
                <div 
                    className="shrink-0 border-r px-2 flex items-center bg-gray-50 z-30"
                    style={{ width: DRIVER_COL_WIDTH }}
                >
                    <span className="text-gray-600 font-medium text-xs">Tài xế / Phương tiện</span>
                    <span className="text-gray-400 ml-auto text-xs">Đơn</span>
                </div>
                {/* Scrollable time header */}
                <div 
                    ref={headerScrollRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden"
                    onScroll={handleHeaderScroll}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <div className="h-full relative" style={{ width: TIMELINE_WIDTH }}>
                        {timeMarkers10min.map(({ hour, minute }) => {
                            const isHour = minute === 0;
                            const is30Min = minute === 30;
                            const totalMin = (hour - START_HOUR) * 60 + minute;
                            const px = totalMin * PX_PER_MINUTE;
                            return (
                                <div
                                    key={`header-${hour}:${minute}`}
                                    className={cn(
                                        "absolute top-0 bottom-0 flex items-center",
                                        isHour ? "border-l-2 border-gray-300" : is30Min ? "border-l border-gray-200" : "border-l border-gray-100"
                                    )}
                                    style={{ left: px }}
                                >
                                    {isHour && (
                                        <span className="pl-1.5 text-[11px] text-gray-600 font-semibold">{hour}:00</span>
                                    )}
                                    {is30Min && (
                                        <span className="pl-1 text-[9px] text-gray-400">{hour}:30</span>
                                    )}
                                </div>
                            );
                        })}
                        {/* Current Time indicator in header */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30"
                            style={{ left: currentTimePx }}
                        >
                            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap shadow">
                                {currentTime}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Fixed Driver Info Column */}
                <div 
                    ref={driverScrollRef}
                    className="shrink-0 overflow-y-auto overflow-x-hidden border-r bg-white z-20"
                    style={{ width: DRIVER_COL_WIDTH, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    onScroll={handleDriverScroll}
                >
                    {timelines.map((timeline) => {
                        const routeColor = timeline.color || '#3b82f6';
                        const stopEvents = timeline.events.filter(e => e.type !== 'driving');
                        
                        return (
                            <div 
                                key={`driver-${timeline.driverId}`} 
                                className="border-b px-2 py-2 flex items-start gap-2 hover:bg-blue-50/30"
                                style={{ height: 64 }}
                            >
                                {/* Route color indicator */}
                                <div 
                                    className="w-1.5 rounded-full shrink-0 self-stretch" 
                                    style={{ backgroundColor: routeColor }}
                                />
                                {/* Driver info */}
                                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                                    <div className="font-semibold text-gray-800 truncate text-xs leading-tight" title={timeline.driverName}>
                                        {timeline.driverName}
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-mono text-gray-600 border border-gray-200 leading-none">
                                            {timeline.vehiclePlate === '---' ? '---' : timeline.vehiclePlate}
                                        </span>
                                    </div>
                                    <span className="text-[9px] text-gray-400 leading-none">
                                        N°{timeline.driverId.slice(-6)}
                                    </span>
                                </div>
                                {/* Order count */}
                                <div className="flex flex-col items-center shrink-0">
                                    <div className="text-gray-700 font-bold text-base leading-tight">
                                        {timeline.orderCount || Math.floor(stopEvents.length / 2)}
                                    </div>
                                    <span className="text-[8px] text-gray-400">đơn</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Scrollable Timeline Content */}
                <div 
                    ref={contentScrollRef}
                    className="flex-1 overflow-auto bg-gray-50/30"
                    onScroll={handleContentScroll}
                >
                    <div style={{ width: TIMELINE_WIDTH }}>
                        {timelines.map((timeline) => {
                            const routeColor = timeline.color || '#3b82f6';
                            const stopEvents = timeline.events.filter(e => e.type !== 'driving');
                            const drivingEvents = timeline.events.filter(e => e.type === 'driving');
                            
                            const [currentHour, currentMin] = currentTime.split(':').map(Number);
                            const currentTotalMin = currentHour * 60 + currentMin;
                            
                            let vehiclePositionPx: number | null = null;
                            let vehicleStatus: 'driving' | 'at_stop' | 'idle' = 'idle';
                            
                            for (const evt of timeline.events) {
                                const [startH, startM] = evt.startTime.split(':').map(Number);
                                const [endH, endM] = evt.endTime.split(':').map(Number);
                                const evtStart = startH * 60 + startM;
                                const evtEnd = endH * 60 + endM;
                                
                                if (currentTotalMin >= evtStart && currentTotalMin <= evtEnd) {
                                    if (evt.type === 'driving') {
                                        const progress = (currentTotalMin - evtStart) / Math.max(1, evtEnd - evtStart);
                                        const startPx = timeToPixels(evt.startTime);
                                        const endPx = timeToPixels(evt.endTime);
                                        vehiclePositionPx = startPx + (endPx - startPx) * progress;
                                        vehicleStatus = 'driving';
                                    } else {
                                        vehiclePositionPx = timeToPixels(evt.startTime);
                                        vehicleStatus = 'at_stop';
                                    }
                                    break;
                                } else if (currentTotalMin < evtStart) {
                                    break;
                                } else {
                                    vehiclePositionPx = timeToPixels(evt.endTime);
                                }
                            }
                            
                            return (
                                <div 
                                    key={`timeline-${timeline.driverId}`} 
                                    className="relative border-b hover:bg-blue-50/20 flex items-center"
                                    style={{ height: 64, width: TIMELINE_WIDTH }}
                                >
                                    {/* Background grid */}
                                    {timeMarkers10min.map(({ hour, minute }) => {
                                        const isHour = minute === 0;
                                        const is30Min = minute === 30;
                                        const totalMin = (hour - START_HOUR) * 60 + minute;
                                        const px = totalMin * PX_PER_MINUTE;
                                        return (
                                            <div
                                                key={`grid-${timeline.driverId}-${hour}:${minute}`}
                                                className={cn(
                                                    "absolute top-0 bottom-0",
                                                    isHour ? "border-l border-gray-200/70" : is30Min ? "border-l border-gray-100/70" : "border-l border-gray-50"
                                                )}
                                                style={{ left: px }}
                                            />
                                        );
                                    })}

                                    {/* Driving segments */}
                                    {drivingEvents.map((event) => {
                                        const startPx = timeToPixels(event.startTime);
                                        const endPx = timeToPixels(event.endTime);
                                        const width = Math.max(2, endPx - startPx);
                                        const isCompleted = event.status === 'completed';
                                        const isInProgress = event.status === 'in_progress';
                                        
                                        return (
                                            <div
                                                key={event.id}
                                                className={cn(
                                                    "absolute top-1/2 -translate-y-1/2 h-[6px] rounded-full",
                                                    isCompleted ? "opacity-100" : isInProgress ? "opacity-80" : "opacity-40"
                                                )}
                                                style={{ 
                                                    left: startPx, 
                                                    width,
                                                    backgroundColor: routeColor,
                                                }}
                                                title={`Di chuyển: ${event.startTime} - ${event.endTime}`}
                                            />
                                        );
                                    })}

                                    {/* Stop markers */}
                                    {stopEvents.map((event) => {
                                        const startPx = timeToPixels(event.startTime);
                                        const isPickup = event.type === 'pickup';
                                        const isDelivery = event.type === 'delivery';
                                        const isDepot = event.type === 'depot';
                                        const isCompleted = event.status === 'completed';
                                        const isInProgress = event.status === 'in_progress';
                                        
                                        const serviceMin = event.serviceMinutes ?? 5;
                                        const serviceWidth = minutesToPixels(serviceMin);
                                        const waitMin = event.waitMinutes ?? 0;
                                        const waitWidth = minutesToPixels(waitMin);
                                        
                                        const stopColor = isDepot ? '#22c55e' : isPickup ? '#3b82f6' : '#ef4444';
                                        const bgColor = stopColor; // Always full color, no opacity
                                        
                                        return (
                                            <div key={event.id} className="absolute" style={{ left: startPx - 14, top: '50%', transform: 'translateY(-50%)' }}>
                                                {/* Wait time bar */}
                                                {waitMin > 0 && (
                                                    <div
                                                        className="absolute top-1/2 -translate-y-1/2 h-[4px] rounded-l-full"
                                                        style={{
                                                            left: 14 - waitWidth,
                                                            width: waitWidth,
                                                            backgroundColor: '#fbbf24',
                                                        }}
                                                        title={`Chờ: ${waitMin} phút`}
                                                    />
                                                )}
                                                
                                                {/* Service time bar */}
                                                {serviceMin > 0 && !isDepot && (
                                                    <div
                                                        className="absolute top-1/2 -translate-y-1/2 h-[8px] rounded-r-full flex items-center"
                                                        style={{
                                                            left: 28,
                                                            width: serviceWidth,
                                                            backgroundColor: isPickup ? '#dbeafe' : '#fee2e2',
                                                            border: `1px solid ${isPickup ? '#3b82f6' : '#ef4444'}`,
                                                        }}
                                                        title={`Phục vụ: ${serviceMin} phút`}
                                                    >
                                                        <span className="text-[7px] px-1 font-medium" style={{ color: isPickup ? '#1e40af' : '#991b1b' }}>
                                                            {serviceMin}m
                                                        </span>
                                                    </div>
                                                )}
                                                
                                                {/* Stop marker icon */}
                                                <div
                                                    className={cn(
                                                        "relative rounded-full flex items-center justify-center z-10 cursor-pointer hover:scale-110 transition-all",
                                                        isCompleted ? "ring-2 ring-green-400 ring-offset-1" : "",
                                                        isInProgress ? "ring-2 ring-amber-400 ring-offset-1 animate-pulse" : ""
                                                    )}
                                                    style={{ 
                                                        width: 28,
                                                        height: 28,
                                                        backgroundColor: bgColor,
                                                        border: '2.5px solid white',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                    }}
                                                    title={`${event.startTime} - ${event.label || event.type}${serviceMin ? ` (${serviceMin}m)` : ''}`}
                                                    onClick={() => {
                                                        if (!isDepot && (isPickup || isDelivery)) {
                                                            setSelectedEvent(event);
                                                        }
                                                    }}
                                                >
                                                    {isPickup && <PickupIcon size={14} />}
                                                    {isDelivery && <DeliveryIcon size={14} />}
                                                    {isDepot && <DepotIcon size={12} />}
                                                    
                                                    {!isDepot && event.seqIndex !== undefined && (
                                                        <div 
                                                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                                                            style={{ backgroundColor: 'white', color: stopColor, border: `1.5px solid ${stopColor}` }}
                                                        >
                                                            {event.seqIndex}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Time label */}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 text-[8px] text-gray-500 font-medium whitespace-nowrap">
                                                    {event.startTime}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Vehicle position marker */}
                                    {vehiclePositionPx !== null && (
                                        <div
                                            className="absolute z-20"
                                            style={{ 
                                                left: vehiclePositionPx - 12,
                                                top: '50%',
                                                transform: 'translateY(-50%)'
                                            }}
                                        >
                                            <div 
                                                className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center shadow-lg",
                                                    vehicleStatus === 'driving' ? "animate-pulse" : ""
                                                )}
                                                style={{ 
                                                    backgroundColor: routeColor,
                                                    border: '2px solid white',
                                                    boxShadow: `0 0 0 2px ${routeColor}, 0 2px 8px rgba(0,0,0,0.3)`,
                                                }}
                                                title={`Vị trí hiện tại - ${vehicleStatus === 'driving' ? 'Đang di chuyển' : 'Đang dừng'}`}
                                            >
                                                <VehicleIcon size={12} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Current time line */}
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                                        style={{ left: currentTimePx }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            
            {/* Legend */}
            <div className="shrink-0 border-t bg-white px-3 py-1.5 flex items-center gap-4 text-[10px] text-gray-600">
                <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><PickupIcon size={10} /></div>
                    <span>Lấy hàng</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><DeliveryIcon size={10} /></div>
                    <span>Giao hàng</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"><DepotIcon size={10} /></div>
                    <span>Kho</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-full bg-amber-300 border border-amber-500"></div>
                    <span>Chờ</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-2 rounded bg-blue-100 border border-blue-400"></div>
                    <span>Phục vụ</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                    <div className="w-0.5 h-4 bg-red-500"></div>
                    <span>Thời gian hiện tại</span>
                </div>
            </div>
            
            {/* Order Detail Popup */}
            {selectedEvent && (
                <OrderDetailPopup 
                    event={selectedEvent} 
                    onClose={() => setSelectedEvent(null)} 
                />
            )}
        </div>
    );
}

