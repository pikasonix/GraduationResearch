use fixedbitset::FixedBitSet;

use crate::io::sintef_solution::SINTEFSolution;
use crate::problem::pdptw::{NodeType, PDPTWInstance, Vehicle};
use crate::problem::Num;
use crate::refn::REFData;
use crate::solution::blocknode::BlockNodes;
pub use crate::solution::description::SolutionDescription;
use crate::solution::misc::REFNodeVec;
use crate::solution::requestbank::RequestBank;

pub mod blocknode;
pub mod datastructure;
mod description;
pub mod balassimonetti;
mod misc;
pub mod permutation;
mod requestbank;

impl REFData {
    pub fn check_feasible(&self, vehicle: &Vehicle) -> bool {
        self.tw_feasible
            && vehicle.check_capacity(self.max_load)
            && self.earliest_completion - self.latest_start <= vehicle.shift_length
    }
}

pub struct Solution<'a> {
    pub(crate) instance: &'a PDPTWInstance,
    pub fw_data: REFNodeVec,
    pub bw_data: REFNodeVec,
    pub blocks: BlockNodes,
    pub empty_route_ids: FixedBitSet,
    pub unassigned_requests: RequestBank<'a>,
    
    /// Locked nodes that cannot be removed/moved by LNS destroy operators.
    /// Used in dynamic re-optimization to protect committed/in-transit requests.
    pub locked_nodes: FixedBitSet,

    objective: Num,
    max_num_vehicles_available: usize,
    num_requests: usize,
    
    /// Total lateness across all routes (for soft time windows)
    total_lateness: Num,
}

impl<'a> Solution<'a> {
    pub fn extract_itinerary_and_data(&self, route_id: usize) -> (Vec<usize>, REFData) {
        let itinerary = self
            .iter_route_by_vn_id(route_id * 2)
            .collect::<Vec<usize>>();
        let data = self.fw_data[(route_id * 2) + 1].data.clone();
        (itinerary, data)
    }

    pub fn new(instance: &'a PDPTWInstance) -> Self {
        let num_requests = instance.num_requests;
        let num_vehicles = instance.num_vehicles;
        debug_assert_eq!(instance.nodes.len(), (num_vehicles + num_requests) * 2);

        let mut empty_route_ids = FixedBitSet::with_capacity(instance.num_vehicles);
        empty_route_ids.insert_range(..);
        
        let num_nodes = instance.nodes.len();

        Self {
            instance,
            objective: Num::max_value(),
            max_num_vehicles_available: num_vehicles,
            num_requests,

            fw_data: REFNodeVec::with_instance(&instance),
            bw_data: REFNodeVec::with_instance(&instance),
            blocks: BlockNodes::with_instance(&instance),
            empty_route_ids,
            unassigned_requests: RequestBank::with_instance(&instance),
            locked_nodes: FixedBitSet::with_capacity(num_nodes),
            total_lateness: Num::ZERO,
        }
    }

    pub fn set_with(&mut self, desc: &SolutionDescription) {
        self.set(&desc.to_routes_vec(self.instance));
    }

    pub fn objective(&self) -> Num {
        let mut objective = self.unassigned_requests.penalty_per_entry
            * Num::from(self.unassigned_requests.count());
        objective += self.total_cost();
        
        // Add lateness penalty when soft-time-windows feature is enabled
        #[cfg(feature = "soft-time-windows")]
        {
            objective += self.lateness_penalty();
        }
        
        objective
    }
    
    /// Calculate lateness penalty across all routes.
    /// Penalty = total_lateness_minutes * LATE_PENALTY_PER_MINUTE (1000)
    #[cfg(feature = "soft-time-windows")]
    pub fn lateness_penalty(&self) -> Num {
        const LATE_PENALTY_PER_MINUTE: i64 = 1000;
        let mut total_lateness = Num::ZERO;
        for i in 0..self.instance.num_vehicles {
            total_lateness += self.fw_data[(i * 2) + 1].data.get_lateness();
        }
        total_lateness * Num::from(LATE_PENALTY_PER_MINUTE)
    }
    
