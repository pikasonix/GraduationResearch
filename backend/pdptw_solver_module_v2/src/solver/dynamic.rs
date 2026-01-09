//! Dynamic re-optimization module for PDPTW.
//! 
//! This module provides functionality to re-optimize routes when:
//! - Vehicles are already in progress (not at depot)
//! - Some requests are in-transit (picked up, not yet delivered)
//! - New orders arrive that need to be inserted
//! 
//! Key concepts:
//! - **Virtual Start Node**: Vehicle's current GPS position (not depot)
//! - **Ghost Pickup**: Placeholder for in-transit requests (pickup already done)
//! - **Locked Nodes**: Nodes that cannot be removed/moved by LNS
//! - **Soft Time Windows**: Allow violations with penalty instead of hard reject

use log::{info, warn};
use serde::{Deserialize, Serialize};
use took::Timer;

use crate::cli::SolverArguments;
use crate::lns::largescale::ages::{LargeNeighborhoodAGES, Parameters as AGESParameters};
use crate::lns::largescale::{SplitSettings, GroupMatchingMode, UnassignedMatchingMode};
use crate::lns::acceptance_criterion::AcceptanceCriterionStrategy;
use crate::lns::destroy::adjacent_string_removal::AdjacencyMeasure;
use crate::ages::{ILSSolutionSelectionStrategy, PenaltyCounterResetStrategy, PerturbationMode};
use crate::cli::LS_Mode;
use crate::problem::pdptw::{PDPTWInstance, VehicleState, Node, NodeType, Capacity};
use crate::problem::Num;
use crate::solution::{Solution, SolutionDescription};
use crate::solver::{DynamicSolverResult, Violation, ViolationType, UnassignedReason};
use crate::utils::{Countdown, Random, TimeLimit};

/// Configuration for dynamic re-optimization
#[derive(Debug, Clone)]
pub struct ReoptimizeConfig {
    /// Penalty per minute of lateness (default: 1000)
    pub late_penalty_per_minute: Num,
    /// Penalty per unassigned request (default: 10000)
    pub unassigned_penalty: Num,
    /// Whether to lock committed requests (not yet picked up)
    pub lock_committed: bool,
    /// Time threshold: lock requests starting within this many seconds
    pub lock_time_threshold: Option<Num>,
}

impl Default for ReoptimizeConfig {
    fn default() -> Self {
        Self {
            late_penalty_per_minute: Num::from(1000),
            unassigned_penalty: Num::from(10000),
            lock_committed: false,
            lock_time_threshold: None,
        }
    }
}

/// New request to be added during re-optimization
#[derive(Debug, Clone)]
pub struct NewRequest {
    /// Unique request ID
    pub request_id: usize,
    /// Original order ID (for tracking)
    pub original_order_id: usize,
    /// Pickup coordinates (x, y)
    pub pickup_coords: (f64, f64),
    /// Delivery coordinates (x, y)
    pub delivery_coords: (f64, f64),
    /// Pickup time window
    pub pickup_tw: (Num, Num),
    /// Delivery time window
    pub delivery_tw: (Num, Num),
    /// Demand (number of items/passengers)
    pub demand: Capacity,
    /// Service time at pickup
    pub pickup_service_time: Num,
    /// Service time at delivery
    pub delivery_service_time: Num,
}

/// JSON input for vehicle state (from external system)
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VehicleStateJson {
    /// Vehicle ID (0-indexed)
    pub vehicle_id: usize,
    /// Current GPS position (x, y or lat, lon)
    pub current_position: [f64; 2],
    /// Current time (seconds from start of day)
    pub current_time: f64,
    /// Current load (number of items on board)
    pub current_load: i16,
    /// Delivery node IDs that are in-transit (picked up but not delivered)
    #[serde(default)]
    pub in_transit_deliveries: Vec<usize>,
    /// Request IDs that are committed (assigned but not yet picked up)
    #[serde(default)]
    pub committed_requests: Vec<usize>,
}

/// JSON input for new request (from external system)
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NewRequestJson {
    /// Unique request ID
    pub request_id: usize,
    /// Original order ID (for tracking)
    pub original_order_id: usize,
    /// Pickup coordinates [x, y]
    pub pickup_coords: [f64; 2],
    /// Delivery coordinates [x, y]
    pub delivery_coords: [f64; 2],
    /// Pickup time window [ready, due] in seconds
    pub pickup_tw: [f64; 2],
    /// Delivery time window [ready, due] in seconds
    pub delivery_tw: [f64; 2],
    /// Demand (number of items/passengers)
    pub demand: i16,
    /// Service time at pickup (seconds)
    #[serde(default)]
    pub pickup_service_time: f64,
    /// Service time at delivery (seconds)
    #[serde(default)]
    pub delivery_service_time: f64,
}

