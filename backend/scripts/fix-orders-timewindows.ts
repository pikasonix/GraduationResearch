import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { createSupabaseAdminClient } from '../src/supabaseAdmin';

const SERVICE_TIME = 5; // minutes
const MIN_TRAVEL_TIME = 15; // minutes - minimum time to travel between pickup and delivery
const MIN_DELIVERY_WINDOW = 60; // minutes - minimum delivery window duration

async function fixTimeWindows() {
    const supabase = createSupabaseAdminClient();
    const orgId = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';
    
    // Fetch all orders for this org
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('organization_id', orgId)
        .in('status', ['pending', 'assigned', 'in_transit']);
    
    if (error || !orders) {
        console.error('Error fetching orders:', error);
        return;
    }
    
    console.log(`Found ${orders.length} orders to check\n`);
    
    const updates: Array<{
        id: string;
        tracking_number: string;
        old: { delivery_start: string; delivery_end: string };
        new: { delivery_start: string; delivery_end: string };
    }> = [];
    
    for (const order of orders) {
        const pickupStart = order.pickup_time_start ? new Date(order.pickup_time_start) : null;
        let deliveryStart = order.delivery_time_start ? new Date(order.delivery_time_start) : null;
        let deliveryEnd = order.delivery_time_end ? new Date(order.delivery_time_end) : null;
        
        if (!pickupStart || !deliveryStart || !deliveryEnd) {
            continue;
        }
        
        let needsUpdate = false;
        const minDeliveryStart = new Date(pickupStart.getTime() + (SERVICE_TIME + MIN_TRAVEL_TIME) * 60 * 1000);
        
        // Fix delivery_time_start if it's too early
        if (deliveryStart < minDeliveryStart) {
            deliveryStart = minDeliveryStart;
            needsUpdate = true;
        }
        
        // Fix delivery_time_end if it's before delivery_time_start or window is too small
        const minDeliveryEnd = new Date(deliveryStart.getTime() + MIN_DELIVERY_WINDOW * 60 * 1000);
        if (deliveryEnd < minDeliveryEnd) {
            deliveryEnd = minDeliveryEnd;
            needsUpdate = true;
        }
        
        // Also ensure delivery_end is after pickup_start + service + travel + buffer
        const absoluteMinDeliveryEnd = new Date(pickupStart.getTime() + (SERVICE_TIME + MIN_TRAVEL_TIME + 30) * 60 * 1000);
        if (deliveryEnd < absoluteMinDeliveryEnd) {
            deliveryEnd = absoluteMinDeliveryEnd;
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            updates.push({
                id: order.id,
                tracking_number: order.tracking_number,
                old: {
                    delivery_start: order.delivery_time_start,
                    delivery_end: order.delivery_time_end,
                },
                new: {
                    delivery_start: deliveryStart.toISOString(),
                    delivery_end: deliveryEnd.toISOString(),
                },
            });
        }
    }
    
    console.log(`Found ${updates.length} orders that need time window fixes\n`);
    
    if (updates.length === 0) {
        console.log('No updates needed!');
        return;
    }
    
    // Show what will be updated
    console.log('='.repeat(100));
    console.log('Changes to be made:');
    console.log('='.repeat(100));
    
    for (const update of updates) {
        console.log(`\n[${update.tracking_number}] ${update.id}`);
        console.log(`  Old delivery: ${update.old.delivery_start} -> ${update.old.delivery_end}`);
        console.log(`  New delivery: ${update.new.delivery_start} -> ${update.new.delivery_end}`);
    }
    
    console.log('\n' + '='.repeat(100));
    console.log(`\nApplying ${updates.length} updates...`);
    
    // Apply updates
    let successCount = 0;
    let errorCount = 0;
    
    for (const update of updates) {
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                delivery_time_start: update.new.delivery_start,
                delivery_time_end: update.new.delivery_end,
            })
            .eq('id', update.id);
        
        if (updateError) {
            console.error(`Failed to update ${update.tracking_number}: ${updateError.message}`);
            errorCount++;
        } else {
            successCount++;
        }
    }
    
    console.log(`\nDone! ${successCount} updated, ${errorCount} errors`);
}

fixTimeWindows();
