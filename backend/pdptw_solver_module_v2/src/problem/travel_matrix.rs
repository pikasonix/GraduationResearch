use num_traits::{Pow, Zero};

use crate::problem::Arc;

#[cfg(not(feature = "classic-pdptw"))]
pub type DistanceNumType = crate::utils::num::NumU16P0;

#[cfg(not(feature = "classic-pdptw"))]
pub type TimeNumType = crate::utils::num::NumU16P0;

#[cfg(feature = "classic-pdptw")]
pub type DistanceNumType = crate::utils::num::NumI32P3;

#[cfg(feature = "classic-pdptw")]
pub type TimeNumType = crate::utils::num::NumI32P3;

#[derive(Debug, Clone)]
pub struct ArcValues {
    pub distance: DistanceNumType,
    pub time: TimeNumType,
}

static ZERO_ARC_VALUES: ArcValues = ArcValues {
    distance: DistanceNumType::ZERO,
    time: TimeNumType::ZERO,
};

impl Default for ArcValues {
    fn default() -> Self {
        ArcValues {
            distance: DistanceNumType::max_value(),
            time: TimeNumType::max_value(),
        }
    }
}

pub trait TravelMatrix {
    fn distance(&self, from: usize, to: usize) -> DistanceNumType;
    fn time(&self, from: usize, to: usize) -> TimeNumType;
    fn arc(&self, from: usize, to: usize) -> &ArcValues;
    fn max_distance(&self) -> DistanceNumType;
    fn max_time(&self) -> TimeNumType;
}

#[derive(Debug)]
pub struct FixSizedTravelMatrix {
    n: usize,
    data: Vec<ArcValues>,
    max_distance: DistanceNumType,
    max_time: TimeNumType,
}

impl FixSizedTravelMatrix {
    pub fn with_euclidean_distances(coords: &Vec<(f64, f64)>) -> Self {
        let n = coords.len();
        let num_arcs = n * n;
        let mut data = vec![ArcValues::default(); num_arcs];

        let mut max_distance = DistanceNumType::ZERO;
        let mut max_time = TimeNumType::ZERO;
        for i in 0..n {
            for j in 0..n {
                let idx = i * n + j;
                if i == j {
                    data[idx] = ArcValues {
                        distance: DistanceNumType::zero(),
                        time: TimeNumType::zero(),
                    };
                } else {
                    let (xi, yi) = &coords[i];
                    let (xj, yj) = &coords[j];
                    let euclidean_squared: f64 = (xi - xj).pow(2) + (yi - yj).pow(2);
                    let euclidean = euclidean_squared.sqrt();
                    let distance = euclidean.into();
                    let time = euclidean.into();
                    if distance > max_distance {
                        max_distance = distance;
                    }
                    if time > max_time {
                        max_time = time;
                    }
                    data[idx] = ArcValues { distance, time };
                }
            }
        }

        Self {
            n,
            data,
            max_distance,
            max_time,
        }
    }

    pub fn relabeled_subset(&self, to_original_mapping: &Vec<usize>) -> Self {
        let n = to_original_mapping.len();
        let mut data = vec![ArcValues::default(); n * n];
        let mut max_distance = DistanceNumType::ZERO;
        let mut max_time = TimeNumType::ZERO;

        for i in 0..n {
            let from = to_original_mapping[i];
            for j in 0..n {
                let to = to_original_mapping[j];
                if from == to {
                    data[i * n + j].distance = DistanceNumType::ZERO;
                    data[i * n + j].time = TimeNumType::ZERO;
                } else {
                    data[i * n + j] = self.data[self.idx(from, to)].clone();
                    if data[i * n + j].distance > max_distance {
                        max_distance = data[i * n + j].distance;
                    }
                    if data[i * n + j].distance > max_time {
                        max_time = data[i * n + j].distance;
                    }
                }
            }
        }

        Self {
            n,
            data,
            max_distance,
            max_time,
        }
    }

    #[inline(always)]
    fn idx(&self, from: usize, to: usize) -> usize {
        debug_assert!(from < self.n);
        debug_assert!(to < self.n);
        from * self.n + to
    }
}

impl TravelMatrix for FixSizedTravelMatrix {
    #[inline(always)]
    fn distance(&self, from: usize, to: usize) -> DistanceNumType {
        self.data[self.idx(from, to)].distance
    }
    #[inline(always)]
    fn time(&self, from: usize, to: usize) -> TimeNumType {
        self.data[self.idx(from, to)].time
    }
    #[inline(always)]
    fn arc(&self, from: usize, to: usize) -> &ArcValues {
        &self.data[self.idx(from, to)]
    }
    #[inline(always)]
    fn max_distance(&self) -> DistanceNumType {
        self.max_distance
    }
    #[inline(always)]
    fn max_time(&self) -> DistanceNumType {
        self.max_time
    }
}

