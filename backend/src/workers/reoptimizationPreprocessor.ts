/**
 * Reoptimization Preprocessor
 * 
 * Generates augmented PDPTW instances with Virtual Start Nodes (Dummy Nodes)
 * for dynamic re-optimization of vehicle routing with active vehicles.
 * 
 * Key Features:
 * - Dummy Start Nodes: Represent current vehicle positions
 * - Ghost Pickup Nodes: Handle orders already picked up but not delivered
 * - Zero-cost edges: Connect depot to dummy nodes
 * - Multi-dimensional capacity: Prevent vehicle swapping using capacity hack
 */

import { snapToRoad } from '../enrichment/enrichmentClient';
import type {
    VehicleState,
    ReoptimizationContext,
    DummyNode,
    MappingIdExtended,
    AugmentedPDPTWInstance,
    SnappedLocation,
    InitialRoute,
} from '../types/reoptimization';

interface Order {
    id: string;
    pickup_location_id: string;
    delivery_location_id: string;
    pickup_lat: number;
    pickup_lng: number;
    delivery_lat: number;
    delivery_lng: number;
    demand_weight?: number;
    demand_volume?: number;
    pickup_time_window_start?: string;
    pickup_time_window_end?: string;
    delivery_time_window_start?: string;
    delivery_time_window_end?: string;
    service_time_pickup?: number; // minutes
    service_time_delivery?: number; // minutes
}

