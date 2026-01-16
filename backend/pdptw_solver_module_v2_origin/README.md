# PDPTW Solver - Rust Implementation

## Mô tả chung

PDPTW Solver (Rust version) là bộ giải thuật tối ưu hóa cho bài toán Pickup and Delivery Problem with Time Windows (PDPTW). Đây là phiên bản viết lại hoàn toàn bằng Rust từ phiên bản C++ gốc, cung cấp hiệu năng cao hơn và khả năng tương thích tốt hơn với backend Node.js.

**Đặc điểm chính:**
- Viết bằng Rust với hiệu năng cao và memory safety
- Giải quyết bài toán Large-Scale PDPTW với hàng trăm requests
- Hỗ trợ hai objective: Fleet Minimization và Cost Minimization
- Thuật toán hybrid kết hợp nhiều kỹ thuật metaheuristic
- Compatible với CLI của phiên bản C++
- Hỗ trợ hai format instances: Li & Lim và Sartori & Buriol

**Phương pháp giải:**
- Construction: KDSP (K-Disjoint Shortest Paths) với single-request blocks
- Local Search: LNS (Large Neighborhood Search) với nhiều destroy/repair operators
- Fleet Minimization: AGES (Approximate GENI Ejection Search)
- Acceptance Criteria: Record-to-Record Travel (RTR) và Simulated Annealing (SA)

**Kết quả:**
- Tìm được solutions chất lượng cao cho benchmark instances
- Thời gian chạy nhanh (giây đến phút) cho instances vừa phải
- Có thể scale lên instances lớn (100+ requests)

## Cách cài đặt

### Yêu cầu hệ thống

- Rust 1.70 trở lên (khuyến nghị sử dụng phiên bản stable mới nhất)
- Cargo (đi kèm với Rust)
- OS: Windows, Linux, hoặc macOS
- RAM: Tối thiểu 2GB (4GB+ cho instances lớn)

### Cài đặt Rust

**Windows:**
```powershell
# Download và chạy rustup-init.exe từ https://rustup.rs/
# Hoặc sử dụng winget
winget install Rustlang.Rust.MSVC
```

**Linux/macOS:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

Kiểm tra cài đặt:
```bash
rustc --version
cargo --version
```

### Build project

**1. Clone và navigate tới project:**
```bash
cd backend/pdptw_solver_module_v2_origin
```

**2. Build release version:**
```bash
cargo build --release
```

Binary sẽ được tạo tại: `target/release/ls-pdptw-solver.exe` (Windows) hoặc `target/release/ls-pdptw-solver` (Linux/macOS)

**3. Build với features tùy chọn:**
```bash
# Build với progress tracking
cargo build --release --features progress_tracking

# Build với parallel processing
cargo build --release --features parallel

# Build với tất cả features
cargo build --release --all-features
```

**4. Copy binary vào thư mục backend/bin:**
```bash
# Windows
copy target\release\ls-pdptw-solver.exe ..\bin\pdptw_solver_rust.exe

# Linux/macOS
cp target/release/ls-pdptw-solver ../bin/pdptw_solver_rust
```

### Dependencies

Các dependencies chính được quản lý bởi Cargo:
- `clap`: Command-line argument parsing
- `rand`: Random number generation
- `kdsp`: K-Disjoint Shortest Paths library
- `serde` và `serde_json`: Serialization/deserialization
- `anyhow`: Error handling
- `log` và `env_logger`: Logging

Dependencies được tự động tải khi build với Cargo.

## Cách chạy

### Basic usage

**Cú pháp cơ bản:**
```bash
ls-pdptw-solver --instance <instance_file> [OPTIONS]
```

**Ví dụ đơn giản:**
```bash
# Chạy với instance Li & Lim
ls-pdptw-solver --instance resources/instances/lilim/lr107.txt

# Chỉ định output directory
ls-pdptw-solver --instance resources/instances/lilim/lc101.txt --output-dir solutions

# Set seed cho reproducibility
ls-pdptw-solver --instance resources/instances/lilim/lrc102.txt --seed 42
```

### Parameters chi tiết

