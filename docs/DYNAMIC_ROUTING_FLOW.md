# Dynamic Routing Flow - Current & Future

## 📋 Tổng quan

Document này mô tả chi tiết flow xử lý dynamic routing trong hệ thống WAYO, bao gồm:
- **Current Implementation**: Flow hiện tại đang hoạt động (v1.0)
- **Future Improvements**: Các cải tiến dự kiến (v2.0, v3.0)

---

## 🔄 Current Implementation (v1.0)

### Architecture Overview

```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
└────────┬────────┘
         │ POST /api/jobs/reoptimize
         │ {previous_solution_id, vehicles, new_orders}
         ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Express + TypeScript)              │
├─────────────────────────────────────────────────────────┤
│  1. Fetch Data from Supabase                            │
│     - Previous solution → route_stops → order_ids       │
│     - Active orders (pending/assigned/in_transit)       │
│     - New orders (from order_delta)                     │
│     - Vehicles & Organization depot                     │
├─────────────────────────────────────────────────────────┤
│  2. Preprocessing (reoptimizationPreprocessor.ts)      │
│     ┌──────────────────────────────────────────────┐   │
│     │ For each vehicle:                            │   │
│     │  • Create dummy_start node (current GPS)     │   │
│     │  • Create ghost_pickup (in-transit orders)   │   │
│     │                                               │   │
│     │ For each order:                              │   │
│     │  • Create pickup/delivery nodes              │   │
│     │  • Adjust time windows (relative to now)    │   │
│     │                                               │   │
│     │ Build Sartori instance:                      │   │
│     │  • Depot + Dummies + Real nodes              │   │
│     │  • Update mapping_ids (29 nodes)             │   │
│     └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  3. Solver Execution (SolverWorker.ts)                 │
│     • Spawn Rust binary: pdptw_solver_rust.exe          │
│     • Args: --format sartori --time-limit 60           │
│     • Output: Route sequences (node indices)            │
├─────────────────────────────────────────────────────────┤
│  4. Post-processing (dummyNodeCleaner.ts)              │
│     • Remove dummy/ghost nodes from routes              │
│     • Extract vehicle_id from dummy_start               │
│     • Re-index node sequences                           │
├─────────────────────────────────────────────────────────┤
│  5. Persistence (persistSolutionSnapshot.ts)           │
│     • Insert optimization_solutions                     │
│     • Insert routes (with vehicle_id)                   │
│     • Insert route_stops (pickup/delivery)              │
│     • Copy driver assignments from parent               │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   Supabase      │
│   Database      │
└─────────────────┘
```

### Detailed Flow Steps

#### Step 1: Trigger Re-optimization
**Frontend: DispatchWorkspaceClient.tsx**
```typescript
// Lần đầu: previous_solution_id = undefined
// Lần sau: previous_solution_id = latestSolutionId
const reoptimizationContext: ReoptimizationContext = {
  previous_solution_id: latestSolutionId || undefined,
  vehicle_states: vehicleStates,
  order_delta: {
    new_order_ids: newOrderIds,
    cancelled_order_ids: [],
  },
  organization_id: organizationId,
  require_depot_return: true,
};

const result = await solverService.reoptimizeRoutes(
  reoptimizationContext,
  solverParams
);
```

#### Step 2: Backend - Fetch Data
**Backend: jobRoutes.ts**
```typescript
// Query previous solution's orders
const { data: solutionStops } = await supabase
  .from('route_stops')
  .select('order_id, routes!inner(solution_id)')
  .eq('routes.solution_id', previous_solution_id)
  .not('order_id', 'is', null);

// Get active orders (exclude cancelled, completed)
const activeOrders = await fetchActiveOrders(solutionOrderIds);

// Combine: active + new - cancelled
const allOrders = [...activeOrders, ...newOrders];
```

#### Step 3: Preprocessing - Build Instance
**Backend: reoptimizationPreprocessor.ts**
```typescript
// Create dummy nodes for each vehicle
for (const vehicle of vehicles) {
  const dummyStartNode: DummyNode = {
    node_index: nodeIndex++,
    node_type: 'dummy_start',
    vehicle_id: vehicle.vehicle_id,
    lat: vehicle.lat,
    lng: vehicle.lng,
    ready_time: currentTimeMinutes,
  };
  dummy_nodes.push(dummyStartNode);
  
  // Ghost pickup for in-transit orders
  if (vehicle.picked_order_ids.length > 0) {
    const ghostPickup: DummyNode = {
      node_type: 'ghost_pickup',
      demand: totalLoad,
    };
    dummy_nodes.push(ghostPickup);
  }
}

// Build Sartori instance (29 nodes example)
// Node 0: Depot
// Nodes 1-9: Dummy pickups (9 vehicles)
// Nodes 10-18: Dummy deliveries (9 vehicles)
// Nodes 19-23: Real pickups (5 orders)
// Nodes 24-28: Real deliveries (5 orders)

const { instance_text, updated_mapping_ids, updated_dummy_nodes } 
  = await buildSartoriInstanceText({...});
```