interface Depot {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

interface Vehicle {
    id: string;
    license_plate: string;
    capacity_weight?: number;
    capacity_volume?: number;
}

interface PreprocessingInput {
    context: ReoptimizationContext;
    depot: Depot;
    active_orders: Order[]; // Orders not yet completed
    new_orders: Order[];
    vehicles: Vehicle[];
    current_timestamp: Date;
    end_of_shift?: Date;
}

const SNAP_TO_ROAD_TIME_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const SNAP_TO_ROAD_DISTANCE_THRESHOLD_M = 500; // 500 meters

/**
 * Determine the best location for a vehicle's dummy node
 * Priority 1: Last stop if recent (< 2 min or < 500m)
 * Priority 2: Snap GPS to road network
 */
async function determineVehicleStartLocation(
    vehicleState: VehicleState,
    currentTime: Date
): Promise<SnappedLocation> {
    // Priority 1: Use last stop if recent
    if (vehicleState.last_stop_time && vehicleState.last_stop_location_id) {
        const lastStopTime = new Date(vehicleState.last_stop_time);
        const timeSinceLastStop = currentTime.getTime() - lastStopTime.getTime();
        
        if (timeSinceLastStop < SNAP_TO_ROAD_TIME_THRESHOLD_MS) {
            // TODO: Fetch actual location coordinates from location_id
            // For now, assume vehicle GPS is close to last stop
            const distance = 0; // Would calculate from location table
            
            if (distance < SNAP_TO_ROAD_DISTANCE_THRESHOLD_M) {
                return {
                    lat: vehicleState.lat,
                    lng: vehicleState.lng,
                    snapped: false,
                    source: 'last_stop',
                };
            }
        }
    }

    // Priority 2: Snap GPS to road network
    const snapped = await snapToRoad(vehicleState.lat, vehicleState.lng, vehicleState.bearing);
    
    return {
        lat: snapped.lat,
        lng: snapped.lng,
        snapped: snapped.snapped,
        distance_from_original: snapped.distance_from_original,
        source: snapped.snapped ? 'snapped_road' : 'gps',
    };
}

/**
 * Calculate total demand for orders currently on a vehicle (picked but not delivered)
 */
function calculateVehicleLoad(pickedOrderIds: string[], allOrders: Order[]): number {
    let totalWeight = 0;
    
    for (const orderId of pickedOrderIds) {
        const order = allOrders.find(o => o.id === orderId);
        if (order && order.demand_weight) {
            totalWeight += order.demand_weight;
        }
    }
    
    return totalWeight;
}

/**
 * Convert Date to time window value relative to a reference start time (in minutes)
 */
function dateToRelativeMinutes(date: Date | string | undefined, referenceStart: Date, fallback: number): number {
    if (!date) return fallback;
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return fallback;
    const diff = Math.floor((d.getTime() - referenceStart.getTime()) / 60000); // minutes
    // CHANGED: Allow past times (negative diff) for orders that may have been created moments ago
    // We'll clamp to 0 only if it's significantly in the past (> 10 minutes)
    return diff < -10 ? 0 : Math.max(0, diff);
}

/**
 * Calculate reference start time for relative time windows.
 *
 * We intentionally anchor to the current timestamp so that relative minutes stay within
 * the solver horizon (e.g. 480 minutes). If we anchored to an old earliest order time,
 * "now" would become a huge number of minutes and then get clamped to the horizon,
 * causing infeasible tight windows (especially for dummy nodes).
 */
function calculateReferenceStart(_orders: Order[], currentTimestamp: Date): Date {
    return currentTimestamp;
}

/**
 * Convert Date to time window value (minutes from start of day or unix timestamp)
 * @deprecated Use dateToRelativeMinutes instead
 */
function dateToTimeWindow(date: Date | string | undefined, fallback: number): number {
    if (!date) return fallback;
    const d = typeof date === 'string' ? new Date(date) : date;
    return Math.floor(d.getTime() / 1000 / 60); // Minutes since epoch
}

/**
 * Main preprocessing function to generate augmented PDPTW instance
 */
export async function preprocessReoptimization(
    input: PreprocessingInput
): Promise<AugmentedPDPTWInstance> {
    const {
        context,
        depot,
        active_orders,
        new_orders,
        vehicles,
        current_timestamp,
        end_of_shift,
    } = input;

    // Merge and deduplicate orders (new_orders may overlap with active_orders)
    const orderMap = new Map<string, Order>();
    for (const order of active_orders) {
        orderMap.set(order.id, order);
    }
    for (const order of new_orders) {
        orderMap.set(order.id, order); // New orders override active orders if duplicated
    }
    
    console.log(`[PreprocessReopt] active_orders count: ${active_orders.length}, new_orders count: ${new_orders.length}, after dedup: ${orderMap.size}`);
    
    // Filter out cancelled orders
    const allOrders = Array.from(orderMap.values()).filter(
        order => !context.order_delta.cancelled_order_ids.includes(order.id)
    );

    console.log(`[PreprocessReopt] After filtering cancelled: ${allOrders.length} orders, vehicles: ${context.vehicle_states.length}`);

    const currentTimeMinutes = dateToTimeWindow(current_timestamp, 0);
    const rawEndOfShiftMinutes = dateToTimeWindow(end_of_shift, currentTimeMinutes + 480); // Default 8 hour shift
    
    // Ensure end_of_shift is at least 8 hours (480 minutes) after current time
    // This prevents infeasible time windows when end_of_shift is undefined or too close
    const endOfShiftMinutes = Math.max(rawEndOfShiftMinutes, currentTimeMinutes + 480);
    
    console.log(`[PreprocessReopt] Time windows: current=${currentTimeMinutes}, endOfShift=${endOfShiftMinutes} (buffer: ${endOfShiftMinutes - currentTimeMinutes} minutes)`);

    // Build mapping_ids starting with depot
    const mapping_ids: MappingIdExtended[] = [
        {
            kind: 'depot',
            order_id: null,
            location_id: null,
            lat: depot.latitude,
            lng: depot.longitude,
            is_dummy: false,
        },
    ];

    const dummy_nodes: DummyNode[] = [];
    const vehicle_capacity_dimensions = new Map<string, number>();
    const initial_routes: InitialRoute[] = [];

    let nodeIndex = 1; // Node 0 is depot

    // Generate dummy nodes and ghost pickups for each active vehicle
    for (let vehicleIdx = 0; vehicleIdx < context.vehicle_states.length; vehicleIdx++) {
        const vehicleState = context.vehicle_states[vehicleIdx];
        const vehicle = vehicles.find(v => v.id === vehicleState.vehicle_id);
        
        if (!vehicle) {
            console.warn(`Vehicle ${vehicleState.vehicle_id} not found in vehicles list`);
            continue;
        }

        // Determine vehicle start location
        const startLocation = await determineVehicleStartLocation(vehicleState, current_timestamp);

        // Create Dummy Start Node
        const dummyStartNodeIndex = nodeIndex++;
        const dummyStartNode: DummyNode = {
            node_index: dummyStartNodeIndex,
            node_type: 'dummy_start',
            vehicle_id: vehicleState.vehicle_id,
            lat: startLocation.lat,
            lng: startLocation.lng,
            demand: 0,
            ready_time: currentTimeMinutes,
            due_time: endOfShiftMinutes,
            service_time: 0,
        };
        dummy_nodes.push(dummyStartNode);

        mapping_ids.push({
            kind: 'dummy_start',
            order_id: null,
            location_id: null,
            lat: startLocation.lat,
            lng: startLocation.lng,
            is_dummy: true,
            vehicle_id: vehicleState.vehicle_id,
        });

        // Assign unique capacity dimension to prevent vehicle swapping
        // Use large values to avoid conflicts with actual capacity
        const vehicleCapacityDimValue = 10000 - vehicleIdx;
        vehicle_capacity_dimensions.set(vehicleState.vehicle_id, vehicleCapacityDimValue);

        // Initialize route sequence with depot and dummy start
        const routeSequence: number[] = [0, dummyStartNodeIndex];

        // Create Ghost Pickup Node if vehicle has picked orders
        if (vehicleState.picked_order_ids.length > 0) {
            const vehicleLoad = calculateVehicleLoad(vehicleState.picked_order_ids, allOrders);

            if (vehicleLoad > 0) {
                const ghostPickupNodeIndex = nodeIndex++;
                const ghostPickupNode: DummyNode = {
                    node_index: ghostPickupNodeIndex,
                    node_type: 'ghost_pickup',
                    vehicle_id: vehicleState.vehicle_id,
                    lat: startLocation.lat,
                    lng: startLocation.lng,
                    demand: vehicleLoad,
                    ready_time: currentTimeMinutes,
                    due_time: endOfShiftMinutes,
                    service_time: 0,
                    original_order_ids: vehicleState.picked_order_ids,
                };
                dummy_nodes.push(ghostPickupNode);

                mapping_ids.push({
                    kind: 'ghost_pickup',
                    order_id: null,
                    location_id: null,
                    lat: startLocation.lat,
                    lng: startLocation.lng,
                    is_dummy: true,
                    vehicle_id: vehicleState.vehicle_id,
                    original_order_ids: vehicleState.picked_order_ids,
                });

                routeSequence.push(ghostPickupNodeIndex);
            }
        }

        // Store initial route for warm-start
        initial_routes.push({
            vehicle_number: vehicleIdx + 1,
            node_sequence: routeSequence,
        });
    }

    // Add regular pickup and delivery nodes
    let pickupNodesAdded = 0;
    let deliveryNodesAdded = 0;
    let skippedPickups = 0;
    
    // Calculate reference start for time windows
    const referenceStart = calculateReferenceStart(allOrders, current_timestamp);
    const horizonMinutes = 720; // 12 hours default (increased from 8h to prevent TW clamping)
    
    for (const order of allOrders) {
        // Check if this order is already picked up (on a vehicle)
        const isPickedUp = context.vehicle_states.some(vs => 
            vs.picked_order_ids.includes(order.id)
        );
        
        const pickupDemand = Math.max(1, Math.round(order.demand_weight || 1));
        const pickupEtw = dateToRelativeMinutes(order.pickup_time_window_start, referenceStart, 0);
        const pickupLtw = dateToRelativeMinutes(order.pickup_time_window_end, referenceStart, horizonMinutes);
        const rawDeliveryEtw = dateToRelativeMinutes(order.delivery_time_window_start, referenceStart, 0);
        const rawDeliveryLtw = dateToRelativeMinutes(order.delivery_time_window_end, referenceStart, horizonMinutes);
        
        // IMPORTANT: Ensure delivery time window is AFTER pickup time window
        // Delivery must start after pickup completes (pickup_etw + service_time + min_travel_time)
        const serviceTime = order.service_time_pickup || 5;
        const minTravelTime = 10; // Assume minimum 10 minutes travel between pickup and delivery
        const minDeliveryStart = pickupEtw + serviceTime + minTravelTime;
        const deliveryEtw = Math.max(rawDeliveryEtw, minDeliveryStart);
        
        // CRITICAL FIX: Rust solver asserts: pickup.ready <= delivery.due - travel_time
        // This means delivery.ltw must be >= pickupEtw + travel_time (at minimum)
        // We ensure: delivery.ltw >= pickupEtw + serviceTime + minTravelTime + buffer
        const minDeliveryLtw = pickupEtw + serviceTime + minTravelTime + 30; // 30 min buffer
        const deliveryLtw = Math.max(rawDeliveryLtw, deliveryEtw + 60, minDeliveryLtw); // At least 60 min window AND feasible

        // Add pickup node only if not already picked up
        if (!isPickedUp) {
            nodeIndex++; // Increment for pickup node
            mapping_ids.push({
                kind: 'pickup',
                order_id: order.id,
                location_id: order.pickup_location_id,
                lat: order.pickup_lat,
                lng: order.pickup_lng,
                is_dummy: false,
                // Order details for frontend
                demand: pickupDemand,
                time_window_start: pickupEtw,
                time_window_end: Math.max(pickupEtw + 60, pickupLtw), // Ensure ltw >= etw
                service_time: order.service_time_pickup || 5,
            });
            pickupNodesAdded++;
        } else {
            skippedPickups++;
        }

        // Always add delivery node
        nodeIndex++; // Increment for delivery node
        mapping_ids.push({
            kind: 'delivery',
            order_id: order.id,
            location_id: order.delivery_location_id,
            lat: order.delivery_lat,
            lng: order.delivery_lng,
            is_dummy: false,
            // Order details for frontend
            demand: -pickupDemand, // Negative for delivery (drop-off)
            time_window_start: deliveryEtw,
            time_window_end: Math.max(deliveryEtw + 60, deliveryLtw), // Ensure ltw >= etw
            service_time: order.service_time_delivery || 5,
        });
        deliveryNodesAdded++;
    }
    
    console.log(`[PreprocessReopt] Nodes breakdown: ${pickupNodesAdded} pickups, ${deliveryNodesAdded} deliveries, ${skippedPickups} skipped pickups (already picked), ${dummy_nodes.length} dummy nodes`);
    
    // DEBUG: Log sample mapping_ids with order details
    const samplePickup = mapping_ids.find(m => m.kind === 'pickup' && !m.is_dummy);
    const sampleDelivery = mapping_ids.find(m => m.kind === 'delivery' && !m.is_dummy);
    console.log(`[PreprocessReopt DEBUG] Sample pickup mapping:`, JSON.stringify(samplePickup, null, 2));
    console.log(`[PreprocessReopt DEBUG] Sample delivery mapping:`, JSON.stringify(sampleDelivery, null, 2));

    // Generate Sartori PDPTW instance text
    const { instance_text, updated_mapping_ids, updated_dummy_nodes } = await buildSartoriInstanceText({
        depot,
        mapping_ids,
        dummy_nodes,
        allOrders,
        vehicles,
        vehicle_capacity_dimensions,
        current_timestamp,
    });

    console.log(`[PreprocessReopt] Generated instance with ${updated_mapping_ids.length} nodes (expected: 1 depot + ${context.vehicle_states.length} vehicles * 2 dummy + ${allOrders.length} orders * 2 = ${1 + context.vehicle_states.length * 2 + allOrders.length * 2})`);

    return {
        instance_text,
        mapping_ids: updated_mapping_ids, // Use updated mapping_ids from buildSartoriInstanceText
        dummy_nodes: updated_dummy_nodes, // Use updated dummy_nodes with correct node indices
        vehicle_capacity_dimensions,
        initial_routes,
    };
}

/**
 * Calculate haversine distance in km between two points
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Build Sartori format PDPTW instance text
 * 
 * CRITICAL: Sartori format requires:
 * - Node 0 = single depot
 * - Nodes 1..n = ALL pickups first
 * - Nodes n+1..2n = ALL deliveries after
 * - Pickup i (node index i) has delivery at node (i + num_requests)
 * - p column = pickup index for delivery nodes (0 for pickups)
 * - d column = delivery index for pickup nodes (0 for deliveries)
 * 
 * The Rust solver uses this formula internally:
 * - num_requests = (SIZE - 1) / 2
 * - Pickup node i in file corresponds to internal pickup
 * - Delivery at file node i + num_requests
 */
async function buildSartoriInstanceText(params: {
    depot: Depot;
    mapping_ids: MappingIdExtended[];
    dummy_nodes: DummyNode[];
    allOrders: Order[];
    vehicles: Vehicle[];
    vehicle_capacity_dimensions: Map<string, number>;
    current_timestamp: Date;
}): Promise<{ instance_text: string; updated_mapping_ids: MappingIdExtended[]; updated_dummy_nodes: DummyNode[] }> {
    const { depot, mapping_ids, dummy_nodes, allOrders, current_timestamp } = params;

    const maxCapacity = Math.max(...params.vehicles.map(v => v.capacity_weight || 100), 100);
    const horizonMinutes = 720; // 12 hours default (increased from 8h to prevent TW clamping)
    const speedKmh = 30;

    // Calculate reference start time for time windows
    const referenceStart = calculateReferenceStart(allOrders, current_timestamp);
    const referenceStartMinutes = Math.floor(referenceStart.getTime() / 1000 / 60);
    const currentTimeMinutes = Math.floor(current_timestamp.getTime() / 1000 / 60);
    
    console.log(`[buildSartoriInstanceText DEBUG] referenceStart: ${referenceStart.toISOString()}, referenceStartMinutes: ${referenceStartMinutes}, currentTimeMinutes: ${currentTimeMinutes}, diff: ${currentTimeMinutes - referenceStartMinutes} minutes`);

    // Separate pickups and deliveries from mapping_ids (excluding dummy nodes)
    const pickupMappings = mapping_ids.filter(m => m.kind === 'pickup' && !m.is_dummy);
    const deliveryMappings = mapping_ids.filter(m => m.kind === 'delivery' && !m.is_dummy);
    
    // Match pickup-delivery pairs by order_id
    interface PickupDeliveryPair {
        orderId: string;
        pickup: MappingIdExtended;
        delivery: MappingIdExtended;
    }
    
    const pairs: PickupDeliveryPair[] = [];
    
    // HACK: Add dummy_start nodes as fake pickup-delivery pairs
    // This allows vehicles to start at their current positions
    for (const dummy of dummy_nodes) {
        if (dummy.node_type === 'dummy_start') {
            // Convert absolute timestamps to relative minutes
            const pickupReady = Math.max(0, Math.floor(dummy.ready_time - referenceStartMinutes));
            const pickupDue = Math.max(pickupReady + 5, Math.floor(dummy.ready_time - referenceStartMinutes + 30)); // Wider window
            const deliveryReady = pickupReady + 1; // After pickup
            const deliveryDue = Math.max(deliveryReady + 10, Math.floor(dummy.due_time - referenceStartMinutes));
            
            const dummyPickup: MappingIdExtended = {
                kind: 'pickup',
                order_id: `DUMMY_${dummy.vehicle_id}`,
                location_id: null,
                lat: dummy.lat,
                lng: dummy.lng,
                is_dummy: true,
                vehicle_id: dummy.vehicle_id,
                demand: 0, // No capacity usage
                time_window_start: pickupReady,
                time_window_end: pickupDue,
                service_time: 0,
            };
            
            const dummyDelivery: MappingIdExtended = {
                kind: 'delivery',
                order_id: `DUMMY_${dummy.vehicle_id}`,
                location_id: null,
                lat: depot.latitude,
                lng: depot.longitude,
                is_dummy: true,
                vehicle_id: dummy.vehicle_id,
                demand: 0,
                time_window_start: deliveryReady,
                time_window_end: deliveryDue,
                service_time: 0,
            };
            
            pairs.push({
                orderId: `DUMMY_${dummy.vehicle_id}`,
                pickup: dummyPickup,
                delivery: dummyDelivery,
            });
            
            console.log(`[buildSartoriInstanceText DEBUG] Dummy pair for vehicle ${dummy.vehicle_id}: pickup at (${dummy.lat}, ${dummy.lng}), TW [${pickupReady}, ${pickupDue}]`);
        }
    }
    
    // Add real order pairs
    for (const pickup of pickupMappings) {
        const delivery = deliveryMappings.find(d => d.order_id === pickup.order_id);
        if (delivery) {
            pairs.push({ orderId: pickup.order_id!, pickup, delivery });
        } else {
            console.warn(`[buildSartoriInstanceText] No delivery found for pickup order ${pickup.order_id}`);
        }
    }
    
    // Also handle deliveries for orders that are already picked up (no pickup node)
    for (const delivery of deliveryMappings) {
        const hasPickup = pairs.some(p => p.orderId === delivery.order_id);
        if (!hasPickup) {
            // This delivery's pickup is already done - create a ghost pickup at depot
            console.log(`[buildSartoriInstanceText] Delivery ${delivery.order_id} has no pickup - creating ghost pickup at depot`);
            const ghostPickup: MappingIdExtended = {
                kind: 'pickup',
                order_id: delivery.order_id,
                location_id: null,
                lat: depot.latitude,
                lng: depot.longitude,
                is_dummy: true,
                demand: Math.abs(delivery.demand || 1),
                time_window_start: 0,
                time_window_end: horizonMinutes,
                service_time: 0, // Ghost pickup has no service time
            };
            pairs.push({ orderId: delivery.order_id!, pickup: ghostPickup, delivery });
        }
    }
    
    const numRequests = pairs.length;
    // Sartori format: SIZE = 1 (depot) + numRequests (pickups) + numRequests (deliveries) = 1 + 2*numRequests
    const size = 1 + 2 * numRequests;
    
    console.log(`[buildSartoriInstanceText] Building Sartori format: ${numRequests} requests -> SIZE=${size}`);

    // Build nodes array in STRICT Sartori order:
    // Node 0: Depot
    // Nodes 1..numRequests: All pickups
    // Nodes numRequests+1..2*numRequests: All deliveries
    
    interface NodeData {
        id: number;
        lat: number;
        lng: number;
        demand: number;
        etw: number;
        ltw: number;
        duration: number;
        p: number; // pickup index (for delivery nodes)
        d: number; // delivery index (for pickup nodes)
    }

    const nodes: NodeData[] = [];
    
    // Node 0: Depot
    nodes.push({
        id: 0,
        lat: depot.latitude,
        lng: depot.longitude,
        demand: 0,
        etw: 0,
        ltw: horizonMinutes,
        duration: 0,
        p: 0,
        d: 0,
    });
    
    // Build pickup nodes (1..numRequests) and delivery nodes (numRequests+1..2*numRequests)
    for (let i = 0; i < numRequests; i++) {
        const pair = pairs[i];
        const pickupNodeId = 1 + i;
        const deliveryNodeId = 1 + numRequests + i;
        
        // Get order data
        const order = allOrders.find(o => o.id === pair.orderId);
        const pickupDemand = Math.max(1, Math.round(order?.demand_weight || pair.pickup.demand || 1));
        
        // Pickup time windows from mapping_ids or order
        let pickupEtw = pair.pickup.time_window_start ?? 
            (order ? dateToRelativeMinutes(order.pickup_time_window_start, referenceStart, 0) : 0);
        let pickupLtw = pair.pickup.time_window_end ?? 
            (order ? dateToRelativeMinutes(order.pickup_time_window_end, referenceStart, horizonMinutes) : horizonMinutes);
        
        // Delivery time windows from mapping_ids or order
        let deliveryEtw = pair.delivery.time_window_start ?? 
            (order ? dateToRelativeMinutes(order.delivery_time_window_start, referenceStart, 0) : 0);
        let deliveryLtw = pair.delivery.time_window_end ?? 
            (order ? dateToRelativeMinutes(order.delivery_time_window_end, referenceStart, horizonMinutes) : horizonMinutes);
        
        // Calculate travel time from pickup to delivery
        const km = haversineKm(pair.pickup.lat, pair.pickup.lng, pair.delivery.lat, pair.delivery.lng);
        const travelTime = Math.max(1, Math.round((km / speedKmh) * 60));
        const serviceTime = pair.pickup.service_time || order?.service_time_pickup || 5;
        
        // CRITICAL TIME WINDOW ADJUSTMENTS:
        // Rust solver asserts: pickup.ready <= delivery.due - travel_time
        // This means: delivery.ltw >= pickup.etw + travel_time
        
        // 1. Ensure pickup LTW >= pickup ETW
        if (pickupLtw <= pickupEtw) {
            pickupLtw = Math.min(horizonMinutes, pickupEtw + 60);
        }
        
        // 2. Ensure delivery ETW >= pickup ETW + service + travel
        const minDeliveryEtw = pickupEtw + serviceTime + travelTime;
        if (deliveryEtw < minDeliveryEtw) {
            deliveryEtw = Math.min(horizonMinutes, minDeliveryEtw);
        }
        
        // 3. CRITICAL: Ensure delivery LTW >= pickup ETW + travel_time (with buffer)
        const minDeliveryLtw = pickupEtw + travelTime + 30; // 30 min buffer
        if (deliveryLtw < minDeliveryLtw) {
            deliveryLtw = Math.min(horizonMinutes, minDeliveryLtw);
        }
        
        // 4. Ensure delivery LTW >= delivery ETW
        if (deliveryLtw <= deliveryEtw) {
            deliveryLtw = Math.min(horizonMinutes, deliveryEtw + 60);
        }
        
        // Final validation: pickup.ready <= delivery.due - travel_time
        if (pickupEtw > deliveryLtw - travelTime) {
            console.warn(`[buildSartoriInstanceText] Time window violation for order ${pair.orderId}: pickup.ready=${pickupEtw} > delivery.due - tt = ${deliveryLtw} - ${travelTime} = ${deliveryLtw - travelTime}`);
            // Adjust delivery LTW to be feasible
            deliveryLtw = Math.min(horizonMinutes, pickupEtw + travelTime + 60);
        }
        
        // Add PICKUP node at position i+1
        nodes.push({
            id: pickupNodeId,
            lat: pair.pickup.lat,
            lng: pair.pickup.lng,
            demand: pickupDemand,
            etw: Math.max(0, Math.min(pickupEtw, horizonMinutes)),
            ltw: Math.max(0, Math.min(pickupLtw, horizonMinutes)),
            duration: serviceTime,
            p: 0, // Pickup nodes have p=0
            d: deliveryNodeId, // Points to its delivery
        });
    }
    
    // Now add all DELIVERY nodes (indices numRequests+1 to 2*numRequests)
    for (let i = 0; i < numRequests; i++) {
        const pair = pairs[i];
        const pickupNodeId = 1 + i;
        const deliveryNodeId = 1 + numRequests + i;
        
        const order = allOrders.find(o => o.id === pair.orderId);
        const deliveryDemand = -Math.max(1, Math.round(order?.demand_weight || Math.abs(pair.delivery.demand || 1)));
        
        // Get delivery time windows (already calculated above, recalculate for clarity)
        let deliveryEtw = pair.delivery.time_window_start ?? 
            (order ? dateToRelativeMinutes(order.delivery_time_window_start, referenceStart, 0) : 0);
        let deliveryLtw = pair.delivery.time_window_end ?? 
            (order ? dateToRelativeMinutes(order.delivery_time_window_end, referenceStart, horizonMinutes) : horizonMinutes);
        
        // Apply same adjustments as above
        const pickupNode = nodes[pickupNodeId];
        const km = haversineKm(pickupNode.lat, pickupNode.lng, pair.delivery.lat, pair.delivery.lng);
        const travelTime = Math.max(1, Math.round((km / speedKmh) * 60));
        
        const minDeliveryEtw = pickupNode.etw + pickupNode.duration + travelTime;
        if (deliveryEtw < minDeliveryEtw) {
            deliveryEtw = Math.min(horizonMinutes, minDeliveryEtw);
        }
        
        const minDeliveryLtw = pickupNode.etw + travelTime + 30;
        if (deliveryLtw < minDeliveryLtw) {
            deliveryLtw = Math.min(horizonMinutes, minDeliveryLtw);
        }
        
        if (deliveryLtw <= deliveryEtw) {
            deliveryLtw = Math.min(horizonMinutes, deliveryEtw + 60);
        }
        
        const serviceTimeDelivery = pair.delivery.service_time || order?.service_time_delivery || 5;
        
        // Add DELIVERY node
        nodes.push({
            id: deliveryNodeId,
            lat: pair.delivery.lat,
            lng: pair.delivery.lng,
            demand: deliveryDemand,
            etw: Math.max(0, Math.min(deliveryEtw, horizonMinutes)),
            ltw: Math.max(0, Math.min(deliveryLtw, horizonMinutes)),
            duration: serviceTimeDelivery,
            p: pickupNodeId, // Points back to its pickup
            d: 0, // Delivery nodes have d=0
        });
    }
    
    console.log(`[buildSartoriInstanceText] Built ${nodes.length} nodes: 1 depot + ${numRequests} pickups + ${numRequests} deliveries`);

    // Build updated_mapping_ids to match nodes array order
    const updated_mapping_ids: MappingIdExtended[] = [];
    const updated_dummy_nodes: DummyNode[] = [];
    
    // Node 0: Depot (must be kind='depot' for persistSolutionSnapshot validation)
    updated_mapping_ids.push({
        kind: 'depot',
        order_id: null,
        location_id: null,
        lat: depot.latitude,
        lng: depot.longitude,
        is_dummy: false,
        demand: 0,
        time_window_start: 0,
        time_window_end: horizonMinutes,
        service_time: 0,
    });
    
    // Nodes 1..numRequests: Pickups (match pairs order)
    for (let i = 0; i < numRequests; i++) {
        const pair = pairs[i];
        const nodeIndex = 1 + i;
        
        updated_mapping_ids.push({
            ...pair.pickup,
            time_window_start: nodes[nodeIndex].etw,
            time_window_end: nodes[nodeIndex].ltw,
        });
        
        // If this is a dummy pickup, create corresponding dummy_node entry
        if (pair.pickup.is_dummy && pair.pickup.order_id?.startsWith('DUMMY_')) {
            updated_dummy_nodes.push({
                node_index: nodeIndex,
                node_type: 'dummy_start',
                vehicle_id: pair.pickup.vehicle_id!,
                lat: pair.pickup.lat,
                lng: pair.pickup.lng,
                demand: 0,
                ready_time: Math.floor(referenceStartMinutes + nodes[nodeIndex].etw),
                due_time: Math.floor(referenceStartMinutes + nodes[nodeIndex].ltw),
                service_time: 0,
            });
        }
    }
    
    // Nodes numRequests+1..2*numRequests: Deliveries (match pairs order)
    for (let i = 0; i < numRequests; i++) {
        const pair = pairs[i];
        const nodeIndex = 1 + numRequests + i;
        
        updated_mapping_ids.push({
            ...pair.delivery,
            time_window_start: nodes[nodeIndex].etw,
            time_window_end: nodes[nodeIndex].ltw,
        });
        
        // Dummy deliveries don't need dummy_node entries (only pickups matter for vehicle tracking)
    }

    // Build time matrix (minutes based on haversine distance)
    const times: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (i === j) {
                times[i][j] = 0;
                continue;
            }
            const a = nodes[i];
            const b = nodes[j];
            const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
            const minutes = Math.max(1, Math.round((km / speedKmh) * 60));
            times[i][j] = minutes;
        }
    }

    // Build Sartori format output
    const lines: string[] = [];
    lines.push(`NAME: reopt-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`);
    lines.push(`LOCATION: ${depot.name || 'WAYO'}`);
    lines.push(`COMMENT: Dynamic Re-optimization generated by backend`);
    lines.push(`TYPE: PDPTW`);
    lines.push(`SIZE: ${size}`);
    lines.push(`DISTRIBUTION: custom (WAYO reoptimization)`);
    lines.push(`DEPOT: ${depot.name || 'depot'}`);
    lines.push(`ROUTE-TIME: ${horizonMinutes}`);
    lines.push(`TIME-WINDOW: ${horizonMinutes}`);
    lines.push(`CAPACITY: ${maxCapacity}`);
    lines.push(`NODES`);

    for (const n of nodes) {
        lines.push([
            n.id,
            n.lat.toFixed(8),
            n.lng.toFixed(8),
            n.demand,
            n.etw,
            n.ltw,
            n.duration,
            n.p,
            n.d,
        ].join(' '));
    }

    lines.push(`EDGES`);
    for (let i = 0; i < size; i++) {
        lines.push(times[i].join(' '));
    }

    lines.push(`EOF`);

    return {
        instance_text: lines.join('\n').trimEnd(),
        updated_mapping_ids,
        updated_dummy_nodes,
    };
}
