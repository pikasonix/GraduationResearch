use fixedbitset::FixedBitSet;

use crate::problem::pdptw::PDPTWInstance;
use crate::solution::BestInsertion;
use crate::solution::Solution;
#[cfg(feature = "search_assertions")]
use crate::utils::validator::assert_valid_solution;
use crate::utils::Random;

pub struct GreedyInsertionWithBlinks<'a> {
    instance: &'a PDPTWInstance,
    use_empty_route: bool,
    blink_rate: f64,
}

impl<'a> GreedyInsertionWithBlinks<'a> {
    pub fn new(instance: &'a PDPTWInstance, blink_rate: f64, use_empty_route: bool) -> Self {
        Self {
            instance,
            use_empty_route,
            blink_rate: blink_rate.clamp(0.0, 1.0),
        }
    }
    // Greedy insertion with blinks (Algorithm 3) is modified to iterate over
    //  feasible combinations for pickup and delivery insertion positions.
    // In addition to the sorting orders introduced in Section 5.3 (random, demand, far, and close),
    // customers are sorted with respect to increasing time window length, increasing time window
    // start, and decreasing time window end.
    pub fn repair(&self, solution: &mut Solution, rng: &mut Random) {
        let sorted_pickups =
            crate::lns::repair::sort_unassigned_customers(self.instance, solution, rng);

        let v_ids: Vec<usize> = solution.iter_route_ids().collect();

        let iter = sorted_pickups.into_iter();

        for p_id in iter {
            let best_insertion =
                self.find_best_insertion_in_iter_routes(solution, p_id, v_ids.iter().cloned(), rng);

            if let BestInsertion::Some(ins, _) = best_insertion {
                solution.insert(ins);
                solution.unassigned_requests.remove(p_id);
            } else if self.use_empty_route {
                self.find_first_empty_route_and_insert(solution, p_id, rng);
            }
        }

        #[cfg(feature = "search_assertions")]
        assert_valid_solution(self.instance, solution);
    }

    pub fn repair_using_subset_of_routes(
        &self,
        solution: &mut Solution,
        rng: &mut Random,
        subset_routes: FixedBitSet,
    ) {
        let sorted_pickups =
            crate::lns::repair::sort_unassigned_customers(self.instance, solution, rng);

        let iter = sorted_pickups.into_iter();

        for p_id in iter {
            // find best insertion
            let best_insertion =
                self.find_best_insertion_in_iter_routes(solution, p_id, subset_routes.ones(), rng);

            if let BestInsertion::Some(ins, _) = best_insertion {
                solution.insert(ins);
                solution.unassigned_requests.remove(p_id);
            } else if self.use_empty_route {
                self.find_first_empty_route_and_insert(solution, p_id, rng);
            }
        }

        #[cfg(feature = "search_assertions")]
        assert_valid_solution(self.instance, solution);
    }

    fn find_best_insertion_in_iter_routes(
        &self,
        solution: &mut Solution,
        p_id: usize,
        iter_v_ids: impl Iterator<Item=usize>,
        rng: &mut Random,
    ) -> BestInsertion {
        let mut best_insertion: BestInsertion = BestInsertion::None;
        for v_id in iter_v_ids {
            let best_insertion_in_route = solution
                .find_best_insert_for_request_in_route_with_blinks(
                    p_id,
                    self.instance.vn_id_of(v_id),
                    rng,
                    self.blink_rate,
                );
            best_insertion.replace_if_better(best_insertion_in_route)
        }
        best_insertion
    }

    fn find_first_empty_route_and_insert(
        &self,
        solution: &mut Solution,
        p_id: usize,
        rng: &mut Random,
    ) {
        if let Some(empty_route_id) = solution.get_empty_route() {
            if let BestInsertion::Some(ins, _) = solution
                .find_best_insert_for_request_in_route_with_blinks(
                    p_id,
                    self.instance.vn_id_of(empty_route_id),
                    rng,
                    self.blink_rate,
                )
            {
                solution.insert(ins);
                solution.unassigned_requests.remove(p_id);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::problem::Num;
    use crate::solution::create_solution_from_sintef;

    use super::*;

    #[test]
    #[allow(non_snake_case)]
    fn test_all_insertions_N100() -> anyhow::Result<()> {
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
            let solution_desc = create_solution_from_sintef(solution, &instance).to_description();
            let mut sol = Solution::new(&instance);

            let repair = GreedyInsertionWithBlinks::new(&instance, 0.0, true);
            let mut rng = Random::new(0);

            for pickup in instance.iter_pickups() {
                sol.set_with(&solution_desc);
                let vehicles_used = sol.number_of_vehicles_used();
                assert_eq!(Num::from(*ref_obj), sol.objective());
                println!("unassigned pickup: {}", pickup.id);
                println!(
                    "corresponding route ({}): {:?}",
                    sol.fw_data[pickup.id].vn_id / 2,
                    sol.iter_route(sol.fw_data[pickup.id].vn_id / 2)
                        .collect::<Vec<usize>>()
                );

                sol.unassign_request(pickup.id);
                println!(
                    "{:?}",
                    sol.iter_route(sol.fw_data[pickup.id].vn_id / 2)
                        .collect::<Vec<usize>>()
                );
                repair.repair(&mut sol, &mut rng);
                println!(
                    "{:?}",
                    sol.iter_route(sol.fw_data[pickup.id].vn_id / 2)
                        .collect::<Vec<usize>>()
                );

                assert_eq!(sol.unassigned_requests.count(), 0);
                assert_eq!(sol.number_of_vehicles_used(), vehicles_used);
            }
        }

        Ok(())
    }

    #[test]
    #[allow(non_snake_case)]
    fn test_all_insertions_N1000() -> anyhow::Result<()> {
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
            let solution_desc = create_solution_from_sintef(solution, &instance).to_description();
            let mut sol = Solution::new(&instance);

            let repair = GreedyInsertionWithBlinks::new(&instance, 0.0, true);
            let mut rng = Random::new(0);

            for pickup in instance.iter_pickups() {
                sol.set_with(&solution_desc);
                let vehicles_used = sol.number_of_vehicles_used();
                assert_eq!(Num::from(*ref_obj), sol.objective());
                sol.unassign_request(pickup.id);

                repair.repair(&mut sol, &mut rng);

                assert_eq!(sol.unassigned_requests.count(), 0);
                assert_eq!(sol.number_of_vehicles_used(), vehicles_used);
            }
        }

        Ok(())
    }
}
