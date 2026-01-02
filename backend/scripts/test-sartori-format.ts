/**
 * Test script to generate a new Sartori instance and verify its format
 */
import * as fs from 'fs';
import * as path from 'path';

// Simulate the new buildSartoriInstanceText logic
function buildTestSartoriInstance() {
    const horizonMinutes = 480;
    const maxCapacity = 150;
    const speedKmh = 30;

    // Sample depot
    const depot = {
        lat: 41.37737372,
        lng: 2.17785816,
        name: "Test Depot"
    };

    // Sample orders (pickup-delivery pairs)
    const orders = [
        {
            id: "order1",
            pickup: { lat: 41.39406020, lng: 2.19094860, etw: 117, ltw: 237 },
            delivery: { lat: 41.41266620, lng: 2.16020560, etw: 143, ltw: 224 },
            demand: 20
        },
        {
            id: "order2",
            pickup: { lat: 41.40052560, lng: 2.11713440, etw: 0, ltw: 85 },
            delivery: { lat: 41.39747430, lng: 2.12799110, etw: 20, ltw: 134 },
            demand: 22
        },
        {
            id: "order3",
            pickup: { lat: 41.43531630, lng: 2.08933260, etw: 0, ltw: 83 },
            delivery: { lat: 41.39407070, lng: 2.18067200, etw: 23, ltw: 130 },
            demand: 153
        }
    ];

    const numRequests = orders.length;
    const size = 1 + 2 * numRequests; // 1 depot + n pickups + n deliveries

    interface NodeData {
        id: number;
        lat: number;
        lng: number;
        demand: number;
        etw: number;
        ltw: number;
        duration: number;
        p: number;
        d: number;
    }

    const nodes: NodeData[] = [];

    // Node 0: Depot
    nodes.push({
        id: 0,
        lat: depot.lat,
        lng: depot.lng,
        demand: 0,
        etw: 0,
        ltw: horizonMinutes,
        duration: 0,
        p: 0,
        d: 0
    });

    // Add pickup nodes (1 to numRequests)
    for (let i = 0; i < numRequests; i++) {
        const order = orders[i];
        const pickupNodeId = 1 + i;
        const deliveryNodeId = 1 + numRequests + i;

        const km = haversineKm(order.pickup.lat, order.pickup.lng, order.delivery.lat, order.delivery.lng);
        const travelTime = Math.max(1, Math.round((km / speedKmh) * 60));

        let pickupEtw = order.pickup.etw;
        let pickupLtw = order.pickup.ltw;
        let deliveryLtw = order.delivery.ltw;

        // Ensure: pickup.ready <= delivery.due - travel_time
        const minDeliveryLtw = pickupEtw + travelTime + 30;
        if (deliveryLtw < minDeliveryLtw) {
            deliveryLtw = Math.min(horizonMinutes, minDeliveryLtw);
            console.log(`Adjusted delivery LTW for order ${order.id}: ${order.delivery.ltw} -> ${deliveryLtw}`);
        }

        nodes.push({
            id: pickupNodeId,
            lat: order.pickup.lat,
            lng: order.pickup.lng,
            demand: order.demand,
            etw: pickupEtw,
            ltw: pickupLtw,
            duration: 5,
            p: 0, // Pickup has p=0
            d: deliveryNodeId // Points to delivery
        });
    }

    // Add delivery nodes (numRequests+1 to 2*numRequests)
    for (let i = 0; i < numRequests; i++) {
        const order = orders[i];
        const pickupNodeId = 1 + i;
        const deliveryNodeId = 1 + numRequests + i;
        const pickupNode = nodes[pickupNodeId];

        const km = haversineKm(pickupNode.lat, pickupNode.lng, order.delivery.lat, order.delivery.lng);
        const travelTime = Math.max(1, Math.round((km / speedKmh) * 60));

        let deliveryEtw = order.delivery.etw;
        let deliveryLtw = order.delivery.ltw;

        const minDeliveryEtw = pickupNode.etw + pickupNode.duration + travelTime;
        if (deliveryEtw < minDeliveryEtw) {
            deliveryEtw = Math.min(horizonMinutes, minDeliveryEtw);
        }

        const minDeliveryLtw = pickupNode.etw + travelTime + 30;
        if (deliveryLtw < minDeliveryLtw) {
            deliveryLtw = Math.min(horizonMinutes, minDeliveryLtw);
        }

        nodes.push({
            id: deliveryNodeId,
            lat: order.delivery.lat,
            lng: order.delivery.lng,
            demand: -order.demand,
            etw: deliveryEtw,
            ltw: deliveryLtw,
            duration: 5,
            p: pickupNodeId, // Points to pickup
            d: 0 // Delivery has d=0
        });
    }

    // Build time matrix
    const times: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (i === j) continue;
            const km = haversineKm(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng);
            times[i][j] = Math.max(1, Math.round((km / speedKmh) * 60));
        }
    }

    // Build output
    const lines: string[] = [];
    lines.push(`NAME: test-sartori`);
    lines.push(`LOCATION: ${depot.name}`);
    lines.push(`COMMENT: Test instance`);
    lines.push(`TYPE: PDPTW`);
    lines.push(`SIZE: ${size}`);
    lines.push(`DISTRIBUTION: custom`);
    lines.push(`DEPOT: ${depot.name}`);
    lines.push(`ROUTE-TIME: ${horizonMinutes}`);
    lines.push(`TIME-WINDOW: ${horizonMinutes}`);
    lines.push(`CAPACITY: ${maxCapacity}`);
    lines.push(`NODES`);

    for (const n of nodes) {
        lines.push([n.id, n.lat.toFixed(8), n.lng.toFixed(8), n.demand, n.etw, n.ltw, n.duration, n.p, n.d].join(' '));
    }

    lines.push(`EDGES`);
    for (let i = 0; i < size; i++) {
        lines.push(times[i].join(' '));
    }

    lines.push(`EOF`);

    return {
        text: lines.join('\n'),
        nodes,
        numRequests,
        times
    };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Main test
