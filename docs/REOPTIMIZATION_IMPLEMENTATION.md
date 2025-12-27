# Dynamic Re-optimization Implementation Summary

## Overview

This implementation adds support for dynamic vehicle routing re-optimization using **Virtual Start Nodes** (Dummy Nodes) to handle active vehicles, in-transit loads, and order changes without native multi-depot solver support.

## Architecture

### Key Components

1. **Preprocessing Layer** (`backend/src/workers/reoptimizationPreprocessor.ts`)
   - Generates augmented PDPTW instances with dummy nodes
   - Creates Virtual Start Nodes for each active vehicle
   - Creates Ghost Pickup Nodes for already-picked orders
   - Implements vehicle swapping prevention via multi-dimensional capacity hack

2. **Post-processing Layer** (`backend/src/workers/dummyNodeCleaner.ts`)
   - Filters dummy/ghost nodes from solver output
   - Extracts metadata (start_time, initial_load)
   - Validates ghost pickups have corresponding deliveries

3. **Persistence Layer** (`backend/src/persistence/persistSolutionSnapshot.ts`)
   - Updated to handle cleaned routes with initial vehicle state
   - Stores start_time and initial_load in route_data

4. **API Layer** (`backend/src/routes/jobRoutes.ts`)
   - New `POST /api/jobs/reoptimize` endpoint
   - Fetches vehicle states, orders, and depot from database
   - Orchestrates preprocessing → solving → persistence workflow

5. **Enrichment Services** (`backend/src/enrichment/enrichmentClient.ts`)
   - Added `snapToRoad()` function with bearing support
   - Uses 2-minute/500m threshold for last-stop vs GPS snapping

6. **Frontend Integration** (`frontend/src/services/solverService.ts`)
   - Added `submitReoptimizationJob()` and `reoptimizeRoutes()` methods
   - Type definitions for VehicleState and ReoptimizationContext

## How It Works

### Problem Statement

Original issue: When re-optimizing after 5 minutes with order changes (2 new, 1 cancelled), the system only optimized the 3 changed orders and forgot the 47 active orders, resulting in incomplete Solution 2.

### Solution: Virtual Start Nodes Workaround

Since the solver doesn't support multi-depot natively, we simulate it at preprocessing:

1. **Node 0 remains the static depot**
2. **Dummy Start Nodes** created for each active vehicle at their current GPS position (snapped to road)
3. **Ghost Pickup Nodes** created for orders already picked up (to represent current vehicle load)
4. **Zero-cost edges** from depot to dummy nodes (conceptual - enforced via capacity dimensions)
5. **Vehicle-specific capacity dimensions** prevent vehicle swapping (each vehicle has unique capacity ID)

### Data Flow

```
Frontend Reoptimization Request
  ↓
  vehicle_states: [{ vehicle_id, lat, lng, bearing, picked_order_ids }]
  order_delta: { new_order_ids, cancelled_order_ids }
  ↓
Backend: Fetch active orders, new orders, vehicles, depot
  ↓
Preprocessing: Generate augmented PDPTW instance
  - Node 0: Depot
  - Nodes 1-N: Dummy Start Nodes (vehicle positions)
  - Nodes N+1-M: Ghost Pickup Nodes (vehicle loads)
  - Nodes M+1-K: Regular pickup/delivery nodes
  ↓
Solver: Processes augmented instance (thinks it's single-depot)
  ↓
Post-processing: Clean dummy nodes
  - Extract start_time from Dummy Node
  - Extract initial_load from Ghost Pickup
  - Filter out dummy/ghost nodes
  - Return only real customer stops
  ↓
Persistence: Save cleaned routes with vehicle metadata
  ↓
Frontend: Display complete Solution 2 with all orders
```

## API Usage

### Endpoint: `POST /api/jobs/reoptimize`