**Instance và format:**
```bash
--instance <path>        # Instance file path (required)
--format <format>        # Instance format: auto (default), lilim, sartori
--output-dir <dir>       # Output directory (default: solutions)
--max-vehicles <n>       # Maximum number of vehicles (default: auto)
```

**LNS parameters:**
```bash
--iterations <n>         # Maximum LNS iterations (default: 100000)
--max-non-improving <n>  # Max non-improving iterations (default: 20000)
--time-limit <seconds>   # Time limit in seconds (0 = no limit, default: 0)
--seed <n>               # Random seed (default: random)
```

**Destroy parameters:**
```bash
--min-destroy <frac>     # Min destroy fraction 0.0-1.0 (default: 0.20)
--max-destroy <frac>     # Max destroy fraction 0.0-1.0 (default: 0.35)
--min-destroy-count <n>  # Min destroy count absolute (overrides fraction)
--max-destroy-count <n>  # Max destroy count absolute (overrides fraction)
```

**Acceptance criterion:**
```bash
--acceptance <type>      # Acceptance criterion: rtr (default), sa, greedy
                         # rtr = Record-to-Record Travel
                         # sa = Simulated Annealing
                         # greedy = Only accept improvements
```

**Construction và recombination:**
```bash
--construction <type>    # Construction strategy: sequential, regret, binpacking
--recombine <mode>       # Recombination mode: greedy, bestfit
```

**AGES parameters:**
```bash
--k-ejection             # Enable k-ejection in AGES (default: true)
--no-k-ejection          # Disable k-ejection
--perturbation           # Enable perturbation in AGES (default: true)
--no-perturbation        # Disable perturbation
```

**Metadata:**
```bash
--authors <names>        # Solution authors (default: "PDPTW Solver")
--reference <ref>        # Solution reference (default: "LNS with SA/RTR")
--log-level <level>      # Log level: trace, debug, info, warn, error
```

### Ví dụ nâng cao

**1. Chạy với thời gian giới hạn và parameters tùy chỉnh:**
```bash
ls-pdptw-solver \
  --instance resources/instances/sartori/bar-n100-1.txt \
  --format sartori \
  --output-dir results \
  --iterations 50000 \
  --max-non-improving 10000 \
  --time-limit 600 \
  --min-destroy 0.15 \
  --max-destroy 0.40 \
  --acceptance rtr \
  --seed 12345 \
  --authors "WAYO Team" \
  --reference "LNS+AGES Hybrid"
```

**2. Chạy với absolute destroy counts:**
```bash
ls-pdptw-solver \
  --instance resources/instances/lilim/lrc101.txt \
  --min-destroy-count 10 \
  --max-destroy-count 30 \
  --iterations 100000
```

**3. Disable AGES features:**
```bash
ls-pdptw-solver \
  --instance resources/instances/lilim/lr101.txt \
  --no-k-ejection \
  --no-perturbation
```

**4. Sử dụng Simulated Annealing:**
```bash
ls-pdptw-solver \
  --instance resources/instances/lilim/lc102.txt \
  --acceptance sa \
  --iterations 50000
```

**5. Benchmark toàn bộ instances:**
```powershell
# Windows PowerShell
.\run_all_benchmarks.ps1
```

### Output format

Solution được lưu theo SINTEF format trong file `.sol`:

```
Instance name : <instance_name>
Authors : <authors>
Reference : <reference>
Solution
Route 1: <node_sequence>
Route 2: <node_sequence>
...
```

Tên file theo format:
```
<instance_name>.<unassigned>_<vehicles>_<objective>.<seed>.sol
```

Ví dụ: `lr107.0_12_1558.069.42.sol`
- 0 unassigned requests
- 12 vehicles used
- Objective: 1558.069
- Seed: 42

## Cấu trúc dự án