pub struct FixSizedTravelMatrixBuilder {
    n: usize,
    data: Vec<ArcValues>,
    max_distance: DistanceNumType,
    max_time: TimeNumType,
}

impl FixSizedTravelMatrixBuilder {
    pub fn with_num_nodes(num_nodes: usize) -> Self {
        let mut data = vec![ArcValues::default(); num_nodes * num_nodes];
        for i in 0..num_nodes {
            let idx = i * num_nodes + i;
            data[idx] = ArcValues {
                distance: DistanceNumType::zero(),
                time: TimeNumType::zero(),
            };
        }
        Self {
            n: num_nodes,
            data,
            max_distance: DistanceNumType::ZERO,
            max_time: TimeNumType::ZERO,
        }
    }
    pub fn set_arc(&mut self, arc: Arc) -> &mut Self {
        if DistanceNumType::try_from(arc.distance).is_err() {
            panic!("{} does not fit in DistanceNumType", arc.distance);
        }
        if TimeNumType::try_from(arc.time).is_err() {
            panic!("{} does not fit in TimeNumType", arc.time);
        }
        let distance = arc.distance.try_into().unwrap();
        if distance > self.max_distance {
            self.max_distance = distance;
        }
        let time = arc.time.try_into().unwrap();
        if time > self.max_time {
            self.max_time = time;
        }
        self.data[arc.from * self.n + arc.to] = ArcValues { distance, time };

        self
    }
    pub fn build(self) -> FixSizedTravelMatrix {
        FixSizedTravelMatrix {
            n: self.n,
            data: self.data,
            max_distance: self.max_distance,
            max_time: self.max_time,
        }
    }
}

#[derive(Debug)]
pub struct TravelMatrixProxy {
    pub map: Vec<usize>,
    matrix: &'static FixSizedTravelMatrix,
}

impl TravelMatrix for TravelMatrixProxy {
    #[inline(always)]
    fn distance(&self, from: usize, to: usize) -> DistanceNumType {
        self.matrix.distance(self.map[from], self.map[to])
    }
    #[inline(always)]
    fn time(&self, from: usize, to: usize) -> TimeNumType {
        self.matrix.time(self.map[from], self.map[to])
    }
    #[inline(always)]
    fn arc(&self, from: usize, to: usize) -> &ArcValues {
        self.matrix.arc(self.map[from], self.map[to])
    }

    #[inline(always)]
    fn max_distance(&self) -> DistanceNumType {
        self.matrix.max_distance()
    }
    #[inline(always)]
    fn max_time(&self) -> DistanceNumType {
        self.matrix.max_time()
    }
}

impl TravelMatrixProxy {
    pub fn new(
        map: Vec<usize>,
        matrix: &'static FixSizedTravelMatrix,
    ) -> Self {
        Self {
            map,
            matrix,
        }
    }

    pub fn relabeled_subset(
        &self,
        to_original_mapping: &Vec<usize>,
    ) -> Self {
        Self {
            map: to_original_mapping.iter().map(|it| self.map[*it]).collect(),
            matrix: self.matrix,
        }
    }
}

// ============================================================================
// Dynamic Travel Matrix - Supports virtual start nodes for re-optimization
// ============================================================================

use std::collections::HashMap;

/// Virtual node representing a vehicle's current position (not at depot).
/// Used during dynamic re-optimization when vehicles are already on route.
#[derive(Debug, Clone)]
pub struct VirtualNode {
    pub node_id: usize,           // Virtual node ID (>= first_virtual_id)
    pub vehicle_id: usize,        // Which vehicle this represents
    pub position: (f64, f64),     // GPS coordinates
}

/// Dynamic travel matrix that wraps a base matrix and adds support for
/// virtual start nodes (vehicle current positions).
/// 
/// Strategy: Compute Row Once - when reoptimize() starts, compute distances
/// from each virtual node to all static nodes and cache them.
#[derive(Debug)]
pub struct DynamicTravelMatrix<'a> {
    /// Base travel matrix for static nodes
    base_matrix: &'a TravelMatrixProxy,
    
    /// Cached distance/time rows for virtual nodes
    /// Key: virtual_node_id, Value: Vec of ArcValues to all nodes (including other virtuals)
    virtual_rows: HashMap<usize, Vec<ArcValues>>,
    
    /// Virtual nodes info
    virtual_nodes: Vec<VirtualNode>,
    
    /// First virtual node ID (= num_static_nodes)
    first_virtual_id: usize,
    
    /// Total nodes (static + virtual)
    total_nodes: usize,
    
    /// Coordinates of all static nodes for distance calculation
    static_coords: Vec<(f64, f64)>,
    
    /// Speed factor for time calculation (distance / speed = time)
    /// Default: 1.0 (time = distance for euclidean)
    speed_factor: f64,
}

