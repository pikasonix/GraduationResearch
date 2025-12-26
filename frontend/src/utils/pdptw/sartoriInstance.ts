import type { Order } from "@/lib/redux/services/orderApi";

export type DepotInput = {
  name?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
};

function requireFiniteNumber(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} không hợp lệ`);
  }
  return n;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function minutesBetween(startIso: Date, tIso: string): number {
  const t = new Date(tIso);
  return Math.max(0, Math.round((t.getTime() - startIso.getTime()) / 60000));
}

function pickHorizonAndStart(orders: Order[]): { start: Date; horizonMinutes: number } {
  const starts: Date[] = [];
  const ends: Date[] = [];

  for (const o of orders) {
    if (o.pickup_time_start) starts.push(new Date(o.pickup_time_start));
    if (o.delivery_time_start) starts.push(new Date(o.delivery_time_start));
    if (o.pickup_time_end) ends.push(new Date(o.pickup_time_end));
    if (o.delivery_time_end) ends.push(new Date(o.delivery_time_end));
  }

  const now = new Date();
  const start = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : now;
  const end = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : new Date(start.getTime() + 8 * 60 * 60000);

  const raw = Math.round((end.getTime() - start.getTime()) / 60000);
  const horizonMinutes = Math.max(240, Math.min(24 * 60, raw + 60));

  return { start, horizonMinutes };
}

function formatNodeLine(parts: Array<string | number>): string {
  return parts.map((p) => String(p)).join(" ");
}

export function buildSartoriPdptwInstance(opts: {
  name: string;
  location?: string;
  depot: DepotInput;
  orders: Order[];
  capacity?: number;
  speedKmh?: number;
}): string {
  const depotLat = requireFiniteNumber(opts.depot.latitude, "Depot latitude");
  const depotLng = requireFiniteNumber(opts.depot.longitude, "Depot longitude");

  const { start, horizonMinutes } = pickHorizonAndStart(opts.orders);
  const speedKmh = opts.speedKmh ?? 30;
  const capacity = opts.capacity ?? 300;

  const nOrders = opts.orders.length;
  const size = 1 + nOrders * 2;

  // Nodes: 0 = depot
  const nodes: {
    id: number;
    lat: number;
    lng: number;
    demand: number;
    etw: number;
    ltw: number;
    duration: number;
    p: number;
    d: number;
  }[] = [];

  nodes.push({
    id: 0,
    lat: depotLat,
    lng: depotLng,
    demand: 0,
    etw: 0,
    ltw: horizonMinutes,
    duration: 0,
    p: 0,
    d: 0,
  });

  for (let i = 0; i < nOrders; i++) {
    const o = opts.orders[i];
    const pickupId = 1 + i;
    const deliveryId = 1 + nOrders + i;

    const pickupLat = requireFiniteNumber(o.pickup_latitude, `Pickup latitude (order ${o.tracking_number ?? o.id})`);
    const pickupLng = requireFiniteNumber(o.pickup_longitude, `Pickup longitude (order ${o.tracking_number ?? o.id})`);
    const deliveryLat = requireFiniteNumber(o.delivery_latitude, `Delivery latitude (order ${o.tracking_number ?? o.id})`);
    const deliveryLng = requireFiniteNumber(o.delivery_longitude, `Delivery longitude (order ${o.tracking_number ?? o.id})`);

    const pickupDemand = Math.max(1, Math.round(Number(o.weight ?? 1)));
    const pickupEtw = o.pickup_time_start ? minutesBetween(start, o.pickup_time_start) : 0;
    const pickupLtw = o.pickup_time_end ? minutesBetween(start, o.pickup_time_end) : horizonMinutes;
    const deliveryEtw = o.delivery_time_start ? minutesBetween(start, o.delivery_time_start) : 0;
    const deliveryLtw = o.delivery_time_end ? minutesBetween(start, o.delivery_time_end) : horizonMinutes;

    nodes.push({
      id: pickupId,
      lat: pickupLat,
      lng: pickupLng,
      demand: pickupDemand,
      etw: Math.min(pickupEtw, horizonMinutes),
      ltw: Math.min(Math.max(pickupEtw, pickupLtw), horizonMinutes),
      duration: Math.max(0, Math.round(Number(o.service_time_pickup ?? 5))),
      p: 0,
      d: deliveryId,
    });

    nodes.push({
      id: deliveryId,
      lat: deliveryLat,
      lng: deliveryLng,
      demand: -pickupDemand,
      etw: Math.min(deliveryEtw, horizonMinutes),
      ltw: Math.min(Math.max(deliveryEtw, deliveryLtw), horizonMinutes),
      duration: Math.max(0, Math.round(Number(o.service_time_delivery ?? 5))),
      p: pickupId,
      d: 0,
    });
  }

  // Build time matrix (minutes)
  const times: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === j) {
        times[i][j] = 0;
        continue;
      }
      const a = nodes[i];
      const b = nodes[j];
      const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
      const minutes = Math.max(1, Math.round((km / speedKmh) * 60));
      times[i][j] = minutes;
    }
  }

  const lines: string[] = [];
  lines.push(`NAME: ${opts.name}`);
  lines.push(`LOCATION: ${opts.location ?? "WAYO"}`);
  lines.push(`COMMENT: Generated from /orders (Sartori and Buriol format)`);
  lines.push(`TYPE: PDPTW`);
  lines.push(`SIZE: ${size}`);
  // Optional header used by the reference Sartori-Buriol instances. Safe to include; our parser ignores it.
  lines.push(`DISTRIBUTION: custom (WAYO)`);
  lines.push(`DEPOT: ${opts.depot.name || "custom"}`);
  lines.push(`ROUTE-TIME: ${horizonMinutes}`);
  lines.push(`TIME-WINDOW: ${horizonMinutes}`);
  lines.push(`CAPACITY: ${capacity}`);
  lines.push(`NODES`);

  for (const n of nodes) {
    lines.push(
      formatNodeLine([
        n.id,
        n.lat.toFixed(8),
        n.lng.toFixed(8),
        n.demand,
        n.etw,
        n.ltw,
        n.duration,
        n.p,
        n.d,
      ])
    );
  }

  lines.push(`EDGES`);
  for (let i = 0; i < size; i++) {
    lines.push(times[i].join(" "));
  }

  // Sartori-Buriol instances typically end with an explicit EOF token.
  lines.push(`EOF`);

  // IMPORTANT: avoid trailing blank lines (instance parser throws on unknown empty token)
  return lines.join("\n").trimEnd();
}
