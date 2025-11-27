#include "pdptw/decomposition/splitter.hpp"
#include "pdptw/problem/travel_matrix.hpp"
#include <algorithm>
#include <limits>
#include <numeric>
#include <spdlog/spdlog.h>
#include <unordered_map>

namespace pdptw::decomposition {

namespace {
using problem::Node;
using problem::NodeType;
using problem::PDPTWInstance;
using problem::RequestId;
using problem::TravelMatrix;
using solution::Solution;

Node clone_node(size_t new_id, const PDPTWInstance &instance, size_t full_id) {
    const auto &src = instance.nodes()[full_id];
    return Node(new_id, src.oid(), src.gid(), src.node_type(), src.x(), src.y(), src.demand(), src.ready(), src.due(), src.servicetime());
}
} // namespace

SolutionSplitter::SolutionSplitter(const Solution &reference_solution)
    : full_solution_(reference_solution),
      instance_(reference_solution.instance()) {}

std::vector<PartialInstance> SolutionSplitter::split(const SplitSettings &settings, std::mt19937 &rng) const {
    auto clusters = build_clusters(settings, rng);
    std::vector<PartialInstance> partials;
    partials.reserve(clusters.size());

    for (const auto &cluster : clusters) {
        if (cluster.empty()) {
            continue;
        }
        partials.push_back(build_partial(cluster));
    }
    return partials;
}

std::vector<std::vector<size_t>> SolutionSplitter::build_clusters(const SplitSettings &settings, std::mt19937 &rng) const {
    std::vector<size_t> assigned_requests;
    assigned_requests.reserve(instance_.num_requests());

    for (size_t route_id : full_solution_.iter_route_ids()) {
        for (size_t node_id : full_solution_.iter_route(route_id)) {
            if (!instance_.is_request(node_id)) {
                continue;
            }
            if (!instance_.is_pickup(node_id)) {
                continue;
            }
            size_t request_id = instance_.request_id(node_id);
            assigned_requests.push_back(request_id);
        }
    }

    for (size_t request_id : full_solution_.unassigned_requests().iter_request_ids()) {
        assigned_requests.push_back(request_id);
    }

    if (assigned_requests.empty()) {
        return {};
    }

    if (assigned_requests.size() < 150) {
        spdlog::info("[Splitter] Small instance ({} requests) - skipping decomposition", assigned_requests.size());
        return {assigned_requests};
    }

    size_t num_groups = settings.target_num_groups;
    if (num_groups == 0) {
        size_t avg = (settings.min_requests_per_group + settings.max_requests_per_group) / 2;
        avg = std::max<size_t>(1, avg);
        num_groups = std::max<size_t>(1, assigned_requests.size() / avg);
    }
    num_groups = std::max<size_t>(1, std::min(num_groups, assigned_requests.size()));

    std::vector<std::pair<double, double>> coords;
    coords.reserve(assigned_requests.size());
    for (size_t req_id : assigned_requests) {
        size_t pickup_id = instance_.pickup_id_of_request(req_id);
        const auto &node = instance_.nodes()[pickup_id];
        coords.emplace_back(node.x(), node.y());
    }

    std::vector<std::vector<size_t>> clusters;
    switch (settings.mode) {
    case SplitMode::Geographic:
        clusters = kmeans_clusters(coords, num_groups, rng);
        break;
    case SplitMode::Random: {
        clusters.resize(num_groups);
        std::vector<size_t> indices(assigned_requests.size());
        std::iota(indices.begin(), indices.end(), 0);
        std::shuffle(indices.begin(), indices.end(), rng);
        for (size_t i = 0; i < indices.size(); ++i) {
            clusters[i % num_groups].push_back(assigned_requests[indices[i]]);
        }
        return clusters;
    }
    }

    for (auto &cluster : clusters) {
        for (size_t &idx : cluster) {
            idx = assigned_requests[idx];
        }
    }
    return clusters;
}

std::vector<std::vector<size_t>> SolutionSplitter::kmeans_clusters(const std::vector<std::pair<double, double>> &points, size_t k, std::mt19937 &rng) const {
    if (points.empty() || k == 0) {
        return {};
    }

    k = std::min(k, points.size());

    std::vector<size_t> seeds(points.size());
    std::iota(seeds.begin(), seeds.end(), 0);
    std::shuffle(seeds.begin(), seeds.end(), rng);

    std::vector<std::pair<double, double>> centroids;
    centroids.reserve(k);
    for (size_t i = 0; i < k; ++i) {
        centroids.push_back(points[seeds[i]]);
    }

    std::vector<size_t> assignments(points.size());
    bool changed = true;
    int max_iter = 50;

    for (int iter = 0; iter < max_iter && changed; ++iter) {
        changed = false;

        for (size_t i = 0; i < points.size(); ++i) {
            double best_dist = std::numeric_limits<double>::max();
            size_t best_cluster = 0;
            for (size_t c = 0; c < k; ++c) {
                double dx = points[i].first - centroids[c].first;
                double dy = points[i].second - centroids[c].second;
                double dist = dx * dx + dy * dy;
                if (dist < best_dist) {
                    best_dist = dist;
                    best_cluster = c;
                }
            }
            if (assignments[i] != best_cluster) {
                assignments[i] = best_cluster;
                changed = true;
            }
        }

        std::vector<double> sum_x(k, 0.0);
        std::vector<double> sum_y(k, 0.0);
        std::vector<size_t> counts(k, 0);

        for (size_t i = 0; i < points.size(); ++i) {
            size_t c = assignments[i];
            sum_x[c] += points[i].first;
            sum_y[c] += points[i].second;
            counts[c] += 1;
        }

        for (size_t c = 0; c < k; ++c) {
            if (counts[c] > 0) {
                centroids[c].first = sum_x[c] / static_cast<double>(counts[c]);
                centroids[c].second = sum_y[c] / static_cast<double>(counts[c]);
            }
        }
    }

    std::vector<std::vector<size_t>> clusters(k);
    for (size_t i = 0; i < points.size(); ++i) {
        clusters[assignments[i]].push_back(i);
    }

    clusters.erase(std::remove_if(clusters.begin(), clusters.end(), [](const auto &c) {
                       return c.empty();
                   }),
                   clusters.end());
    return clusters;
}

PartialInstance SolutionSplitter::build_partial(const std::vector<size_t> &request_ids) const {
    const size_t num_requests = request_ids.size();
    const size_t num_vehicles = instance_.num_vehicles();

    std::vector<Node> nodes;
    nodes.reserve(num_vehicles * 2 + num_requests * 2);
    std::vector<size_t> mapping;
    mapping.reserve(num_vehicles * 2 + num_requests * 2);

    for (size_t v = 0; v < num_vehicles; ++v) {
        size_t start_full = v * 2;
        size_t end_full = start_full + 1;
        nodes.push_back(clone_node(nodes.size(), instance_, start_full));
        mapping.push_back(start_full);
        nodes.push_back(clone_node(nodes.size(), instance_, end_full));
        mapping.push_back(end_full);
    }

    std::vector<size_t> pickup_full_ids;
    pickup_full_ids.reserve(num_requests);

    for (size_t request_id : request_ids) {
        size_t pickup_full = instance_.pickup_id_of_request(request_id);
        size_t delivery_full = pickup_full + 1;
        nodes.push_back(clone_node(nodes.size(), instance_, pickup_full));
        mapping.push_back(pickup_full);
        nodes.push_back(clone_node(nodes.size(), instance_, delivery_full));
        mapping.push_back(delivery_full);
        pickup_full_ids.push_back(pickup_full);
    }

    auto matrix = std::make_shared<TravelMatrix>(nodes.size());
    for (size_t i = 0; i < nodes.size(); ++i) {
        size_t full_i = mapping[i];
        for (size_t j = 0; j < nodes.size(); ++j) {
            size_t full_j = mapping[j];
            matrix->set_distance(i, j, instance_.distance(full_i, full_j));
            matrix->set_time(i, j, instance_.time(full_i, full_j));
        }
    }

    std::vector<problem::Vehicle> vehicles = instance_.vehicles();

    PDPTWInstance sub_instance = problem::create_instance_with(
        instance_.name() + "_sub",
        num_vehicles,
        num_requests,
        vehicles,
        nodes,
        matrix);

    Solution partial(sub_instance);

    std::unordered_map<size_t, size_t> full_to_partial;
    full_to_partial.reserve(mapping.size());
    for (size_t idx = 0; idx < mapping.size(); ++idx) {
        full_to_partial[mapping[idx]] = idx;
    }

    std::vector<std::vector<size_t>> itineraries(num_vehicles);
    for (size_t v = 0; v < num_vehicles; ++v) {
        size_t vn = sub_instance.vn_id_of(v);
        itineraries[v] = {vn, vn + 1};
    }

    for (size_t route_id : full_solution_.iter_route_ids()) {
        const auto route_nodes = full_solution_.iter_route(route_id);
        std::vector<size_t> projected;
        projected.reserve(route_nodes.size());
        size_t partial_vn = sub_instance.vn_id_of(route_id);
        projected.push_back(partial_vn);

        for (size_t node_id : route_nodes) {
            if (node_id == instance_.vn_id_of(route_id) || node_id == instance_.vn_id_of(route_id) + 1) {
                continue;
            }
            auto it = full_to_partial.find(node_id);
            if (it != full_to_partial.end()) {
                projected.push_back(it->second);
            }
        }
        projected.push_back(partial_vn + 1);

        if (projected.size() > 2) {
            itineraries[route_id] = std::move(projected);
        }
    }

    partial.set(itineraries);

    return PartialInstance(std::move(sub_instance),
                           std::move(partial),
                           std::move(mapping),
                           request_ids);
}

} // namespace pdptw::decomposition
