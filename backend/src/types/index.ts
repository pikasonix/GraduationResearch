export interface SolverParams {
    // LNS parameters
    iterations?: number;                    // --iterations (default: 100000)
    max_non_improving?: number;             // --max-non-improving (default: 20000)
    time_limit?: number;                    // --time-limit (default: 0.0 - no limit)
    min_destroy?: number;                   // --min-destroy (default: 0.1)
    max_destroy?: number;                   // --max-destroy (default: 0.4)
    min_destroy_count?: number;             // --min-destroy-count (default: -1)
    max_destroy_count?: number;             // --max-destroy-count (default: -1)
    acceptance?: 'sa' | 'rtr' | 'greedy';   // --acceptance (default: rtr)
    
    // General configuration
    seed?: number;                          // --seed (default: 42)
    max_vehicles?: number;                  // --max-vehicles (default: 0 - use max from instance)
    log_level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';  // --log-level (default: info)
    authors?: string;                       // --authors (default: "PDPTW Solver")
    reference?: string;                     // --reference (default: "LNS with SA/RTR")
    
    // Instance format
    format?: 'lilim' | 'sartori';           // --format (default: lilim)
    
    // Dynamic re-optimization parameters
    dynamic?: boolean;                      // --dynamic (enable dynamic re-optimization mode)
    vehicle_states?: VehicleStateInput[];   // --vehicle-states (JSON file path, written by backend)
    new_requests?: NewRequestInput[];       // --new-requests (JSON file path, written by backend)
    late_penalty?: number;                  // --late-penalty (default: 1000)
    unassigned_penalty?: number;            // --unassigned-penalty (default: 10000)
    lock_committed?: boolean;               // --lock-committed (lock committed requests)
    lock_time_threshold?: number;           // --lock-time-threshold (seconds)
}

/**
 * Vehicle state for dynamic re-optimization
 * Represents the current state of a vehicle mid-route
 */
export interface VehicleStateInput {
    vehicle_id: number;                     // 0-indexed vehicle ID
    current_position: [number, number];     // [x, y] or [lat, lon] coordinates
    current_time: number;                   // seconds from start of day
    current_load: number;                   // items currently on board
    in_transit_deliveries: number[];        // delivery node IDs (picked up, not yet delivered)
    committed_requests: number[];           // request IDs that are committed but not yet picked up
}

/**
 * New request for dynamic re-optimization
 */
export interface NewRequestInput {
    request_id: number;                     // unique request ID
    original_order_id: number;              // original order ID for tracking
    pickup_coords: [number, number];        // [x, y] pickup coordinates
    delivery_coords: [number, number];      // [x, y] delivery coordinates
    pickup_tw: [number, number];            // [ready, due] pickup time window in seconds
    delivery_tw: [number, number];          // [ready, due] delivery time window in seconds
    demand: number;                         // number of items/passengers
    pickup_service_time?: number;           // service time at pickup (default: 0)
    delivery_service_time?: number;         // service time at delivery (default: 0)
}

/**
 * Dynamic solver result (JSON output from solver)
 */
export interface DynamicSolverResult {
    routes: DynamicRoute[];
    violations: DynamicViolation[];
    vehicles_used: number;
    unassigned_count: number;
    total_cost: number;
    computation_time_ms: number;
}

export interface DynamicRoute {
    vehicle_id: number;
    nodes: number[];
    order_ids: number[];
}

export interface DynamicViolation {
    node_id: number;
    request_id: number;
    original_order_id: number;
    violation_type: 'late_arrival' | 'unassigned';
    details: {
        expected?: number;
        actual?: number;
        late_by_minutes?: number;
        reason?: string;
    };
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Job {
    id: string;
    instance: string;
    params: SolverParams;
    organizationId?: string;
    createdBy?: string;
    inputData?: unknown;
    status: JobStatus;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    result: SolutionResult | null;
    error: string | null;
    progress: number;
    queuePosition: number;
}

export interface SolutionResult {
    solution: string;
    filename: string;
    stdout: string;
    workDir: string;
    persisted?: boolean;
    solutionId?: string;
    dynamicResult?: DynamicSolverResult;  // Populated when params.dynamic = true
}

export interface JobQueueStats {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    queueLength: number;
    currentJobId: string | null;
}

export interface JobQueueOptions {
    maxQueueSize?: number;
    jobTimeout?: number;
    cleanupInterval?: number;
    maxJobAge?: number;
}

export interface SolverWorkerOptions {
    baseWorkDir?: string;
    maxBuffer?: number;
}

export interface JobCallbacks {
    onComplete: (result: SolutionResult) => void;
    onFail: (error: string) => void;
    onProgress: (progress: number) => void;
}