/// JSON output for dynamic solver result
#[derive(Debug, Clone, Serialize)]
pub struct DynamicResultJson {
    /// Solution routes
    pub routes: Vec<RouteJson>,
    /// Violations (late arrivals, unassigned requests)
    pub violations: Vec<ViolationJson>,
    /// Total vehicles used
    pub vehicles_used: usize,
    /// Number of unassigned requests
    pub unassigned_count: usize,
    /// Total cost
    pub total_cost: i32,
    /// Computation time in milliseconds
    pub computation_time_ms: u64,
}

/// JSON output for a single route
#[derive(Debug, Clone, Serialize)]
pub struct RouteJson {
    /// Vehicle ID
    pub vehicle_id: usize,
    /// Sequence of node IDs (excluding depot start/end)
    pub nodes: Vec<usize>,
    /// Original order IDs for tracking
    pub order_ids: Vec<usize>,
}

/// JSON output for a violation
#[derive(Debug, Clone, Serialize)]
pub struct ViolationJson {
    /// Node ID
    pub node_id: usize,
    /// Request ID
    pub request_id: usize,
    /// Original order ID
    pub original_order_id: usize,
    /// Violation type: "late_arrival" or "unassigned"
    pub violation_type: String,
    /// Details about the violation
    pub details: serde_json::Value,
}

impl VehicleStateJson {
    /// Convert to internal VehicleState
    pub fn to_vehicle_state(&self) -> VehicleState {
        VehicleState {
            vehicle_id: self.vehicle_id,
            current_position: (self.current_position[0], self.current_position[1]),
            current_time: Num::from(self.current_time),
            current_load: self.current_load,
            in_transit_deliveries: self.in_transit_deliveries.clone(),
            committed_requests: self.committed_requests.clone(),
        }
    }
}

impl NewRequestJson {
    /// Convert to internal NewRequest
    pub fn to_new_request(&self) -> NewRequest {
        NewRequest {
            request_id: self.request_id,
            original_order_id: self.original_order_id,
            pickup_coords: (self.pickup_coords[0], self.pickup_coords[1]),
            delivery_coords: (self.delivery_coords[0], self.delivery_coords[1]),
            pickup_tw: (Num::from(self.pickup_tw[0]), Num::from(self.pickup_tw[1])),
            delivery_tw: (Num::from(self.delivery_tw[0]), Num::from(self.delivery_tw[1])),
            demand: self.demand,
            pickup_service_time: Num::from(self.pickup_service_time),
            delivery_service_time: Num::from(self.delivery_service_time),
        }
    }
}

/// Load vehicle states from JSON file
pub fn load_vehicle_states(path: &str) -> anyhow::Result<Vec<VehicleStateJson>> {
    let content = std::fs::read_to_string(path)?;
    let states: Vec<VehicleStateJson> = serde_json::from_str(&content)?;
    Ok(states)
}

/// Load new requests from JSON file
pub fn load_new_requests(path: &str) -> anyhow::Result<Vec<NewRequestJson>> {
    let content = std::fs::read_to_string(path)?;
    let requests: Vec<NewRequestJson> = serde_json::from_str(&content)?;
    Ok(requests)
}

/// Convert DynamicSolverResult to JSON output
pub fn to_result_json(
    result: &DynamicSolverResult,
    instance: &PDPTWInstance,
) -> DynamicResultJson {
    let mut routes = Vec::new();
    
    // Extract routes from solution description using successors
    // Each vehicle has 2 depot nodes: start at v*2, end at v*2+1
    for vehicle_id in 0..instance.num_vehicles {
        let start_depot = vehicle_id * 2;
        let end_depot = start_depot + 1;
        
        let mut nodes = Vec::new();
        let mut order_ids = Vec::new();
        
        // Walk the route using successors
        let mut current = result.solution.successors[start_depot];
        while current != end_depot {
            if instance.is_request(current) {
                nodes.push(current);
                order_ids.push(instance.nodes[current].oid);
            }
            current = result.solution.successors[current];
        }
        
        if !nodes.is_empty() {
            routes.push(RouteJson {
                vehicle_id,
                nodes,
                order_ids,
            });
        }
    }
    
    // Convert violations
    let violations: Vec<ViolationJson> = result.violations.iter().map(|v| {
        let (violation_type, details) = match &v.violation_type {
            ViolationType::LateArrival { expected, actual, late_by_minutes } => {
                ("late_arrival".to_string(), serde_json::json!({
                    "expected": expected.value(),
                    "actual": actual.value(),
                    "late_by_minutes": late_by_minutes.value(),
                }))
            }
            ViolationType::Unassigned { reason } => {
                ("unassigned".to_string(), serde_json::json!({
                    "reason": format!("{:?}", reason),
                }))
            }
        };
        
        ViolationJson {
            node_id: v.node_id,
            request_id: v.request_id,
            original_order_id: v.original_order_id,
            violation_type,
            details,
        }
    }).collect();
    
    DynamicResultJson {
        routes,
        violations,
        vehicles_used: result.solution.vehicles_used,
        unassigned_count: result.solution.unassigned_requests,
        total_cost: result.solution.total_cost.value(),
        computation_time_ms: result.time.as_std().as_millis() as u64,
    }
}

