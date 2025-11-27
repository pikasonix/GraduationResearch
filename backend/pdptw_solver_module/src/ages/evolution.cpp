#include "ages/evolution.h"
#include <algorithm>
#include <iomanip>
#include <sstream>

namespace pdptw {

std::string Evolution::Statistics::to_string() const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2);
    oss << "Evolution Statistics:\n";
    oss << "  Generations: " << generations_run << "\n";
    oss << "  Offspring generated: " << total_offspring_generated << "\n";
    oss << "  Successful crossovers: " << successful_crossovers << "\n";
    oss << "  Successful mutations: " << successful_mutations << "\n";
    oss << "  Initial best: " << initial_best_objective << "\n";
    oss << "  Final best: " << final_best_objective << "\n";
    oss << "  Improvement: " << improvement_percentage << "%\n";
    return oss.str();
}

Evolution::Evolution(const Instance &instance, const Parameters &params)
    : instance_(instance), params_(params), population_(instance, params.population_size, params.min_diversity), genetic_ops_(instance, params.seed) {
}

Solution Evolution::run(const std::vector<Solution> &initial_population) {
    population_.clear();
    for (const auto &sol : initial_population) {
        population_.add(sol);
    }

    if (population_.empty()) {
        throw std::runtime_error("Evolution: Initial population is empty");
    }

    stats_ = Statistics();
    stats_.initial_best_objective = population_.get_best()->objective();
    current_generation_ = 0;
    generations_without_improvement_ = 0;
    last_best_objective_ = stats_.initial_best_objective;

    while (!should_terminate()) {
        bool success = evolve_one_generation();
        if (!success) {
            break;
        }
    }

    const Solution *best = get_best_solution();
    if (best) {
        stats_.final_best_objective = best->objective();
        if (stats_.initial_best_objective > 0.0) {
            stats_.improvement_percentage =
                ((stats_.initial_best_objective - stats_.final_best_objective) /
                 stats_.initial_best_objective) *
                100.0;
        }
    }

    if (best) {
        return *best;
    } else {
        return *population_.get_best();
    }
}

Solution Evolution::run(const Solution &initial_solution) {
    auto initial_pop = create_initial_population(initial_solution);
    return run(initial_pop);
}

bool Evolution::evolve_one_generation() {
    current_generation_++;

    size_t num_offspring = params_.population_size - params_.elite_size;
    auto offspring = generate_offspring(num_offspring);

    if (offspring.empty()) {
        return false;
    }

    stats_.total_offspring_generated += offspring.size();

    auto survivors = select_survivors(offspring);

    population_.clear();
    for (const auto &sol : survivors) {
        population_.add(sol);
    }

    update_statistics();

    return true;
}

double Evolution::calculate_fitness(const Solution &solution) const {
    return population_.calculate_fitness(solution, params_.diversity_weight);
}

std::vector<Solution> Evolution::generate_offspring(size_t num_offspring) {
    std::vector<Solution> offspring;
    offspring.reserve(num_offspring);

    std::uniform_real_distribution<double> dist(0.0, 1.0);

    for (size_t i = 0; i < num_offspring; ++i) {
        if (dist(genetic_ops_.rng()) < params_.crossover_rate) {
            size_t parent1_idx = genetic_ops_.tournament_selection(
                population_.get_all(), params_.tournament_size);
            size_t parent2_idx = genetic_ops_.tournament_selection(
                population_.get_all(), params_.tournament_size);

            const Solution &parent1 = population_.get_all()[parent1_idx];
            const Solution &parent2 = population_.get_all()[parent2_idx];

            Solution child = parent1;

            bool success = genetic_ops_.route_crossover(parent1, parent2, child);

            if (success) {
                stats_.successful_crossovers++;
                offspring.push_back(child);
            } else {
                if (parent1.objective() < parent2.objective()) {
                    offspring.push_back(parent1);
                } else {
                    offspring.push_back(parent2);
                }
            }
        } else {
            size_t parent_idx = genetic_ops_.tournament_selection(
                population_.get_all(), params_.tournament_size);

            Solution mutant = population_.get_all()[parent_idx];

            size_t num_mutations = genetic_ops_.adaptive_mutate(
                mutant, params_.mutation_intensity);

            if (num_mutations > 0) {
                stats_.successful_mutations++;
            }

            offspring.push_back(mutant);
        }
    }

    return offspring;
}

std::vector<Solution> Evolution::select_survivors(const std::vector<Solution> &offspring) {
    std::vector<Solution> survivors;

    auto current_pop = population_.get_all();

    std::vector<size_t> indices(current_pop.size());
    for (size_t i = 0; i < indices.size(); ++i) {
        indices[i] = i;
    }

    std::sort(indices.begin(), indices.end(), [&](size_t a, size_t b) {
        return current_pop[a].objective() < current_pop[b].objective();
    });

    for (size_t i = 0; i < std::min(params_.elite_size, indices.size()); ++i) {
        survivors.push_back(current_pop[indices[i]]);
    }

    std::vector<Solution> candidates;
    for (size_t i = params_.elite_size; i < indices.size(); ++i) {
        candidates.push_back(current_pop[indices[i]]);
    }
    for (const auto &child : offspring) {
        candidates.push_back(child);
    }

    std::sort(candidates.begin(), candidates.end(), [this](const Solution &a, const Solution &b) {
        return calculate_fitness(a) < calculate_fitness(b);
    });

    size_t remaining = params_.population_size - survivors.size();
    for (size_t i = 0; i < std::min(remaining, candidates.size()); ++i) {
        survivors.push_back(candidates[i]);
    }

    return survivors;
}

bool Evolution::should_terminate() const {
    if (current_generation_ >= params_.max_generations) {
        return true;
    }

    if (generations_without_improvement_ >= params_.max_stagnant_generations) {
        return true;
    }

    if (population_.empty()) {
        return true;
    }

    return false;
}

void Evolution::reset() {
    population_.clear();
    stats_ = Statistics();
    current_generation_ = 0;
    generations_without_improvement_ = 0;
    last_best_objective_ = std::numeric_limits<double>::infinity();
    genetic_ops_.reset_statistics();
}

std::vector<Solution> Evolution::create_initial_population(const Solution &initial_solution) {
    std::vector<Solution> population;
    population.push_back(initial_solution);

    for (size_t i = 1; i < params_.population_size; ++i) {
        Solution mutant = initial_solution;

        size_t mutations = 1 + (i % 5);
        genetic_ops_.adaptive_mutate(mutant, mutations);

        population.push_back(mutant);
    }

    return population;
}

void Evolution::update_statistics() {
    stats_.generations_run = current_generation_;

    const Solution *current_best = population_.get_best();
    if (current_best) {
        double current_obj = current_best->objective();

        if (current_obj < last_best_objective_ - 1e-6) {
            generations_without_improvement_ = 0;
            last_best_objective_ = current_obj;
        } else {
            generations_without_improvement_++;
        }
    }
}

} // namespace pdptw