    /// Get total lateness across all routes (in time units)
    pub fn compute_total_lateness(&self) -> Num {
        #[cfg(feature = "soft-time-windows")]
        {
            let mut total = Num::ZERO;
            for i in 0..self.instance.num_vehicles {
                total += self.fw_data[(i * 2) + 1].data.get_lateness();
            }
            total
        }
        #[cfg(not(feature = "soft-time-windows"))]
        { Num::ZERO }
    }
    
    /// Get total violation count across all routes
    pub fn compute_violation_count(&self) -> usize {
        #[cfg(feature = "soft-time-windows")]
        {
            let mut count = 0;
            for i in 0..self.instance.num_vehicles {
                count += self.fw_data[(i * 2) + 1].data.get_violation_count();
            }
            count
        }
        #[cfg(not(feature = "soft-time-windows"))]
        { 0 }
    }

    pub fn total_cost(&self) -> Num {
        let mut cost = Num::ZERO;
        for i in 0..self.instance.num_vehicles {
            cost += self.fw_data[(i * 2) + 1].data.distance;
        }
        cost
    }

    pub fn total_waiting_time(&self) -> Num {
        let mut waiting_time = Num::ZERO;
        for i in 0..self.instance.num_vehicles {
            waiting_time += Num::ZERO.max(
                self.fw_data[(i * 2) + 1].data.duration() - self.fw_data[(i * 2) + 1].data.time,
            );
        }
        waiting_time
    }

    pub fn is_feasible(&self) -> bool {
        for i in 0..self.instance.num_vehicles {
            if !self.fw_data[(i * 2) + 1].data.tw_feasible {
                dbg!(&self.fw_data[(i * 2) + 1].data);
                return false;
            }
        }
        true
    }
    
    // ========================================================================
    // Locked Nodes (Dynamic Re-optimization)
    // ========================================================================
    
    /// Check if a node is locked (cannot be removed by LNS)
    #[inline(always)]
    pub fn is_locked(&self, node_id: usize) -> bool {
        self.locked_nodes.contains(node_id)
    }
    
    /// Lock a node (prevent removal by LNS destroy operators)
    pub fn lock_node(&mut self, node_id: usize) {
        self.locked_nodes.insert(node_id);
    }
    
    /// Lock a request (both pickup and delivery)
    pub fn lock_request(&mut self, pickup_id: usize) {
        self.locked_nodes.insert(pickup_id);
        self.locked_nodes.insert(pickup_id + 1); // delivery
    }
    
    /// Unlock a node
    pub fn unlock_node(&mut self, node_id: usize) {
        self.locked_nodes.set(node_id, false);
    }
    
    /// Unlock all nodes
    pub fn unlock_all(&mut self) {
        self.locked_nodes.clear();
    }
    
    /// Get count of locked nodes
    pub fn locked_count(&self) -> usize {
        self.locked_nodes.count_ones(..)
    }
    
    /// Iterate over locked node IDs
    pub fn iter_locked(&self) -> impl Iterator<Item = usize> + '_ {
        self.locked_nodes.ones()
    }
    
    // ========================================================================
    // Lateness Tracking (Soft Time Windows)
    // ========================================================================
    
    /// Get total lateness across all routes
    pub fn get_total_lateness(&self) -> Num {
        self.total_lateness
    }
    
    /// Set total lateness (called after route evaluation)
    pub fn set_total_lateness(&mut self, lateness: Num) {
        self.total_lateness = lateness;
    }
}

#[derive(Copy, Clone, Debug)]
pub struct PDExchange {
    pub(crate) vn1_id: usize,
    pub(crate) vn2_id: usize,
    pub(crate) p1_id: usize,
    pub(crate) p2_id: usize,
}

#[derive(Copy, Clone, Debug)]
pub struct PDReplacement {
    pub(crate) vn_id: usize,
    pub(crate) pickup_id: usize,
    pub(crate) replaced_pickup: usize,
}

