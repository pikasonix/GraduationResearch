import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env từ backend/.env.local
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSolution(solutionId: string) {
  // Get routes for solution
  const { data: routes, error: routesError } = await supabase
    .from('routes')
    .select('id, route_number')
    .eq('solution_id', solutionId);
  
  if (routesError) {
    console.error('Routes error:', routesError);
    return;
  }
  
  console.log(`\nSolution ${solutionId}:`);
  console.log(`Found ${routes?.length || 0} routes`);
  
  if (!routes || routes.length === 0) {
    console.log('No routes found');
    return;
  }
  
  // Check route_stops for each route
  for (const route of routes) {
    const { data: stops, error: stopsError } = await supabase
      .from('route_stops')
      .select('order_id, stop_type, stop_sequence')
      .eq('route_id', route.id)
      .order('stop_sequence');
    
    if (stopsError) {
      console.error(`Route ${route.route_number} stops error:`, stopsError);
      continue;
    }
    
    console.log(`\nRoute ${route.route_number} (${route.id}):`);
    console.log(`  ${stops?.length || 0} stops`);
    
    if (stops && stops.length > 0) {
      console.log('  Sample stops:');
      stops.slice(0, 5).forEach(s => {
        console.log(`    ${s.stop_sequence}: ${s.stop_type} - order ${s.order_id}`);
      });
    }
  }
  
  // Also try the query backend uses
  console.log('\n--- Testing backend query ---');
  const { data: solutionStops, error: stopsError } = await supabase
    .from('route_stops')
    .select('order_id, routes!inner(solution_id)')
    .eq('routes.solution_id', solutionId)
    .not('order_id', 'is', null);
  
  if (stopsError) {
    console.error('Backend query error:', stopsError);
  } else {
    console.log(`Backend query found ${solutionStops?.length || 0} stops`);
    if (solutionStops && solutionStops.length > 0) {
      const uniqueOrders = [...new Set(solutionStops.map(s => s.order_id))];
      console.log(`Unique orders: ${uniqueOrders.length}`);
      console.log(`Order IDs: ${uniqueOrders.join(', ')}`);
    }
  }
}

(async () => {
  await checkSolution('696a5e33-9bfc-4063-9ff8-fe8df4db8de8');
  process.exit(0);
})();