#### Step 4: Solver Execution
**Backend: SolverWorker.ts**
```bash
# Command executed
pdptw_solver_rust.exe \
  -i instance.txt \
  -o solutions/ \
  --iterations 100000 \
  --time-limit 60 \
  --format sartori

# Output
Route 1: 0 5 2 1 8 9 17 12 11 24 23 0
Route 2: 0 3 7 4 16 6 15 19 18 0
Cost: 1234.56
```

#### Step 5: Post-processing & Cleanup
**Backend: dummyNodeCleaner.ts**
```typescript
// Remove dummy nodes from solver output
for (const nodeIndex of route.node_sequence) {
  const mapping = mappingIds[nodeIndex];
  
  // Skip depot
  if (mapping.kind === 'depot') continue;
  
  // Skip dummy nodes (DUMMY_ prefix)
  if (mapping.is_dummy && mapping.order_id?.startsWith('DUMMY_')) {
    vehicle_id = mapping.vehicle_id; // Extract vehicle_id
    continue;
  }
  
  // Keep real nodes
  if (mapping.kind === 'pickup' || mapping.kind === 'delivery') {
    cleanedRoute.push(nodeIndex);
  }
}
```

#### Step 6: Persistence & Assignment
**Backend: persistSolutionSnapshot.ts**
```typescript
// 1. Save solution
INSERT INTO optimization_solutions (
  organization_id,
  solution_data,
  parent_solution_id  -- Link to previous
) VALUES (...);

// 2. Save routes
INSERT INTO routes (
  solution_id,
  route_number,
  vehicle_id,  -- From dummy_start node
  status = 'planned',
  driver_id = NULL
) VALUES (...);

// 3. Save stops (SKIP dummy nodes)
for (const node of route.sequence) {
  if (!mapping.is_dummy && mapping.order_id) {
    INSERT INTO route_stops (
      route_id,
      order_id,
      location_id,
      stop_type
    ) VALUES (...);
  }
}

// 4. Inherit driver assignments
CALL copy_driver_assignments(parent_solution_id, new_solution_id);
```

### Current Limitations

| Issue | Description | Impact |
|-------|-------------|--------|
| **No Locking** | Solver can move committed orders | Tài xế có thể bị "quay xe" |
| **No Real-time GPS** | Vehicle position from manual input | Outdated locations |
| **Manual Polling** | Frontend polls every 5 mins | Delayed updates |
| **Preprocessing Overhead** | Build dummy nodes, then clean them | Complex logic, bugs |
| **No In-transit Tracking** | Picked orders not tracked accurately | Wrong initial load |

---

## 🚀 Future Implementation (v2.0)

### Key Improvements

1. **Native Dynamic Mode** - Dùng Rust solver's built-in dynamic re-optimization
2. **Real-time GPS Tracking** - Driver app gửi location 30s/lần
3. **Supabase Realtime** - Socket events thay vì polling
4. **Committed Order Locking** - Khóa cứng orders đang giao
5. **Vehicle Tracking Table** - Persistent state storage

### Architecture Overview

```
┌─────────────────┐     GPS every 30s      ┌──────────────────┐
│  Driver App     │───────────────────────▶│  Vehicle         │
│  (Mobile)       │                         │  Tracking API    │
└─────────────────┘                         └────────┬─────────┘
                                                     │
                                                     ▼
┌─────────────────┐     Realtime Event    ┌──────────────────┐
│   Dispatcher    │◀──────────────────────│  Supabase        │
│   Frontend      │                        │  Realtime        │
└────────┬────────┘                        │  Channels        │
         │                                  └──────────────────┘
         │ Trigger Re-opt
         ▼
┌─────────────────────────────────────────────────────────┐
│              Backend - Native Dynamic Mode               │
├─────────────────────────────────────────────────────────┤
│  1. Fetch Latest State (NO preprocessing)              │
│     • vehicle_tracking table (GPS + load)               │
│     • route_assignments (committed orders)              │
├─────────────────────────────────────────────────────────┤
│  2. Build Dynamic Input (Rust native format)           │
│     ┌──────────────────────────────────────────────┐   │
│     │ vehicle_states.json:                         │   │
│     │ [{                                            │   │
│     │   vehicle_id: "v1",                          │   │
│     │   current_position: {lat, lng},              │   │
│     │   current_time: 1000,                        │   │
│     │   current_load: 150,                         │   │
│     │   in_transit_deliveries: [1, 3, 5],         │   │
│     │   committed_requests: [1, 2]  // LOCKED     │   │
│     │ }]                                            │   │
│     │                                               │   │
│     │ new_requests.json:                           │   │
│     │ [{ request_id: 10, pickup: {...} }]         │   │
│     └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  3. Native Solver Execution                             │
│     • pdptw_solver_rust --dynamic                       │
│     • --vehicle-states vehicle_states.json              │
│     • --new-requests new_requests.json                  │
│     • --lock-committed  // Khóa cứng committed         │
│     • --late-penalty 100                                │
│     • Output: JSON (no file cleanup needed)             │
├─────────────────────────────────────────────────────────┤
│  4. Direct Persistence (No post-processing)            │
│     • Parse JSON result                                 │
│     • Insert solution + routes                          │
│     • Broadcast event to Realtime                       │
└─────────────────────────────────────────────────────────┘
```

