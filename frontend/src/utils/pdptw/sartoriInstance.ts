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
  // Increase minimum horizon to 8 hours and remove upper limit to avoid time window conflicts
  const horizonMinutes = Math.max(480, raw + 120); // At least 8 hours, with 2-hour buffer

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

  // First pass: collect all pickup-delivery pair data
  interface PairData {
    order: Order;
    pickupId: number;
    deliveryId: number;
    pickupLat: number;
    pickupLng: number;
    deliveryLat: number;
    deliveryLng: number;
    pickupDemand: number;
    pickupServiceTime: number;
    deliveryServiceTime: number;
    travelTime: number; // minutes from pickup to delivery
    rawPickupEtw: number;
    rawPickupLtw: number;
    rawDeliveryEtw: number;
    rawDeliveryLtw: number;
  }

  const pairs: PairData[] = [];
  for (let i = 0; i < nOrders; i++) {
    const o = opts.orders[i];
    const pickupId = 1 + i;
    const deliveryId = 1 + nOrders + i;

    const pickupLat = requireFiniteNumber(o.pickup_latitude, `Pickup latitude (order ${o.tracking_number ?? o.id})`);
    const pickupLng = requireFiniteNumber(o.pickup_longitude, `Pickup longitude (order ${o.tracking_number ?? o.id})`);
    const deliveryLat = requireFiniteNumber(o.delivery_latitude, `Delivery latitude (order ${o.tracking_number ?? o.id})`);
    const deliveryLng = requireFiniteNumber(o.delivery_longitude, `Delivery longitude (order ${o.tracking_number ?? o.id})`);

    const pickupDemand = Math.max(1, Math.round(Number(o.weight ?? 1)));
    const pickupServiceTime = Math.max(0, Math.round(Number(o.service_time_pickup ?? 5)));
    const deliveryServiceTime = Math.max(0, Math.round(Number(o.service_time_delivery ?? 5)));
    
    // Calculate travel time from pickup to delivery
    const km = haversineKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
    const travelTime = Math.max(1, Math.round((km / speedKmh) * 60));

    const rawPickupEtw = o.pickup_time_start ? minutesBetween(start, o.pickup_time_start) : 0;
    const rawPickupLtw = o.pickup_time_end ? minutesBetween(start, o.pickup_time_end) : horizonMinutes;
    const rawDeliveryEtw = o.delivery_time_start ? minutesBetween(start, o.delivery_time_start) : 0;
    const rawDeliveryLtw = o.delivery_time_end ? minutesBetween(start, o.delivery_time_end) : horizonMinutes;

    pairs.push({
      order: o,
      pickupId,
      deliveryId,
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng,
      pickupDemand,
      pickupServiceTime,
      deliveryServiceTime,
      travelTime,
      rawPickupEtw,
      rawPickupLtw,
      rawDeliveryEtw,
      rawDeliveryLtw,
    });
  }

  // Second pass: add nodes with validated time windows
  // The Rust solver does complex tightening that can cause pickup.due < pickup.ready:
  // 1. pickup.ready = max(pickup.ready, depot_travel).min(pickup.due)
  // 2. pickup.due = min(pickup.due, delivery.due - travel_time - service_time)
  // We must ensure that after BOTH steps, pickup.ready <= pickup.due
  
  const problematicOrders: string[] = [];
  
  for (const p of pairs) {
    // Calculate travel time from depot to pickup
    const depotToPickupKm = haversineKm(depotLat, depotLng, p.pickupLat, p.pickupLng);
    const depotToPickupTime = Math.max(1, Math.round((depotToPickupKm / speedKmh) * 60));

    let pickupEtw = Math.max(0, Math.min(p.rawPickupEtw, horizonMinutes));
    let pickupLtw = Math.max(pickupEtw, Math.min(p.rawPickupLtw, horizonMinutes));
    let deliveryEtw = Math.max(0, Math.min(p.rawDeliveryEtw, horizonMinutes));
    let deliveryLtw = Math.max(deliveryEtw, Math.min(p.rawDeliveryLtw, horizonMinutes));

    // CRITICAL: Calculate what pickup.ready will be after solver tightening
    // pickup.ready_after = max(pickupEtw, depotToPickupTime).min(pickupLtw)
    // To ensure this is well-defined, pickupLtw must be >= max(pickupEtw, depotToPickupTime)
    const minPickupReady = Math.max(pickupEtw, depotToPickupTime);
    
    // Ensure pickupLtw is large enough
    if (pickupLtw < minPickupReady + 30) {
      pickupLtw = Math.min(horizonMinutes, minPickupReady + 60);
    }
    
    // Now calculate effective pickup ready (after solver caps it at pickupLtw)
    const effectivePickupReady = Math.min(pickupLtw, minPickupReady);
    
    // Solver will tighten pickup.due to: min(pickupLtw, deliveryLtw - tt - st)
    // For pickup.ready <= pickup.due_after to hold:
    // effectivePickupReady <= min(pickupLtw, deliveryLtw - tt - st)
    // Since effectivePickupReady <= pickupLtw (by construction above),
    // we need: effectivePickupReady <= deliveryLtw - tt - st
    // Therefore: deliveryLtw >= effectivePickupReady + tt + st
    
    const minDeliveryLtw = effectivePickupReady + p.pickupServiceTime + p.travelTime + 60; // 60 min buffer
    if (deliveryLtw < minDeliveryLtw) {
      console.warn(
        `[buildSartoriPdptwInstance] Order ${p.order.tracking_number ?? p.order.id}: ` +
        `Extending deliveryLtw from ${deliveryLtw} to ${minDeliveryLtw} ` +
        `(effectivePickupReady=${effectivePickupReady}, tt=${p.travelTime}, st=${p.pickupServiceTime})`
      );
      deliveryLtw = Math.min(horizonMinutes, minDeliveryLtw);
      
      // If we hit horizon limit, this order is problematic
      if (deliveryLtw < minDeliveryLtw) {
        problematicOrders.push(
          `${p.order.tracking_number ?? p.order.id}: Cần deliveryLtw=${minDeliveryLtw} nhưng horizon chỉ cho phép ${horizonMinutes}`
        );
      }
    }
    
    // Ensure delivery.etw is feasible
    const minDeliveryEtw = effectivePickupReady + p.pickupServiceTime + p.travelTime;
    if (deliveryEtw < minDeliveryEtw) {
      deliveryEtw = Math.min(horizonMinutes, minDeliveryEtw);
    }

    // Ensure delivery window is valid
    if (deliveryLtw <= deliveryEtw) {
      deliveryLtw = Math.min(horizonMinutes, deliveryEtw + 60);
    }

    // Double-check the critical constraint one more time
    const pickupDueAfterTightening = Math.min(pickupLtw, deliveryLtw - p.travelTime - p.pickupServiceTime);
    if (effectivePickupReady > pickupDueAfterTightening) {
      console.error(
        `[buildSartoriPdptwInstance] CRITICAL constraint violation for order ${p.order.tracking_number ?? p.order.id}! ` +
        `effectivePickupReady=${effectivePickupReady} > pickupDueAfterTightening=${pickupDueAfterTightening.toFixed(1)} ` +
        `(pickupLtw=${pickupLtw}, deliveryLtw=${deliveryLtw}, tt=${p.travelTime}, st=${p.pickupServiceTime}, depotTravel=${depotToPickupTime})`
      );
      
      // Last-ditch effort: dramatically increase deliveryLtw
      const emergencyDeliveryLtw = effectivePickupReady + p.pickupServiceTime + p.travelTime + 120;
      if (emergencyDeliveryLtw <= horizonMinutes) {
        deliveryLtw = emergencyDeliveryLtw;
        console.warn(`[buildSartoriPdptwInstance] Emergency adjustment: deliveryLtw set to ${deliveryLtw}`);
      } else {
        problematicOrders.push(
          `${p.order.tracking_number ?? p.order.id}: Không thể fix - cần ${emergencyDeliveryLtw} phút nhưng horizon=${horizonMinutes}. ` +
          `Pickup ETW=${p.rawPickupEtw}, LTW=${p.rawPickupLtw}, Delivery ETW=${p.rawDeliveryEtw}, LTW=${p.rawDeliveryLtw}, ` +
          `Depot→Pickup=${depotToPickupTime}min, Pickup→Delivery=${p.travelTime}min`
        );
      }
    }
    
    // Final assertion check (same as solver will do)
    const finalPickupReady = Math.min(pickupLtw, Math.max(pickupEtw, depotToPickupTime));
    const finalCheck = finalPickupReady <= deliveryLtw - p.travelTime;
    if (!finalCheck) {
      console.error(
        `[buildSartoriPdptwInstance] FINAL CHECK FAILED for order ${p.order.tracking_number ?? p.order.id}! ` +
        `finalPickupReady=${finalPickupReady} > deliveryLtw=${deliveryLtw} - tt=${p.travelTime} = ${deliveryLtw - p.travelTime}`
      );
      problematicOrders.push(
        `${p.order.tracking_number ?? p.order.id}: Final check failed - pickup.ready=${finalPickupReady} > delivery.due=${deliveryLtw} - tt=${p.travelTime}`
      );
    }

    nodes.push({
      id: p.pickupId,
      lat: p.pickupLat,
      lng: p.pickupLng,
      demand: p.pickupDemand,
      etw: pickupEtw,
      ltw: pickupLtw,
      duration: p.pickupServiceTime,
      p: 0,
      d: p.deliveryId,
    });

    nodes.push({
      id: p.deliveryId,
      lat: p.deliveryLat,
      lng: p.deliveryLng,
      demand: -p.pickupDemand,
      etw: deliveryEtw,
      ltw: deliveryLtw,
      duration: p.deliveryServiceTime,
      p: p.pickupId,
      d: 0,
    });
  }

  // Check if any orders have unresolvable time window conflicts
  if (problematicOrders.length > 0) {
    const errorMsg = 
      `Không thể tạo instance hợp lệ cho static routing. ${problematicOrders.length} đơn hàng có time windows không khả thi sau khi solver xử lý:\n\n` +
      problematicOrders.map((msg, idx) => `${idx + 1}. ${msg}`).join('\n\n') +
      `\n\n⚠️ GIẢI PHÁP:\n` +
      `• Sử dụng DYNAMIC ROUTING thay vì Static (dynamic routing tự động điều chỉnh time windows)\n` +
      `• HOẶC điều chỉnh time windows thủ công:\n` +
      `  - Tăng "Thời gian giao hàng muộn nhất" (delivery latest time)\n` +
      `  - Giảm "Thời gian lấy hàng sớm nhất" (pickup earliest time)\n` +
      `  - Đảm bảo khoảng cách thời gian giữa pickup và delivery đủ lớn`;
    console.error('[buildSartoriPdptwInstance] ' + errorMsg);
    throw new Error(errorMsg);
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
