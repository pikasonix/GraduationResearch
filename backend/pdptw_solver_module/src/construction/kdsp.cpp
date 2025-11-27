#include "pdptw/construction/kdsp.hpp"
#include <cmath>
#include <limits>
#include <queue>
#include <set>
#include <spdlog/spdlog.h>

namespace pdptw {
namespace construction {

Num KDSP::calculate_path_cost(
    const PDPTWInstance &instance,
    const std::vector<size_t> &path) {
    if (path.size() < 2) {
        return 0.0;
    }

    Num total_cost = 0.0;
    for (size_t i = 0; i + 1 < path.size(); ++i) {
        total_cost += instance.distance(path[i], path[i + 1]);
    }

    return total_cost;
}

Num KDSP::calculate_path_duration(
    const PDPTWInstance &instance,
    const std::vector<size_t> &path) {
    if (path.size() < 2) {
        return 0.0;
    }

    Num total_duration = 0.0;
    for (size_t i = 0; i + 1 < path.size(); ++i) {
        total_duration += instance.time(path[i], path[i + 1]);
    }

    return total_duration;
}

bool KDSP::is_path_feasible(
    const PDPTWInstance &instance,
    const Solution &solution [[maybe_unused]],
    const std::vector<size_t> &path) {
    if (path.empty()) {
        return false;
    }

    Num current_time = 0.0;

    for (size_t vn_id : path) {
        const auto &node = instance.nodes()[vn_id];

        if (node.is_depot()) {
            continue;
        }

        Num early = node.ready();
        Num late = node.due();

        if (current_time < early) {
            current_time = early;
        }

        if (current_time > late) {
            return false;
        }

        current_time += node.servicetime();
    }

    return true;
}

std::vector<size_t> KDSP::get_direct_path(size_t source, size_t target) {
    return {source, target};
}

std::vector<Path> KDSP::find_k_shortest_paths(
    const PDPTWInstance &instance,
    const Solution &solution,
    size_t source_node,
    size_t target_node,
    size_t k) {
    std::vector<Path> paths;

    std::vector<size_t> direct_path = get_direct_path(source_node, target_node);
    Num direct_cost = calculate_path_cost(instance, direct_path);
    Num direct_duration = calculate_path_duration(instance, direct_path);
    bool direct_feasible = is_path_feasible(instance, solution, direct_path);

    paths.push_back(Path(direct_path, direct_cost, direct_duration, direct_feasible));

    if (k > 1) {
        auto alternatives = find_alternative_paths(
            instance, solution, source_node, target_node, k - 1);

        paths.insert(paths.end(), alternatives.begin(), alternatives.end());
    }

    std::sort(paths.begin(), paths.end());

    if (paths.size() > k) {
        paths.resize(k);
    }

    return paths;
}

std::vector<Path> KDSP::find_alternative_paths(
    const PDPTWInstance &instance,
    const Solution &solution,
    size_t source,
    size_t target,
    size_t k) {
    std::vector<Path> alternatives;

    std::set<size_t> intermediate_nodes;

    const size_t MAX_NODES_IN_ROUTE = instance.num_requests() * 2 + 12;
    size_t num_vehicles = instance.num_vehicles();
    for (size_t v = 0; v < num_vehicles; ++v) {
        size_t vn_start = v * 2;
        size_t current = solution.succ(vn_start);
        size_t iterations = 0;

        while (current != vn_start + 1 && iterations < MAX_NODES_IN_ROUTE) {
            const auto &node = instance.nodes()[current];

            if (current != source && current != target && !node.is_depot()) {
                intermediate_nodes.insert(current);
            }

            current = solution.succ(current);
            iterations++;
        }

        if (iterations >= MAX_NODES_IN_ROUTE) {
            spdlog::warn("Possible cycle in generate_paths_k_2 for vehicle {}: hit max iterations ({})",
                         v, MAX_NODES_IN_ROUTE);
        }
    }

    for (size_t inter : intermediate_nodes) {
        std::vector<size_t> path = {source, inter, target};

        Num cost = calculate_path_cost(instance, path);
        Num duration = calculate_path_duration(instance, path);
        bool feasible = is_path_feasible(instance, solution, path);

        alternatives.push_back(Path(path, cost, duration, feasible));

        if (alternatives.size() >= k) {
            break;
        }
    }

    std::sort(alternatives.begin(), alternatives.end());
    if (alternatives.size() > k) {
        alternatives.resize(k);
    }

    return alternatives;
}

Path KDSP::find_shortest_path(
    const PDPTWInstance &instance,
    const Solution &solution,
    size_t source,
    size_t target) {
    auto paths = find_k_shortest_paths(instance, solution, source, target, 1);

    if (paths.empty()) {
        return Path({}, std::numeric_limits<Num>::infinity(), 0.0, false);
    }

    return paths[0];
}

std::vector<Path> KDSP::find_insertion_paths(
    const PDPTWInstance &instance,
    const Solution &solution,
    size_t request_id,
    size_t vehicle_id,
    size_t k) {
    std::vector<Path> insertion_paths;

    size_t pickup_vn = instance.pickup_id_of_request(request_id);
    size_t delivery_vn = instance.delivery_id_of_request(request_id);

    const size_t MAX_NODES_IN_ROUTE = instance.num_requests() * 2 + 12;
    size_t vn_start = vehicle_id * 2;
    size_t vn_end = vehicle_id * 2 + 1;

    std::vector<size_t> route;
    size_t current = vn_start;
    size_t iterations = 0;
    while (current != vn_end && iterations < MAX_NODES_IN_ROUTE) {
        route.push_back(current);
        current = solution.succ(current);
        iterations++;
    }

    if (iterations >= MAX_NODES_IN_ROUTE) {
        spdlog::warn("Possible cycle in find_kdsp_insertions for vehicle {}: hit max iterations ({})",
                     vehicle_id, MAX_NODES_IN_ROUTE);
    }

    route.push_back(vn_end);

    for (size_t i = 0; i + 1 < route.size(); ++i) {
        size_t before_vn = route[i];
        size_t after_vn = route[i + 1];

        std::vector<size_t> path = {before_vn, pickup_vn, delivery_vn, after_vn};

        Num cost = calculate_path_cost(instance, path);
        Num duration = calculate_path_duration(instance, path);
        bool feasible = is_path_feasible(instance, solution, path);

        insertion_paths.push_back(Path(path, cost, duration, feasible));
    }

    for (size_t i = 0; i + 1 < route.size(); ++i) {
        for (size_t j = i + 1; j + 1 < route.size(); ++j) {
            size_t pickup_before = route[i];
            [[maybe_unused]] size_t pickup_after = route[i + 1];
            [[maybe_unused]] size_t delivery_before = route[j];
            size_t delivery_after = route[j + 1];

            std::vector<size_t> path;
            path.push_back(pickup_before);
            path.push_back(pickup_vn);

            for (size_t m = i + 1; m <= j; ++m) {
                path.push_back(route[m]);
            }

            path.push_back(delivery_vn);
            path.push_back(delivery_after);

            Num cost = calculate_path_cost(instance, path);
            Num duration = calculate_path_duration(instance, path);
            bool feasible = is_path_feasible(instance, solution, path);

            insertion_paths.push_back(Path(path, cost, duration, feasible));
        }
    }

    std::sort(insertion_paths.begin(), insertion_paths.end());

    if (insertion_paths.size() > k) {
        insertion_paths.resize(k);
    }

    return insertion_paths;
}

} // namespace construction
} // namespace pdptw
