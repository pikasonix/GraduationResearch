#include "pdptw/construction/constructor.hpp"
#include <algorithm>
#include <limits>
#include <spdlog/spdlog.h>
#include <vector>

namespace pdptw::construction {

using Num = problem::Num;

Solution Constructor::construct(
    const PDPTWInstance &instance,
    ConstructionStrategy strategy) {
    switch (strategy) {
    case ConstructionStrategy::SequentialInsertion:
        return sequential_construction(instance);
    case ConstructionStrategy::RegretInsertion:
        return regret_construction(instance);
    case ConstructionStrategy::BinPackingFirst:
        return bin_packing_construction(instance);
    default:
        return sequential_construction(instance);
    }
}

Solution Constructor::sequential_construction(
    const PDPTWInstance &instance) {
    Solution solution(instance);

    spdlog::debug("Starting sequential construction for {} requests", instance.num_requests());

    size_t inserted_count = 0;
    for (size_t req_id = 0; req_id < instance.num_requests(); ++req_id) {
        auto candidate = Insertion::find_best_insertion(
            solution,
            req_id,
            InsertionStrategy::BestCost);

        if (candidate.feasible) {
            spdlog::debug("Request {}: Inserting at vehicle {}, pickup_after={}, delivery_after={}, cost={:.2f}",
                          req_id, candidate.vehicle_id, candidate.pickup_after,
                          candidate.delivery_after, candidate.cost_increase);
            Insertion::insert_request(solution, candidate);
            inserted_count++;
        } else {
            spdlog::debug("Request {}: No feasible insertion found", req_id);
        }
    }

    spdlog::info("Sequential construction completed: {}/{} requests inserted",
                 inserted_count, instance.num_requests());

    return solution;
}

Solution Constructor::regret_construction(
    const PDPTWInstance &instance,
    size_t k) {
    Solution solution(instance);

    std::vector<size_t> uninserted;
    for (size_t req_id = 0; req_id < instance.num_requests(); ++req_id) {
        uninserted.push_back(req_id);
    }

    while (!uninserted.empty()) {
        auto regret_candidates = Insertion::calculate_regret(solution, uninserted, k);

        if (regret_candidates.empty()) {
            break;
        }

        std::sort(regret_candidates.begin(), regret_candidates.end(),
                  [](const InsertionCandidate &a, const InsertionCandidate &b) {
                      if (a.regret_value != b.regret_value) {
                          return a.regret_value > b.regret_value;
                      }
                      return a.cost_increase < b.cost_increase;
                  });

        const auto &best = regret_candidates[0];
        Insertion::insert_request(solution, best);

        uninserted.erase(
            std::remove(uninserted.begin(), uninserted.end(), best.request_id),
            uninserted.end());
    }

    return solution;
}

Solution Constructor::bin_packing_construction(
    const PDPTWInstance &instance) {
    Solution solution(instance);

    std::vector<size_t> all_requests;
    for (size_t req_id = 0; req_id < instance.num_requests(); ++req_id) {
        all_requests.push_back(req_id);
    }

    auto bins = BinPacking::best_fit_decreasing(instance, all_requests);

    for (const auto &bin : bins) {
        if (!bin.empty()) {
            build_route_for_vehicle(solution, bin.vehicle_id, bin.requests);
        }
    }

    return solution;
}

void Constructor::build_route_for_vehicle(
    Solution &solution,
    size_t vehicle_id,
    const std::vector<size_t> &requests) {
    
    for (size_t req_id : requests) {
        // Tìm vị trí chèn tốt nhất CHỈ trong vehicle_id được chỉ định
        // Không dùng Insertion::find_best_insertion vì nó tìm trên toàn bộ các xe
        
        InsertionCandidate best_candidate; // Default: cost = infinity, feasible = false

        size_t depot_start = vehicle_id * 2;
        size_t depot_end = vehicle_id * 2 + 1;

        // Duyệt qua tất cả vị trí pickup có thể
        size_t pickup_after = depot_start;
        const size_t MAX_ITER = 1000; // Safety break
        size_t pickup_iter = 0;

        while (pickup_after != depot_end && pickup_iter++ < MAX_ITER) {
            // Duyệt qua tất cả vị trí delivery có thể (phải sau pickup)
            size_t delivery_after = pickup_after;
            size_t delivery_iter = 0;

            while (delivery_after != depot_end && delivery_iter++ < MAX_ITER) {
                // Kiểm tra tính khả thi
                if (Insertion::is_feasible_insertion(solution, req_id, vehicle_id, pickup_after, delivery_after)) {
                    Num cost = Insertion::calculate_insertion_cost(solution, req_id, vehicle_id, pickup_after, delivery_after);
                    
                    if (cost < best_candidate.cost_increase) {
                        best_candidate = InsertionCandidate(
                            req_id, vehicle_id, pickup_after, delivery_after, cost, true);
                    }
                }

                delivery_after = solution.succ(delivery_after);
            }

            pickup_after = solution.succ(pickup_after);
        }

        if (best_candidate.feasible) {
            Insertion::insert_request(solution, best_candidate);
        } else {
            spdlog::warn("BinPacking: Failed to insert request {} into assigned vehicle {}", req_id, vehicle_id);
        }
    }
}

} // namespace pdptw::construction