### New Components

#### 1. Vehicle Tracking Table
```sql
CREATE TABLE vehicle_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id),
  organization_id UUID REFERENCES organizations(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  bearing DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  current_load INTEGER DEFAULT 0,
  picked_order_ids UUID[] DEFAULT '{}',
  committed_order_ids UUID[] DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for real-time queries
  INDEX idx_vehicle_tracking_vehicle (vehicle_id),
  INDEX idx_vehicle_tracking_org (organization_id),
  INDEX idx_vehicle_tracking_updated (last_updated DESC)
);
```

#### 2. GPS Update Endpoint
**Backend: vehicleTrackingRoutes.ts**
```typescript
router.post('/vehicles/:vehicleId/position', async (req, res) => {
  const { vehicleId } = req.params;
  const { lat, lng, bearing, speed_kmh } = req.body;
  
  // 1. Update tracking table
  await supabase
    .from('vehicle_tracking')
    .upsert({
      vehicle_id: vehicleId,
      latitude: lat,
      longitude: lng,
      bearing,
      speed_kmh,
      last_updated: new Date(),
    }, { onConflict: 'vehicle_id' });
  
  // 2. Check if significant change → trigger re-optimization
  const shouldReoptimize = await detectSignificantChange(vehicleId);
  if (shouldReoptimize) {
    await triggerReoptimization(organizationId);
  }
  
  res.json({ success: true });
});
```

#### 3. Native Dynamic Mode Endpoint
**Backend: jobRoutes.ts**
```typescript
router.post('/jobs/reoptimize-native', async (req, res) => {
  const { organization_id, previous_solution_id } = req.body;
  
  // 1. Fetch vehicle states from tracking table
  const { data: vehicles } = await supabase
    .from('vehicle_tracking')
    .select('*')
    .eq('organization_id', organization_id);
  
  // 2. Build vehicle_states.json
  const vehicleStates = vehicles.map(v => ({
    vehicle_id: v.vehicle_id,
    current_position: { lat: v.latitude, lng: v.longitude },
    current_time: Math.floor(Date.now() / 1000 / 60),
    current_load: v.current_load,
    in_transit_deliveries: v.picked_order_ids.map(extractDeliveryId),
    committed_requests: v.committed_order_ids,
  }));
  
  // 3. Fetch new orders
  const { data: newOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .eq('organization_id', organization_id);
  
  // 4. Build new_requests.json
  const newRequests = newOrders.map(buildRequestFromOrder);
  
  // 5. Call native solver
  const result = await solverWorker.solveDynamic({
    instance_text: baseInstance,
    vehicle_states: vehicleStates,
    new_requests: newRequests,
    params: {
      lock_committed: true,
      late_penalty: 100,
      unassigned_penalty: 500,
    },
  });
  
  // 6. Parse JSON result (no cleanup needed!)
  const routes = JSON.parse(result.stdout);
  
  // 7. Persist
  await persistDynamicSolution({
    routes,
    organization_id,
    parent_solution_id,
  });
  
  // 8. Broadcast real-time event
  await supabase
    .channel(`org:${organization_id}`)
    .send({
      type: 'broadcast',
      event: 'SOLUTION_UPDATED',
      payload: { solution_id: newSolutionId },
    });
  
  res.json({ success: true, solution_id: newSolutionId });
});
```

#### 4. Frontend Realtime Subscription
**Frontend: DispatchWorkspaceClient.tsx**
```typescript
useEffect(() => {
  if (!organizationId) return;
  
  const channel = supabase
    .channel(`org:${organizationId}`)
    .on('broadcast', { event: 'SOLUTION_UPDATED' }, async (payload) => {
      console.log('New solution available:', payload.solution_id);
      
      // Fetch new routes
      const newRoutes = await fetchRoutes(payload.solution_id);
      
      // Client-side diffing
      const diff = compareRoutes(currentRoutes, newRoutes);
      
      // Update UI with smooth transition
      if (diff.added.length > 0) {
        toast.info(`Thêm ${diff.added.length} điểm mới vào lộ trình`);
      }
      if (diff.removed.length > 0) {
        toast.warning(`Đã hủy ${diff.removed.length} điểm`);
      }
      
      // Update state
      setCurrentRoutes(newRoutes);
      setLatestSolutionId(payload.solution_id);
    })
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, [organizationId]);
```