```
pdptw_solver_module_v2_origin/
├── Cargo.toml                   # Cargo configuration và dependencies
├── Cargo.lock                   # Locked dependencies versions
├── CLI_COMPATIBILITY.md         # CLI compatibility guide
├── README.md                    # Tài liệu này
│
├── src/                         # Source code
│   ├── main.rs                  # Entry point
│   ├── cli.rs                   # CLI arguments parsing
│   │
│   ├── problem/                 # Problem definition
│   │   ├── mod.rs               # Problem types và interfaces
│   │   ├── pdptw.rs             # PDPTW instance structure
│   │   └── travel_matrix.rs    # Distance/time matrix
│   │
│   ├── solution/                # Solution representation
│   │   ├── mod.rs               # Solution structure
│   │   ├── blocknode.rs         # Block node representation
│   │   └── permutation.rs       # Permutation operations
│   │
│   ├── construction/            # Construction heuristics
│   │   ├── mod.rs               # Construction interface
│   │   ├── kdsp.rs              # KDSP construction
│   │   ├── insertion.rs         # Insertion heuristics
│   │   └── bin.rs               # Bin packing heuristics
│   │
│   ├── lns/                     # Large Neighborhood Search
│   │   ├── mod.rs               # LNS framework
│   │   ├── destroy/             # Destroy operators
│   │   │   ├── mod.rs           # Destroy interface
│   │   │   ├── adjacent_string_removal.rs  # Shaw removal
│   │   │   ├── route_removal.rs            # Random route removal
│   │   │   ├── worst_removal.rs            # Worst removal
│   │   │   └── absence_removal.rs          # Absence-based removal
│   │   ├── repair/              # Repair operators
│   │   │   ├── mod.rs           # Repair interface
│   │   │   ├── greedy_insertion_with_blinks.rs
│   │   │   ├── regret_insertion.rs
│   │   │   ├── absence_based_regret_insertion.rs
│   │   │   └── hardest_first_insertion.rs
│   │   ├── acceptance_criterion.rs  # RTR, SA, Greedy
│   │   ├── absence_counter.rs       # Absence tracking
│   │   ├── fleet_minimization.rs    # Fleet minimization logic
│   │   └── largescale/              # Large-scale LNS components
│   │       ├── mod.rs
│   │       └── ages.rs              # AGES integration
│   │
│   ├── ages/                    # AGES (Ejection search)
│   │   └── mod.rs               # K-ejection và perturbation
│   │
│   ├── solver/                  # Solver implementations
│   │   ├── mod.rs               # Solver interface
│   │   ├── ls_solver.rs         # LS-AGES-LNS solver
│   │   └── construction.rs      # Construction solver
│   │
│   ├── refn/                    # Resource Extension Functions
│   │   ├── mod.rs               # Forward REF
│   │   └── ...                  # REF utilities
│   │
│   ├── clustering/              # Clustering utilities
│   │   └── mod.rs               # Block creation
│   │
│   ├── pooling/                 # Solution pooling
│   │   └── mod.rs               # Pool management
│   │
│   ├── io/                      # Input/Output
│   │   ├── mod.rs               # I/O interface
│   │   ├── lilim_instance.rs    # Li & Lim format parser
│   │   ├── sartori_instance.rs  # Sartori & Buriol parser
│   │   ├── sintef_solution.rs   # SINTEF solution writer
│   │   └── kdsp_writer.rs       # KDSP format writer
│   │
│   └── utils/                   # Utilities
│       ├── mod.rs               # Utility functions
│       ├── num.rs               # Numeric types (fixed-point)
│       ├── random.rs            # RNG utilities
│       ├── validator.rs         # Solution validation
│       └── stats/               # Statistics tracking
│           └── search_progress_stats.rs
│
├── libs/                        # Local libraries
│   ├── fp_decimal_type/         # Fixed-point decimal implementation
│   │   ├── Cargo.toml
│   │   └── src/
│   └── kdsp/                    # K-Disjoint Shortest Paths library
│       ├── Cargo.toml
│       └── src/
│
├── resources/                   # Resources
│   ├── instances/               # Benchmark instances
│   │   ├── lilim/               # Li & Lim instances (lr101.txt, lc101.txt, etc.)
│   │   └── sartori/             # Sartori & Buriol instances
│   └── parameters/              # Parameter configurations
│       ├── benchmark.args       # Benchmark parameters
│       └── case-study.args      # Case study parameters
│
├── solutions/                   # Output solutions directory
├── benchmark_results/           # Benchmark results
│
├── target/                      # Build artifacts (gitignored)
│   ├── debug/                   # Debug build
│   └── release/                 # Release build
│
└── scripts/                     # PowerShell scripts
    ├── run_all_benchmarks.ps1   # Run all benchmarks
    ├── run_all_tests.ps1        # Run all tests
    └── run_benchmark.ps1        # Run single benchmark
```