**Request Body:**
```json
{
  "reoptimizationContext": {
    "organization_id": "uuid",
    "previous_solution_id": "uuid",
    "vehicle_states": [
      {
        "vehicle_id": "vehicle-1",
        "lat": 10.762622,
        "lng": 106.660172,
        "bearing": 90,
        "last_stop_location_id": "loc-123",
        "last_stop_time": "2025-12-26T10:30:00Z",
        "picked_order_ids": ["order-5", "order-12"]
      }
    ],
    "order_delta": {
      "new_order_ids": ["order-50", "order-51"],
      "cancelled_order_ids": ["order-10"]
    },
    "require_depot_return": true,
    "end_of_shift": "2025-12-26T18:00:00Z"
  },
  "params": {
    "iterations": 5000,
    "time_limit": 60,
    "max_vehicles": 10
  },
  "createdBy": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-uuid",
  "message": "Reoptimization job submitted successfully",
  "preprocessing_stats": {
    "total_nodes": 120,
    "dummy_nodes": 5,
    "ghost_pickups": 3,
    "active_vehicles": 5
  }
}
```

### Frontend Usage

```typescript
import { solverService } from '@/services/solverService';

// Build reoptimization context
const reoptContext = {
  organization_id: orgId,
  previous_solution_id: currentSolutionId,
  vehicle_states: [
    {
      vehicle_id: 'vehicle-1',
      lat: vehicleTracking.latitude,
      lng: vehicleTracking.longitude,
      bearing: vehicleTracking.bearing,
      picked_order_ids: ['order-5', 'order-12'],
    }
  ],
  order_delta: {
    new_order_ids: ['order-50', 'order-51'],
    cancelled_order_ids: ['order-10'],
  },
};

// Submit and wait for result
const result = await solverService.reoptimizeRoutes(
  reoptContext,
  { iterations: 5000, time_limit: 60 },
  (job) => console.log(`Progress: ${job.progress}%`),
  userId
);

console.log('New solution:', result.solutionId);
```

## Key Features

### 1. Vehicle Position Snapping

```typescript
// Priority 1: Use last stop if recent (< 2 min, < 500m)
// Priority 2: Snap GPS to road network using OSRM/Mapbox
const snapped = await snapToRoad(lat, lng, bearing);
```

### 2. Vehicle Swapping Prevention

Uses multi-dimensional capacity hack:
```typescript
// Assign unique capacity dimension to each vehicle
vehicle_capacity_dimensions.set('vehicle-1', 10000);
vehicle_capacity_dimensions.set('vehicle-2', 9999);

// Dummy nodes require matching capacity dimension
// This forces Vehicle 1 to visit only its own dummy node
```

### 3. Ghost Pickup for In-Transit Load

```typescript
// Vehicle has picked Order X (weight: 20) but not delivered yet
const ghostPickup = {
  node_type: 'ghost_pickup',
  vehicle_id: 'vehicle-1',
  demand: 20, // Current load
  service_time: 0,
  original_order_ids: ['order-x'],
};

// Solver sees: Vehicle loads 20kg at start → continues to deliver
```

### 4. Post-Solve Cleanup

```typescript
// Solver output: "Route 1: 0 49 50 1 2 3 0"
// - 0: Depot (skip)
// - 49: Dummy Start (extract start_time, skip)
// - 50: Ghost Pickup (extract initial_load, skip)
// - 1, 2, 3: Real stops (keep)
// - 0: Depot (skip)

// Cleaned output: [1, 2, 3]
// Metadata: { start_time: 480, initial_load: 20, vehicle_id: 'vehicle-1' }
```

## Unit Tests

Comprehensive test suite in `backend/src/workers/reoptimizationPreprocessor.test.ts`:

- ✓ Test 1: Dummy Node Generation at correct vehicle positions
- ✓ Test 2: Ghost Pickup Logic with positive demand
- ✓ Test 3: Zero-Cost Matrix structure validation
- ✓ Test 4: Post-processing cleanup and metadata extraction
- ✓ Test 5: Solver output parsing

**Run tests:**
```bash
cd backend
npm test reoptimizationPreprocessor.test.ts
```

## Database Schema Updates

### Extended MappingId Type

```typescript
type MappingId = {
  kind: 'depot' | 'pickup' | 'delivery' | 'dummy_start' | 'ghost_pickup';
  order_id: string | null;
  location_id: string | null;
  lat: number;
  lng: number;
  is_dummy?: boolean;
  vehicle_id?: string;
  original_order_ids?: string[]; // For ghost pickups
};
```

### Route Data Extensions

```typescript
route_data: {
  route_sequence: number[],
  metrics_meters_seconds: { distance_meters, duration_seconds },
  used_edges_matrix: boolean,
  start_time?: number, // From dummy node
  initial_load?: number, // From ghost pickup
}
```

## Configuration

