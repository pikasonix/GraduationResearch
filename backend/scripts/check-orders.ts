import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { createSupabaseAdminClient } from '../src/supabaseAdmin';

async function check() {
  const supabase = createSupabaseAdminClient();
  
  // Check with specific org_id
  const orgId = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';
  
  const { data, error } = await supabase
    .from('orders')
    .select('tracking_number, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, organization_id')
    .eq('organization_id', orgId)
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Orders coordinates:');
    data?.forEach(order => {
      console.log(`${order.tracking_number}: pickup(${order.pickup_latitude}, ${order.pickup_longitude}) -> delivery(${order.delivery_latitude}, ${order.delivery_longitude})`);
    });
    
    // Check if coordinates are different
    const uniquePickupCoords = new Set(data?.map(o => `${o.pickup_latitude},${o.pickup_longitude}`));
    const uniqueDeliveryCoords = new Set(data?.map(o => `${o.delivery_latitude},${o.delivery_longitude}`));
    console.log(`\nUnique pickup coordinates: ${uniquePickupCoords.size}`);
    console.log(`Unique delivery coordinates: ${uniqueDeliveryCoords.size}`);
  }
}

check();
