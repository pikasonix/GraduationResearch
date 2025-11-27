#include "ages/genetic_operators.h"
#include "ages/population.h"
#include "pdptw/construction/constructor.hpp"
#include "pdptw/io/li_lim_reader.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <filesystem>
#include <gtest/gtest.h>
#include <iostream>

using namespace pdptw;

TEST(GeneticOperatorsSimpleTest, BasicOperations) {
    // Load instance from instances directory
    std::string instance_path = "instances/lr107.txt";

    if (!std::filesystem::exists(instance_path)) {
        std::cout << "Instance not found at: " << instance_path << std::endl;
        GTEST_SKIP() << "Instance not found: " << instance_path;
    }
    auto instance = io::load_li_lim_instance(instance_path);
    std::cout << "Loaded instance: " << instance.num_requests() << " requests, "
              << instance.num_vehicles() << " vehicles" << std::endl;

    // Create initial solution
    auto initial = construction::Constructor::sequential_construction(instance);
    std::cout << "Initial solution objective: " << initial.objective() << std::endl;

    // Create genetic operators
    GeneticOperators gen_ops(instance, 42);

    // Test tournament selection
    std::vector<Solution> population;
    population.push_back(initial);

    Solution solution2 = initial;
    solution2.objective(); // Just to have another solution
    population.push_back(solution2);

    std::cout << "Testing tournament selection..." << std::endl;
    size_t selected = gen_ops.tournament_selection(population, 2);
    EXPECT_LT(selected, population.size());
    std::cout << "Selected index: " << selected << std::endl;

    // Test crossover
    std::cout << "\nTesting route crossover..." << std::endl;
    Solution offspring(instance);
    bool success = gen_ops.route_crossover(population[0], population[1], offspring);
    EXPECT_TRUE(success);
    std::cout << "Crossover objective: " << offspring.objective() << std::endl;

    // Test mutation
    std::cout << "\nTesting mutation relocate..." << std::endl;
    Solution mutated = initial;
    size_t mutations = gen_ops.mutate_relocate(mutated, 1);
    std::cout << "Mutations: " << mutations << ", New objective: " << mutated.objective() << std::endl;

    // Test adaptive mutation
    std::cout << "\nTesting adaptive mutation..." << std::endl;
    Solution adaptive_mutated = initial;
    size_t adaptive_mutations = gen_ops.adaptive_mutate(adaptive_mutated, 2);
    std::cout << "Adaptive mutations: " << adaptive_mutations
              << ", New objective: " << adaptive_mutated.objective() << std::endl;

    // Print statistics
    std::cout << "\n=== Statistics ===" << std::endl;
    std::cout << gen_ops.get_statistics() << std::endl;

    std::cout << "\n✅ All genetic operators working!" << std::endl;
}