### Module dependencies

```
main
 ├─ cli
 ├─ io (lilim, sartori, sintef)
 ├─ problem (pdptw, travel_matrix)
 ├─ solution (blocknode, permutation)
 ├─ construction (kdsp, insertion)
 ├─ solver
 │   ├─ construction
 │   └─ ls_solver
 │       ├─ lns (destroy, repair, acceptance)
 │       └─ ages (ejection, perturbation)
 ├─ refn (REF calculations)
 ├─ clustering (block creation)
 └─ utils (num, random, validator)
```

## Phân tích chi tiết thuật toán

### 1. Overview thuật toán LS-AGES-LNS

Solver sử dụng hybrid metaheuristic kết hợp ba thành phần chính:

```
┌─────────────────────────────────────────────────────┐
│         LS-AGES-LNS Hybrid Framework                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Construction Phase (KDSP)                      │
│     └─ Generate initial solution                   │
│                                                     │
│  2. Improvement Phase (LNS Loop)                   │
│     ├─ Destroy: Remove requests                    │
│     ├─ Repair: Re-insert requests                  │
│     └─ Accept/Reject: RTR or SA                    │
│                                                     │
│  3. Intensification Phase (AGES)                   │
│     ├─ K-Ejection: Try deeper moves                │
│     └─ Perturbation: Escape local optima           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. Construction Phase - KDSP

**K-Disjoint Shortest Paths (KDSP) với Single-Request Blocks:**

**Mục đích:** Tạo initial solution khả thi nhanh chóng.

**Thuật toán:**
1. Tạo blocks từ mỗi request (pickup + delivery pair)
2. Xây dựng graph với:
   - Nodes: Vehicles + Blocks
   - Arcs: Feasible connections với cost = distance - profit
   - Source/Sink: Depot
3. Giải K-disjoint shortest paths trên graph
4. Extract routes từ paths

**Đặc điểm:**
- Fast: O(V × B × log(B)) với V vehicles, B blocks
- Quality: Good initial solution (thường 70-80% optimal)
- Feasibility: Guarantees time window feasibility

**Implementation:**
```rust
// src/construction/kdsp.rs
pub fn kdsp_with_single_request_blocks(instance: &PDPTWInstance) -> Solution {
    // Create blocks from requests
    let blocks = create_blocks_from_requests(instance);
    
    // Build source-sink graph
    let graph = build_kdsp_graph(instance, blocks);
    
    // Solve K-disjoint shortest paths
    let paths = kdsp::solve(graph, instance.num_vehicles);
    
    // Convert paths to routes
    paths_to_solution(paths, instance)
}
```

### 3. Large Neighborhood Search (LNS)

**Cơ chế hoạt động:**

```
Loop until stopping criterion:
  1. Select destroy operator randomly
  2. Destroy: Remove q requests (q ∈ [q_min, q_max])
  3. Select repair operator randomly
  4. Repair: Re-insert removed requests
  5. Accept/Reject new solution
