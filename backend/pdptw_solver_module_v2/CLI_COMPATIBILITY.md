# CLI Compatibility Guide

This document describes the command-line interface compatibility between the Rust and C++ versions of the PDPTW solver.

## Overview

The Rust version (`pdptw_solver_module_v2`) now supports the same command-line parameters as the C++ version (`pdptw_solver_module`), making it easy to switch between implementations without changing your scripts.

## Key Compatible Parameters

### Basic Parameters

| C++ Parameter | Rust Parameter | Description | Default |
|--------------|----------------|-------------|---------|
| `-i, --instance` | `-i, --instance` | Instance file path | Required |
| `-f, --format` | `-f, --format` | Instance format (auto/lilim/sartori) | auto |
| `-o, --output` | `-o, --output-dir` | Output directory for solutions | solutions |
| `--seed` | `--seed` | Random seed | Random |
| `--max-vehicles` | `--max-vehicles` | Maximum number of vehicles | Auto |
| `-l, --log-level` | `-l, --log-level` | Log level | info |

### LNS Parameters

| C++ Parameter | Rust Parameter | Description | Default |
|--------------|----------------|-------------|---------|
| `--iterations` | `--iterations` | Maximum LNS iterations | 100000 |
| `--max-non-improving` | `--max-non-improving` | Max non-improving iterations | 20000 |
| `--time-limit` | `--time-limit` | Time limit in seconds (0=no limit) | 0 |
| `--min-destroy` | `--min-destroy` | Min destroy fraction (0.0-1.0) | 0.20 |
| `--max-destroy` | `--max-destroy` | Max destroy fraction (0.0-1.0) | 0.35 |
| `--min-destroy-count` | `--min-destroy-count` | Min destroy count (absolute) | -1 |
| `--max-destroy-count` | `--max-destroy-count` | Max destroy count (absolute) | -1 |

### Acceptance Criterion

| C++ Parameter | Rust Parameter | Description | Default |
|--------------|----------------|-------------|---------|
| `--acceptance` | `--acceptance` | Acceptance criterion (sa/rtr/greedy) | rtr |

Note: The Rust version also supports the internal `--aspiration-mode` parameter which is mapped to `--acceptance`:
- `rtr` → Record-to-Record
- `sa` → Simulated Annealing (Metropolis)
- `greedy` → None

### Construction & Recombination

| C++ Parameter | Rust Parameter | Description | Default |
|--------------|----------------|-------------|---------|
| `--construction` | `--construction` | Construction strategy (sequential/regret/binpacking) | sequential |
| `--recombine` | `--recombine` | Recombination strategy (greedy/bestfit) | greedy |

### AGES Parameters

| C++ Parameter | Rust Parameter | Description | Default |
|--------------|----------------|-------------|---------|
| `--k-ejection` | `--k-ejection` | Enable k-ejection in AGES | true |
| `--no-k-ejection` | `--no-k-ejection` | Disable k-ejection in AGES | - |
| `--perturbation` | `--perturbation` | Enable perturbation in AGES | true |
| `--no-perturbation` | `--no-perturbation` | Disable perturbation in AGES | - |

### Metadata Parameters

| C++ Parameter | Rust Parameter | Description | Default |
|--------------|----------------|-------------|---------|
| `--authors` | `--authors` | Solution authors metadata | PDPTW Solver |
| `--reference` | `--reference` | Solution reference metadata | LNS with SA/RTR |

## Usage Examples

### Basic Usage (Compatible with C++)

```bash
# C++ version
./pdptw_solver --instance instances/lr107.txt --format lilim --output solutions --seed 42

# Rust version (equivalent)
./ls-pdptw-solver --instance instances/lr107.txt --format lilim --output-dir solutions --seed 42
```

### Advanced Usage

```bash
# Run with specific parameters
./ls-pdptw-solver \
  --instance instances/bar-n100-1.txt \
  --format auto \
  --output-dir my_solutions \
  --iterations 50000 \
  --max-non-improving 10000 \
  --time-limit 3600 \
  --min-destroy 0.15 \
  --max-destroy 0.40 \
  --acceptance rtr \
  --construction sequential \
  --recombine greedy \
  --k-ejection \
  --perturbation \
  --seed 42 \
  --authors "Your Name" \
  --reference "Your Research"
```

### Using Absolute Destroy Counts

```bash
# Instead of fractions, use absolute counts
./ls-pdptw-solver \
  --instance instances/bar-n100-1.txt \
  --min-destroy-count 10 \
  --max-destroy-count 30
```

### Disable AGES Features

```bash
# Disable k-ejection
./ls-pdptw-solver --instance instances/lr107.txt --no-k-ejection

# Disable perturbation
./ls-pdptw-solver --instance instances/lr107.txt --no-perturbation

# Disable both
./ls-pdptw-solver --instance instances/lr107.txt --no-k-ejection --no-perturbation
```

## Format Detection

The `--format` parameter supports three values:

1. **auto** (default): Tries Li & Lim format first, then Sartori & Buriol if that fails
2. **lilim**: Forces Li & Lim format (original PDPTW benchmark instances)
3. **sartori**: Forces Sartori & Buriol format (real-world instances)

## Output Directory

The solver will automatically create the output directory if it doesn't exist. Solution files are named according to the SINTEF convention:

```
<instance_name>.<num_unassigned>_<num_vehicles>_<objective>.<seed>.sol
```

Example: `bar-n100-1.0_6_733.42.sol`

## Compatibility Notes

### Backward Compatibility

The Rust version maintains backward compatibility with its original parameters. If you use both versions of parameters (e.g., both `--iterations` and `--lns-iterations`), the C++ compatible parameter takes precedence.

### Parameter Priority

- `--time-limit` takes precedence over `--time-limit-in-seconds`
- `--iterations` takes precedence over `--lns-iterations`
- `--min-destroy-count`/`--max-destroy-count` override `--min-destroy`/`--max-destroy`
- `--no-k-ejection` overrides `--k-ejection`
- `--no-perturbation` overrides `--perturbation`

### Not Yet Implemented

Some C++ parameters are not yet fully mapped in the Rust version:
- Large-scale decomposition LNS parameters are handled differently
- Fleet minimization is part of the main solver in Rust

## Migration from C++

To migrate your scripts from C++ to Rust:

1. Replace the executable name from `pdptw_solver` to `ls-pdptw-solver`
2. Change `--output` to `--output-dir` (or keep using it as both are supported)
3. All other parameters work identically

Example migration:

```bash
# Old C++ command
./pdptw_solver -i instances/lr107.txt -f lilim -o solutions --iterations 50000 --acceptance rtr

# New Rust command (just change executable and output flag)
./ls-pdptw-solver -i instances/lr107.txt -f lilim --output-dir solutions --iterations 50000 --acceptance rtr
```

## Building the Rust Version

```bash
cd pdptw_solver_module_v2
cargo build --release --features classic-pdptw
./target/release/ls-pdptw-solver --help
```

## Testing Compatibility

To verify compatibility, run the same instance with both versions:

```bash
# C++ version
./pdptw_solver --instance test.txt --seed 42 --output cpp_out

# Rust version  
./ls-pdptw-solver --instance test.txt --seed 42 --output-dir rust_out

# Compare results
diff cpp_out/*.sol rust_out/*.sol
```
