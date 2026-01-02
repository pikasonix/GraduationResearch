import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { createSupabaseAdminClient } from '../src/supabaseAdmin';

async function check() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('optimization_solutions')
    .select('id, solution_data')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) { console.error(error); return; }
  
  const solutionData = data.solution_data as any;
  console.log('Solution ID:', data.id);
  console.log('\nSolution data keys:', Object.keys(solutionData));
  
  // Check if mapping_ids exists in solution_data
  if (solutionData.mapping_ids) {
    const mappingIds = solutionData.mapping_ids as Record<string, any>;
    console.log('\nSample nodes from mapping_ids:');
    Object.entries(mappingIds).slice(0, 5).forEach(([key, value]) => {
      console.log(`  ${key}:`, JSON.stringify(value));
    });
    
    const coords = Object.values(mappingIds).map((n: any) => `${n.x},${n.y}`);
    const uniqueCoords = new Set(coords);
    console.log('\nTotal nodes:', Object.keys(mappingIds).length);
    console.log('Unique coordinates:', uniqueCoords.size);
    
    if (uniqueCoords.size <= 2) {
      console.log('\n⚠️  WARNING: All nodes have nearly identical coordinates!');
      console.log('This is why the map shows only 2 points.');
    }
  } else {
    console.log('\n⚠️  No mapping_ids found in solution_data');
    console.log('Full solution_data:', JSON.stringify(solutionData, null, 2).slice(0, 1000));
  }
}

check();
