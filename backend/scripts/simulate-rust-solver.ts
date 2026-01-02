import * as fs from 'fs';

const instancePath = 'D:\\CODE\\WAYO\\backend\\storage\\temp\\job-50d8e5f1-b664-4000-b4dd-ebea57a3a1ae-Kwsqi4\\instance.txt';
const content = fs.readFileSync(instancePath, 'utf8');
const lines = content.split('\n');

const nodesIndex = lines.findIndex(l => l.trim() === 'NODES');
const edgesIndex = lines.findIndex(l => l.trim() === 'EDGES');

// Parse nodes
const nodes: any[] = [];
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
            ready: parseInt(parts[4]),  // etw
            due: parseInt(parts[5]),    // ltw
            service: parseInt(parts[6]),
            p: parseInt(parts[7]),
            d: parseInt(parts[8]),
        });
    }
}

// Parse travel times
const travelTimes: number[][] = [];
for (let i = edgesIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === 'EOF') break;
    const times = line.split(/\s+/).map(Number);
    travelTimes.push(times);
}

// Simulate Rust solver's time window tightening logic
console.log('Simulating Rust solver time window tightening...\n');

const latestDeparture = 480; // ROUTE-TIME

// For each pickup-delivery pair
for (const node of nodes) {
    if (node.d > 0) { // This is a pickup
        const p_id = node.id;
        const d_id = node.d;
        const p = nodes.find(n => n.id === p_id);
        const d = nodes.find(n => n.id === d_id);
        
        if (!p || !d) continue;
        
        const tt = travelTimes[p_id]?.[d_id] || 0;
        
        console.log(`\nPair: pickup ${p_id} -> delivery ${d_id}`);
        console.log(`  Before tightening:`);
        console.log(`    Pickup ${p_id}: ready=${p.ready}, due=${p.due}, service=${p.service}`);
        console.log(`    Delivery ${d_id}: ready=${d.ready}, due=${d.due}, service=${d.service}`);
        console.log(`    Travel time: ${tt}`);
        
        // Check BEFORE tightening (this is where the assertion happens)
        const checkBefore = p.ready <= d.due - tt;
        console.log(`  Assertion check: ${p.ready} <= ${d.due} - ${tt} = ${d.due - tt} => ${checkBefore ? 'PASS' : 'FAIL'}`);
        
        if (!checkBefore) {
            console.log(`  ❌❌❌ THIS CAUSES PANIC! p_id: ${d_id} (rdy: ${p.ready}, due: ${d.due}, tt: ${tt})`);
            // Note: Rust reports p_id as the delivery node ID based on the error message format
        }
        
        // Simulate tightening (what Rust does after the check)
        // d.due = min(d.due, latest_departure - d.service)
        const newDDue = Math.min(d.due, latestDeparture - d.service);
        
        // d.ready = max(d.ready, p.ready + p.service + tt)
        const newDReady = Math.max(d.ready, p.ready + p.service + tt);
        
        // p.due = min(p.due, d.due - tt - p.service)
        const newPDue = Math.min(p.due, newDDue - tt - p.service);
        
        console.log(`  After tightening:`);
        console.log(`    Pickup ${p_id}: ready=${p.ready}, due=${newPDue}`);
        console.log(`    Delivery ${d_id}: ready=${newDReady}, due=${newDDue}`);
        
        if (newPDue < p.ready) {
            console.log(`  ⚠️ WARNING: Pickup due (${newPDue}) < ready (${p.ready}) - INFEASIBLE!`);
        }
    }
}
