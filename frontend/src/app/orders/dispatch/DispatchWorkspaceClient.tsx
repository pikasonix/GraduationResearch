"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useGetSessionQuery } from "@/lib/redux/services/auth";
import { useGetUserProfileOverviewQuery } from "@/lib/redux/services/userApi";
import {
  useGetOrdersQuery,
  useUpdateOrderMutation,
  type Order,
} from "@/lib/redux/services/orderApi";
import { buildSartoriPdptwInstance } from "@/utils/pdptw/sartoriInstance";
import { solverService } from "@/services/solverService";
import type { ReoptimizationContext } from "@/services/solverService";
import { buildVehicleStatesForRouting } from "@/services/vehicleStateService";
import { supabase } from "@/supabase/client";
import {
  DEFAULT_DISPATCH_SETTINGS,
  normalizeDispatchSettings,
  type DispatchOrderStatus,
  type DispatchSettings,
} from "@/lib/dispatchSettings";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SolverParametersForm } from "@/components/map/SolverParametersForm";
import {
  ArrowLeft,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Clock,
  Truck,
  Lock,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  Zap,
  ChevronRight,
  Plus
} from "lucide-react";

type DispatchMode = "static" | "dynamic";

// Routing State enum
type RoutingState = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "REMOVED";

// Lock State enum
type LockState = "LOCKED" | "REOPTIMIZABLE";

// Event Type enum
type EventType =
  | "OPTIMIZATION_RUN"
  | "RE_OPTIMIZATION"
  | "ORDER_ADDED"
  | "ORDER_REMOVED"
  | "ORDER_REASSIGNED"
  | "VEHICLE_AFFECTED"
  | "ROUTE_LOCKED";

interface RoutingEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  trigger?: string;
  summary: string;
  details?: string[];
}

interface OrderInScope {
  id: string;
  orderId: string;
  trackingNumber: string;
  status: string;
  routingState: RoutingState;
  assignedVehicle: string | null;
  lockState: LockState;
  isInRouting: boolean;
  pickupAddress: string;
  deliveryAddress: string;
  pickupTimeStart?: string;
  pickupTimeEnd?: string;
  deliveryTimeStart?: string;
  deliveryTimeEnd?: string;
}

const STATUS_LABELS: Record<DispatchOrderStatus, string> = {
  WAITING: "Đang chờ",
  IN_TRANSIT: "Đang giao",
  DISPATCHED: "Đã điều phối",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const ROUTING_STATE_LABELS: Record<RoutingState, string> = {
  PENDING: "Chờ xử lý",
  ASSIGNED: "Đã gán",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  REMOVED: "Đã xóa",
};

const EVENT_TYPE_LABELS: Record<EventType, { label: string; icon: React.ReactNode; color: string }> = {
  OPTIMIZATION_RUN: { label: "Tối ưu hóa", icon: <Zap className="w-4 h-4" />, color: "text-blue-600 bg-blue-50" },
  RE_OPTIMIZATION: { label: "Tái tối ưu", icon: <RefreshCw className="w-4 h-4" />, color: "text-purple-600 bg-purple-50" },
  ORDER_ADDED: { label: "Thêm đơn", icon: <Package className="w-4 h-4" />, color: "text-green-600 bg-green-50" },
  ORDER_REMOVED: { label: "Xóa đơn", icon: <XCircle className="w-4 h-4" />, color: "text-red-600 bg-red-50" },
  ORDER_REASSIGNED: { label: "Chuyển đơn", icon: <ArrowRightLeft className="w-4 h-4" />, color: "text-orange-600 bg-orange-50" },
  VEHICLE_AFFECTED: { label: "Xe bị ảnh hưởng", icon: <Truck className="w-4 h-4" />, color: "text-amber-600 bg-amber-50" },
  ROUTE_LOCKED: { label: "Khóa tuyến", icon: <Lock className="w-4 h-4" />, color: "text-gray-600 bg-gray-100" },
};

type DynamicOverride = Partial<DispatchSettings["dynamic"]>;

const DYNAMIC_OVERRIDE_KEY = "dispatch_dynamic_override";

function readDynamicOverrideFromSessionStorage(): DynamicOverride | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DYNAMIC_OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as DynamicOverride;
  } catch {
    return null;
  }
}

