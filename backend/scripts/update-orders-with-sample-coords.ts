/**
 * Update orders in database with real coordinates from sampleInstance
 * 
 * This script reads coordinates from the Barcelona sample instance and
 * updates existing orders with realistic pickup/delivery coordinates.
 * 
 * Usage: npx ts-node scripts/update-orders-with-sample-coords.ts
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { createSupabaseAdminClient } from '../src/supabaseAdmin';

// Parse sample instance coordinates
// Format: id lat lng demand etw ltw duration p d
const SAMPLE_NODES = `
0 41.39753660 2.12356330 0 0 240 0 0 0
1 41.40052560 2.11713440 22 129 240 5 0 51
2 41.39406020 2.19094860 20 0 92 5 0 52
3 41.42137720 2.08627070 147 116 236 5 0 53
4 41.42227070 2.13323310 73 117 237 5 0 54
5 41.43640110 2.18893560 158 0 85 5 0 55
6 41.39797200 2.17343800 135 151 240 5 0 56
7 41.43220000 2.16124700 127 49 169 5 0 57
8 41.41009850 2.18822350 136 73 193 5 0 58
9 41.43215450 2.18508420 178 52 172 5 0 59
10 41.39825330 2.17687800 55 32 152 5 0 60
11 41.43531630 2.08933260 153 84 204 5 0 61
12 41.39491220 2.13269920 82 50 170 5 0 62
13 41.44181900 2.17304600 144 0 85 5 0 63
14 41.39691210 2.12195190 66 0 80 5 0 64
15 41.40289610 2.10700030 88 0 76 5 0 65
16 41.42202810 2.17641570 155 42 162 5 0 66
17 41.38104350 2.18867720 136 0 83 5 0 67
18 41.39289310 2.15261720 129 126 240 5 0 68
19 41.44252360 2.17430660 169 30 150 5 0 69
20 41.38859690 2.18120880 93 0 113 5 0 70
21 41.39809180 2.17319740 61 0 117 5 0 71
22 41.42876960 2.09558440 59 47 167 5 0 72
23 41.43418680 2.16529700 55 136 240 5 0 73
24 41.42457780 2.15607310 173 38 158 5 0 74
25 41.38892640 2.17960100 165 128 240 5 0 75
26 41.41895940 2.14909610 180 0 240 5 0 76
27 41.41927790 2.14900990 13 49 169 5 0 77
28 41.38534280 2.17170190 113 82 202 5 0 78
29 41.39560560 2.17296570 72 0 104 5 0 79
30 41.42487430 2.15596920 164 0 109 5 0 80
31 41.39713230 2.12343660 54 0 113 5 0 81
32 41.44193550 2.19008920 176 19 139 5 0 82
33 41.43460950 2.15629080 61 0 113 5 0 83
34 41.43342200 2.18441240 177 28 148 5 0 84
35 41.39843170 2.17893870 88 0 77 5 0 85
36 41.42938860 2.17646510 49 144 240 5 0 86
37 41.42690600 2.18465540 173 96 216 5 0 87
38 41.38785930 2.17799060 39 0 240 5 0 88
39 41.43074650 2.16251410 146 12 132 5 0 89
40 41.38672140 2.17353810 55 0 72 5 0 90
41 41.41695530 2.21603250 74 18 138 5 0 91
42 41.43314540 2.18911240 142 0 84 5 0 92
43 41.36250330 2.07296610 57 53 173 5 0 93
44 41.38226980 2.13802490 36 39 159 5 0 94
45 41.37961100 2.08964820 104 67 187 5 0 95
46 41.39716020 2.19588250 21 136 240 5 0 96
47 41.42256580 2.09726060 34 0 94 5 0 97
48 41.41273970 2.18130290 57 0 240 5 0 98
49 41.38963490 2.10462520 14 48 168 5 0 99
50 41.44984240 2.20782730 179 75 195 5 0 100
51 41.39747430 2.12799110 -22 137 237 5 1 0
52 41.41266620 2.16020560 -20 13 133 5 2 0
53 41.39002880 2.11717190 -147 138 236 5 3 0
54 41.44289120 2.21485120 -73 143 224 5 4 0
55 41.44130830 2.20664850 -158 11 131 5 5 0
56 41.42233050 2.18189410 -135 162 227 5 6 0
57 41.42474170 2.17131170 -127 58 178 5 7 0
58 41.37019390 2.05809080 -136 107 227 5 8 0
59 41.43119840 2.18743590 -178 59 179 5 9 0
60 41.39245750 2.16795150 -55 41 161 5 10 0
61 41.39407070 2.18067200 -153 109 228 5 11 0
62 41.40364660 2.19934050 -82 68 188 5 12 0
63 41.40768350 2.17528990 -144 14 134 5 13 0
64 41.39244310 2.10492030 -66 10 130 5 14 0
65 41.35605100 2.06936610 -88 19 139 5 15 0
66 41.44128310 2.20095760 -155 57 177 5 16 0
67 41.39163460 2.18771500 -136 10 130 5 17 0
68 41.40178920 2.20672040 -129 144 223 5 18 0
69 41.32571630 2.09067340 -169 59 179 5 19 0
70 41.38414740 2.05186090 -93 34 154 5 20 0
`.trim().split('\n');

interface NodeCoord {
    id: number;
    lat: number;
    lng: number;
    demand: number;
    etw: number;
    ltw: number;
    duration: number;
}

function parseNodes(): NodeCoord[] {
    return SAMPLE_NODES.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
            id: parseInt(parts[0]),
            lat: parseFloat(parts[1]),
            lng: parseFloat(parts[2]),
            demand: parseInt(parts[3]),
            etw: parseInt(parts[4]),
            ltw: parseInt(parts[5]),
            duration: parseInt(parts[6]),
        };
    });
}

// Build pickup-delivery pairs
function buildPairs(nodes: NodeCoord[]): Array<{
    pickupLat: number;
    pickupLng: number;
    pickupDemand: number;
    deliveryLat: number;
    deliveryLng: number;
}> {
    const pairs: Array<{
        pickupLat: number;
        pickupLng: number;
        pickupDemand: number;
        deliveryLat: number;
        deliveryLng: number;
    }> = [];

    // Pickup nodes are 1-50, delivery nodes are 51-100
    for (let i = 1; i <= 50; i++) {
        const pickup = nodes.find(n => n.id === i);
        const delivery = nodes.find(n => n.id === i + 50);
        
        if (pickup && delivery) {
            pairs.push({
                pickupLat: pickup.lat,
                pickupLng: pickup.lng,
                pickupDemand: pickup.demand,
                deliveryLat: delivery.lat,
                deliveryLng: delivery.lng,
            });
        }
    }
    
    return pairs;
}

async function main() {
    const orgId = process.argv[2] || '3de8793f-18f4-4855-80a0-2dd12f9edc6a';
    
    console.log(`Updating orders for organization: ${orgId}`);
    
    const supabase = createSupabaseAdminClient();
    
    // Fetch existing orders
    const { data: orders, error: fetchError } = await supabase
        .from('orders')
        .select('id')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });
    
    if (fetchError) {
        console.error('Error fetching orders:', fetchError);
        process.exit(1);
    }
    
    if (!orders || orders.length === 0) {
        console.log('No orders found for this organization');
        process.exit(0);
    }
    
    console.log(`Found ${orders.length} orders`);
    
    // Parse sample coordinates
    const nodes = parseNodes();
    const pairs = buildPairs(nodes);
    
    console.log(`Loaded ${pairs.length} pickup-delivery coordinate pairs from sample`);
    
    // Update orders with real coordinates
    let updated = 0;
    let failed = 0;
    
    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        const pairIdx = i % pairs.length; // Cycle through pairs if more orders than pairs
        const pair = pairs[pairIdx];
        
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                pickup_latitude: pair.pickupLat,
                pickup_longitude: pair.pickupLng,
                delivery_latitude: pair.deliveryLat,
                delivery_longitude: pair.deliveryLng,
                weight: pair.pickupDemand,
            })
            .eq('id', order.id);
        
        if (updateError) {
            console.error(`Failed to update order ${order.id}:`, updateError.message);
            failed++;
        } else {
            updated++;
            console.log(`✓ Updated order ${i + 1}: pickup=(${pair.pickupLat.toFixed(4)}, ${pair.pickupLng.toFixed(4)}) delivery=(${pair.deliveryLat.toFixed(4)}, ${pair.deliveryLng.toFixed(4)}) demand=${pair.pickupDemand}`);
        }
    }
    
    console.log('\n========================================');
    console.log(`Updated: ${updated} orders`);
    console.log(`Failed: ${failed} orders`);
    console.log('========================================');
}

main().catch(console.error);
