import * as fs from 'fs';

// Parse instance file
const instancePath = 'D:\\CODE\\WAYO\\backend\\storage\\temp\\job-50d8e5f1-b664-4000-b4dd-ebea57a3a1ae-Kwsqi4\\instance.txt';
const content = fs.readFileSync(instancePath, 'utf8');
const lines = content.split('\n');

// Find NODES section
const nodesIndex = lines.findIndex(l => l.trim() === 'NODES');
const edgesIndex = lines.findIndex(l => l.trim() === 'EDGES');

if (nodesIndex < 0 || edgesIndex < 0) {
    console.error('Could not find NODES or EDGES section');
    process.exit(1);
}

// Parse nodes
interface Node {
    id: number;
    lat: number;
    lng: number;
    demand: number;
    etw: number;  // earliest time window (ready)
    ltw: number;  // latest time window (due)
    duration: number;
    pickup: number;  // pickup node index (for deliveries)
    delivery: number; // delivery node index (for pickups)
}

const nodes: Node[] = [];
for (let i = nodesIndex + 1; i < edgesIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(/\s+/);
    if (parts.length >= 9) {
        nodes.push({
            id: parseInt(parts[0]),
            lat: parseFloat(parts[1]),
            lng: parseFloat(parts[2]),
            demand: parseInt(parts[3]),
            etw: parseInt(parts[4]),
            ltw: parseInt(parts[5]),
            duration: parseInt(parts[6]),
            pickup: parseInt(parts[7]),
            delivery: parseInt(parts[8]),
        });
    }
}

// Parse travel time matrix
const travelTimes: number[][] = [];
for (let i = edgesIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === 'EOF') break;
    
    const times = line.split(/\s+/).map(Number);
    travelTimes.push(times);
}

console.log('='.repeat(80));
console.log('INSTANCE ANALYSIS');
console.log('='.repeat(80));
console.log(`Total nodes: ${nodes.length}`);
console.log(`Travel time matrix size: ${travelTimes.length}x${travelTimes[0]?.length || 0}`);
console.log();

// Check each pickup-delivery pair
console.log('PICKUP-DELIVERY PAIRS:');
console.log('-'.repeat(80));

let violations = 0;
for (const node of nodes) {
    if (node.delivery > 0) {  // This is a pickup node
        const pickupId = node.id;
        const deliveryId = node.delivery;
        const deliveryNode = nodes.find(n => n.id === deliveryId);
        
        if (!deliveryNode) {
            console.log(`❌ Pickup ${pickupId} has no delivery node ${deliveryId}!`);
            continue;
        }
        
        const travelTime = travelTimes[pickupId]?.[deliveryId] || 0;
        
        // Solver check: pickup.ready <= delivery.due - travel_time
        const pickupReady = node.etw;
        const deliveryDue = deliveryNode.ltw;
        const check = pickupReady <= deliveryDue - travelTime;
        
        if (!check) {
            violations++;
            console.log(`\n❌ VIOLATION at node ${pickupId}:`);
            console.log(`   Pickup (node ${pickupId}): ETW=${node.etw}, LTW=${node.ltw}, coords=(${node.lat.toFixed(4)}, ${node.lng.toFixed(4)})`);
            console.log(`   Delivery (node ${deliveryId}): ETW=${deliveryNode.etw}, LTW=${deliveryNode.ltw}, coords=(${deliveryNode.lat.toFixed(4)}, ${deliveryNode.lng.toFixed(4)})`);
            console.log(`   Travel time: ${travelTime} min`);
            console.log(`   CHECK: pickup.ready (${pickupReady}) <= delivery.due (${deliveryDue}) - travel (${travelTime}) = ${deliveryDue - travelTime}`);
            console.log(`   ${pickupReady} <= ${deliveryDue - travelTime} => FALSE`);
        }
    }
}

console.log();
console.log('='.repeat(80));
console.log(`SUMMARY: ${violations} violations found`);
console.log('='.repeat(80));

// Specifically check node 26
console.log('\n--- Checking node 26 specifically (from error) ---');
const node25 = nodes.find(n => n.id === 25); // pickup
const node26 = nodes.find(n => n.id === 26); // delivery
if (node25 && node26) {
    const tt = travelTimes[25]?.[26] || 0;
    console.log(`Node 25 (pickup): ETW=${node25.etw}, LTW=${node25.ltw}, demand=${node25.demand}, delivery=${node25.delivery}`);
    console.log(`Node 26 (delivery): ETW=${node26.etw}, LTW=${node26.ltw}, demand=${node26.demand}, pickup=${node26.pickup}`);
    console.log(`Travel time 25->26: ${tt}`);
    console.log(`Check: ${node25.etw} <= ${node26.ltw} - ${tt} = ${node26.ltw - tt} => ${node25.etw <= node26.ltw - tt}`);
}

// Check for duplicate coordinates
console.log('\n--- Checking for duplicate coordinates ---');
const coordMap = new Map<string, number[]>();
for (const node of nodes) {
    const key = `${node.lat.toFixed(6)},${node.lng.toFixed(6)}`;
    if (!coordMap.has(key)) {
        coordMap.set(key, []);
    }
    coordMap.get(key)!.push(node.id);
}

let duplicates = 0;
for (const [coord, nodeIds] of coordMap) {
    if (nodeIds.length > 1) {
        // Check if these are depot/dummy nodes (id 0,1,2)
        const nonDepotNodes = nodeIds.filter(id => id > 2);
        if (nonDepotNodes.length > 1) {
            duplicates++;
            console.log(`Duplicate coord ${coord}: nodes ${nodeIds.join(', ')}`);
        }
    }
}
console.log(`Total non-depot duplicate coordinates: ${duplicates}`);