console.log("=== Testing New Sartori Format Generation ===\n");

const { text, nodes, numRequests, times } = buildTestSartoriInstance();

console.log("Generated instance:\n");
console.log(text);
console.log("\n=== Verification ===\n");

console.log(`Total nodes: ${nodes.length} (expected: 1 + ${numRequests}*2 = ${1 + numRequests * 2})`);
console.log(`Node 0 (depot): demand=${nodes[0].demand}, p=${nodes[0].p}, d=${nodes[0].d}`);

console.log("\nPickup nodes (should be 1 to numRequests):");
for (let i = 1; i <= numRequests; i++) {
    const n = nodes[i];
    console.log(`  Node ${n.id}: demand=${n.demand} (positive), p=${n.p} (should be 0), d=${n.d} (delivery index)`);
}

console.log("\nDelivery nodes (should be numRequests+1 to 2*numRequests):");
for (let i = numRequests + 1; i <= 2 * numRequests; i++) {
    const n = nodes[i];
    console.log(`  Node ${n.id}: demand=${n.demand} (negative), p=${n.p} (pickup index), d=${n.d} (should be 0)`);
}

console.log("\n=== Rust Solver Constraint Check ===");
console.log("Checking: pickup.ready <= delivery.due - travel_time\n");

for (let i = 0; i < numRequests; i++) {
    const pickupId = 1 + i;
    const deliveryId = 1 + numRequests + i;
    const pickup = nodes[pickupId];
    const delivery = nodes[deliveryId];
    const tt = times[pickupId][deliveryId];

    const valid = pickup.etw <= delivery.ltw - tt;
    console.log(`Request ${i}: pickup[${pickupId}].ready=${pickup.etw} <= delivery[${deliveryId}].due=${delivery.ltw} - tt=${tt} = ${delivery.ltw - tt}  => ${valid ? 'PASS ✓' : 'FAIL ✗'}`);
}

// Save test instance
const testPath = path.join(__dirname, '..', 'storage', 'temp', 'test-sartori-instance.txt');
fs.writeFileSync(testPath, text);
console.log(`\nSaved test instance to: ${testPath}`);
console.log("\nNow run solver with:");
console.log(`& "D:\\CODE\\WAYO\\backend\\bin\\pdptw_solver_rust.exe" -i "${testPath}" -o "D:\\CODE\\WAYO\\backend\\storage\\temp\\test-solutions" --iterations 1000 --time-limit 10 --format sartori`);