#[derive(Copy, Clone, Debug)]
pub struct PDInsertion {
    pub(crate) vn_id: usize,
    pub(crate) pickup_id: usize,
    pub(crate) pickup_after: usize,
    pub(crate) delivery_before: usize,
}

pub enum PDInsertionCheckResult {
    Feasible(PDInsertion, Num),
    Infeasible,
}

impl PDInsertionCheckResult {
    fn is_feasible(&self) -> bool {
        match self {
            Self::Feasible(_, _) => true,
            _ => false,
        }
    }
    fn is_infeasible(&self) -> bool {
        !self.is_feasible()
    }
}

impl<'a> Solution<'a> {
    fn check_feasible(&mut self) -> bool {
        (0..self.instance.num_vehicles).all(|i| self.is_route_feasible(i))
    }

    fn check_feasibility(&self, data: &REFData, vn_id: usize) -> bool {
        data.check_feasible(&self.instance.vehicle_from_vn_id(vn_id))
    }

    pub fn check_precedence(&mut self, vn_id: usize) -> bool {
        let mut prev = vn_id;
        let mut open_pickups = FixedBitSet::with_capacity(self.instance.nodes.len());
        loop {
            let next = self.succ(prev);
            if next == vn_id + 1 {
                break;
            }
            match self.instance.node_type(next) {
                NodeType::Pickup => open_pickups.insert(next),
                NodeType::Delivery => {
                    if !open_pickups.contains(next - 1) {
                        return false;
                    }
                    open_pickups.set(next - 1, false);
                }
                _ => {}
            }
            prev = next;
        }
        open_pickups.count_ones(..) == 0
    }
}

impl Solution<'_> {
    pub fn to_description(&self) -> SolutionDescription {
        SolutionDescription {
            successors: self
                .fw_data
                .iter()
                .map(|it| it.succ)
                .collect::<Vec<usize>>(),
            objective: self.objective(),
            total_cost: self.total_cost(),
            vehicles_used: self.number_of_vehicles_used(),
            unassigned_requests: self.number_of_unassigned_requests(),
        }
    }
}

pub fn create_solution_from_sintef(solution: SINTEFSolution, instance: &PDPTWInstance) -> Solution {
    let mut sol = Solution::new(&instance);
    sol.set(
        &solution
            .routes
            .iter()
            .enumerate()
            .map(|(i, it)| {
                let mut r = Vec::with_capacity(it.len());
                r.push(instance.nodes[i * 2].id);
                for u in it {
                    let i = instance
                        .nodes
                        .iter()
                        .find(|it| instance.is_request(it.id) && it.oid == *u)
                        .unwrap();
                    r.push(i.id)
                }
                r.push(instance.nodes[(i * 2) + 1].id);
                r
            })
            .collect::<Vec<Vec<usize>>>(),
    );
    sol
}


#[derive(Debug)]
pub enum BestInsertion {
    Some(PDInsertion, Num),
    None,
}

impl BestInsertion {
    pub fn is_none(&self) -> bool {
        match self {
            Self::None => true,
            _ => false,
        }
    }
    pub fn is_some(&self) -> bool {
        !self.is_none()
    }

    pub fn replace_if_better(&mut self, other: BestInsertion) {
        match (&self, other) {
            (BestInsertion::None, x) => *self = x,
            (BestInsertion::Some(_, cost_a), BestInsertion::Some(ins_b, cost_b)) => {
                if cost_b < *cost_a {
                    *self = BestInsertion::Some(ins_b, cost_b)
                }
            }
            _ => {}
        }
    }
}


#[cfg(feature = "classic-pdptw")]
#[cfg(feature = "test-with-sartoriburiol-solutions")]
#[cfg(test)]
pub mod tests {
    use crate::problem::Num;
    use crate::solution::create_solution_from_sintef;