impl<'a> DynamicTravelMatrix<'a> {
    /// Create a new DynamicTravelMatrix wrapping a base matrix.
    /// 
    /// # Arguments
    /// * `base_matrix` - The static travel matrix
    /// * `static_coords` - Coordinates of all static nodes for computing virtual distances
    /// * `num_static_nodes` - Number of nodes in base matrix
    pub fn new(
        base_matrix: &'a TravelMatrixProxy,
        static_coords: Vec<(f64, f64)>,
        num_static_nodes: usize,
    ) -> Self {
        Self {
            base_matrix,
            virtual_rows: HashMap::new(),
            virtual_nodes: Vec::new(),
            first_virtual_id: num_static_nodes,
            total_nodes: num_static_nodes,
            static_coords,
            speed_factor: 1.0,
        }
    }

    /// Set speed factor for time calculation
    pub fn with_speed_factor(mut self, speed: f64) -> Self {
        self.speed_factor = speed;
        self
    }

    /// Add a virtual node for a vehicle's current position.
    /// Returns the virtual node ID.
    pub fn add_virtual_node(&mut self, vehicle_id: usize, position: (f64, f64)) -> usize {
        let virtual_id = self.total_nodes;
        
        self.virtual_nodes.push(VirtualNode {
            node_id: virtual_id,
            vehicle_id,
            position,
        });
        
        // Compute distances from this virtual node to all static nodes
        let mut row = Vec::with_capacity(self.total_nodes + 1);
        
        for i in 0..self.first_virtual_id {
            let (sx, sy) = self.static_coords[i];
            let arc = self.compute_arc(position, (sx, sy));
            row.push(arc);
        }
        
        // Distance to other virtual nodes (if any)
        for vn in &self.virtual_nodes {
            if vn.node_id != virtual_id {
                let arc = self.compute_arc(position, vn.position);
                row.push(arc);
            }
        }
        
        // Distance to self = 0
        row.push(ArcValues {
            distance: DistanceNumType::ZERO,
            time: TimeNumType::ZERO,
        });
        
        self.virtual_rows.insert(virtual_id, row);
        self.total_nodes += 1;
        
        virtual_id
    }

    /// Compute arc values (distance and time) between two positions
    fn compute_arc(&self, from: (f64, f64), to: (f64, f64)) -> ArcValues {
        let dx = from.0 - to.0;
        let dy = from.1 - to.1;
        let euclidean = (dx * dx + dy * dy).sqrt();
        
        ArcValues {
            distance: (euclidean as f64).into(),
            time: (euclidean / self.speed_factor).into(),
        }
    }

    /// Check if a node ID is a virtual node
    #[inline(always)]
    pub fn is_virtual(&self, node_id: usize) -> bool {
        node_id >= self.first_virtual_id
    }

    /// Get virtual node info by ID
    pub fn get_virtual_node(&self, node_id: usize) -> Option<&VirtualNode> {
        if self.is_virtual(node_id) {
            let idx = node_id - self.first_virtual_id;
            self.virtual_nodes.get(idx)
        } else {
            None
        }
    }

    /// Get virtual node ID for a vehicle (if exists)
    pub fn virtual_node_for_vehicle(&self, vehicle_id: usize) -> Option<usize> {
        self.virtual_nodes
            .iter()
            .find(|vn| vn.vehicle_id == vehicle_id)
            .map(|vn| vn.node_id)
    }
}

impl<'a> TravelMatrix for DynamicTravelMatrix<'a> {
    #[inline(always)]
    fn distance(&self, from: usize, to: usize) -> DistanceNumType {
        self.arc(from, to).distance
    }

    #[inline(always)]
    fn time(&self, from: usize, to: usize) -> TimeNumType {
        self.arc(from, to).time
    }

    #[inline(always)]
    fn arc(&self, from: usize, to: usize) -> &ArcValues {
        if from >= self.first_virtual_id {
            // From is virtual node - lookup cached row
            if let Some(row) = self.virtual_rows.get(&from) {
                if to < row.len() {
                    return &row[to];
                }
            }
            // Fallback to zero (shouldn't happen in correct usage)
            &ZERO_ARC_VALUES
        } else if to >= self.first_virtual_id {
            // To is virtual node - this is rare (vehicles don't return to current position)
            // For now, return MAX to discourage this
            &ZERO_ARC_VALUES
        } else {
            // Both static - use base matrix
            self.base_matrix.arc(from, to)
        }
    }

    #[inline(always)]
    fn max_distance(&self) -> DistanceNumType {
        self.base_matrix.max_distance()
    }

    #[inline(always)]
    fn max_time(&self) -> DistanceNumType {
        self.base_matrix.max_time()
    }
}

#[cfg(test)]
mod dynamic_matrix_tests {
    use super::*;

    // Tests would go here
}