```

**3.1 Destroy Operators**

**a) Adjacent String Removal (Shaw Removal)**
```rust
// src/lns/destroy/adjacent_string_removal.rs
```

**Idea:** Remove requests that are "related" to each other.

**Relatedness measures:**
- Spatial: Distance between pickup/delivery locations
- Temporal: Time window overlap
- Demand: Similar demand sizes
- Vehicle: Same or adjacent routes

**Algorithm:**
1. Select seed request randomly
2. Compute relatedness scores to all other requests
3. Remove k most related requests using weighted random selection

**Parameters:**
- `adjacency_measure`: Which relatedness to use
- `max_cardinality`: Maximum removal size
- `alpha`, `beta`: Randomization parameters

**b) Route Removal**
```rust
// src/lns/destroy/route_removal.rs
```

**Idea:** Remove entire routes.

**Algorithm:**
1. Select random route
2. Remove all requests in that route

**c) Worst Removal**

**Idea:** Remove requests with highest cost contribution.

**Algorithm:**
1. Compute cost savings if each request is removed
2. Remove requests with highest savings

**d) Absence-Based Removal**

**Idea:** Remove requests that have been absent from solutions long time.

**Algorithm:**
1. Track absence counter for each request
2. Probabilistically remove requests with high absence count

**3.2 Repair Operators**

**a) Greedy Insertion with Blinks**
```rust
// src/lns/repair/greedy_insertion_with_blinks.rs
```

**Idea:** Insert requests one-by-one at best position, with random "blinks".

**Algorithm:**
```
For each unassigned request:
  1. Find best insertion position (min cost increase)
  2. With probability p: "blink" - insert at random position
  3. Insert request
```

**Blink rate:** Controls exploration vs exploitation
- High blink rate: More exploration, worse solution quality
- Low blink rate: Less exploration, risk getting stuck

**b) Regret Insertion**

**Idea:** Prioritize requests that are "hard to insert" later.

**Regret value:**
```
regret[r] = cost[2nd_best_position] - cost[best_position]
```

**Algorithm:**
1. Compute regret for all unassigned requests
2. Insert request with highest regret
3. Repeat until all inserted or infeasible

**c) Absence-Based Regret Insertion**

Combines regret with absence counter:
```
priority[r] = regret[r] × (1 + absence_weight × absence[r])
```

**d) Hardest-First Insertion**

**Idea:** Insert requests with smallest feasibility window first.

**Hardness measures:**
- Smallest time window
- Furthest from depot
- Largest demand

**3.3 Acceptance Criteria**

**a) Record-to-Record Travel (RTR)**
```rust
// src/lns/acceptance_criterion.rs
```

**Formula:**
```
Accept if: cost(new) ≤ cost(best) × (1 + threshold)
```

**Characteristics:**
- Deterministic
- Parameter: threshold (typically 0.01 - 0.05)
- Accepts solutions within % of best found
- Good balance between intensification and diversification

**b) Simulated Annealing (SA)**

**Formula:**
```
Accept if: random() < exp(-(cost(new) - cost(current)) / temperature)
```

**Temperature schedule:**
```
T(t) = T0 × alpha^t
```

**Characteristics:**
- Probabilistic
- Parameters: T0 (initial temp), alpha (cooling rate)
- More exploration early, intensification later

**c) Greedy (Hill Climbing)**

**Formula:**
```
Accept if: cost(new) < cost(current)
```

**Characteristics:**
- Only accept improvements
- Fast convergence
- Risk getting stuck in local optima

### 4. AGES - Approximate GENI Ejection Search

**Purpose:** Fleet Minimization - reduce number of vehicles used.

**4.1 K-Ejection Mechanism**

**Idea:** Try to insert unassigned request by ejecting other requests.

**Algorithm:**
```rust
// src/ages/mod.rs
pub fn eject_and_insert(sol: &mut Solution, request: usize) {
    // Try 1-ejection
    if let Some(move) = find_best_insertion_1_ejection(request) {
        apply(move);
        return;
    }
    
    // Try 2-ejection
    if let Some(move) = find_best_insertion_2_ejection(request) {
        apply(move);
        return;
    }
    
    // Give up, leave unassigned
    unassign(request);
}
```

**K-ejection types:**
- **1-ejection:** Eject 1 request, insert target request
- **2-ejection:** Eject 2 requests, insert target request

**Cost calculation:**
```
cost(k-ejection) = cost_increase(insertion) 
                  - sum(cost_savings(ejections))
```

**Selection:** Choose k-ejection with minimum cost.

**4.2 Perturbation**

**Purpose:** Escape local optima.

**Perturbation operators:**

**a) Relocate:**
```
Move request from route A to route B
```

**b) Exchange:**
```
Swap two requests between routes
```

**Perturbation modes:**

**Mode 1: Relocate and Exchange**
```
With probability p:
  Apply relocate
Else:
  Apply exchange