    #[test]
    fn test_with_solutions_n100() -> anyhow::Result<()> {
        use crate::io::sintef_solution::tests::sartori_buriol::INSTANCE_DIR_N100;
        use crate::io::sintef_solution::tests::sartori_buriol::N100;
        use crate::io::sintef_solution::tests::sartori_buriol::SOLUTION_DIR_N100;

        for (instance_name, solution_name, ref_vehicles, ref_obj) in N100.iter() {
            let instance_path = format!("{}/{}", INSTANCE_DIR_N100, instance_name);
            let solution_path = format!("{}/{}", SOLUTION_DIR_N100, solution_name);

            let instance = crate::io::sartori_buriol_reader::load_instance(
                instance_path,
                Some(*ref_vehicles),
            )?;
            let solution = crate::io::sintef_solution::load_sintef_solution(solution_path)?;

            let sol = create_solution_from_sintef(solution, &instance);

            assert_eq!(Num::from(*ref_obj), sol.objective());
        }

        Ok(())
    }

    #[test]
    fn test_with_solutions_n200() -> anyhow::Result<()> {
        use crate::io::sintef_solution::tests::sartori_buriol::INSTANCE_DIR_N200;
        use crate::io::sintef_solution::tests::sartori_buriol::N200;
        use crate::io::sintef_solution::tests::sartori_buriol::SOLUTION_DIR_N200;

        for (instance_name, solution_name, ref_vehicles, ref_obj) in N200.iter() {
            let instance_path = format!("{}/{}", INSTANCE_DIR_N200, instance_name);
            let solution_path = format!("{}/{}", SOLUTION_DIR_N200, solution_name);

            let instance = crate::io::sartori_buriol_reader::load_instance(
                instance_path,
                Some(*ref_vehicles),
            )?;
            let solution = crate::io::sintef_solution::load_sintef_solution(solution_path)?;

            let sol = create_solution_from_sintef(solution, &instance);

            assert_eq!(Num::from(*ref_obj), sol.objective());
        }

        Ok(())
    }

    #[test]
    fn test_with_solutions_n400() -> anyhow::Result<()> {
        use crate::io::sintef_solution::tests::sartori_buriol::INSTANCE_DIR_N400;
        use crate::io::sintef_solution::tests::sartori_buriol::N400;
        use crate::io::sintef_solution::tests::sartori_buriol::SOLUTION_DIR_N400;

        for (instance_name, solution_name, ref_vehicles, ref_obj) in N400.iter() {
            let instance_path = format!("{}/{}", INSTANCE_DIR_N400, instance_name);
            let solution_path = format!("{}/{}", SOLUTION_DIR_N400, solution_name);

            let instance = crate::io::sartori_buriol_reader::load_instance(
                instance_path,
                Some(*ref_vehicles),
            )?;
            let solution = crate::io::sintef_solution::load_sintef_solution(solution_path)?;

            let sol = create_solution_from_sintef(solution, &instance);

            assert_eq!(Num::from(*ref_obj), sol.objective());
        }

        Ok(())
    }

    #[test]
    fn test_with_solutions_n1000() -> anyhow::Result<()> {
        use crate::io::sintef_solution::tests::sartori_buriol::INSTANCE_DIR_N1000;
        use crate::io::sintef_solution::tests::sartori_buriol::N1000;
        use crate::io::sintef_solution::tests::sartori_buriol::SOLUTION_DIR_N1000;

        for (instance_name, solution_name, ref_vehicles, ref_obj) in N1000.iter() {
            let instance_path = format!("{}/{}", INSTANCE_DIR_N1000, instance_name);
            let solution_path = format!("{}/{}", SOLUTION_DIR_N1000, solution_name);

            let instance = crate::io::sartori_buriol_reader::load_instance(
                instance_path,
                Some(*ref_vehicles),
            )?;
            let solution = crate::io::sintef_solution::load_sintef_solution(solution_path)?;

            let sol = create_solution_from_sintef(solution, &instance);

            assert_eq!(Num::from(*ref_obj), sol.objective());
        }

        Ok(())
    }
}