### Snap-to-Road Thresholds

```typescript
const SNAP_TO_ROAD_TIME_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const SNAP_TO_ROAD_DISTANCE_THRESHOLD_M = 500; // 500 meters
```

### Solver Parameters

Recommended settings for dynamic re-optimization:
```typescript
{
  iterations: 5000,
  time_limit: 60, // 1 minute for fast re-optimization
  max_vehicles: actual_vehicle_count,
  acceptance: 'sa', // Simulated annealing for better quality
  min_destroy: 15,
  max_destroy: 40,
}
```

## Known Limitations & Future Improvements

### Current Limitations

1. **Solver Format**: Relies on Sartori format text parsing. If solver output format changes, parser needs update.

2. **Multi-dimensional Capacity**: Assumes solver supports multiple capacity dimensions. If not supported, alternative is per-vehicle instance generation.

3. **Initial Route Seeding**: Currently generates `initial_routes` but solver may not support warm-start. Falls back to penalty-based approach if needed.

4. **GPS Accuracy**: Snap-to-road depends on enrichment API. Poor GPS or missing road data may cause inaccurate snapping.

### Future Improvements

1. **Real-time Vehicle Tracking**: Integrate with `vehicle_tracking` table for live GPS updates during re-optimization intervals.

2. **Partial Route Locking**: Allow locking only completed stops instead of entire routes for more flexibility.

3. **Time Window Adjustment**: Auto-adjust time windows based on vehicle delays and current time.

4. **Multi-depot Native Support**: If solver is upgraded to support multi-depot natively, remove Virtual Start Node workaround.

5. **Solver Warm-start**: Implement proper warm-start by seeding previous solution for faster convergence.

## Troubleshooting

### Issue: Vehicle swapping still occurs

**Cause**: Multi-dimensional capacity not supported by solver or incorrectly configured.

**Solution**: 
- Verify solver supports multiple capacity dimensions
- Check that dummy node demands match vehicle capacity dimensions
- Consider generating separate instances per vehicle and merging results

### Issue: Ghost pickup validation errors

**Cause**: Picked orders have been cancelled or delivery location deleted.

**Solution**:
- Validate order status before creating ghost pickups
- Handle orphaned ghost pickups by creating synthetic delivery at vehicle location
- Add manual intervention workflow for edge cases

### Issue: Snapped coordinates far from original

**Cause**: GPS position off road network or bearing incorrect.

**Solution**:
- Increase snap radius in enrichment API
- Use last completed stop if snap distance > 1km
- Add validation to reject unreasonable snaps

### Issue: Solution 2 missing orders

**Cause**: Preprocessing failed to merge active orders correctly.

**Solution**:
- Check `cancelled_order_ids` filter logic
- Verify database query includes all statuses: `['WAITING', 'IN_TRANSIT', 'assigned']`
- Add logging to track order count at each stage

## Files Modified/Created

### Backend

**Created:**
- `backend/src/types/reoptimization.ts` - Type definitions
- `backend/src/workers/reoptimizationPreprocessor.ts` - Core preprocessing logic
- `backend/src/workers/dummyNodeCleaner.ts` - Post-processing cleanup
- `backend/src/workers/reoptimizationPreprocessor.test.ts` - Unit tests

**Modified:**
- `backend/src/enrichment/enrichmentClient.ts` - Added snapToRoad()
- `backend/src/persistence/persistSolutionSnapshot.ts` - Handle cleaned routes
- `backend/src/routes/jobRoutes.ts` - Added /reoptimize endpoint

### Frontend

**Modified:**
- `frontend/src/services/solverService.ts` - Added reoptimization methods

### Next Steps (To Complete)

**TODO:** Integrate into dispatch-dynamic page:
- Query `vehicle_tracking` table for current GPS positions
- Join `route_stops` to find picked orders (pickup completed, delivery not completed)
- Build `VehicleState[]` array
- Detect order changes (new orders, cancelled orders)
- Trigger reoptimization on interval or manual button click

## Contact & Support

For questions or issues, refer to:
- Architecture docs: `docs/architecture/overview.md`
- API documentation: `docs/api/`
- Deployment guide: `docs/guides/deployment.md`

---

**Implementation Date:** December 26, 2025  
**Version:** 1.0.0  
**Status:** ✅ Core Implementation Complete (Frontend integration pending)