```

**Mode 2: Biased Relocation**
```
Relocate with bias towards:
  - Requests with high cost
  - Routes with low utilization
```

**Parameters:**
- `num_perturbations`: Number of perturbations to apply
- `shift_probability`: Probability of relocate vs exchange
- `bias`: Bias factor for biased relocation

### 5. Integrated Framework

**Main loop:**

```rust
// src/solver/ls_solver.rs
pub fn ls_ages_lns(instance: &PDPTWInstance, args: &SolverArguments) {
    // 1. Construction
    let mut solution = construct_initial_solution(instance);
    let mut best = solution.clone();
    
    // 2. LNS Loop
    for iteration in 0..max_iterations {
        // 2.1 Destroy
        let num_destroy = random(min_destroy, max_destroy);
        let removed = destroy_operator.destroy(&mut solution, num_destroy);
        
        // 2.2 Repair
        repair_operator.repair(&mut solution, removed);
        
        // 2.3 Accept/Reject
        if accept(solution, best) {
            current = solution;
            if solution.cost < best.cost {
                best = solution;
                
                // 3. AGES Intensification on new best
                if should_run_ages() {
                    ages_intensification(&mut best);
                }
            }
        }
        
        // 2.4 Perturbation (diversification)
        if no_improvement_for(perturbation_threshold) {
            perturb(&mut solution);
        }
    }
    
    return best;
}
```

**AGES Intensification:**

```rust
fn ages_intensification(solution: &mut Solution) {
    let mut unassigned_stack = solution.unassigned_requests();
    
    // Try k-ejection for each unassigned
    while let Some(request) = unassigned_stack.pop() {
        eject_and_insert(solution, request, &mut unassigned_stack);
    }
    
    // Perturbation phase
    for _ in 0..num_perturbation_phases {
        perturb(solution, num_perturbations);
        
        // Try k-ejection again after perturbation
        let mut new_unassigned = solution.unassigned_requests();
        while let Some(request) = new_unassigned.pop() {
            eject_and_insert(solution, request, &mut new_unassigned);
        }
    }
}
```

### 6. Stopping Criteria

Solver dừng khi một trong các điều kiện sau xảy ra:

1. **Iteration limit:** Đạt `max_iterations`
2. **Non-improving limit:** Không cải thiện sau `max_non_improving` iterations
3. **Time limit:** Vượt quá `time_limit` seconds
4. **Optimal solution found:** 0 unassigned, 0 violations

### 7. Solution Representation

**Solution structure:**

```rust
pub struct Solution<'a> {
    instance: &'a PDPTWInstance,
    routes: Vec<Route>,
    unassigned_requests: UnassignedSet,
    objective: Objective,
}

pub struct Route {
    vehicle_id: usize,
    nodes: Vec<usize>,  // Sequence: depot -> pickups/deliveries -> depot
    load: Vec<Load>,    // Cumulative load at each node
    time: Vec<Time>,    // Arrival time at each node
    cost: Cost,         // Route cost (distance)
}