---

## 🎯 Future Implementation (v3.0)

### Advanced Features

#### 1. Predictive Re-optimization
```typescript
// Trigger re-optimization BEFORE events happen
class PredictiveOptimizer {
  async analyze() {
    // 1. ML prediction: Xe A sẽ đến pickup trong 5 phút
    const prediction = await predictArrival(vehicleA);
    
    // 2. Pre-compute: Nếu pickup thành công, route sẽ như thế nào?
    const futureState = {
      ...currentState,
      vehicle_a_load: currentLoad + newOrder.demand,
      vehicle_a_picked: [...picked, newOrder.id],
    };
    
    // 3. Run solver in background
    const precomputedSolution = await solveAsync(futureState);
    
    // 4. Cache result
    await redis.set(
      `precomputed:${vehicleA}:${newOrder.id}`,
      precomputedSolution,
      'EX', 300
    );
    
    // 5. When actual event happens → instant update
  }
}
```

#### 2. Multi-Depot Support
```typescript
// Multiple warehouses
const depots = [
  { id: 'depot-north', lat: 10.8, lng: 106.7 },
  { id: 'depot-south', lat: 10.7, lng: 106.6 },
];

// Solver assigns orders to optimal depot
const result = await solver.solve({
  depots,
  vehicles: vehiclesWithHomeDepot,
  orders,
});
```

#### 3. Driver Preference Learning
```typescript
// Learn driver patterns
class DriverProfiler {
  async analyzeHistory(driverId: string) {
    const history = await getCompletedRoutes(driverId);
    
    return {
      preferred_areas: extractPreferredZones(history),
      average_speed: calculateAvgSpeed(history),
      service_time_multiplier: 1.2, // Tài xế này chậm hơn 20%
      break_pattern: detectBreakTimes(history),
    };
  }
  
  // Apply to solver constraints
  async customize(driverId: string) {
    const profile = await this.analyzeHistory(driverId);
    return {
      time_multiplier: profile.service_time_multiplier,
      avoid_zones: profile.disliked_areas,
    };
  }
}
```

---

## 📊 Comparison Table

| Feature | Current (v1.0) | Future v2.0 | Future v3.0 |
|---------|----------------|-------------|-------------|
| **Solver Mode** | Preprocessing | Native Dynamic | Predictive |
| **GPS Tracking** | ❌ Manual | ✅ 30s interval | ✅ + ML prediction |
| **Realtime Sync** | ❌ Polling | ✅ Websocket | ✅ + Push notif |
| **Order Locking** | ❌ None | ✅ --lock-committed | ✅ + Soft lock |
| **Multi-depot** | ❌ Single | ❌ Single | ✅ Multiple |
| **Driver Profile** | ❌ None | ❌ None | ✅ ML-based |
| **Response Time** | ~60s | ~30s | ~5s (cached) |
| **Complexity** | High (preproc) | Low (native) | Medium (ML) |

---

## 🔧 Migration Path

### Phase 1: Stability (Current → v1.5)
- ✅ Fix route_stops persistence
- ✅ Fix mapping_ids count
- ⏳ Add integration tests
- ⏳ Performance monitoring

### Phase 2: Native Mode (v1.5 → v2.0)
1. ⏳ Create vehicle_tracking table
2. ⏳ Implement GPS update endpoint
3. ⏳ Implement /reoptimize-native endpoint
4. ⏳ Add Supabase Realtime channels
5. ⏳ Frontend: Subscribe to events
6. ⏳ Gradual rollout (10% → 50% → 100%)

### Phase 3: Advanced (v2.0 → v3.0)
1. ⏳ ML model training (ETA prediction)
2. ⏳ Multi-depot routing
3. ⏳ Driver profiling system
4. ⏳ Predictive re-optimization

---

## 📚 References

- [Rust Solver Dynamic Mode](../backend/pdptw_solver_module_v2/CLI_COMPATIBILITY.md)
- [Reoptimization Implementation](./REOPTIMIZATION_IMPLEMENTATION.md)
- [Priority Update Guide](./PRIORITY_UPDATE_GUIDE.md)
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)

---

**Last Updated:** 2026-01-09  
**Version:** 1.0  
**Status:** Current implementation stable, v2.0 in planning
