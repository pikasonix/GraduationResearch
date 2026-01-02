import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { createSupabaseAdminClient } from '../src/supabaseAdmin';

/**
 * Haversine distance in km
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Convert date to relative minutes from reference start
 */
function dateToRelativeMinutes(date: Date | string | undefined, referenceStart: Date, fallback: number): number {
    if (!date) return fallback;
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return fallback;
    const diff = Math.floor((d.getTime() - referenceStart.getTime()) / 60000);
    return Math.max(0, diff);
}

async function testInstanceGeneration() {
    const supabase = createSupabaseAdminClient();
    const orgId = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';
    
    // Fetch orders (same as reoptimization does)
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('organization_id', orgId)
        .in('status', ['pending', 'assigned', 'in_transit'])
        .limit(20);
    
    if (error || !orders) {
        console.error('Error fetching orders:', error);
        return;
    }
    
    console.log(`Fetched ${orders.length} orders\n`);
    
    // Calculate reference start (same logic as preprocessor)
    const times: Date[] = [];
    for (const o of orders) {
        if (o.pickup_time_start) {
            const t = new Date(o.pickup_time_start);
            if (!isNaN(t.getTime())) times.push(t);
        }
        if (o.delivery_time_start) {
            const t = new Date(o.delivery_time_start);
            if (!isNaN(t.getTime())) times.push(t);
        }
    }
    const currentTimestamp = new Date();
    const referenceStart = times.length > 0 
        ? new Date(Math.min(...times.map(t => t.getTime())))
        : currentTimestamp;
    
    console.log(`Reference Start: ${referenceStart.toISOString()}`);
    console.log(`Current Time: ${currentTimestamp.toISOString()}\n`);
    
    const horizonMinutes = 480;
    const speedKmh = 30;
    
    // Simulate instance generation
    const nodes: Array<{
        id: number;
        kind: string;
        order_tracking: string;
        lat: number;
        lng: number;
        demand: number;
        etw: number;
        ltw: number;
        p: number;
        d: number;
    }> = [];
    
    // Depot
    nodes.push({ id: 0, kind: 'depot', order_tracking: 'DEPOT', lat: 41.377, lng: 2.178, demand: 0, etw: 0, ltw: horizonMinutes, p: 0, d: 0 });
    
    // Dummy nodes for 2 vehicles
    nodes.push({ id: 1, kind: 'dummy_start', order_tracking: 'DUMMY1', lat: 41.377, lng: 2.178, demand: 0, etw: 0, ltw: horizonMinutes, p: 0, d: 0 });
    nodes.push({ id: 2, kind: 'dummy_start', order_tracking: 'DUMMY2', lat: 41.377, lng: 2.178, demand: 0, etw: 0, ltw: horizonMinutes, p: 0, d: 0 });
    
    // Process orders
    let nodeIdx = 3;
    const orderNodes: Map<string, { pickupIdx: number; deliveryIdx: number; order: any }> = new Map();
    
    // First pass: create pickup and delivery nodes
    for (const order of orders) {
        const pickupIdx = nodeIdx++;
        const deliveryIdx = nodeIdx++;
        orderNodes.set(order.id, { pickupIdx, deliveryIdx, order });
    }
    
    // Second pass: calculate time windows with validation
    for (const [orderId, { pickupIdx, deliveryIdx, order }] of orderNodes) {
        const pickupLat = order.pickup_latitude || 41.377;
        const pickupLng = order.pickup_longitude || 2.178;
        const deliveryLat = order.delivery_latitude || 41.377;
        const deliveryLng = order.delivery_longitude || 2.178;
        
        // Calculate raw time windows
        let pickupEtw = dateToRelativeMinutes(order.pickup_time_start, referenceStart, 0);
        let pickupLtw = dateToRelativeMinutes(order.pickup_time_end, referenceStart, horizonMinutes);
        let deliveryEtw = dateToRelativeMinutes(order.delivery_time_start, referenceStart, 0);
        let deliveryLtw = dateToRelativeMinutes(order.delivery_time_end, referenceStart, horizonMinutes);
        
        // Calculate travel time
        const km = haversineKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
        const travelTime = Math.max(10, Math.round((km / speedKmh) * 60));
        const serviceTime = 5;
        
        // CRITICAL VALIDATION: Ensure pickup.ready <= delivery.due - travel_time
        // => delivery.ltw >= pickup.etw + travel_time
        const minDeliveryLtw = pickupEtw + travelTime;
        
        console.log(`\n[${order.tracking_number}] Order ${orderId}`);
        console.log(`  Raw pickup:   ETW=${pickupEtw}, LTW=${pickupLtw}`);
        console.log(`  Raw delivery: ETW=${deliveryEtw}, LTW=${deliveryLtw}`);
        console.log(`  Travel time:  ${travelTime} min (${km.toFixed(2)} km)`);
        console.log(`  Min delivery LTW needed: ${minDeliveryLtw} (pickup_etw + travel)`);
        
        // Apply fixes
        if (deliveryLtw < minDeliveryLtw) {
            console.log(`  ⚠️ FIXING delivery LTW: ${deliveryLtw} -> ${Math.min(horizonMinutes, minDeliveryLtw + 60)}`);
            deliveryLtw = Math.min(horizonMinutes, minDeliveryLtw + 60);
        }
        
        // Ensure delivery ETW is after pickup can be completed
        const minDeliveryEtw = pickupEtw + serviceTime + travelTime;
        if (deliveryEtw < minDeliveryEtw) {
            console.log(`  ⚠️ FIXING delivery ETW: ${deliveryEtw} -> ${minDeliveryEtw}`);
            deliveryEtw = minDeliveryEtw;
        }
        
        // Ensure LTW >= ETW
        if (pickupLtw < pickupEtw) {
            pickupLtw = Math.min(horizonMinutes, pickupEtw + 120);
        }
        if (deliveryLtw < deliveryEtw) {
            deliveryLtw = Math.min(horizonMinutes, deliveryEtw + 60);
        }
        
        // Final check
        const check = pickupEtw <= deliveryLtw - travelTime;
        console.log(`  Final pickup:   ETW=${pickupEtw}, LTW=${pickupLtw}`);
        console.log(`  Final delivery: ETW=${deliveryEtw}, LTW=${deliveryLtw}`);
        console.log(`  Solver check (pickup.ready <= delivery.due - travel): ${pickupEtw} <= ${deliveryLtw} - ${travelTime} = ${deliveryLtw - travelTime} => ${check ? '✅ PASS' : '❌ FAIL'}`);
        
        if (!check) {
            console.log(`  ❌❌❌ THIS WOULD CAUSE SOLVER PANIC! ❌❌❌`);
        }
        
        const demand = Math.max(1, Math.round(order.weight || 1));
        
        nodes.push({
            id: pickupIdx,
            kind: 'pickup',
            order_tracking: order.tracking_number,
            lat: pickupLat,
            lng: pickupLng,
            demand: demand,
            etw: pickupEtw,
            ltw: pickupLtw,
            p: 0,
            d: deliveryIdx,
        });
        
        nodes.push({
            id: deliveryIdx,
            kind: 'delivery',
            order_tracking: order.tracking_number,
            lat: deliveryLat,
            lng: deliveryLng,
            demand: -demand,
            etw: deliveryEtw,
            ltw: deliveryLtw,
            p: pickupIdx,
            d: 0,
        });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Generated nodes summary:');
    console.log('='.repeat(80));
    
    // Check for any violations
    let violations = 0;
    for (const node of nodes) {
        if (node.kind === 'pickup' && node.d > 0) {
            const deliveryNode = nodes.find(n => n.id === node.d);
            if (deliveryNode) {
                const km = haversineKm(node.lat, node.lng, deliveryNode.lat, deliveryNode.lng);
                const travelTime = Math.max(10, Math.round((km / speedKmh) * 60));
                const check = node.etw <= deliveryNode.ltw - travelTime;
                if (!check) {
                    violations++;
                    console.log(`\n❌ VIOLATION at node ${node.id} (${node.order_tracking}):`);
                    console.log(`   pickup.etw=${node.etw}, delivery.ltw=${deliveryNode.ltw}, travel=${travelTime}`);
                    console.log(`   Check: ${node.etw} <= ${deliveryNode.ltw - travelTime} => FAIL`);
                }
            }
        }
    }
    
    console.log(`\nTotal violations: ${violations}`);
}

testInstanceGeneration();
