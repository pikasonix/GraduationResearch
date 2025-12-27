/**
 * Types for Dynamic Re-optimization with Virtual Start Nodes
 */

export interface VehicleState {
  vehicle_id: string;
  lat: number;
  lng: number;
  bearing?: number; // Direction vehicle is heading (0-360 degrees)
  last_stop_location_id?: string; // Last completed stop location
  last_stop_time?: string; // ISO timestamp of last stop
  picked_order_ids: string[]; // Orders picked up but not delivered
}

export interface OrderDelta {
  new_order_ids: string[];
  cancelled_order_ids: string[];
}

export interface ReoptimizationContext {
  previous_solution_id?: string;
  vehicle_states: VehicleState[];
  order_delta: OrderDelta;
  organization_id: string;
  require_depot_return?: boolean;
}

export interface DummyNode {
  node_index: number;
  node_type: 'dummy_start' | 'ghost_pickup';
  vehicle_id: string;
  lat: number;
  lng: number;
  demand?: number; // For ghost pickups
  ready_time: number; // Unix timestamp
  due_time: number;
  service_time: number;
  original_order_ids?: string[]; // For ghost pickups
}

export interface MappingIdExtended {
  kind: 'depot' | 'pickup' | 'delivery' | 'dummy_start' | 'ghost_pickup';
  order_id: string | null;
  location_id: string | null;
  lat: number;
  lng: number;
  is_dummy?: boolean;
  vehicle_id?: string;
  original_order_ids?: string[]; // For ghost pickups tracking which orders are on vehicle
}

export interface AugmentedPDPTWInstance {
  instance_text: string; // Sartori format
  mapping_ids: MappingIdExtended[];
  dummy_nodes: DummyNode[];
  vehicle_capacity_dimensions: Map<string, number>; // vehicle_id -> unique capacity dimension value
  initial_routes?: InitialRoute[]; // For warm-start
}

export interface InitialRoute {
  vehicle_number: number;
  node_sequence: number[]; // [0, dummy_node_idx, ghost_pickup_idx?, ...]
}

export interface SnappedLocation {
  lat: number;
  lng: number;
  snapped: boolean;
  distance_from_original?: number; // meters
  source: 'gps' | 'last_stop' | 'snapped_road';
}

export interface CleanedRoute {
  vehicle_id: string;
  route_number: number;
  node_sequence: number[]; // With dummy nodes removed
  start_time?: number; // Extracted from dummy node
  initial_load?: number; // Extracted from ghost pickup
  real_stops: {
    node_index: number;
    order_id: string;
    location_id: string;
    stop_type: 'pickup' | 'delivery';
    lat: number;
    lng: number;
  }[];
}
