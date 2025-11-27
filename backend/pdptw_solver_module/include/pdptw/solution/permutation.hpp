#pragma once

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <array>
#include <optional>
#include <random>

// Permutation operations cho PDPTW solution

namespace pdptw::solution {

using pdptw::problem::Num;

// PDInsertion: Chèn cặp pickup-delivery
struct PDInsertion {
    size_t vn_id;           // Vehicle node ID (route * 2)
    size_t pickup_id;       // Pickup node ID
    size_t pickup_after;    // Node sau đó chèn pickup
    size_t delivery_before; // Node trước đó chèn delivery
    Num cost;               // Cost delta của insertion
};

// PDEjection: Đẩy cặp pickup-delivery ra
struct PDEjection {
    size_t pickup_id; // Pickup node ID cần đẩy ra
};

// KEjectionInsertion: Kết quả K-ejection + insertion
// K = số requests cần đẩy ra (1 hoặc 2)
template <size_t K>
struct KEjectionInsertion {
    std::array<PDEjection, K> ejections; // Requests cần đẩy ra
    PDInsertion insertion;               // Request cần chèn vào
};

// ReservoirSampling: Reservoir sampling cho random selection
class ReservoirSampling {
public:
    ReservoirSampling() : count_(0), sample_(std::nullopt) {}

    // Thêm candidate với count cho trước
    void add(PDInsertion candidate, size_t count, std::mt19937 &rng) {
        if (count == 0)
            return;

        count_ += count;
        std::uniform_int_distribution<size_t> dist(0, count_ - 1);
        if (dist(rng) < count) {
            sample_ = candidate;
        }
    }

    // Lấy sampled insertion (empty nếu không có feasible insertion)
    std::optional<PDInsertion> take() {
        return sample_;
    }

private:
    size_t count_;
    std::optional<PDInsertion> sample_;
};

// PermutationOps: Permutation operations cho Solution class
class PermutationOps {
public:
    // Tìm random feasible insertion cho request (bất kỳ route nào)
    // Dùng reservoir sampling để chọn 1 random feasible insertion
    static std::optional<PDInsertion> find_random_insert_for_request(
        const Solution &sol,
        size_t pickup_id,
        std::mt19937 &rng);

    // Tìm random feasible insertion trong route cụ thể
    static ReservoirSampling find_random_insert_in_route(
        const Solution &sol,
        size_t pickup_id,
        size_t route_id,
        std::mt19937 &rng,
        ReservoirSampling sampling);

    // Tìm tất cả feasible insertions cho request trong route
    static std::vector<PDInsertion> find_all_inserts_for_request_in_route(
        const Solution &sol,
        size_t pickup_id,
        size_t route_id);

    // Chèn pickup-delivery pair vào solution
    static void insert(Solution &sol, const PDInsertion &insertion);

    // Random shift move: relocate 1 request
    static bool random_shift(Solution &sol, std::mt19937 &rng);

    // Random exchange move: swap 2 requests
    static bool random_exchange(Solution &sol, std::mt19937 &rng);
};

} // namespace pdptw::solution