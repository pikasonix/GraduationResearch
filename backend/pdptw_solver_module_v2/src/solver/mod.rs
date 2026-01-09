use log::info;
use took::{Timer, Took};

use crate::cli::SolverArguments;
use crate::clustering::{extract_promising_blocks, RequestsStats};
use crate::construction::kdsp::ClusterKDSP;
use crate::problem::pdptw::PDPTWInstance;
use crate::problem::Num;
use crate::solution::SolutionDescription;
use crate::solver::construction::construct;
use crate::utils::Random;

pub mod construction;
pub mod ls_solver;
pub mod dynamic;

pub struct SolverResult {
    pub solution: SolutionDescription,
    pub time: Took,
}

// ============================================================================
// Dynamic Re-optimization Support
// ============================================================================

/// Result from dynamic re-optimization, includes violations for UI feedback
pub struct DynamicSolverResult {
    pub solution: SolutionDescription,
    pub violations: Vec<Violation>,
    pub time: Took,
}

/// A time window violation or unassigned request
#[derive(Debug, Clone)]
pub struct Violation {
    /// Node ID where violation occurs
    pub node_id: usize,
    /// Request ID (derived from node)
    pub request_id: usize,
    /// Original order ID (from input)
    pub original_order_id: usize,
    /// Type of violation
    pub violation_type: ViolationType,
}

/// Types of violations that can occur
#[derive(Debug, Clone)]
pub enum ViolationType {
    /// Late arrival at a node
    LateArrival {
        /// Expected arrival (due time)
        expected: Num,
        /// Actual arrival time
        actual: Num,
        /// How many minutes late
        late_by_minutes: Num,
    },
    /// Request could not be assigned to any vehicle
    Unassigned {
        /// Reason why request couldn't be assigned
        reason: UnassignedReason,
    },
}

/// Reasons why a request might be unassigned
#[derive(Debug, Clone)]
pub enum UnassignedReason {
    /// No vehicle has enough capacity
    CapacityExceeded,
    /// Time window already passed
    TimeWindowMissed,
    /// No feasible route exists
    NoFeasibleRoute,
    /// Other reason
    Other(String),
}

pub fn construction_only(
    instance: &PDPTWInstance,
    args: &SolverArguments,
    rng: &mut Random,
) -> SolverResult {
    let timer = Timer::new();
    let desc = construct(instance, rng, &args).to_description();

    SolverResult {
        time: timer.took(),
        solution: desc,
    }
}

pub fn kdsp(instance: &PDPTWInstance, _rng: &mut Random) -> SolverResult {
    let timer = Timer::new();
    let clustering = ClusterKDSP::new(&instance);

    info!("create initial solution with requests-stats");
    let sol = clustering
        .construct_with_blocks(extract_promising_blocks(&RequestsStats::process(&instance)));
    info!(
        "Objective: {}, took: {}",
        sol.objective(),
        timer.took()
    );

    SolverResult {
        solution: sol.to_description(),
        time: timer.took(),
    }
}

#[cfg(feature = "test-with-sartoriburiol-solutions")]
#[cfg(test)]
mod tests {
    use crate::solution::create_solution_from_sintef;
    use crate::construction::kdsp::KDSPBlockMode;

    use super::*;

    #[test]
    fn test_kdsp_with_optimal_blocks() -> anyhow::Result<()> {
        use crate::io::sintef_solution::tests::sartori_buriol::INSTANCE_DIR_N100;
        use crate::io::sintef_solution::tests::sartori_buriol::N100;
        use crate::io::sintef_solution::tests::sartori_buriol::SOLUTION_DIR_N100;
        for (instance_name, solution_name, ref_vehicles, _ref_obj) in N100.iter() {
            let instance_path = format!("{}/{}", INSTANCE_DIR_N100, instance_name);
            let solution_path = format!("{}/{}", SOLUTION_DIR_N100, solution_name);

            let instance = crate::io::sartori_buriol_reader::load_instance(
                instance_path,
                Some(*ref_vehicles),
            )?;
            let sintef_solution = crate::io::sintef_solution::load_sintef_solution(solution_path)?;

            let solution = create_solution_from_sintef(sintef_solution, &instance);

            let kdsp = ClusterKDSP::new(&instance);

            let kdsp_sol = kdsp.construct_with_blocks(kdsp.extract_tightened_blocks_from_solution(
                &solution.to_description(),
                KDSPBlockMode::Average,
            ));

            assert!(kdsp_sol.is_feasible());
            assert_eq!(
                solution.objective(),
                kdsp_sol.objective(),
                "Assertion failed for instance {}",
                instance_name
            );
        }

        Ok(())
    }
}