export function DispatchWorkspaceClient() {
  const router = useRouter();

  const { data: sessionData } = useGetSessionQuery();
  const userId = sessionData?.session?.user?.id;

  const { data: userProfile, isLoading: isProfileLoading } =
    useGetUserProfileOverviewQuery(userId ?? "", { skip: !userId });

  const organizationId = userProfile?.organization?.id ?? null;
  const organization = userProfile?.organization ?? null;

  const dispatchSessionStorageKey = useMemo(() => {
    if (!organizationId) return null;
    return `dispatch:session:${organizationId}`;
  }, [organizationId]);

  const dispatchSettings = useMemo(() => {
    return normalizeDispatchSettings(
      organization?.dispatch_settings ?? DEFAULT_DISPATCH_SETTINGS
    );
  }, [organization?.dispatch_settings]);

  // State
  const [mode, setMode] = useState<DispatchMode>("static");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [lastSolveAtMs, setLastSolveAtMs] = useState<number | null>(null);
  const autoStartRef = useRef(false);

  const inFlightRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const justStartedRef = useRef(false);

  // Orders in routing (for dynamic mode)
  const [ordersInRouting, setOrdersInRouting] = useState<Set<string>>(new Set());

  const ordersInRoutingStorageKey = useMemo(() => {
    if (!organizationId) return null;
    return `dispatch:ordersInRouting:${organizationId}:${mode}`;
  }, [organizationId, mode]);

  useEffect(() => {
    if (!ordersInRoutingStorageKey) return;
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(ordersInRoutingStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const ids = parsed.map(String).filter(Boolean);
      setOrdersInRouting(new Set(ids));
    } catch {
      // ignore
    }
  }, [ordersInRoutingStorageKey]);

  useEffect(() => {
    if (!ordersInRoutingStorageKey) return;
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(ordersInRoutingStorageKey, JSON.stringify(Array.from(ordersInRouting)));
    } catch {
      // ignore
    }
  }, [ordersInRouting, ordersInRoutingStorageKey]);

  // Dynamic settings: org defaults + optional session override
  const [dynamicOverride, setDynamicOverride] = useState<DynamicOverride | null>(() =>
    readDynamicOverrideFromSessionStorage()
  );

  // Solver parameters state
  const [solverParams, setSolverParams] = useState({
    iterations: 100000,
    max_non_improving: 20000,
    time_limit: 60,
    acceptance: 'rtr' as 'sa' | 'rtr' | 'greedy',
    min_destroy: 0.1,
    max_destroy: 0.4,
    seed: 42,
    format: 'sartori' as 'lilim' | 'sartori',
  });
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showParams, setShowParams] = useState(false);

  const handleParamChange = useCallback((name: string, value: any) => {
    setSolverParams(prev => ({ ...prev, [name]: value }));
  }, []);

  const resetParameters = useCallback(() => {
    setSolverParams({
      iterations: 100000,
      max_non_improving: 20000,
      time_limit: 60,
      acceptance: 'rtr',
      min_destroy: 0.1,
      max_destroy: 0.4,
      seed: 42,
      format: 'sartori',
    });
  }, []);

  const effectiveDynamic = useMemo(() => {
    return {
      ...dispatchSettings.dynamic,
      ...(dynamicOverride ?? {}),
    };
  }, [dispatchSettings.dynamic, dynamicOverride]);

  const reoptIntervalMinutes = effectiveDynamic.reopt_interval_minutes;
  const reoptOnNewOrder = effectiveDynamic.reopt_on_new_order;
  const reoptOnDelay = effectiveDynamic.reopt_on_delay;
  const reoptOnCancellation = effectiveDynamic.reopt_on_cancellation;

  const [latestSolutionId, setLatestSolutionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("lastSolutionId");
  });
  const [isSolving, setIsSolving] = useState(false);

  useEffect(() => {
    if (!dispatchSessionStorageKey) return;
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(dispatchSessionStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      if (parsed.mode === "static" || parsed.mode === "dynamic") {
        setMode(parsed.mode);
      }
      if (typeof parsed.isRunning === "boolean") setIsRunning(parsed.isRunning);
      if (typeof parsed.isPaused === "boolean") setIsPaused(parsed.isPaused);

      const n = Number(parsed.lastSolveAtMs);
      if (Number.isFinite(n) && n > 0) setLastSolveAtMs(n);

      if (typeof parsed.latestSolutionId === "string" && parsed.latestSolutionId.trim()) {
        setLatestSolutionId(parsed.latestSolutionId);
        try {
          localStorage.setItem("lastSolutionId", parsed.latestSolutionId);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchSessionStorageKey]);

  useEffect(() => {
    if (!dispatchSessionStorageKey) return;
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(
        dispatchSessionStorageKey,
        JSON.stringify({
          mode,
          isRunning,
          isPaused,
          latestSolutionId,
          lastSolveAtMs,
        })
      );
    } catch {
      // ignore
    }
  }, [dispatchSessionStorageKey, isPaused, isRunning, lastSolveAtMs, latestSolutionId, mode]);

  const [updateOrder] = useUpdateOrderMutation();

  // Events log
  const [localEvents, setLocalEvents] = useState<RoutingEvent[]>([]);
  const [dbEvents, setDbEvents] = useState<RoutingEvent[]>([]);

  const events = useMemo(() => {
    const merged = [...dbEvents, ...localEvents];
    merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return merged;
  }, [dbEvents, localEvents]);

  const loadRouteEventsFromDb = useCallback(
    async (opts: { solutionId: string; organizationId: string }) => {
      const formatSbError = (err: any) => {
        if (!err) return null;
        return {
          message: err.message,
          details: err.details,
          hint: err.hint,
          code: err.code,
          status: err.status,
          name: err.name,
        };
      };

      const toEventType = (row: any): EventType => {
        const kind = row?.metadata?.kind;
        if (kind === "optimization") {
          const reason = row?.metadata?.reason;
          return reason === "PERIODIC" ? "RE_OPTIMIZATION" : "OPTIMIZATION_RUN";
        }

        switch (row?.event_type) {
          case "delay":
          case "traffic_jam":
          case "vehicle_breakdown":
          case "route_deviation":
          case "emergency":
          case "customer_unavailable":
            return "VEHICLE_AFFECTED";
          case "other":
          default:
            return "OPTIMIZATION_RUN";
        }
      };

      try {
        // Load route ids for the given solution.
        let routeIds: string[] = [];
        let lastRoutesErr: any = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          const { data: dbRoutes, error: routesErr } = await supabase
            .from("routes")
            .select("id")
            .eq("solution_id", opts.solutionId)
            .eq("organization_id", opts.organizationId);

          lastRoutesErr = routesErr ?? null;
          routeIds = (dbRoutes ?? []).map((r: any) => r?.id).filter(Boolean) as string[];
          if (routeIds.length > 0) break;

          await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
        }

        if (lastRoutesErr) {
          console.warn("Failed to load routes for route_events select:", formatSbError(lastRoutesErr));
          return;
        }

        if (routeIds.length === 0) {
          return;
        }

        const { data: dbEvents, error: eventsErr } = await supabase
          .from("route_events")
          .select("id, route_id, event_type, severity, title, description, metadata, reported_at")
          .in("route_id", routeIds)
          .order("reported_at", { ascending: false })
          .limit(200);

        if (eventsErr) {
          console.warn("Failed to load route_events:", formatSbError(eventsErr));
          return;
        }

        const mapped: RoutingEvent[] = (dbEvents ?? []).map((row: any) => {
          const reportedAt = row?.reported_at ? new Date(row.reported_at) : new Date();
          const timestamp = Number.isNaN(reportedAt.getTime()) ? new Date() : reportedAt;
          const details: string[] = [];
          if (row?.description) details.push(String(row.description));
          if (row?.severity) details.push(`severity: ${String(row.severity)}`);
          const routeIdShort = row?.route_id ? String(row.route_id).slice(0, 8) : null;
          if (routeIdShort) details.push(`routeId: ${routeIdShort}`);
          if (row?.metadata?.reason) details.push(`reason: ${String(row.metadata.reason)}`);
          if (row?.metadata?.persisted != null) details.push(`persisted: ${row.metadata.persisted ? "yes" : "no"}`);
          if (row?.metadata?.orderCount != null) details.push(`orderCount: ${String(row.metadata.orderCount)}`);
          if (row?.metadata?.solutionId) details.push(`solutionId: ${String(row.metadata.solutionId)}`);

          const title = String(row?.title ?? "Route event");
          const summary = routeIdShort ? `${title} (route ${routeIdShort})` : title;

          return {
            id: String(row.id),
            timestamp,
            type: toEventType(row),
            trigger: row?.metadata?.reason ? String(row.metadata.reason) : undefined,
            summary,
            details: details.length > 0 ? details : undefined,
          };
        });

        // Keep DB events exact so UI matches Supabase (avoid local/DB duplication).
        setDbEvents(mapped);
      } catch (e) {
        console.warn("loadRouteEventsFromDb failed:", e);
      }
    },
    []
  );

  useEffect(() => {
    if (!organizationId) return;
    const sid =
      latestSolutionId ?? (typeof window !== "undefined" ? localStorage.getItem("lastSolutionId") : null);
    if (!sid) return;
    (async () => {
      await loadRouteEventsFromDb({ solutionId: sid, organizationId });
    })().catch(() => {
      // ignore
    });
  }, [latestSolutionId, loadRouteEventsFromDb, organizationId]);

  const persistOptimizationEventsToDb = useCallback(
    async (opts: {
      solutionId: string;
      organizationId: string;
      reportedByAuthUserId: string;
      reason: "PERIODIC" | "MANUAL" | "START";
      persisted: boolean;
      depotLat: number;
      depotLng: number;
      orderCount: number;
    }) => {
      try {
        const formatSbError = (err: any) => {
          if (!err) return null;
          return {
            message: err.message,
            details: err.details,
            hint: err.hint,
            code: err.code,
            status: err.status,
            name: err.name,
          };
        };

        // Newly persisted routes may not be immediately visible depending on client cache/replication.
        let routeIds: string[] = [];
        let lastRoutesErr: any = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          const { data: dbRoutes, error: routesErr } = await supabase
            .from("routes")
            .select("id")
            .eq("solution_id", opts.solutionId)
            .eq("organization_id", opts.organizationId);

          lastRoutesErr = routesErr ?? null;
          routeIds = (dbRoutes ?? []).map((r: any) => r?.id).filter(Boolean) as string[];
          if (routeIds.length > 0) break;

          // wait a bit before retry
          await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
        }

        if (lastRoutesErr) {
          console.warn("Failed to load routes for route_events insert:", formatSbError(lastRoutesErr));
          return;
        }

        if (routeIds.length === 0) {
          console.warn("No routes found for solution; skipping route_events insert", {
            solutionId: opts.solutionId,
            organizationId: opts.organizationId,
          });
          return;
        }

        const isReopt = opts.reason === "PERIODIC";
        const title = isReopt ? "Re-optimization" : "Optimization run";
        const description = isReopt
          ? `Periodic re-optimization for ${opts.orderCount} orders.`
          : `Optimization run for ${opts.orderCount} orders.`;

        const rows = routeIds.map((routeId) => ({
          route_id: routeId,
          event_type: "other" as const,
          severity: "info",
          title,
          description,
          latitude: opts.depotLat,
          longitude: opts.depotLng,
          metadata: {
            kind: "optimization",
            reason: opts.reason,
            solutionId: opts.solutionId,
            persisted: opts.persisted,
            orderCount: opts.orderCount,
            reportedByAuthUserId: opts.reportedByAuthUserId,
          },
        }));

        const { error: insertErr } = await supabase.from("route_events").insert(rows);
        if (insertErr) {
          console.warn("Failed to insert route_events:", {
            error: formatSbError(insertErr),
            solutionId: opts.solutionId,
            organizationId: opts.organizationId,
            routeCount: routeIds.length,
          });
          return;
        }

        console.info("Inserted route_events", {
          solutionId: opts.solutionId,
          organizationId: opts.organizationId,
          routeCount: routeIds.length,
        });
      } catch (e) {
        console.warn("persistOptimizationEventsToDb failed:", e);
      }
    },
    []
  );

  // Orders
  const { data: orders = [], isLoading: isOrdersLoading } = useGetOrdersQuery(
    {
      organizationId: organizationId ?? "",
    },
    { skip: !organizationId }
  );

  // Helper to map order status to dispatch category
  const getDispatchCategory = (status: string): DispatchOrderStatus => {
    switch (status) {
      case "pending":
        return "WAITING";
      case "in_transit":
      case "picked_up":
        return "IN_TRANSIT";
      case "assigned":
        return "DISPATCHED";
      case "delivered":
        return "COMPLETED";
      case "failed":
      case "cancelled":
      default:
        return "CANCELLED";
    }
  };

  // Filter orders based on dispatch settings
  const allEligibleOrders = useMemo(() => {
    return orders
      .filter(order => {
        const dispatchCategory = getDispatchCategory(order.status);
        return dispatchSettings.allowed_statuses.includes(dispatchCategory);
      })
      .map((order): OrderInScope => ({
        id: order.id,
        orderId: order.tracking_number || order.id.slice(0, 8),
        trackingNumber: order.tracking_number || order.id.slice(0, 8),
        status: order.status,
        routingState: order.status === "assigned" ? "ASSIGNED" :
          order.status === "in_transit" ? "IN_PROGRESS" :
            order.status === "delivered" ? "COMPLETED" : "PENDING",
        assignedVehicle: null,
        lockState: order.status === "delivered" || order.status === "in_transit" ? "LOCKED" : "REOPTIMIZABLE",
        isInRouting: ordersInRouting.has(order.id),
        pickupAddress: order.pickup_address || "",
        deliveryAddress: order.delivery_address || "",
        pickupTimeStart: order.pickup_time_start,
        pickupTimeEnd: order.pickup_time_end,
        deliveryTimeStart: order.delivery_time_start,
        deliveryTimeEnd: order.delivery_time_end,
      }));
  }, [orders, dispatchSettings.allowed_statuses, ordersInRouting]);

  // Split orders for dynamic mode
  const ordersBeingRouted = useMemo(() =>
    allEligibleOrders.filter(o => o.isInRouting),
    [allEligibleOrders]
  );

  const availableOrders = useMemo(() =>
    allEligibleOrders.filter(o => !o.isInRouting),
    [allEligibleOrders]
  );

  // Statistics
  const stats = useMemo(() => ({
    ordersInScope: mode === "dynamic" ? ordersBeingRouted.length : allEligibleOrders.length,
    totalEligible: allEligibleOrders.length,
    activeVehicles: new Set(allEligibleOrders.filter(o => o.assignedVehicle).map(o => o.assignedVehicle)).size,
    lockedOrders: allEligibleOrders.filter(o => o.lockState === "LOCKED").length,
    reoptimizations: events.filter(e => e.type === "RE_OPTIMIZATION").length,
  }), [allEligibleOrders, ordersBeingRouted, events, mode]);

  // Handlers
  const handleAddToRouting = useCallback((orderId: string) => {
    setOrdersInRouting(prev => new Set([...prev, orderId]));
    const order = allEligibleOrders.find(o => o.id === orderId);
    if (order) {
      const newEvent: RoutingEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: "ORDER_ADDED",
        summary: `Đơn ${order.orderId} được thêm vào định tuyến.`,
      };
      setLocalEvents(prev => [newEvent, ...prev]);
    }
  }, [allEligibleOrders]);

  const handleRemoveFromRouting = useCallback((orderId: string) => {
    setOrdersInRouting(prev => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
    const order = allEligibleOrders.find(o => o.id === orderId);
    if (order) {
      const newEvent: RoutingEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: "ORDER_REMOVED",
        summary: `Đơn ${order.orderId} được xóa khỏi định tuyến.`,
      };
      setLocalEvents(prev => [newEvent, ...prev]);
    }
  }, [allEligibleOrders]);

  const handleAddAllToRouting = useCallback(() => {
    const newIds = availableOrders.map(o => o.id);
    setOrdersInRouting(prev => new Set([...prev, ...newIds]));
    const newEvent: RoutingEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: "ORDER_ADDED",
      summary: `Đã thêm ${newIds.length} đơn vào định tuyến.`,
    };
    setLocalEvents(prev => [newEvent, ...prev]);
  }, [availableOrders]);

  const clearSessionOverride = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(DYNAMIC_OVERRIDE_KEY);
    } catch {
      // ignore
    }
    setDynamicOverride(null);
  }, []);

  const runDynamicSolve = useCallback(
    async (reason: "PERIODIC" | "MANUAL" | "START") => {
      if (mode !== "dynamic") return;
      if (!organizationId) {
        toast.error("Chưa tải được thông tin tổ chức");
        return;
      }
      if (!userId) {
        toast.error("Chưa tải được thông tin người dùng");
        return;
      }
      if (ordersBeingRouted.length === 0) {
        toast.error("Chưa có đơn nào trong định tuyến");
        return;
      }

      if (inFlightRef.current) {
        toast.info("Đang chạy solver, vui lòng chờ...");
        return;
      }

      const depotLat = organization?.depot_latitude ?? null;
      const depotLng = organization?.depot_longitude ?? null;
      if (depotLat == null || depotLng == null) {
        toast.error("Vui lòng nhập depot (tọa độ) trong Thông tin tài khoản trước");
        router.push("/profile");
        return;
      }

      const orderById = new Map<string, Order>();
      for (const o of orders) orderById.set(o.id, o);
      const selectedOrders: Order[] = ordersBeingRouted
        .map((o) => orderById.get(o.id))
        .filter((o): o is Order => Boolean(o));

      if (selectedOrders.length === 0) {
        toast.error("Không tìm thấy dữ liệu đơn hàng để tạo instance");
        return;
      }

      const asNum = (v: unknown) => Number(v);
      const isFiniteNum = (v: unknown) => Number.isFinite(asNum(v));
      for (const o of selectedOrders) {
        if (!isFiniteNum((o as any).pickup_latitude) || !isFiniteNum((o as any).pickup_longitude)) {
          toast.error(`Thiếu tọa độ pickup cho đơn ${o.tracking_number ?? o.id}`);
          return;
        }
        if (!isFiniteNum((o as any).delivery_latitude) || !isFiniteNum((o as any).delivery_longitude)) {
          toast.error(`Thiếu tọa độ delivery cho đơn ${o.tracking_number ?? o.id}`);
          return;
        }
        if (!(o as any).pickup_location_id) {
          toast.error(`Thiếu pickup_location_id cho đơn ${o.tracking_number ?? o.id}`);
          return;
        }
        if (!(o as any).delivery_location_id) {
          toast.error(`Thiếu delivery_location_id cho đơn ${o.tracking_number ?? o.id}`);
          return;
        }
      }

      inFlightRef.current = true;
      setIsSolving(true);

      try {
        // Helpful for Route Details history / viewing context
        try {
          localStorage.setItem(
            "routePlanningMetadata",
            JSON.stringify({
              orders: selectedOrders.map((o) => ({
                id: o.id,
                tracking_number: o.tracking_number,
                status: o.status,
              })),
              organizationId,
              depot: {
                name: organization?.depot_name ?? "Depot",
                address: organization?.depot_address ?? null,
                latitude: Number(depotLat),
                longitude: Number(depotLng),
              },
              orderCount: selectedOrders.length,
              source: "orders-dispatch-dynamic",
            })
          );
        } catch {
          // ignore
        }

        // Build vehicle states for reoptimization (GPS positions + picked-up orders)
        console.log("[Dynamic Routing] Building vehicle states for reoptimization...");
        const vehicleStates = await buildVehicleStatesForRouting(
          organizationId,
          Number(depotLat),
          Number(depotLng),
          { includeWithoutGps: true }
        );

        if (vehicleStates.length === 0) {
          console.warn("[Dynamic Routing] No vehicle states found, falling back to static solve");
          // Fallback to static solve if no vehicles available
          const instanceText = buildSartoriPdptwInstance({
            name: `wajo-org-${organizationId}-dispatch-dynamic-${new Date().toISOString().slice(0, 10)}`,
            location: "Vietnam",
            depot: {
              name: organization?.depot_name ?? "Depot",
              address: organization?.depot_address ?? null,
              latitude: Number(depotLat),
              longitude: Number(depotLng),
            },
            orders: selectedOrders,
          });

          const nOrders = selectedOrders.length;
          const size = 1 + nOrders * 2;
          const mapping_ids: any[] = Array.from({ length: size }, () => null);
          mapping_ids[0] = {
            kind: "depot",
            order_id: null,
            location_id: null,
            lat: Number(depotLat),
            lng: Number(depotLng),
          };

          for (let i = 0; i < nOrders; i++) {
            const o = selectedOrders[i] as any;
            const pickupId = 1 + i;
            const deliveryId = 1 + nOrders + i;
            mapping_ids[pickupId] = {
              kind: "pickup",
              order_id: o.id,
              location_id: o.pickup_location_id,
              lat: Number(o.pickup_latitude),
              lng: Number(o.pickup_longitude),
            };
            mapping_ids[deliveryId] = {
              kind: "delivery",
              order_id: o.id,
              location_id: o.delivery_location_id,
              lat: Number(o.delivery_latitude),
              lng: Number(o.delivery_longitude),
            };
          }

          const inputData = { mapping_ids };
          const result = await solverService.solveInstance(
            instanceText,
            solverParams,
            undefined,
            {
              organizationId,
              createdBy: userId,
              inputData,
            }
          );

          // Handle fallback result (same as before)
          const sid = result.solutionId ?? null;
          if (sid) {
            setLatestSolutionId(sid);
            try {
              localStorage.setItem("lastSolutionId", sid);
            } catch {
              // ignore
            }

            if (result.persisted) {
              try {
                const nowIso = new Date().toISOString();
                await Promise.all(
                  selectedOrders
                    .filter((o) => o.status === "pending")
                    .map((o) => updateOrder({ id: o.id, status: "assigned", assigned_at: nowIso }).unwrap())
                );
              } catch (e) {
                console.warn("Failed to update orders to assigned:", e);
              }
            }

            await persistOptimizationEventsToDb({
              solutionId: sid,
              organizationId,
              reportedByAuthUserId: userId,
              reason,
              persisted: !!result.persisted,
              depotLat: Number(depotLat),
              depotLng: Number(depotLng),
              orderCount: selectedOrders.length,
            });

            await loadRouteEventsFromDb({ solutionId: sid, organizationId });

            if (reason === "MANUAL" || reason === "START") {
              try {
                if (typeof window !== "undefined") {
                  window.open(`/route-details?solutionId=${encodeURIComponent(String(sid))}`, "_blank");
                }
              } catch {
                // ignore
              }
            }
          }

          toast.success(sid ? "Đã lưu solution vào database (fallback)" : "Đã chạy solver (fallback)");
          return; // Exit early for fallback case
        }

        // Build reoptimization context for dynamic routing
        const orderIds = selectedOrders.map((o) => o.id);

        console.log(`[DynamicSolve] selectedOrders count: ${selectedOrders.length}, unique IDs: ${new Set(orderIds).size}`);
        console.log(`[DynamicSolve] Order IDs:`, orderIds.slice(0, 5), '...');

        // Determine new orders (orders not yet in any active route)
        // For now, treat all selected orders as potentially new
        const newOrderIds = orderIds;

        // Don't send previous_solution_id for fresh routing
        // This prevents backend from fetching all active orders from previous solution
        // Only send previous_solution_id when explicitly reoptimizing an existing solution
        const reoptimizationContext: ReoptimizationContext = {
          previous_solution_id: undefined, // Fresh routing - no previous solution
          vehicle_states: vehicleStates,
          order_delta: {
            new_order_ids: newOrderIds,
            cancelled_order_ids: [],
          },
          organization_id: organizationId,
          require_depot_return: true,
        };

        console.log("[Dynamic Routing] Submitting reoptimization job:", {
          vehicleCount: vehicleStates.length,
          orderCount: orderIds.length,
          previousSolutionId: latestSolutionId,
        });

        // Use reoptimization API for dynamic routing
        const result = await solverService.reoptimizeRoutes(
          reoptimizationContext,
          solverParams,
          undefined,
          userId
        );

        const sid = result.solutionId ?? null;
        if (sid) {
          setLatestSolutionId(sid);
          try {
            localStorage.setItem("lastSolutionId", sid);
          } catch {
            // ignore
          }

          // Persist order state in DB so dynamic progress survives reload.
          if (result.persisted) {
            try {
              const nowIso = new Date().toISOString();
              await Promise.all(
                selectedOrders
                  .filter((o) => o.status === "pending")
                  .map((o) => updateOrder({ id: o.id, status: "assigned", assigned_at: nowIso }).unwrap())
              );
            } catch (e) {
              console.warn("Failed to update orders to assigned:", e);
            }
          }

          // Persist a lightweight DB log per generated route.
          await persistOptimizationEventsToDb({
            solutionId: sid,
            organizationId,
            reportedByAuthUserId: userId,
            reason,
            persisted: !!result.persisted,
            depotLat: Number(depotLat),
            depotLng: Number(depotLng),
            orderCount: selectedOrders.length,
          });

          // Refresh DB events immediately (avoid waiting for effect / avoid duplicates).
          await loadRouteEventsFromDb({ solutionId: sid, organizationId });
        }

        // Keep dynamic scheduler running in this tab, but open Route Details for inspection.
        if (sid && (reason === "MANUAL" || reason === "START")) {
          try {
            if (typeof window !== "undefined") {
              window.open(`/route-details?solutionId=${encodeURIComponent(String(sid))}`, "_blank");
            }
          } catch {
            // ignore
          }
        }

        if (!result.persisted) {
          const eventType: EventType = reason === "PERIODIC" ? "RE_OPTIMIZATION" : "OPTIMIZATION_RUN";
          const newEvent: RoutingEvent = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            type: eventType,
            trigger: reason,
            summary:
              reason === "PERIODIC"
                ? `Tái tối ưu định kỳ cho ${selectedOrders.length} đơn.`
                : `Tối ưu hóa cho ${selectedOrders.length} đơn.`,
            details: [
              `reason: ${reason}`,
              `solutionId: ${sid ?? "-"}`,
              `persisted: ${result.persisted ? "yes" : "no"}`,
            ],
          };
          setLocalEvents((prev) => [newEvent, ...prev]);
        }
        toast.success(sid ? "Đã lưu solution vào database" : "Đã chạy solver");
      } catch (e: any) {
        console.error("Dynamic solve failed:", e);
        const newEvent: RoutingEvent = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "RE_OPTIMIZATION",
          trigger: `${reason}_ERROR`,
          summary: "Tối ưu hóa thất bại",
          details: [String(e?.message || e || "unknown error")],
        };
        setLocalEvents((prev) => [newEvent, ...prev]);
        toast.error("Tối ưu hóa thất bại");
      } finally {
        try {
          setLastSolveAtMs(Date.now());
        } catch {
          // ignore
        }
        inFlightRef.current = false;
        setIsSolving(false);
      }
    },
    [
      mode,
      organizationId,
      userId,
      ordersBeingRouted,
      organization,
      orders,
      router,
      persistOptimizationEventsToDb,
      updateOrder,
      loadRouteEventsFromDb,
      setLastSolveAtMs,
      solverParams,
      latestSolutionId,
    ]
  );

  // Dynamic scheduler: resume after reload using lastSolveAtMs
  useEffect(() => {
    if (mode !== "dynamic") return;
    if (!isRunning || isPaused) return;
    if (ordersBeingRouted.length === 0) return;

    const intervalMs = Math.max(1, reoptIntervalMinutes) * 60_000;
    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      timerRef.current = window.setTimeout(async () => {
        if (cancelled) return;
        await runDynamicSolve("PERIODIC");
        if (cancelled) return;
        scheduleNext(intervalMs);
      }, Math.max(0, delayMs));
    };

    const now = Date.now();
    const nextAt = lastSolveAtMs ? lastSolveAtMs + intervalMs : now;
    scheduleNext(Math.max(0, nextAt - now));

    return () => {
      cancelled = true;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPaused, isRunning, lastSolveAtMs, mode, ordersBeingRouted.length, reoptIntervalMinutes, runDynamicSolve]);

  // Auto-start (after reload) if dynamic was running but no solve has happened yet.
  useEffect(() => {
    if (mode !== "dynamic") return;
    if (!isRunning || isPaused) return;
    if (ordersBeingRouted.length === 0) return;
    if (inFlightRef.current) return;
    if (autoStartRef.current) return;
    if (lastSolveAtMs) return;

    autoStartRef.current = true;
    runDynamicSolve("START").catch(() => {
      // ignore
    });
  }, [isPaused, isRunning, lastSolveAtMs, mode, ordersBeingRouted.length, runDynamicSolve]);

  const handleRunOptimization = useCallback(() => {
    const ordersToOptimize = mode === "static" ? allEligibleOrders : ordersBeingRouted;

    if (mode === "static") {
      if (!organizationId) {
        toast.error("Chưa tải được thông tin tổ chức");
        return;
      }

      const depotLat = organization?.depot_latitude ?? null;
      const depotLng = organization?.depot_longitude ?? null;
      if (depotLat == null || depotLng == null) {
        toast.error("Vui lòng nhập depot (tọa độ) trong Thông tin tài khoản trước");
        router.push("/profile");
        return;
      }

      if (ordersToOptimize.length === 0) {
        toast.error("Không có đơn hàng đủ điều kiện để tối ưu hóa");
        return;
      }

      // Build the exact legacy handoff payload expected by /route-details.
      const orderById = new Map<string, Order>();
      for (const o of orders) orderById.set(o.id, o);

      const selectedOrders: Order[] = ordersToOptimize
        .map((o) => orderById.get(o.id))
        .filter((o): o is Order => Boolean(o));

      if (selectedOrders.length === 0) {
        toast.error("Không tìm thấy dữ liệu đơn hàng để tạo instance");
        return;
      }

      // Validate coordinates
      const asNum = (v: unknown) => Number(v);
      const isFiniteNum = (v: unknown) => Number.isFinite(asNum(v));
      for (const o of selectedOrders) {
        if (!isFiniteNum((o as any).pickup_latitude) || !isFiniteNum((o as any).pickup_longitude)) {
          toast.error(`Thiếu tọa độ pickup cho đơn ${o.tracking_number ?? o.id}`);
          return;
        }
        if (!isFiniteNum((o as any).delivery_latitude) || !isFiniteNum((o as any).delivery_longitude)) {
          toast.error(`Thiếu tọa độ delivery cho đơn ${o.tracking_number ?? o.id}`);
          return;
        }
      }

      try {
        const instanceText = buildSartoriPdptwInstance({
          name: `wajo-org-${organizationId}-dispatch-${new Date().toISOString().slice(0, 10)}`,
          location: "Vietnam",
          depot: {
            name: organization?.depot_name ?? "Depot",
            address: organization?.depot_address ?? null,
            latitude: Number(depotLat),
            longitude: Number(depotLng),
          },
          orders: selectedOrders,
        });

        // Clear stale cached routes/instance from previous sessions
        try {
          localStorage.removeItem("selectedRoute");
          localStorage.removeItem("currentInstance");
          localStorage.removeItem("allRoutes");
          localStorage.removeItem("lastSolutionId");
        } catch {
          // ignore
        }

        localStorage.setItem("builderInstanceText", instanceText);

        // mapping_ids index MUST match solver node index.
        // 0: depot
        // 1..n: pickups
        // n+1..2n: deliveries
        const ordersInBuildOrder = selectedOrders;
        const nOrders = ordersInBuildOrder.length;
        const size = 1 + nOrders * 2;
        const mapping_ids: any[] = Array.from({ length: size }, () => null);
        mapping_ids[0] = {
          kind: "depot",
          order_id: null,
          location_id: null,
          lat: Number(depotLat),
          lng: Number(depotLng),
        };

        for (let i = 0; i < nOrders; i++) {
          const o = ordersInBuildOrder[i] as any;
          const pickupId = 1 + i;
          const deliveryId = 1 + nOrders + i;
          mapping_ids[pickupId] = {
            kind: "pickup",
            order_id: o.id,
            location_id: o.pickup_location_id ?? null,
            lat: Number(o.pickup_latitude),
            lng: Number(o.pickup_longitude),
          };
          mapping_ids[deliveryId] = {
            kind: "delivery",
            order_id: o.id,
            location_id: o.delivery_location_id ?? null,
            lat: Number(o.delivery_latitude),
            lng: Number(o.delivery_longitude),
          };
        }

        localStorage.setItem(
          "builderInputData",
          JSON.stringify({
            mapping_ids,
          })
        );

        localStorage.setItem(
          "routePlanningMetadata",
          JSON.stringify({
            orders: selectedOrders.map((o) => ({
              id: o.id,
              tracking_number: o.tracking_number,
              status: o.status,
            })),
            organizationId,
            depot: {
              name: organization?.depot_name ?? "Depot",
              address: organization?.depot_address ?? null,
              latitude: Number(depotLat),
              longitude: Number(depotLng),
            },
            orderCount: selectedOrders.length,
            source: "orders-dispatch-static",
          })
        );

        toast.success("Đã tạo instance, chuyển sang Route Details...");
        router.push("/route-details");
      } catch (e: unknown) {
        console.error("Failed to build Sartori instance:", e);
        toast.error("Không thể tạo instance PDPTW");
      }

      // Still log the event (optional), but navigation is the primary action.
      const navEvent: RoutingEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: "OPTIMIZATION_RUN",
        trigger: "STATIC_TO_ROUTE_DETAILS",
        summary: `Chuyển sang Route Details để tối ưu hóa ${ordersToOptimize.length} đơn.`,
      };
      setLocalEvents((prev) => [navEvent, ...prev]);
      return;
    }

    // Dynamic: run solver now (persist to DB)
    runDynamicSolve("MANUAL");
  }, [allEligibleOrders, ordersBeingRouted, mode, organization, organizationId, orders, router, runDynamicSolve]);

  const handleStartDynamic = useCallback(async () => {
    if (ordersBeingRouted.length === 0) {
      toast.error("Vui lòng thêm đơn hàng vào định tuyến trước");
      return;
    }
    setIsRunning(true);
    setIsPaused(false);
    justStartedRef.current = true;
    const newEvent: RoutingEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: "OPTIMIZATION_RUN",
      trigger: "START",
      summary: `Bắt đầu điều phối động với ${ordersBeingRouted.length} đơn.`,
      details: [
        `Khoảng tái tối ưu: ${reoptIntervalMinutes} phút`,
        `Tái tối ưu khi có đơn mới: ${reoptOnNewOrder ? "Có" : "Không"}`,
        `Tái tối ưu khi có delay: ${reoptOnDelay ? "Có" : "Không"}`,
        `Tái tối ưu khi đơn bị hủy: ${reoptOnCancellation ? "Có" : "Không"}`,
        `Session override: ${dynamicOverride ? "Có" : "Không"}`,
      ],
    };
    setLocalEvents(prev => [newEvent, ...prev]);
    toast.success("Đã bắt đầu điều phối động");
    await runDynamicSolve("START");
  }, [
    ordersBeingRouted.length,
    reoptIntervalMinutes,
    reoptOnNewOrder,
    reoptOnDelay,
    reoptOnCancellation,
    dynamicOverride,
    runDynamicSolve,
  ]);

  const handlePause = useCallback(() => {
    setIsPaused(!isPaused);
    toast.info(isPaused ? "Đã tiếp tục điều phối" : "Đã tạm dừng điều phối");
  }, [isPaused]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    toast.info("Đã dừng điều phối động");
  }, []);

  const openLatestSolution = useCallback(() => {
    const sid =
      latestSolutionId ?? (typeof window !== "undefined" ? localStorage.getItem("lastSolutionId") : null);
    if (!sid) {
      toast.error("Chưa có solution nào để mở");
      return;
    }
    router.push(`/route-details?solutionId=${encodeURIComponent(String(sid))}`);
  }, [latestSolutionId, router]);

  // Format time window
  const formatTW = (start?: string, end?: string) => {
    if (!start && !end) return "-";
    const formatDate = (d: string) => {
      const date = new Date(d);
      return `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    };
    const s = start ? formatDate(start) : "-";
    const e = end ? formatDate(end) : "-";
    return `${s} → ${e}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-gray-100 text-gray-800";
      case "assigned": return "bg-yellow-100 text-yellow-800";
      case "in_transit": return "bg-blue-100 text-blue-800";
      case "picked_up": return "bg-purple-100 text-purple-800";
      case "delivered": return "bg-green-100 text-green-800";
      case "failed": case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Chờ xử lý";
      case "assigned": return "Đã gán";
      case "in_transit": return "Đang giao";
      case "picked_up": return "Đã lấy hàng";
      case "delivered": return "Hoàn thành";
      case "failed": return "Thất bại";
      case "cancelled": return "Đã hủy";
      default: return status;
    }
  };

  // Order table component
  const OrderTable = ({
    orders: tableOrders,
    showActions = false,
    actionType = "add",
    emptyMessage = "Không có đơn hàng"
  }: {
    orders: OrderInScope[];
    showActions?: boolean;
    actionType?: "add" | "remove";
    emptyMessage?: string;
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
          <tr>
            <th className="p-2 whitespace-nowrap">Mã đơn</th>
            <th className="p-2 whitespace-nowrap">Trạng thái</th>
            <th className="p-2 whitespace-nowrap min-w-[200px]">Pickup → Delivery</th>
            <th className="p-2 whitespace-nowrap">TW</th>
            {showActions && <th className="p-2 text-center w-10"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tableOrders.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 5 : 4} className="p-6 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            tableOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="p-2 font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {order.trackingNumber}
                    {order.lockState === "LOCKED" && (
                      <Lock className="w-3 h-3 text-amber-500" />
                    )}
                  </div>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </td>
                <td className="p-2 max-w-[200px]">
                  <div className="truncate text-gray-700" title={`${order.pickupAddress} → ${order.deliveryAddress}`}>
                    <span>{order.pickupAddress || "-"}</span>
                    <span className="text-gray-400"> → </span>
                    <span>{order.deliveryAddress || "-"}</span>
                  </div>
                </td>
                <td className="p-2 whitespace-nowrap text-gray-600">
                  {formatTW(order.pickupTimeStart, order.pickupTimeEnd)}
                </td>
                {showActions && (
                  <td className="p-2 text-center">
                    <button
                      onClick={() => actionType === "add" ? handleAddToRouting(order.id) : handleRemoveFromRouting(order.id)}
                      className={`p-1 rounded transition-colors ${actionType === "add"
                        ? "text-green-600 hover:bg-green-100"
                        : "text-red-600 hover:bg-red-100"
                        }`}
                      title={actionType === "add" ? "Thêm vào định tuyến" : "Xóa khỏi định tuyến"}
                    >
                      {actionType === "add" ? <Plus className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full h-[calc(100vh-4rem)] flex flex-col bg-gray-50">
      {/* ===== HEADER ===== */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dispatch Workspace</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Quản lý điều phối và tối ưu hóa lộ trình
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/orders")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Orders
            </Button>
            <Button
              variant={showSettingsPanel ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={showSettingsPanel ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              <Settings className="w-4 h-4 mr-1" />
              Solver
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openLatestSolution}
              disabled={isSolving && !latestSolutionId}
              title="Mở solution mới nhất"
            >
              <ChevronRight className="w-4 h-4 mr-1" />
              Latest
            </Button>
            {dynamicOverride && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearSessionOverride}
                title="Xóa session override"
              >
                Clear override
              </Button>
            )}
          </div>
        </div>

        {/* Mode Selector & Controls */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            <button
              onClick={() => setMode("static")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${mode === "static"
                ? "bg-white shadow text-gray-900"
                : "text-gray-600 hover:text-gray-900"
                }`}
            >
              Tĩnh
            </button>
            <button
              onClick={() => setMode("dynamic")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${mode === "dynamic"
                ? "bg-white shadow text-gray-900"
                : "text-gray-600 hover:text-gray-900"
                }`}
            >
              Động
            </button>
          </div>

          <div className="flex gap-2">
            {mode === "static" ? (
              <Button size="sm" onClick={handleRunOptimization} className="bg-blue-600 hover:bg-blue-700">
                <Zap className="w-4 h-4 mr-1" />
                Tối ưu hóa
              </Button>
            ) : (
              <>
                {!isRunning ? (
                  <Button size="sm" onClick={handleStartDynamic} className="bg-purple-600 hover:bg-purple-700">
                    <Play className="w-4 h-4 mr-1" />
                    Bắt đầu
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={handlePause} variant="outline">
                      {isPaused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                      {isPaused ? "Tiếp" : "Dừng"}
                    </Button>
                    <Button size="sm" onClick={handleStop} variant="destructive">
                      Kết thúc
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          {mode === "dynamic" && isRunning && (
            <div className={`flex items-center gap-1.5 text-xs ${isPaused ? "text-amber-600" : "text-green-600"}`}>
              <div className={`w-2 h-2 rounded-full ${isPaused ? "bg-amber-500" : "bg-green-500 animate-pulse"}`} />
              {isPaused ? "Tạm dừng" : isSolving ? "Đang giải..." : "Đang chạy..."}
            </div>
          )}

          {/* Stats */}
          <div className="ml-auto flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              <span>{stats.ordersInScope} đơn</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              <span>{stats.lockedOrders} khóa</span>
            </div>
            <div className="flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{stats.reoptimizations} lần</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SETTINGS PANEL OVERLAY ===== */}
      {showSettingsPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowSettingsPanel(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
              <h2 className="font-semibold text-gray-900">Cài đặt Solver</h2>
              <button
                onClick={() => setShowSettingsPanel(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Preset Templates */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Chọn mẫu</div>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      handleParamChange('iterations', 10000);
                      handleParamChange('max_non_improving', 2000);
                      handleParamChange('time_limit', 120);
                      handleParamChange('acceptance', 'greedy');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${solverParams.iterations === 10000 && solverParams.time_limit === 120
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="font-medium text-gray-900">Nhanh</div>
                    <div className="text-xs text-gray-500">2 phút • Greedy</div>
                  </button>
                  <button
                    onClick={() => {
                      handleParamChange('iterations', 50000);
                      handleParamChange('max_non_improving', 10000);
                      handleParamChange('time_limit', 300);
                      handleParamChange('acceptance', 'rtr');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${solverParams.iterations === 50000 && solverParams.time_limit === 300
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="font-medium text-gray-900">Cân bằng</div>
                    <div className="text-xs text-gray-500">5 phút • RTR</div>
                  </button>
                  <button
                    onClick={() => {
                      handleParamChange('iterations', 100000);
                      handleParamChange('max_non_improving', 20000);
                      handleParamChange('time_limit', 600);
                      handleParamChange('acceptance', 'rtr');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${solverParams.iterations === 100000 && solverParams.time_limit === 600
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="font-medium text-gray-900">Chất lượng cao</div>
                    <div className="text-xs text-gray-500">10 phút • RTR</div>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Advanced Settings Toggle */}
              <div>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => setShowParams((p) => !p)}
                >
                  <span>Tùy chỉnh nâng cao</span>
                  <span className={`transition-transform ${showParams ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {showParams && (
                  <div className="mt-3 space-y-3">
                    <SolverParametersForm
                      params={solverParams}
                      onChange={handleParamChange}
                    />
                    <button
                      type="button"
                      onClick={resetParameters}
                      className="w-full py-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Khôi phục mặc định
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== MAIN CONTENT - SPLIT VIEW ===== */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT PANEL - ORDERS */}
        <div className="w-1/2 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          {mode === "static" ? (
            // STATIC MODE: Single list of all eligible orders
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">Đơn hàng đủ điều kiện</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {allEligibleOrders.length} đơn sẵn sàng tối ưu hóa
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {dispatchSettings.allowed_statuses.map((status) => (
                      <span
                        key={status}
                        className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded"
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {isProfileLoading || isOrdersLoading ? (
                  <div className="text-sm text-gray-500 p-4">Đang tải...</div>
                ) : allEligibleOrders.length === 0 ? (
                  <div className="text-sm text-gray-500 p-8 text-center">
                    Không có đơn hàng đủ điều kiện.
                  </div>
                ) : (
                  <OrderTable orders={allEligibleOrders} emptyMessage="Không có đơn hàng đủ điều kiện" />
                )}
              </div>
            </div>
          ) : (
            // DYNAMIC MODE: Two lists - In Routing + Available
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Orders being routed */}
              <div className="flex-1 flex flex-col overflow-hidden border-b border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100 bg-purple-50 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-purple-900">Đơn đang định tuyến</h2>
                      <p className="text-xs text-purple-600 mt-0.5">
                        {ordersBeingRouted.length} đơn trong lộ trình
                      </p>
                    </div>
                    {ordersBeingRouted.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={handleRunOptimization}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        Tối ưu
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {ordersBeingRouted.length === 0 ? (
                    <div className="text-sm text-gray-500 p-6 text-center">
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      Chưa có đơn nào trong định tuyến.
                      <br />
                      <span className="text-xs">Thêm đơn từ danh sách bên dưới.</span>
                    </div>
                  ) : (
                    <OrderTable orders={ordersBeingRouted} showActions actionType="remove" emptyMessage="Chưa có đơn nào" />
                  )}
                </div>
              </div>

              {/* Available orders */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-gray-900">Đơn sẵn có</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {availableOrders.length} đơn chờ thêm vào
                      </p>
                    </div>
                    {availableOrders.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={handleAddAllToRouting}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Thêm tất cả
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {isProfileLoading || isOrdersLoading ? (
                    <div className="text-sm text-gray-500 p-4">Đang tải...</div>
                  ) : availableOrders.length === 0 ? (
                    <div className="text-sm text-gray-500 p-6 text-center">
                      Tất cả đơn đã được thêm vào định tuyến.
                    </div>
                  ) : (
                    <OrderTable orders={availableOrders} showActions actionType="add" emptyMessage="Tất cả đơn đã thêm" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL - EVENT LOG */}
        <div className="w-1/2 bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <h2 className="font-semibold text-gray-900">Routing Events</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {events.length} sự kiện được ghi lại
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {events.length === 0 ? (
              <div className="text-sm text-gray-500 py-12 text-center border border-dashed border-gray-200 rounded-lg">
                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                Chưa có sự kiện nào.
                <br />
                <span className="text-xs">Chạy tối ưu hóa để bắt đầu.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const eventMeta = EVENT_TYPE_LABELS[event.type];
                  return (
                    <div key={event.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg shrink-0 ${eventMeta.color}`}>
                          {eventMeta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm text-gray-900">{eventMeta.label}</span>
                            {event.trigger && (
                              <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {event.trigger}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">
                              {event.timestamp.toLocaleTimeString("vi-VN")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{event.summary}</p>
                          {event.details && event.details.length > 0 && (
                            <ul className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                              {event.details.map((detail, i) => (
                                <li key={i}>• {detail}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
