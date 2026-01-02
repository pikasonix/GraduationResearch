import * as fs from 'fs';

const instancePath = 'D:/CODE/WAYO/backend/storage/temp/job-50d8e5f1-b664-4000-b4dd-ebea57a3a1ae-Kwsqi4/instance.txt';

const content = fs.readFileSync(instancePath, 'utf-8');
const lines = content.split('\n');

// Find EDGES section
let edgesLineIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'EDGES') {
    edgesLineIndex = i;
    break;
  }
}

console.log('EDGES section starts at line:', edgesLineIndex);

// Parse travel time row for node 3
const row3 = lines[edgesLineIndex + 4].trim().split(/\s+/).map(Number);
console.log('Travel time from node 3 to node 4:', row3[4]);

// Check node 3 and 4 details
const nodesLineIndex = lines.findIndex(l => l.trim() === 'NODES');
const node3Line = lines[nodesLineIndex + 4].trim().split(/\s+/);
const node4Line = lines[nodesLineIndex + 5].trim().split(/\s+/);

console.log('\n=== Node 3 (PICKUP) ===');
console.log('Raw line:', lines[nodesLineIndex + 4].trim());
console.log('Demand:', node3Line[3]);
console.log('ETW (ready):', node3Line[4]);
console.log('LTW (due):', node3Line[5]);
console.log('Service:', node3Line[6]);
console.log('pickup_idx:', node3Line[7]);
console.log('delivery_idx:', node3Line[8]);

console.log('\n=== Node 4 (DELIVERY) ===');
console.log('Raw line:', lines[nodesLineIndex + 5].trim());
console.log('Demand:', node4Line[3]);
console.log('ETW (ready):', node4Line[4]);
console.log('LTW (due):', node4Line[5]);
console.log('Service:', node4Line[6]);
console.log('pickup_idx:', node4Line[7]);
console.log('delivery_idx:', node4Line[8]);

// Check the constraint: pickup.ready <= delivery.due - travel_time
const pickupReady = parseFloat(node3Line[4]);
const deliveryDue = parseFloat(node4Line[5]);
const travelTime = row3[4];

console.log('\n=== CONSTRAINT CHECK ===');
console.log(`pickup.ready (${pickupReady}) <= delivery.due (${deliveryDue}) - travel_time (${travelTime})`);
console.log(`${pickupReady} <= ${deliveryDue - travelTime}`);
console.log('Result:', pickupReady <= deliveryDue - travelTime ? 'PASS ✓' : 'FAIL ✗');

// But wait - Rust error says rdy: 143, due: 83
// Node 4 has ETW=143, LTW=224
// So Rust might be comparing delivery.ready vs delivery.due differently?
console.log('\n=== UNDERSTANDING RUST ERROR ===');
console.log('Rust error: p_id: 26 (rdy: 143.000, due: 83.000, tt: 13.000)');
console.log('But this is p_id: 26 in Rust 0-based = node index 26 in our file');

// Let's check node 25 and 26 
console.log('\n=== Node 25 ===');
console.log('Raw line:', lines[nodesLineIndex + 26].trim());

console.log('\n=== Node 26 ===');
console.log('Raw line:', lines[nodesLineIndex + 27].trim());

// The error says p_id: 26, which in Rust's 0-based indexing means...
// Actually let me check if Rust uses 1-based or 0-based
console.log('\n=== All PICKUP-DELIVERY pairs ===');

// Parse all nodes
const nodes: any[] = [];
const nodesEndIndex = edgesLineIndex;
for (let i = nodesLineIndex + 1; i < nodesEndIndex; i++) {
  const parts = lines[i].trim().split(/\s+/);
  if (parts.length >= 9) {
    nodes.push({
      id: parseInt(parts[0]),
      lat: parseFloat(parts[1]),
      lng: parseFloat(parts[2]),
      demand: parseInt(parts[3]),
      etw: parseFloat(parts[4]),
      ltw: parseFloat(parts[5]),
      service: parseFloat(parts[6]),
      pickup_idx: parseInt(parts[7]),
      delivery_idx: parseInt(parts[8])
    });
  }
}

// Parse travel time matrix
const travelTimes: number[][] = [];
for (let i = edgesLineIndex + 1; i < lines.length; i++) {
  const row = lines[i].trim().split(/\s+/).map(Number);
  if (row.length > 0 && !isNaN(row[0])) {
    travelTimes.push(row);
  }
}

// Find all pickup-delivery pairs and check
console.log('\nChecking all pairs:');
let violationFound = false;
for (const node of nodes) {
  if (node.demand > 0 && node.delivery_idx > 0) {
    const pickup = node;
    const delivery = nodes.find(n => n.id === node.delivery_idx);
    if (delivery) {
      const tt = travelTimes[pickup.id][delivery.id];
      const valid = pickup.etw <= delivery.ltw - tt;
      if (!valid) {
        console.log(`\n❌ VIOLATION at pickup ${pickup.id} -> delivery ${delivery.id}`);
        console.log(`   pickup.ready=${pickup.etw}, delivery.due=${delivery.ltw}, tt=${tt}`);
        console.log(`   ${pickup.etw} > ${delivery.ltw} - ${tt} = ${delivery.ltw - tt}`);
        violationFound = true;
      }
    }
  }
}

if (!violationFound) {
  console.log('✅ All pairs pass the constraint check');
}

// Check what Rust might be doing differently
// Maybe Rust uses a DIFFERENT p_id system?
// Let's look for pair where delivery.etw = 143 and something.ltw = 83
console.log('\n=== Looking for rdy=143, due=83 ===');
for (const node of nodes) {
  if (node.etw === 143) {
    console.log(`Node ${node.id} has ETW=143:`, node);
  }
  if (node.ltw === 83) {
    console.log(`Node ${node.id} has LTW=83:`, node);
  }
}