/// Context for dynamic re-optimization
pub struct ReoptimizeContext<'a> {
    /// Base instance (static problem definition)
    pub base_instance: &'a PDPTWInstance,
    /// Current solution to re-optimize from
    pub current_solution: &'a SolutionDescription,
    /// State of each vehicle
    pub vehicle_states: Vec<VehicleState>,
    /// New requests to add
    pub new_requests: Vec<NewRequest>,
    /// Configuration
    pub config: ReoptimizeConfig,
}

/// Result of building a dynamic instance
pub struct DynamicInstanceBuilder {
    /// Ghost pickup nodes created for in-transit deliveries
    pub ghost_pickups: Vec<GhostPickup>,
    /// Virtual start node IDs for each vehicle
    pub virtual_start_nodes: Vec<Option<usize>>,
    /// Nodes that should be locked (cannot be removed by LNS)
    pub locked_node_ids: Vec<usize>,
}

/// Ghost pickup node for an in-transit delivery
#[derive(Debug, Clone)]
pub struct GhostPickup {
    /// The original delivery node ID this ghost is paired with
    pub delivery_node_id: usize,
    /// Vehicle ID that has this item
    pub vehicle_id: usize,
    /// Ghost pickup node ID (will be assigned during instance creation)
    pub ghost_node_id: usize,
    /// Demand (same as original pickup)
    pub demand: Capacity,
}

