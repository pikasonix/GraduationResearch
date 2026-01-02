import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { createSupabaseAdminClient } from '../src/supabaseAdmin';

// Simulate the preprocessor's reference start calculation
function calculateReferenceStart(orders: any[], currentTimestamp: Date): Date {
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
    
    if (times.length === 0) return currentTimestamp;
    
    const earliest = new Date(Math.min(...times.map(t => t.getTime())));
    // Use earlier of current time or earliest time window
    return earliest < currentTimestamp ? earliest : currentTimestamp;
}

function dateToRelativeMinutes(date: Date | string | undefined, referenceStart: Date, fallback: number): number {
    if (!date) return fallback;
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return fallback;
    const diff = Math.floor((d.getTime() - referenceStart.getTime()) / 60000); // minutes
    return Math.max(0, diff); // Never negative
}

async function check() {
    const supabase = createSupabaseAdminClient();
    const orgId = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';
    
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('organization_id', orgId)
        .in('status', ['pending', 'assigned', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(30);
    
    if (error || !orders) {
        console.error('Error:', error);
        return;
    }
    
    const currentTimestamp = new Date();
    const referenceStart = calculateReferenceStart(orders, currentTimestamp);
    const horizonMinutes = 480;
    
    console.log(`Reference Start: ${referenceStart.toISOString()}`);
    console.log(`Current Time: ${currentTimestamp.toISOString()}`);
    console.log(`Horizon: ${horizonMinutes} minutes`);
    console.log(`\nChecking ${orders.length} orders...\n`);
    console.log('='.repeat(100));
    
    let issueCount = 0;
    
    orders.forEach((order, index) => {
        const pickupEtw = dateToRelativeMinutes(order.pickup_time_start, referenceStart, 0);
        const pickupLtw = dateToRelativeMinutes(order.pickup_time_end, referenceStart, horizonMinutes);
        const deliveryEtw = dateToRelativeMinutes(order.delivery_time_start, referenceStart, 0);
        const deliveryLtw = dateToRelativeMinutes(order.delivery_time_end, referenceStart, horizonMinutes);
        
        const serviceTime = 5;
        const minTravelTime = 10;
        
        // Check: Rust solver asserts pickup.ready <= delivery.due - travel_time
        // => delivery.due >= pickup.ready + travel_time
        // => deliveryLtw >= pickupEtw + travel_time
        const issues: string[] = [];
        
        // Critical check: delivery due must be >= pickup ready + travel time
        if (deliveryLtw < pickupEtw + minTravelTime) {
            issues.push(`❌ CRITICAL: deliveryLtw (${deliveryLtw}) < pickupEtw (${pickupEtw}) + travel (${minTravelTime}) = ${pickupEtw + minTravelTime}`);
        }
        
        // Also check feasibility
        if (deliveryEtw < pickupEtw + serviceTime + minTravelTime) {
            issues.push(`⚠️ deliveryEtw (${deliveryEtw}) < pickupEtw + service + travel (${pickupEtw + serviceTime + minTravelTime})`);
        }
        
        if (pickupLtw < pickupEtw) {
            issues.push(`⚠️ pickupLtw (${pickupLtw}) < pickupEtw (${pickupEtw})`);
        }
        
        if (deliveryLtw < deliveryEtw) {
            issues.push(`⚠️ deliveryLtw (${deliveryLtw}) < deliveryEtw (${deliveryEtw})`);
        }
        
        if (issues.length > 0) {
            issueCount++;
            console.log(`\n[${index + 1}] Order: ${order.tracking_number || order.id}`);
            console.log(`    Raw pickup:   ${order.pickup_time_start} -> ${order.pickup_time_end}`);
            console.log(`    Raw delivery: ${order.delivery_time_start} -> ${order.delivery_time_end}`);
            console.log(`    Relative pickup:   ETW=${pickupEtw}, LTW=${pickupLtw}`);
            console.log(`    Relative delivery: ETW=${deliveryEtw}, LTW=${deliveryLtw}`);
            issues.forEach(issue => console.log(`    ${issue}`));
        }
    });
    
    console.log('\n' + '='.repeat(100));
    console.log(`\nSummary: ${issueCount} orders with potential solver issues out of ${orders.length}`);
    
    // Show sample relative time windows
    console.log('\n--- Sample Relative Time Windows ---');
    orders.slice(0, 5).forEach((order, index) => {
        const pickupEtw = dateToRelativeMinutes(order.pickup_time_start, referenceStart, 0);
        const pickupLtw = dateToRelativeMinutes(order.pickup_time_end, referenceStart, horizonMinutes);
        const deliveryEtw = dateToRelativeMinutes(order.delivery_time_start, referenceStart, 0);
        const deliveryLtw = dateToRelativeMinutes(order.delivery_time_end, referenceStart, horizonMinutes);
        
        console.log(`\n[${index + 1}] ${order.tracking_number}`);
        console.log(`    Pickup:   [${pickupEtw} - ${pickupLtw}]`);
        console.log(`    Delivery: [${deliveryEtw} - ${deliveryLtw}]`);
    });
}

check();
