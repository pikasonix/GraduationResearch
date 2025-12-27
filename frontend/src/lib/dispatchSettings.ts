import type { OrderStatus } from "@/lib/redux/services/orderApi";

export type DispatchOrderStatus =
  | "WAITING"
  | "IN_TRANSIT"
  | "DISPATCHED"
  | "COMPLETED"
  | "CANCELLED";

export interface DispatchSettings {
  allowed_statuses: DispatchOrderStatus[];
  dynamic: {
    lock_completed: boolean;
    allow_reorder: boolean;
    allow_vehicle_change: boolean;
    reopt_interval_minutes: number;
    reopt_on_new_order: boolean;
    reopt_on_delay: boolean;
    reopt_on_cancellation: boolean;
  };
}

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  allowed_statuses: ["WAITING", "IN_TRANSIT", "DISPATCHED"],
  dynamic: {
    lock_completed: true,
    allow_reorder: true,
    allow_vehicle_change: false,
    reopt_interval_minutes: 5,
    reopt_on_new_order: true,
    reopt_on_delay: true,
    reopt_on_cancellation: true,
  },
};

function coercePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return i;
}

const ALL_ALLOWED: DispatchOrderStatus[] = [
  "WAITING",
  "IN_TRANSIT",
  "DISPATCHED",
  "COMPLETED",
  "CANCELLED",
];

export function normalizeDispatchSettings(input: unknown): DispatchSettings {
  const candidate = input as Partial<DispatchSettings> | null | undefined;

  const allowedRaw = Array.isArray(candidate?.allowed_statuses)
    ? candidate?.allowed_statuses
    : DEFAULT_DISPATCH_SETTINGS.allowed_statuses;

  const allowed_statuses = allowedRaw
    .map((s) => String(s).toUpperCase())
    .filter((s): s is DispatchOrderStatus => (ALL_ALLOWED as string[]).includes(s));

  const dynamicRaw = (candidate?.dynamic ?? {}) as Partial<DispatchSettings["dynamic"]>;

  return {
    allowed_statuses: allowed_statuses.length ? allowed_statuses : DEFAULT_DISPATCH_SETTINGS.allowed_statuses,
    dynamic: {
      lock_completed:
        typeof dynamicRaw.lock_completed === "boolean"
          ? dynamicRaw.lock_completed
          : DEFAULT_DISPATCH_SETTINGS.dynamic.lock_completed,
      allow_reorder:
        typeof dynamicRaw.allow_reorder === "boolean"
          ? dynamicRaw.allow_reorder
          : DEFAULT_DISPATCH_SETTINGS.dynamic.allow_reorder,
      allow_vehicle_change:
        typeof dynamicRaw.allow_vehicle_change === "boolean"
          ? dynamicRaw.allow_vehicle_change
          : DEFAULT_DISPATCH_SETTINGS.dynamic.allow_vehicle_change,
      reopt_interval_minutes: coercePositiveInt(
        (dynamicRaw as any).reopt_interval_minutes,
        DEFAULT_DISPATCH_SETTINGS.dynamic.reopt_interval_minutes
      ),
      reopt_on_new_order:
        typeof (dynamicRaw as any).reopt_on_new_order === "boolean"
          ? (dynamicRaw as any).reopt_on_new_order
          : DEFAULT_DISPATCH_SETTINGS.dynamic.reopt_on_new_order,
      reopt_on_delay:
        typeof (dynamicRaw as any).reopt_on_delay === "boolean"
          ? (dynamicRaw as any).reopt_on_delay
          : DEFAULT_DISPATCH_SETTINGS.dynamic.reopt_on_delay,
      reopt_on_cancellation:
        typeof (dynamicRaw as any).reopt_on_cancellation === "boolean"
          ? (dynamicRaw as any).reopt_on_cancellation
          : DEFAULT_DISPATCH_SETTINGS.dynamic.reopt_on_cancellation,
    },
  };
}

export function getOrderDispatchCategory(status: OrderStatus): DispatchOrderStatus {
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
}

export function isOrderDispatchable(status: OrderStatus, settings: DispatchSettings): boolean {
  const cat = getOrderDispatchCategory(status);
  return settings.allowed_statuses.includes(cat);
}
