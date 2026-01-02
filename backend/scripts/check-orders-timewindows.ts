import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { createSupabaseAdminClient } from '../src/supabaseAdmin';

async function check() {
  const supabase = createSupabaseAdminClient();
  
  // Check with specific org_id from the error log
  const orgId = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      tracking_number, 
      pickup_time_start,
      pickup_time_end,
      delivery_time_start,
      delivery_time_end,
      pickup_latitude,
      pickup_longitude,
      delivery_latitude,
      delivery_longitude,
      status,
      created_at
    `)
    .eq('organization_id', orgId)
    .in('status', ['pending', 'assigned', 'in_transit'])
    .order('created_at', { ascending: false })
    .limit(30);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${data?.length || 0} orders\n`);
  console.log('='.repeat(120));
  
  let issueCount = 0;
  
  data?.forEach((order, index) => {
    const pickupStart = order.pickup_time_start ? new Date(order.pickup_time_start) : null;
    const pickupEnd = order.pickup_time_end ? new Date(order.pickup_time_end) : null;
    const deliveryStart = order.delivery_time_start ? new Date(order.delivery_time_start) : null;
    const deliveryEnd = order.delivery_time_end ? new Date(order.delivery_time_end) : null;
    
    // Check for issues
    const issues: string[] = [];
    
    if (pickupStart && deliveryEnd && pickupStart > deliveryEnd) {
      issues.push(`❌ pickup_start (${pickupStart.toISOString()}) > delivery_end (${deliveryEnd.toISOString()})`);
    }
    
    if (pickupStart && pickupEnd && pickupStart > pickupEnd) {
      issues.push(`❌ pickup_start > pickup_end`);
    }
    
    if (deliveryStart && deliveryEnd && deliveryStart > deliveryEnd) {
      issues.push(`❌ delivery_start > delivery_end`);
    }
    
    // Check if delivery window starts before pickup window ends (infeasible)
    if (pickupStart && deliveryEnd) {
      // Assuming minimum 15 min service + travel time
      const minTimeNeeded = 15 * 60 * 1000; // 15 minutes in ms
      if (deliveryEnd.getTime() < pickupStart.getTime() + minTimeNeeded) {
        issues.push(`⚠️ delivery_end is too close to pickup_start (diff: ${Math.round((deliveryEnd.getTime() - pickupStart.getTime()) / 60000)} min)`);
      }
    }
    
    if (issues.length > 0) {
      issueCount++;
      console.log(`\n[${index + 1}] Order: ${order.tracking_number || order.id}`);
      console.log(`    Status: ${order.status}`);
      console.log(`    Pickup:   ${pickupStart?.toISOString() || 'NULL'} -> ${pickupEnd?.toISOString() || 'NULL'}`);
      console.log(`    Delivery: ${deliveryStart?.toISOString() || 'NULL'} -> ${deliveryEnd?.toISOString() || 'NULL'}`);
      issues.forEach(issue => console.log(`    ${issue}`));
    }
  });
  
  console.log('\n' + '='.repeat(120));
  console.log(`\nSummary: ${issueCount} orders with potential time window issues out of ${data?.length || 0}`);
  
  // Also show a sample of time windows for reference
  console.log('\n--- Sample Time Windows (first 5 orders) ---');
  data?.slice(0, 5).forEach((order, index) => {
    console.log(`\n[${index + 1}] ${order.tracking_number || order.id}`);
    console.log(`    Pickup:   ${order.pickup_time_start || 'NULL'} -> ${order.pickup_time_end || 'NULL'}`);
    console.log(`    Delivery: ${order.delivery_time_start || 'NULL'} -> ${order.delivery_time_end || 'NULL'}`);
  });
}

check();
