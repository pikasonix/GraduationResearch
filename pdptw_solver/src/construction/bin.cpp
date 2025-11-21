#include "pdptw/construction/bin.hpp"
#include <algorithm>
#include <cmath>

namespace pdptw {
namespace construction {

bool Bin::can_fit(const PDPTWInstance &instance, size_t request_id) const {
    Num demand = BinPacking::get_request_demand(instance, request_id);
    return total_load + demand <= capacity;
}

void Bin::add_request(const PDPTWInstance &instance, size_t request_id) {
    Num demand = BinPacking::get_request_demand(instance, request_id);
    requests.push_back(request_id);
    total_load += demand;

    size_t pickup_id = instance.pickup_id_of_request(request_id);
    size_t delivery_id = instance.delivery_id_of_request(request_id);
    estimated_cost += instance.distance(pickup_id, delivery_id);
}

Num BinPacking::get_request_demand(const PDPTWInstance &instance,
                                   size_t request_id) {
    size_t pickup_id = instance.pickup_id_of_request(request_id);
    const auto &nodes = instance.nodes();
    return std::abs(nodes[pickup_id].demand());
}

std::vector<size_t> BinPacking::sort_by_demand(
    const PDPTWInstance &instance,
    const std::vector<size_t> &requests) {

    std::vector<size_t> sorted = requests;

    std::sort(sorted.begin(), sorted.end(),
              [&instance](size_t a, size_t b) {
                  Num demand_a = get_request_demand(instance, a);
                  Num demand_b = get_request_demand(instance, b);
                  return demand_a > demand_b;
              });

    return sorted;
}

std::vector<Bin> BinPacking::first_fit_decreasing(
    const PDPTWInstance &instance,
    const std::vector<size_t> &requests) {

    std::vector<Bin> bins;

    auto sorted_requests = sort_by_demand(instance, requests);

    const auto &vehicles = instance.vehicles();

    for (size_t request_id : sorted_requests) {
        bool assigned = false;

        for (auto &bin : bins) {
            if (bin.can_fit(instance, request_id)) {
                bin.add_request(instance, request_id);
                assigned = true;
                break;
            }
        }

        if (!assigned && bins.size() < vehicles.size()) {
            size_t vehicle_id = bins.size();
            Num capacity = vehicles[vehicle_id].seats();
            Bin new_bin(vehicle_id, capacity);
            new_bin.add_request(instance, request_id);
            bins.push_back(new_bin);
        }
    }

    return bins;
}

std::vector<Bin> BinPacking::best_fit_decreasing(
    const PDPTWInstance &instance,
    const std::vector<size_t> &requests) {

    std::vector<Bin> bins;

    auto sorted_requests = sort_by_demand(instance, requests);

    const auto &vehicles = instance.vehicles();

    for (size_t request_id : sorted_requests) {
        Num demand = get_request_demand(instance, request_id);

        int best_bin_idx = -1;
        Num min_remaining = std::numeric_limits<Num>::max();

        for (size_t i = 0; i < bins.size(); ++i) {
            if (bins[i].can_fit(instance, request_id)) {
                Num remaining = bins[i].remaining_capacity() - demand;
                if (remaining < min_remaining) {
                    min_remaining = remaining;
                    best_bin_idx = static_cast<int>(i);
                }
            }
        }

        if (best_bin_idx >= 0) {
            bins[best_bin_idx].add_request(instance, request_id);
        } else if (bins.size() < vehicles.size()) {
            size_t vehicle_id = bins.size();
            Num capacity = vehicles[vehicle_id].seats();
            Bin new_bin(vehicle_id, capacity);
            new_bin.add_request(instance, request_id);
            bins.push_back(new_bin);
        }
    }

    return bins;
}

} // namespace construction
} // namespace pdptw
