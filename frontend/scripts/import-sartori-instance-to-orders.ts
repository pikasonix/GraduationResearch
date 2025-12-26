/**
 * Import a Sartori-Buriol PDPTW instance (NODES section) into the `orders` table.
 *
 * Default source instance: src/data/sampleInstance.js
 *
 * Run:
 *   npx tsx scripts/import-sartori-instance-to-orders.ts <organization_id> [count] [--reset]
 *
 * Notes:
 * - Only `NODES` are used; `EDGES` is ignored.
 * - Creates/uses one default location for required FK columns.
 * - If `--reset` is provided, deletes existing orders for the org first
 *   (and deletes dependent notifications that would otherwise block the delete).
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// ESM default export from JS module
import sampleInstance from "../src/data/sampleInstance.js";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type SartoriNode = {
    id: number;
    lat: number;
    lng: number;
    demand: number;
    etw: number;
    ltw: number;
    duration: number;
    p: number;
    d: number;
};

function parseHeaderNumber(lines: string[], prefix: string): number | undefined {
    const line = lines.find((l) => l.startsWith(prefix));
    if (!line) return undefined;
    const raw = line.slice(prefix.length).trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

function parseNodes(instanceText: string): SartoriNode[] {
    const lines = instanceText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const nodesIdx = lines.findIndex((l) => l === "NODES");
    if (nodesIdx < 0) throw new Error("Instance missing NODES section");

    const edgesIdx = lines.findIndex((l, i) => i > nodesIdx && (l === "EDGES" || l === "EOF"));
    const endIdx = edgesIdx >= 0 ? edgesIdx : lines.length;

    const nodes: SartoriNode[] = [];

    for (let i = nodesIdx + 1; i < endIdx; i++) {
        const parts = lines[i].split(/\s+/);
        if (parts.length < 9) {
            throw new Error(`Invalid node line at '${lines[i]}'`);
        }

        const [id, lat, lng, demand, etw, ltw, duration, p, d] = parts;

        const node: SartoriNode = {
            id: Number(id),
            lat: Number(lat),
            lng: Number(lng),
            demand: Number(demand),
            etw: Number(etw),
            ltw: Number(ltw),
            duration: Number(duration),
            p: Number(p),
            d: Number(d),
        };

        const allNumbers = Object.values(node).every((v) => Number.isFinite(v));
        if (!allNumbers) {
            throw new Error(`Non-numeric values in node line: '${lines[i]}'`);
        }

        nodes.push(node);
    }

    if (!nodes.length) throw new Error("No nodes parsed from instance");
    return nodes;
}

function todayAtLocalHour(hour: number, minute: number): Date {
    const now = new Date();
    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    return d;
}

function addMinutes(base: Date, minutes: number): string {
    return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
    return `09${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}`;
}

async function getOrCreateDefaultLocationId(targetOrgId: string): Promise<string> {
    const { data: existing } = await supabase
        .from("locations")
        .select("id")
        .eq("organization_id", targetOrgId)
        .limit(1)
        .single();

    if (existing?.id) return existing.id as string;

    const { data: newLoc, error } = await supabase
        .from("locations")
        .insert({
            organization_id: targetOrgId,
            name: "Depot Mặc định",
            address: "Số 1 Nguyễn Trãi, Thanh Xuân, Hà Nội",
            latitude: 20.995,
            longitude: 105.805,
            location_type: "warehouse",
        })
        .select("id")
        .single();

    if (error || !newLoc?.id) {
        throw new Error(`Failed to create default location: ${error?.message ?? "unknown error"}`);
    }

    return newLoc.id as string;
}

async function resetOrgOrders(targetOrgId: string): Promise<void> {
    // Collect all order IDs for the org (pagination to avoid default PostgREST limits)
    const pageSize = 1000;
    const orderIds: string[] = [];

    for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
            .from("orders")
            .select("id")
            .eq("organization_id", targetOrgId)
            .range(from, to);

        if (error) {
            throw new Error(`Failed to list existing orders for reset: ${error.message}`);
        }

        const batch = (data ?? []).map((r: any) => String(r.id));
        orderIds.push(...batch);

        if (batch.length < pageSize) break;
    }

    if (orderIds.length === 0) {
        console.log("🧹 Reset: no existing orders found to delete.");
        return;
    }

    console.log(`🧹 Reset: deleting ${orderIds.length} existing orders (and dependent notifications)...`);

    // Delete notifications first (FK does not cascade)
    const chunkSize = 500;
    for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const { error } = await supabase.from("notifications").delete().in("order_id", chunk);
        if (error) {
            throw new Error(`Failed to delete notifications for reset: ${error.message}`);
        }
    }

    // route_stops is ON DELETE CASCADE, so we don't have to delete it explicitly
    const { error: deleteOrdersError } = await supabase
        .from("orders")
        .delete()
        .eq("organization_id", targetOrgId);

    if (deleteOrdersError) {
        throw new Error(`Failed to delete existing orders for reset: ${deleteOrdersError.message}`);
    }

    console.log("✅ Reset: old orders deleted.");
}

async function main() {
    const args = process.argv.slice(2);
    const targetOrgId = args[0];
    const countArg = args[1] && !args[1].startsWith("--") ? args[1] : undefined;
    const flags = args.filter((a) => a.startsWith("--"));
    const doReset = flags.includes("--reset") || flags.includes("--wipe") || flags.includes("--delete-old");

    if (!targetOrgId) {
        console.error("❌ Please provide organization ID");
        console.log("Usage: npx tsx scripts/import-sartori-instance-to-orders.ts <organization_id> [count] [--reset]");
        process.exit(1);
    }

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", targetOrgId)
        .single();

    if (orgError || !org) {
        console.error("❌ Organization not found:", targetOrgId);
        process.exit(1);
    }

    if (doReset) {
        await resetOrgOrders(targetOrgId);
    }

    const lines = String(sampleInstance).split(/\r?\n/).map((l) => l.trim());
    const routeTime = parseHeaderNumber(lines, "ROUTE-TIME:") ?? 240;

    const nodes = parseNodes(String(sampleInstance));
    const nodesById = new Map<number, SartoriNode>(nodes.map((n) => [n.id, n]));

    const pickupNodes = nodes
        .filter((n) => n.id !== 0 && n.demand > 0 && n.d > 0)
        .sort((a, b) => a.id - b.id);

    const maxCount = countArg ? Math.max(0, Number(countArg)) : pickupNodes.length;
    const take = Math.min(pickupNodes.length, Number.isFinite(maxCount) ? maxCount : pickupNodes.length);

    const defaultLocationId = await getOrCreateDefaultLocationId(targetOrgId);

    const baseStart = todayAtLocalHour(8, 0);
    const contactNames = [
        "Nguyễn Văn A",
        "Trần Thị B",
        "Lê Văn C",
        "Phạm Thị D",
        "Hoàng Văn E",
        "Vũ Thị F",
    ];

    const orders: any[] = [];

    for (let idx = 0; idx < take; idx++) {
        const p = pickupNodes[idx];
        const d = nodesById.get(p.d);
        if (!d) {
            throw new Error(`Missing delivery node id=${p.d} for pickup id=${p.id}`);
        }

        // tracking_number is globally unique (not scoped per-organization), so include org prefix
        const orgPrefix = targetOrgId.replace(/-/g, "").slice(0, 8).toUpperCase();
        const tracking = `SB${orgPrefix}${String(p.id).padStart(3, "0")}`;

        orders.push({
            organization_id: targetOrgId,
            tracking_number: tracking,
            reference_code: `SARTORI-${p.id}`,
            status: "pending",
            priority: "normal",

            product_name: "Sample import (Sartori-Buriol)",
            weight: Math.max(1, Math.round(p.demand)),

            pickup_location_id: defaultLocationId,
            pickup_contact_name: randomItem(contactNames),
            pickup_contact_phone: generatePhone(),
            pickup_address: `Pickup node ${p.id} (lat=${p.lat.toFixed(6)}, lng=${p.lng.toFixed(6)})`,
            pickup_latitude: p.lat,
            pickup_longitude: p.lng,
            pickup_time_start: addMinutes(baseStart, Math.max(0, p.etw)),
            pickup_time_end: addMinutes(baseStart, Math.max(0, p.ltw)),
            pickup_notes: null,

            delivery_location_id: defaultLocationId,
            delivery_contact_name: randomItem(contactNames),
            delivery_contact_phone: generatePhone(),
            delivery_address: `Delivery node ${d.id} (lat=${d.lat.toFixed(6)}, lng=${d.lng.toFixed(6)})`,
            delivery_latitude: d.lat,
            delivery_longitude: d.lng,
            delivery_time_start: addMinutes(baseStart, Math.max(0, d.etw)),
            delivery_time_end: addMinutes(baseStart, Math.max(0, d.ltw)),
            delivery_notes: null,

            service_time_pickup: Math.max(0, Math.round(p.duration || 5)),
            service_time_delivery: Math.max(0, Math.round(d.duration || 5)),

            // Keep windows within the instance route time horizon for sanity
            internal_notes: `Imported from Sartori sample. Horizon=${routeTime}m. Pair=${p.id}->${d.id}`,
        });
    }

    if (!orders.length) {
        console.log("No pickup/delivery pairs found to import.");
        return;
    }

    console.log(`📥 Importing ${orders.length} orders into organization '${org.name}' (${targetOrgId})...`);

    const { data, error } = await supabase
        .from("orders")
        .insert(orders)
        .select("id, tracking_number");

    if (error) {
        console.error("❌ Error inserting orders:", error);
        process.exit(1);
    }

    console.log(`✅ Imported ${data?.length ?? 0} orders.`);
    console.log("Example tracking numbers:", (data ?? []).slice(0, 5).map((r) => r.tracking_number).join(", "));
}

main().catch((e) => {
    console.error("❌ Import failed:", e);
    process.exit(1);
});
