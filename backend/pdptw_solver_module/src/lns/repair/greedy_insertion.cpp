#include "pdptw/lns/repair/greedy_insertion.hpp"
#include "pdptw/construction/insertion.hpp"
#include <algorithm>
#include <iostream>
#include <numeric>
#include <random>

namespace pdptw {
namespace lns {
namespace repair {

void GreedyInsertionOperator::repair(solution::Solution &solution, Random &rng) {
    auto &bank = solution.unassigned_requests();
    if (bank.count() == 0)
        return;

    bool progress = true;
    int iteration = 0;
    const int MAX_ITERATIONS = 1000;

    while (bank.count() > 0 && progress && iteration < MAX_ITERATIONS) {
        iteration++;
        progress = false;
        auto requests = sort_unassigned_customers(solution, rng);

        for (size_t request_id : requests) {
            size_t pickup_id = solution.instance().pickup_id_of_request(request_id);

            if (!bank.contains(pickup_id))
                continue;

            auto candidate = pdptw::construction::Insertion::find_best_insertion(solution, request_id,
                                                                                 pdptw::construction::InsertionStrategy::BestCost);
            if (candidate.feasible) {
                pdptw::construction::Insertion::insert_request(solution, candidate);
                bank.remove(pickup_id);
                progress = true;
                continue;
            }

            find_first_empty_route_and_insert(solution, request_id, rng);
            if (!bank.contains(pickup_id)) {
                progress = true;
            }
        }
    }

    if (iteration >= MAX_ITERATIONS) {
        std::cout << "[REPAIR WARNING] Hit max iterations limit (" << MAX_ITERATIONS
                  << "), " << bank.count() << " requests still unassigned\n";
    }
}

std::vector<size_t> GreedyInsertionOperator::sort_unassigned_customers(solution::Solution &solution, Random &rng) {
    auto requests = solution.unassigned_requests().iter_request_ids();
    if (requests.empty())
        return requests;

    const std::vector<int> weights = {4, 4, 2, 1, 2, 2, 2};
    int total = std::accumulate(weights.begin(), weights.end(), 0);
    std::uniform_int_distribution<int> dist(0, total - 1);
    int w = dist(rng);
    int idx = 0;
    int acc = 0;
    for (size_t i = 0; i < weights.size(); ++i) {
        acc += weights[i];
        if (w < acc) {
            idx = static_cast<int>(i);
            break;
        }
    }

    auto &inst = solution.instance();

    switch (idx) {
    case 0: {
        std::shuffle(requests.begin(), requests.end(), rng);
        break;
    }
    case 1: {
        std::sort(requests.begin(), requests.end(), [&inst](size_t req_a, size_t req_b) {
            size_t pickup_a = inst.pickup_id_of_request(req_a);
            size_t pickup_b = inst.pickup_id_of_request(req_b);
            return inst.nodes()[pickup_a].demand() > inst.nodes()[pickup_b].demand();
        });
        break;
    }
    case 2: {
        std::sort(requests.begin(), requests.end(), [&inst](size_t req_a, size_t req_b) {
            size_t pickup_a = inst.pickup_id_of_request(req_a);
            size_t pickup_b = inst.pickup_id_of_request(req_b);
            double va = inst.nodes()[pickup_a].x() + inst.nodes()[pickup_a].y();
            double vb = inst.nodes()[pickup_b].x() + inst.nodes()[pickup_b].y();
            return va > vb;
        });
        break;
    }
    case 3: {
        std::sort(requests.begin(), requests.end(), [&inst](size_t req_a, size_t req_b) {
            size_t pickup_a = inst.pickup_id_of_request(req_a);
            size_t pickup_b = inst.pickup_id_of_request(req_b);
            double va = inst.nodes()[pickup_a].x() + inst.nodes()[pickup_a].y();
            double vb = inst.nodes()[pickup_b].x() + inst.nodes()[pickup_b].y();
            return va < vb;
        });
        break;
    }
    case 4: {
        std::sort(requests.begin(), requests.end(), [&inst](size_t req_a, size_t req_b) {
            size_t pickup_a = inst.pickup_id_of_request(req_a);
            size_t pickup_b = inst.pickup_id_of_request(req_b);
            double la = inst.nodes()[pickup_a].due() - inst.nodes()[pickup_a].ready();
            double lb = inst.nodes()[pickup_b].due() - inst.nodes()[pickup_b].ready();
            return la < lb;
        });
        break;
    }
    case 5: {
        std::sort(requests.begin(), requests.end(), [&inst](size_t req_a, size_t req_b) {
            size_t pickup_a = inst.pickup_id_of_request(req_a);
            size_t pickup_b = inst.pickup_id_of_request(req_b);
            return inst.nodes()[pickup_a].ready() < inst.nodes()[pickup_b].ready();
        });
        break;
    }
    case 6: {
        std::sort(requests.begin(), requests.end(), [&inst](size_t req_a, size_t req_b) {
            size_t pickup_a = inst.pickup_id_of_request(req_a);
            size_t pickup_b = inst.pickup_id_of_request(req_b);
            return inst.nodes()[pickup_a].due() > inst.nodes()[pickup_b].due();
        });
        break;
    }
    default:
        break;
    }

    return requests;
}

void GreedyInsertionOperator::find_first_empty_route_and_insert(solution::Solution &solution, size_t request_id, Random &rng) {
    size_t pickup_id = solution.instance().pickup_id_of_request(request_id);
    auto &bank = solution.unassigned_requests();
    if (!bank.contains(pickup_id))
        return;

    auto candidate = pdptw::construction::Insertion::find_best_insertion(solution, request_id,
                                                                         pdptw::construction::InsertionStrategy::Sequential);
    if (candidate.feasible) {
        pdptw::construction::Insertion::insert_request(solution, candidate);
        bank.remove(pickup_id);
    }
}

} // namespace repair
} // namespace lns
} // namespace pdptw