/// Main entry point for dynamic re-optimization.
/// 
/// # Arguments
/// * `context` - Re-optimization context with all inputs
/// * `args` - Solver arguments (time limit, iterations, etc.)
/// * `rng` - Random number generator
/// 
/// # Returns
/// * `DynamicSolverResult` - Solution with violations list
pub fn reoptimize(
    context: ReoptimizeContext,
    args: &SolverArguments,
    rng: &mut Random,
) -> DynamicSolverResult {
    let timer = Timer::new();
    
    info!("Starting dynamic re-optimization");
    info!("  Vehicles: {}", context.vehicle_states.len());
    info!("  New requests: {}", context.new_requests.len());
    
    // Count in-transit deliveries
    let in_transit_count: usize = context.vehicle_states
        .iter()
        .map(|vs| vs.in_transit_deliveries.len())
        .sum();
    info!("  In-transit deliveries: {}", in_transit_count);
    
    // Step 1: Determine locked nodes
    let locked_node_ids = determine_locked_nodes(
        &context.vehicle_states,
        context.base_instance,
        &context.config,
    );
    info!("  Locked nodes: {}", locked_node_ids.len());
    
    // Step 2: Create solution and apply locks
    let mut solution = Solution::new(context.base_instance);
    solution.set_with(context.current_solution);
    
    // Lock all determined nodes
    for &node_id in &locked_node_ids {
        solution.lock_node(node_id);
    }
    
    // Step 3: Add new requests to unassigned (they will be inserted by repair operators)
    // Note: In a full implementation, we would need to extend the instance with new nodes
    // For now, we assume new_requests are already in the instance's RequestBank
    for new_req in &context.new_requests {
        let pickup_id = context.base_instance.pickup_id_of_request(new_req.request_id);
        solution.unassigned_requests.insert_pickup_id(pickup_id);
    }
    
    info!("  Unassigned requests before optimization: {}", solution.unassigned_requests.count());
    
    // Step 4: Run LNS optimization with locked node constraints
    let time_limit = args.get_time_limit().min(60); // Cap at 60s for dynamic
    let countdown = Countdown::new(
        timer.clone(),
        TimeLimit::Seconds(time_limit),
    );
    
    // Create AGES-LNS solver with reduced iterations for dynamic mode
    let dynamic_iterations = args.get_iterations().min(10000); // Cap iterations
    
    let mut lns_solver = LargeNeighborhoodAGES::with_instance(
        context.base_instance,
        AGESParameters {
            max_ils_iterations: args.ils_iterations.map(|x| x.min(100)),
            max_lns_iterations: dynamic_iterations,
            repair_blink_rate: args.lns_recreate_blink_rate,
            repair_order_weights: args.lns_recreate_order_weights.clone(),
            repair_insertion_limit: args.lns_recreate_insertion_limit,
            destroy_adjacent_measure: AdjacencyMeasure::Detour,
            destroy_adjacent_max_cardinality: args.lns_ruin_max_cardinality.min(10),
            destroy_adjacent_alpha: args.lns_ruin_alpha,
            destroy_adjacent_beta: args.lns_ruin_beta,
            nested_iterations: args.nested_iterations.min(500),
            avg_nodes_per_route: args.avg_nodes_per_split_range(),
            init_temp: args.lns_init_aspiration_temp,
            acceptance_criterion: AcceptanceCriterionStrategy::LinearRecordToRecord {
                initial_temperature: args.lns_init_aspiration_temp,
                final_temperature: 0.01,
            },
            ls_method: LS_Mode::DISABLED,
            ls_probability: 0.0,
            ls_threshold: None,
            ls_method_on_new_best_sol: LS_Mode::DISABLED,
            bs_thickness: args.bs_thickness,
            num_perturbation_ils: 5,
            max_ages_perturbation_phases: 3,
            count_successful_perturbations_only: true,
            num_perturbation_after_ejection_range: 1..=3,
            perturbation_mode_after_ejection: PerturbationMode::RelocateAndExchange { shift_probability: 0.5 },
            perturbation_mode_ils: PerturbationMode::RelocateAndExchange { shift_probability: 0.5 },
            recombine_mode: args.get_recombine_mode(),
            split_settings: SplitSettings {
                group_matching_mode: GroupMatchingMode::Random,
                unassigned_matching_mode: UnassignedMatchingMode::Random,
            },
            shuffle_stack_after_permutation: false,
            penalty_counter_reset: PenaltyCounterResetStrategy::ResetOnNewMin,
            ils_solution_selection: ILSSolutionSelectionStrategy::NonImprovementBased,
            #[cfg(feature = "timed_solution_logger")]
            timed_solution_logger: Default::default(),
        },
    );
    
    // Run optimization - the solution already has locked nodes set
    let initial_desc = solution.to_description();
    
    // Transfer locked nodes to description for tracking
    let (optimized_desc, _abs) = lns_solver.run_with_solution_desc(
        initial_desc,
        rng,
        None,
        &countdown,
        #[cfg(feature = "progress_tracking")]
        &mut Default::default(),
    );
    
    info!("  Optimization complete");
    info!("    Vehicles used: {}", optimized_desc.vehicles_used);
    info!("    Unassigned: {}", optimized_desc.unassigned_requests);
    info!("    Objective: {}", optimized_desc.objective);
    
    // Step 5: Extract violations
    let mut result_solution = Solution::new(context.base_instance);
    result_solution.set_with(&optimized_desc);
    
    let violations = extract_violations(&result_solution, context.base_instance);
    let late_violations = extract_lateness_violations(&result_solution, context.base_instance);
    
    let mut all_violations = violations;
    all_violations.extend(late_violations);
    
    if !all_violations.is_empty() {
        warn!("  Solution has {} violations", all_violations.len());
        for v in &all_violations {
            match &v.violation_type {
                ViolationType::Unassigned { reason } => {
                    warn!("    Request {} unassigned: {:?}", v.request_id, reason);
                }
                ViolationType::LateArrival { expected, actual, late_by_minutes } => {
                    warn!("    Node {} late by {} (expected: {}, actual: {})", 
                          v.node_id, late_by_minutes, expected, actual);
                }
            }
        }
    }
    
    DynamicSolverResult {
        solution: optimized_desc,
        violations: all_violations,
        time: timer.took(),
    }
}

/// Build ghost pickup nodes for in-transit deliveries.
/// 
/// A ghost pickup is created at the vehicle's current position for each
/// delivery that has already been picked up but not yet delivered.
pub fn create_ghost_pickups(
    vehicle_states: &[VehicleState],
    instance: &PDPTWInstance,
    _current_time: Num,
) -> Vec<GhostPickup> {
    let mut ghost_pickups = Vec::new();
    
    for vs in vehicle_states {
        for &delivery_id in &vs.in_transit_deliveries {
            // Get the original pickup to determine demand
            let pickup_id = delivery_id - 1; // delivery_id = pickup_id + 1
            let demand = instance.nodes[pickup_id].demand;
            
            ghost_pickups.push(GhostPickup {
                delivery_node_id: delivery_id,
                vehicle_id: vs.vehicle_id,
                ghost_node_id: 0, // Will be assigned later
                demand,
            });
        }
    }
    
    ghost_pickups
}