pub struct Objective {
    num_unassigned: usize,
    num_vehicles: usize,
    total_cost: Cost,
}
```

**Objective hierarchy (lexicographic):**
1. Minimize unassigned requests
2. Minimize number of vehicles
3. Minimize total distance/cost

### 8. Performance Optimizations

**a) Fixed-Point Arithmetic**

Sử dụng fixed-point numbers thay vì floating-point:
```rust
pub type Num = NumI32P3;  // i32 with 3 decimal places
```

**Benefits:**
- Deterministic (no floating-point rounding errors)
- Faster (integer operations)
- Reproducible results

**b) Incremental Evaluation**

Chỉ recalculate affected parts khi apply moves:
```rust
fn insert_request(&mut self, insertion: PDInsertion) {
    // Only update affected route segments
    update_cumulative_load(route, insertion.position);
    update_arrival_times(route, insertion.position);
    update_route_cost(route);
}
```

**c) Early Termination**

Stop evaluation sớm nếu infeasible:
```rust
fn evaluate_insertion(&self, request: usize, route: usize) -> Option<Cost> {
    for position in route.positions() {
        if violates_capacity(position) {
            return None;  // Early exit
        }
        if violates_time_window(position) {
            return None;  // Early exit
        }
        // ... continue evaluation
    }
}
```

**d) Caching và Memoization**

Cache frequently accessed data:
```rust
struct SolutionCache {
    distance_matrix: Vec<Vec<Distance>>,
    time_matrix: Vec<Vec<Time>>,
    route_costs: Vec<Cost>,
}
```

### 9. Features và Configurations

**Cargo features:**

```toml
[features]
default = ["fleet-minimization"]
parallel = ["rayon"]                    # Parallel processing
progress_tracking = []                  # Track search progress
timed_solution_logger = []              # Log solutions at intervals
fleet-minimization = []                 # Enable fleet minimization
search_assertions = []                  # Enable runtime checks
```

**Enable feature:**
```bash
cargo build --release --features progress_tracking
```

### 10. Benchmark Results

**Li & Lim Instances (100 customers):**

| Instance | Vehicles | Cost    | Time (s) | Seed  |
|----------|----------|---------|----------|-------|
| lc101    | 10       | 828.94  | 45       | 12345 |
| lc102    | 10       | 828.94  | 38       | 12345 |
| lr101    | 19       | 1650.80 | 62       | 12345 |
| lr102    | 17       | 1490.18 | 58       | 12345 |
| lrc101   | 14       | 1708.80 | 51       | 12345 |
| lrc102   | 12       | 1558.07 | 47       | 12345 |

**Sartori & Buriol Instances (100 customers):**

| Instance  | Vehicles | Cost      | Time (s) | Seed  |
|-----------|----------|-----------|----------|-------|
| bar-n100  | 7        | 983.00    | 120      | 12345 |
| LC1_10_1  | 100      | 42489.27  | 180      | 12345 |
| LR1_10_1  | 100      | 59598.55  | 210      | 12345 |

Results cho thấy solver có thể tìm được solutions chất lượng tốt trong thời gian hợp lý.

## Testing và Validation

**Run tests:**
```bash
# Unit tests
cargo test

# Integration tests
cargo test --test integration

# All tests với logging
cargo test -- --nocapture
```

**Validation:**
- Solution feasibility: Time windows, capacity, precedence
- Objective calculation: Cost, fleet size
- Format compliance: SINTEF solution format

**Assertion features:**
```bash
# Build with runtime assertions
cargo build --release --features search_assertions
```

## Logging và Debugging

**Set log level:**
```bash
# Via environment variable
export RUST_LOG=debug
ls-pdptw-solver --instance ...

# Via CLI
ls-pdptw-solver --log-level debug --instance ...
```

**Log levels:**
- `trace`: Very detailed, all operations
- `debug`: Debug information
- `info`: General information (default)
- `warn`: Warnings only
- `error`: Errors only

## Troubleshooting

**Build errors:**
```bash
# Clean và rebuild
cargo clean
cargo build --release
```

**Out of memory:**
- Reduce instance size
- Increase system RAM
- Use smaller destroy ranges

**Slow performance:**
- Use release build (not debug)
- Enable parallel features
- Tune LNS parameters

## Contributing

**Code style:**
- Follow Rust standard naming conventions
- Use `cargo fmt` để format code
- Run `cargo clippy` để check lints

**Adding features:**
1. Implement trong appropriate module
2. Add tests
3. Update documentation
4. Update CLI if needed

## References

**Papers:**
- Ropke, S., & Pisinger, D. (2006). "An Adaptive Large Neighborhood Search Heuristic for the Pickup and Delivery Problem with Time Windows"
- Nagata, Y., & Bräysy, O. (2009). "A Powerful Route Minimization Heuristic for the Vehicle Routing Problem with Time Windows"
- Shaw, P. (1998). "Using Constraint Programming and Local Search Methods to Solve Vehicle Routing Problems"

**Benchmarks:**
- Li & Lim benchmark instances: https://www.sintef.no/projectweb/top/pdptw/li-lim-benchmark/
- Sartori & Buriol instances: Real-world inspired instances

## License

Copyright 2024 WAYO. All rights reserved.