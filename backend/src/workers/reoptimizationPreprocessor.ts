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
    vehicle_code: string;
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
 * Convert Date to time window value (minutes from start of day or unix timestamp)
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

    // Merge and filter orders
    const allOrders = [...active_orders, ...new_orders].filter(
        order => !context.order_delta.cancelled_order_ids.includes(order.id)
    );

    const currentTimeMinutes = dateToTimeWindow(current_timestamp, 0);
    const endOfShiftMinutes = dateToTimeWindow(end_of_shift, currentTimeMinutes + 480); // Default 8 hour shift

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
    for (const order of allOrders) {
        // Check if this order is already picked up (on a vehicle)
        const isPickedUp = context.vehicle_states.some(vs => 
            vs.picked_order_ids.includes(order.id)
        );

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
            });
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
        });
    }

    // Generate Sartori PDPTW instance text
    const instance_text = await buildSartoriInstanceText({
        depot,
        mapping_ids,
        dummy_nodes,
        allOrders,
        vehicles,
        vehicle_capacity_dimensions,
        current_timestamp,
    });

    return {
        instance_text,
        mapping_ids,
        dummy_nodes,
        vehicle_capacity_dimensions,
        initial_routes,
    };
}

/**
 * Build Sartori format PDPTW instance text with dummy nodes
 */
async function buildSartoriInstanceText(params: {
    depot: Depot;
    mapping_ids: MappingIdExtended[];
    dummy_nodes: DummyNode[];
    allOrders: Order[];
    vehicles: Vehicle[];
    vehicle_capacity_dimensions: Map<string, number>;
    current_timestamp: Date;
}): Promise<string> {
    const { mapping_ids, dummy_nodes, allOrders, vehicles } = params;

    // Count nodes
    const numVehicles = vehicles.length;

    // TODO: Calculate max vehicle capacity
    const maxCapacity = Math.max(...vehicles.map(v => v.capacity_weight || 100));

    // Build instance header
    let instanceText = `PDPTW Instance\n`;
    instanceText += `Dynamic Re-optimization ${new Date().toISOString()}\n`;
    instanceText += `\n`;
    instanceText += `VEHICLE\n`;
    instanceText += `NUMBER     CAPACITY\n`;
    instanceText += `  ${numVehicles}         ${maxCapacity.toFixed(0)}\n`;
    instanceText += `\n`;
    instanceText += `CUSTOMER\n`;
    instanceText += `CUST NO.  XCOORD.   YCOORD.    DEMAND   READY TIME  DUE DATE  SERVICE TIME  PICKUP     DELIVERY\n`;
    instanceText += `\n`;

    // Node 0: Depot
    const depotNode = mapping_ids[0];
    instanceText += `    0    ${depotNode.lng.toFixed(6)}  ${depotNode.lat.toFixed(6)}       0        0       999999        0\n`;

    // Add all other nodes (dummy, ghost, pickup, delivery)
    for (let i = 1; i < mapping_ids.length; i++) {
        const node = mapping_ids[i];
        const dummyNode = dummy_nodes.find(d => d.node_index === i);

        let demand = 0;
        let readyTime = 0;
        let dueTime = 999999;
        let serviceTime = 0;
        let pickupIndex = 0;
        let deliveryIndex = 0;

        if (node.kind === 'dummy_start' && dummyNode) {
            // Dummy start node
            demand = dummyNode.demand || 0;
            readyTime = dummyNode.ready_time;
            dueTime = dummyNode.due_time;
            serviceTime = dummyNode.service_time;
        } else if (node.kind === 'ghost_pickup' && dummyNode) {
            // Ghost pickup node
            demand = dummyNode.demand || 0;
            readyTime = dummyNode.ready_time;
            dueTime = dummyNode.due_time;
            serviceTime = dummyNode.service_time;
        } else if (node.kind === 'pickup') {
            // Regular pickup node
            const order = allOrders.find(o => o.id === node.order_id);
            if (order) {
                demand = order.demand_weight || 1;
                readyTime = dateToTimeWindow(order.pickup_time_window_start, 0);
                dueTime = dateToTimeWindow(order.pickup_time_window_end, 999999);
                serviceTime = order.service_time_pickup || 5;
                
                // Find corresponding delivery index
                const deliveryIdx = mapping_ids.findIndex(
                    m => m.kind === 'delivery' && m.order_id === order.id
                );
                if (deliveryIdx > 0) {
                    pickupIndex = i;
                    deliveryIndex = deliveryIdx;
                }
            }
        } else if (node.kind === 'delivery') {
            // Regular delivery node
            const order = allOrders.find(o => o.id === node.order_id);
            if (order) {
                demand = -(order.demand_weight || 1); // Negative for delivery
                readyTime = dateToTimeWindow(order.delivery_time_window_start, 0);
                dueTime = dateToTimeWindow(order.delivery_time_window_end, 999999);
                serviceTime = order.service_time_delivery || 5;
                
                // Find corresponding pickup index
                const pickupIdx = mapping_ids.findIndex(
                    m => m.kind === 'pickup' && m.order_id === order.id
                );
                if (pickupIdx > 0) {
                    pickupIndex = pickupIdx;
                    deliveryIndex = i;
                }
            }
        }

        instanceText += `  ${i.toString().padStart(3)}    ${node.lng.toFixed(6)}  ${node.lat.toFixed(6)}  `;
        instanceText += `${demand.toString().padStart(6)}   ${readyTime.toString().padStart(6)}  `;
        instanceText += `${dueTime.toString().padStart(6)}     ${serviceTime.toString().padStart(6)}    `;
        instanceText += `${pickupIndex.toString().padStart(3)}        ${deliveryIndex.toString().padStart(3)}\n`;
    }

    return instanceText;
}