/// Create a ghost pickup node at vehicle's current position.
/// 
/// Properties:
/// - Coordinates: Vehicle's current GPS position
/// - Demand: Same as original pickup (items being carried)
/// - Service time: 0 (no physical pickup needed)
/// - Time window: [current_time, current_time] (must be "visited" immediately)
pub fn create_ghost_node(
    ghost: &GhostPickup,
    vehicle_state: &VehicleState,
    node_id: usize,
    original_order_id: usize,
) -> Node {
    Node {
        id: node_id,
        oid: original_order_id,
        gid: node_id, // Will need special handling in travel matrix
        node_type: NodeType::Pickup,
        x: vehicle_state.current_position.0,
        y: vehicle_state.current_position.1,
        demand: ghost.demand,
        ready: vehicle_state.current_time,
        due: vehicle_state.current_time, // Must be "done" immediately
        servicetime: Num::ZERO,
    }
}

/// Determine which nodes should be locked based on vehicle states and config.
pub fn determine_locked_nodes(
    vehicle_states: &[VehicleState],
    instance: &PDPTWInstance,
    config: &ReoptimizeConfig,
) -> Vec<usize> {
    let mut locked = Vec::new();
    
    for vs in vehicle_states {
        // All in-transit deliveries must be locked (cannot be unassigned)
        for &delivery_id in &vs.in_transit_deliveries {
            locked.push(delivery_id);
            // Ghost pickup for this delivery will also be locked
        }
        
        // Optionally lock committed requests
        if config.lock_committed {
            for &request_id in &vs.committed_requests {
                let pickup_id = instance.pickup_id_of_request(request_id);
                let delivery_id = instance.delivery_id_of_request(request_id);
                locked.push(pickup_id);
                locked.push(delivery_id);
            }
        }
        
        // Lock based on time threshold
        if let Some(_threshold) = config.lock_time_threshold {
            // Lock any requests that start within threshold time
            // This would need to check route order and timing
            // TODO: Implement time-based locking
        }
    }
    
    locked
}

/// Extract violations from a solution.
pub fn extract_violations(
    solution: &Solution,
    instance: &PDPTWInstance,
) -> Vec<Violation> {
    let mut violations = Vec::new();
    
    // Check unassigned requests
    for pickup_id in solution.unassigned_requests.iter_pickup_ids() {
        let request_id = instance.request_id(pickup_id);
        let node = &instance.nodes[pickup_id];
        
        violations.push(Violation {
            node_id: pickup_id,
            request_id,
            original_order_id: node.oid,
            violation_type: ViolationType::Unassigned {
                reason: UnassignedReason::NoFeasibleRoute,
            },
        });
    }
    
    violations
}

/// Extract time window violations by traversing routes.
pub fn extract_lateness_violations(
    solution: &Solution,
    instance: &PDPTWInstance,
) -> Vec<Violation> {
    let mut violations = Vec::new();
    
    // Traverse each route and compute arrival times
    for route_id in 0..instance.num_vehicles {
        let vn_start = route_id * 2;
        let vn_end = vn_start + 1;
        
        let mut current_time = instance.nodes[vn_start].ready;
        let mut current_node = solution.succ(vn_start);
        
        while current_node != vn_end {
            let node = &instance.nodes[current_node];
            
            // Calculate arrival time
            let prev_node = solution.pred(current_node);
            let travel_time = instance.time(prev_node, current_node);
            let arrival_time = current_time + travel_time;
            
            // Check for late arrival
            if arrival_time > node.due {
                let late_by = arrival_time - node.due;
                let request_id = if instance.is_request(current_node) {
                    instance.request_id(current_node)
                } else {
                    0
                };
                
                violations.push(Violation {
                    node_id: current_node,
                    request_id,
                    original_order_id: node.oid,
                    violation_type: ViolationType::LateArrival {
                        expected: node.due,
                        actual: arrival_time,
                        late_by_minutes: late_by,
                    },
                });
            }
            
            // Update current time (wait if arrived early, then service)
            current_time = arrival_time.max(node.ready) + node.servicetime;
            current_node = solution.succ(current_node);
        }
    }
    
    violations
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_reoptimize_config_default() {
        let config = ReoptimizeConfig::default();
        assert_eq!(config.late_penalty_per_minute, Num::from(1000));
        assert_eq!(config.unassigned_penalty, Num::from(10000));
        assert!(!config.lock_committed);
        assert!(config.lock_time_threshold.is_none());
    }
}
