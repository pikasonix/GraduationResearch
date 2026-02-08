export interface Instance {
    all_coords: [number, number][];
    nodes: Node[];
    times: number[][];
    name: string;
    type: string;
    size: number;
    capacity: number;
    location: string;
}

export interface Solution {
    instance_name: string;
    reference: string;
    date: string;
    author: string;
    routes: Route[];
}

export interface Route {
    id: number;
    sequence: number[];
    path: [number, number][];
    color: string;
    cost: number;
    push(n: number, coord: [number, number]): void;
    set_color(new_color: string): void;
}

export interface Node {
    id: number;
    coords: [number, number];
    demand: number;
    time_window: [number, number];
    duration: number;
    is_depot: boolean;
    is_pickup: boolean;
    is_delivery: boolean;
    pair: number;
}

export function createInstance(): Instance {
    return {
        all_coords: [],
        nodes: [],
        times: [],
        name: "",
        type: "",
        size: 0,
        capacity: 0,
        location: ""
    };
}

export function createSolution(instance_name: string, reference: string, date: string, author: string, routes: Route[]): Solution {
    return {
        instance_name,
        reference,
        date,
        author,
        routes
    };
}

export function createRoute(id: number): Route {
    return {
        id,
        sequence: [],
        path: [],
        color: "#000000",
        cost: 0,
        push(n: number, coord: [number, number]) {
            this.sequence.push(n);
            this.path.push(coord);
        },
        set_color(new_color: string) {
            this.color = new_color;
        }
    };
}

export function createNode(id: number, coords: [number, number], demand: number, time_window: [number, number], duration: number, is_pickup: boolean, is_delivery: boolean): Node {
    return {
        id,
        coords,
        demand,
        time_window,
        duration,
        is_depot: id === 0,
        is_pickup,
        is_delivery,
        pair: -1
    };
}

// ========== Dynamic Tracking / Timeline Types ==========

export interface OptimizationSolutionMetadata {
    id: string;
    created_at: string;
    solution_name: string | null;
    total_cost: number;
    total_distance_km: number;
    total_time_hours: number;
    total_vehicles_used: number;
    parent_solution_id: string | null;
    organization_id: string;
    job_id: string | null;
    solution_data?: any; // JSONB field with instance + routes
    mapping_ids?: any[];
}

export interface TimelineNode {
    solution: Solution; // Parsed solution data
    metadata: OptimizationSolutionMetadata; // DB row
    children: TimelineNode[]; // Child solutions (reoptimizations)
    depth: number; // Depth in tree (0 = root)
    timestamp: string; // created_at
    index: number; // Position in chronological sequence
}

export interface MetricsChange {
    totalCost: number; // Delta from previous
    totalDistance: number; // Delta km
    totalTime: number; // Delta hours
    vehiclesUsed: number; // Delta count
    costPercent: number; // % change
    distancePercent: number; // % change
    timePercent: number; // % change
}

export interface OrderReassignment {
    nodeId: number; // Node ID in instance
    orderId: string | null; // Order UUID from mapping_ids
    fromRoute: number | null; // Previous route ID (null if newly added)
    toRoute: number | null; // New route ID (null if removed)
    impactScore: number; // Delivery time change in minutes
    kind: 'pickup' | 'delivery' | 'depot' | 'unknown';
}

export interface RouteModification {
    routeId: number;
    changeType: 'added' | 'removed' | 'modified' | 'unchanged';
    ordersAdded: number[]; // Node IDs added to this route
    ordersRemoved: number[]; // Node IDs removed from this route
    sequenceChanged: boolean; // Whether order of stops changed
    metricsChange: {
        cost: number;
        distance: number;
        time: number;
    };
}

export interface VehicleUtilizationChange {
    vehicleId: number | string | null;
    routeId: number;
    beforeCapacity: number; // % capacity used
    afterCapacity: number; // % capacity used
    beforeTime: number; // % time window used
    afterTime: number; // % time window used
}

export interface SolutionDiff {
    fromSolution: OptimizationSolutionMetadata;
    toSolution: OptimizationSolutionMetadata;
    metricsChange: MetricsChange;
    ordersReassigned: OrderReassignment[];
    routesAdded: number[]; // Route IDs
    routesRemoved: number[]; // Route IDs
    routesModified: RouteModification[];
    vehicleUtilizationChange: VehicleUtilizationChange[];
    timeWindowViolationsDelta: number; // Change in violations count
    summary: {
        totalChanges: number;
        ordersAffected: number;
        routesAffected: number;
        isImprovement: boolean; // True if cost decreased
    };
}
