import * as fs from 'fs';

const instancePath = 'D:/CODE/WAYO/backend/storage/temp/job-50d8e5f1-b664-4000-b4dd-ebea57a3a1ae-Kwsqi4/instance.txt';

const content = fs.readFileSync(instancePath, 'utf-8');
const lines = content.split('\n');

// Find NODES and EDGES
const nodesLineIndex = lines.findIndex(l => l.trim() === 'NODES');
const edgesLineIndex = lines.findIndex(l => l.trim() === 'EDGES');

// Parse nodes from file (file indices)
interface NodeFromFile {
  fileId: number;
  lat: number;
  lng: number;
  demand: number;
  etw: number;
  ltw: number;
  service: number;
  pickup_idx: number;
  delivery_idx: number;
}

const nodesFromFile: NodeFromFile[] = [];
for (let i = nodesLineIndex + 1; i < edgesLineIndex; i++) {
  const parts = lines[i].trim().split(/\s+/);
  if (parts.length >= 9) {
    nodesFromFile.push({
      fileId: parseInt(parts[0]),
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

// Parse edges
const travelTimes: number[][] = [];
for (let i = edgesLineIndex + 1; i < lines.length; i++) {
  const row = lines[i].trim().split(/\s+/).map(Number);
  if (row.length > 1 && !isNaN(row[0])) {
    travelTimes.push(row);
  }
}

// In Rust:
// - There are 3 depots (vehicles) = nodes 0,1,2 in file → indices 0-5 in Rust (start/end per vehicle)
// - Request nodes start after vehicle nodes
// - The file has: depot 0, depot 1, depot 2, then pickup/delivery pairs

console.log('=== FILE STRUCTURE ===');
console.log('Total nodes in file:', nodesFromFile.length);
console.log('Node 0:', nodesFromFile[0]);
console.log('Node 1:', nodesFromFile[1]);
console.log('Node 2:', nodesFromFile[2]);
console.log('Node 3 (first request):', nodesFromFile[3]);

// According to instance.txt:
// - Nodes 0,1,2 are depots (vehicles)
// - Nodes 3+ are pickup/delivery pairs

// Rust's internal indexing for 3 vehicles:
// - Vehicle 0 start: 0, end: 1
// - Vehicle 1 start: 2, end: 3
// - Vehicle 2 start: 4, end: 5
// - Request 0 pickup: 6, delivery: 7
// - Request 1 pickup: 8, delivery: 9
// ... etc

// p_id = 26 means: (num_vehicles * 2) + (request_idx * 2) = 26
// 6 + (request_idx * 2) = 26
// request_idx = 10

const numVehicles = 3; // depots 0,1,2
const rustPid = 26;
const rustDid = 27;
const requestIdx = (rustPid - numVehicles * 2) / 2;

console.log('\n=== RUST INDEX CALCULATION ===');
console.log(`Rust p_id: ${rustPid}, d_id: ${rustDid}`);
console.log(`Request index: ${requestIdx}`);

// Request 10 in file would be:
// After 3 depots, requests start at file index 3
// Pickup at file index: 3 + (requestIdx * 2) = 3 + 20 = 23
// Delivery at file index: 24

const filePickupIdx = 3 + (requestIdx * 2);
const fileDeliveryIdx = filePickupIdx + 1;

console.log(`File pickup index: ${filePickupIdx}, delivery index: ${fileDeliveryIdx}`);

const pickup = nodesFromFile[filePickupIdx];
const delivery = nodesFromFile[fileDeliveryIdx];

console.log('\n=== MATCHING NODES IN FILE ===');
console.log(`Pickup (file index ${filePickupIdx}):`, pickup);
console.log(`Delivery (file index ${fileDeliveryIdx}):`, delivery);

if (pickup && delivery) {
  // Get travel time
  const tt = travelTimes[pickup.fileId]?.[delivery.fileId] || 0;
  
  console.log('\n=== TIME WINDOW CHECK ===');
  console.log(`pickup.ready = ${pickup.etw}`);
  console.log(`delivery.due = ${delivery.ltw}`);
  console.log(`travel_time = ${tt}`);
  console.log(`Check: ${pickup.etw} <= ${delivery.ltw} - ${tt} = ${delivery.ltw - tt}`);
  console.log(`Result: ${pickup.etw <= delivery.ltw - tt ? 'PASS' : 'FAIL'}`);
}

// BUT WAIT - Rust error says rdy: 143, due: 83
// Let's find which node has ready=143 and which has due=83
console.log('\n=== LOOKING FOR rdy=143, due=83 VALUES ===');

// Rust modifies nodes[p_id].ready during preprocessing:
// nodes[p_id].ready = nodes[p_id].ready.max(earliest_arrival).min(nodes[p_id].due);
// So it might compute earliest_arrival = 143 based on vehicle distances

// Let's check if Rust's indexing maps differently
// Actually let me re-read the Rust code...

// In Sartori format, the solver might interpret nodes differently
// Let's check what request would give us these values

console.log('\nSearching for nodes with etw=143 or ltw=83...');
nodesFromFile.forEach((n, idx) => {
  if (n.etw === 143) {
    console.log(`File index ${idx} (node ${n.fileId}) has ETW=143:`, n);
  }
  if (n.ltw === 83) {
    console.log(`File index ${idx} (node ${n.fileId}) has LTW=83:`, n);
  }
});

// The real problem might be that after Rust's preprocessing,
// the "ready" time gets tightened based on vehicle travel times
console.log('\n=== SIMULATING RUST PREPROCESSING ===');

// For p_id=26 (request 10), pickup is at file index 23
// Rust calculates earliest_arrival from all vehicles
// earliest_arrival = min over all vehicles v: nodes[v*2].ready + travel_time(v*2, p_id)

const pickupFileIdx = 23; // request 10 pickup
const pickupNode = nodesFromFile[pickupFileIdx];
console.log(`\nAnalyzing pickup at file index ${pickupFileIdx} (node ${pickupNode?.fileId})`);

if (pickupNode) {
  // Vehicle start nodes are at file indices 0, 1, 2
  // But in Rust internal, they're at indices 0, 2, 4 (only start nodes)
  // Let me reconsider...
  
  // Actually in Sartori format, NODES section might be parsed differently
  // Let me check if first 3 nodes are depots (demand=0) or something else
  
  console.log('\nFirst 5 nodes from file:');
  for (let i = 0; i < 5; i++) {
    const n = nodesFromFile[i];
    console.log(`  Index ${i} (id ${n.fileId}): demand=${n.demand}, etw=${n.etw}, ltw=${n.ltw}`);
  }
  
  // If nodes 0,1,2 are depots (vehicles), then:
  // - Rust maps file index 0 → internal [0,1] (start,end)
  // - Rust maps file index 1 → internal [2,3]
  // - Rust maps file index 2 → internal [4,5]
  // - Rust maps file index 3 → internal [6,7] (first request pickup,delivery)
  
  // So for Rust p_id=26:
  // 26 = 6 + (req * 2) → req = 10
  // File index for pickup = 3 + 10 = 13
  // File index for delivery = 3 + 10 + 1 = 14?
  
  // Wait, that doesn't work because pairs are (3,4), (5,6), etc.
  // Let me check the file format again
  
  console.log('\nLet me check pickup-delivery relationship in file:');
  for (let i = 3; i < 15; i++) {
    const n = nodesFromFile[i];
    console.log(`  File index ${i}: id=${n.fileId}, demand=${n.demand}, pickup_idx=${n.pickup_idx}, delivery_idx=${n.delivery_idx}`);
  }
}
