#include "ages/genetic_operators.h"
#include "pdptw/lns/destroy/route_removal.hpp"
#include "pdptw/lns/destroy/worst_removal.hpp"
#include "pdptw/lns/repair/greedy_insertion.hpp"
#include <algorithm>
#include <limits>
#include <random>
#include <spdlog/spdlog.h>

namespace pdptw {

GeneticOperators::GeneticOperators(const Instance &instance, unsigned int seed)
    : instance_(instance), rng_(seed) {
}

bool GeneticOperators::route_crossover(const Solution &parent1, const Solution &parent2, Solution &offspring) {
    crossover_stats_.used++;
    offspring = parent1;

    size_t num_routes = offspring.number_of_non_empty_routes();
    if (num_routes > 0) {
        std::uniform_real_distribution<double> dist(0.2, 0.5);
        size_t num_remove = std::max(static_cast<size_t>(1), static_cast<size_t>(num_routes * dist(rng_)));

        lns::RouteRemovalOperator destroyer;
        destroyer.destroy(offspring, num_remove);
        lns::repair::GreedyInsertionOperator repairer;
        repairer.repair(offspring, rng_);

        if (offspring.objective() < parent1.objective())
            crossover_stats_.successful++;
    }
    return true;
}

bool GeneticOperators::order_crossover(const Solution &parent1, const Solution &parent2, Solution &offspring) {
    crossover_stats_.used++;
    offspring = parent1;

    std::uniform_real_distribution<double> dist(0.15, 0.30);
    size_t num_remove = std::max(static_cast<size_t>(1), static_cast<size_t>(instance_.num_requests() * dist(rng_)));

    lns::WorstRemovalOperator destroyer;
    destroyer.destroy(offspring, num_remove);
    lns::repair::GreedyInsertionOperator repairer;
    repairer.repair(offspring, rng_);

    if (offspring.objective() < parent1.objective())
        crossover_stats_.successful++;
    return true;
}

bool GeneticOperators::best_route_crossover(const Solution &parent1, const Solution &parent2, Solution &offspring) {
    crossover_stats_.used++;
    offspring = (parent1.objective() < parent2.objective()) ? parent1 : parent2;

    size_t num_routes = offspring.number_of_non_empty_routes();
    if (num_routes > 0) {
        std::uniform_real_distribution<double> dist(0.1, 0.3);
        size_t num_remove = std::max(static_cast<size_t>(1), static_cast<size_t>(num_routes * dist(rng_)));

        lns::RouteRemovalOperator destroyer;
        destroyer.destroy(offspring, num_remove);
        lns::repair::GreedyInsertionOperator repairer;
        repairer.repair(offspring, rng_);

        if (offspring.objective() < std::min(parent1.objective(), parent2.objective()))
            crossover_stats_.successful++;
    }
    return true;
}

size_t GeneticOperators::mutate_relocate(Solution &solution, size_t num_mutations) {
    mutation_relocate_stats_.used++;
    size_t num_remove = std::min(num_mutations, instance_.num_requests() / 10);
    if (num_remove == 0)
        num_remove = 1;

    lns::WorstRemovalOperator destroyer;
    destroyer.destroy(solution, num_remove);
    lns::repair::GreedyInsertionOperator repairer;
    repairer.repair(solution, rng_);

    mutation_relocate_stats_.successful++;
    return 1;
}

size_t GeneticOperators::mutate_swap(Solution &solution, size_t num_mutations) {
    mutation_swap_stats_.used++;
    size_t num_routes = solution.number_of_non_empty_routes();
    if (num_routes == 0)
        return 0;

    size_t num_remove = std::min(num_mutations, num_routes / 2);
    if (num_remove == 0)
        num_remove = 1;

    lns::RouteRemovalOperator destroyer;
    destroyer.destroy(solution, num_remove);
    lns::repair::GreedyInsertionOperator repairer;
    repairer.repair(solution, rng_);

    mutation_swap_stats_.successful++;
    return 1;
}

size_t GeneticOperators::mutate_shuffle(Solution &solution, size_t num_mutations) {
    mutation_shuffle_stats_.used++;
    size_t num_routes = solution.number_of_non_empty_routes();
    if (num_routes == 0)
        return 0;

    double removal_percentage = 0.2 + (num_mutations * 0.05);
    size_t num_remove = std::max(static_cast<size_t>(1), static_cast<size_t>(num_routes * removal_percentage));
    num_remove = std::min(num_remove, num_routes);

    lns::RouteRemovalOperator destroyer;
    destroyer.destroy(solution, num_remove);
    lns::repair::GreedyInsertionOperator repairer;
    repairer.repair(solution, rng_);

    mutation_shuffle_stats_.successful++;
    return 1;
}

size_t GeneticOperators::adaptive_mutate(Solution &solution, size_t intensity) {
    double relocate_rate = mutation_relocate_stats_.success_rate();
    double swap_rate = mutation_swap_stats_.success_rate();
    double shuffle_rate = mutation_shuffle_stats_.success_rate();
    double total_weight = relocate_rate + swap_rate + shuffle_rate + 0.3;

    std::uniform_real_distribution<double> dist(0.0, total_weight);
    double random_value = dist(rng_);
    double cumulative = relocate_rate + 0.1;

    if (random_value < cumulative)
        return mutate_relocate(solution, intensity);
    cumulative += swap_rate + 0.1;
    if (random_value < cumulative)
        return mutate_swap(solution, intensity);
    return mutate_shuffle(solution, intensity);
}

size_t GeneticOperators::tournament_selection(const std::vector<Solution> &population, size_t tournament_size) {
    if (population.empty())
        throw std::runtime_error("Cannot select from empty population");
    if (tournament_size > population.size())
        tournament_size = population.size();

    std::uniform_int_distribution<size_t> dist(0, population.size() - 1);
    size_t best_idx = dist(rng_);
    double best_obj = population[best_idx].objective();

    for (size_t i = 1; i < tournament_size; i++) {
        size_t idx = dist(rng_);
        if (population[idx].objective() < best_obj) {
            best_idx = idx;
            best_obj = population[idx].objective();
        }
    }
    return best_idx;
}

size_t GeneticOperators::roulette_selection(const std::vector<Solution> &population) {
    if (population.empty())
        throw std::runtime_error("Cannot select from empty population");

    double max_obj = 0.0;
    for (const auto &sol : population)
        max_obj = std::max(max_obj, sol.objective());

    double total_fitness = 0.0;
    std::vector<double> fitness_values;
    fitness_values.reserve(population.size());
    for (const auto &sol : population) {
        double fitness = max_obj - sol.objective() + 1.0;
        fitness_values.push_back(fitness);
        total_fitness += fitness;
    }

    std::uniform_real_distribution<double> dist(0.0, total_fitness);
    double random_value = dist(rng_);
    double cumulative = 0.0;

    for (size_t i = 0; i < population.size(); i++) {
        cumulative += fitness_values[i];
        if (cumulative >= random_value)
            return i;
    }
    return population.size() - 1;
}

std::string GeneticOperators::get_statistics() const {
    return "Crossover: " + std::to_string(crossover_stats_.used) +
           " used, " + std::to_string(crossover_stats_.successful) + " successful\n" +
           "Mutate relocate: " + std::to_string(mutation_relocate_stats_.used) +
           " used, " + std::to_string(mutation_relocate_stats_.successful) + " successful\n" +
           "Mutate swap: " + std::to_string(mutation_swap_stats_.used) +
           " used, " + std::to_string(mutation_swap_stats_.successful) + " successful\n" +
           "Mutate shuffle: " + std::to_string(mutation_shuffle_stats_.used) +
           " used, " + std::to_string(mutation_shuffle_stats_.successful) + " successful";
}

void GeneticOperators::reset_statistics() {
    crossover_stats_ = {0, 0};
    mutation_relocate_stats_ = {0, 0};
    mutation_swap_stats_ = {0, 0};
    mutation_shuffle_stats_ = {0, 0};
}

bool GeneticOperators::copy_route(const Solution &from, Solution &to, size_t route_id, std::vector<bool> &assigned) {
    return false;
}

size_t GeneticOperators::repair_solution(Solution &solution, const std::vector<size_t> &unassigned) {
    lns::repair::GreedyInsertionOperator repairer;
    repairer.repair(solution, rng_);
    return 0;
}

} // namespace pdptw
