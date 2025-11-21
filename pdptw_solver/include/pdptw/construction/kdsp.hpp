// K-Shortest Paths cho PDPTW - tìm k đường đi ngắn nhất để chèn request

#pragma once

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <algorithm>
#include <vector>

namespace pdptw {
namespace construction {

using pdptw::problem::Num;
using pdptw::problem::PDPTWInstance;
using pdptw::solution::Solution;

// Biểu diễn đường đi từ nguồn đến đích
struct Path {
    std::vector<size_t> nodes; // Chuỗi node (VN IDs)
    Num cost;                  // Tổng chi phí
    Num duration;              // Tổng thời gian
    bool feasible;             // Khả thi không

    Path(const std::vector<size_t> &nodes = {},
         Num cost = 0.0,
         Num duration = 0.0,
         bool feasible = true)
        : nodes(nodes), cost(cost), duration(duration), feasible(feasible) {}

    bool operator<(const Path &other) const { return cost < other.cost; }
    bool empty() const { return nodes.empty(); }
    size_t length() const { return nodes.size(); }
};

// Thuật toán K-Shortest Paths cho PDPTW
class KDSP {
public:
    // Tìm k đường đi ngắn nhất từ source đến target
    static std::vector<Path> find_k_shortest_paths(
        const PDPTWInstance &instance,
        const Solution &solution,
        size_t source_node,
        size_t target_node,
        size_t k);

    // Tìm k đường đi để chèn cặp pickup-delivery
    // Đường đi: vị trí hiện tại → pickup → delivery → vị trí tiếp theo
    static std::vector<Path> find_insertion_paths(
        const PDPTWInstance &instance,
        const Solution &solution,
        size_t request_id,
        size_t vehicle_id,
        size_t k);

    // Tìm đường đi ngắn nhất duy nhất (k=1)
    static Path find_shortest_path(
        const PDPTWInstance &instance,
        const Solution &solution,
        size_t source,
        size_t target);

    // Tính tổng chi phí của đường đi
    static Num calculate_path_cost(
        const PDPTWInstance &instance,
        const std::vector<size_t> &path);

    // Tính tổng thời gian của đường đi
    static Num calculate_path_duration(
        const PDPTWInstance &instance,
        const std::vector<size_t> &path);

    // Kiểm tra đường đi có khả thi không (time windows)
    static bool is_path_feasible(
        const PDPTWInstance &instance,
        const Solution &solution,
        const std::vector<size_t> &path);

private:
    // Lấy đường đi trực tiếp (không qua node trung gian)
    static std::vector<size_t> get_direct_path(size_t source, size_t target);

    // Tìm đường đi thay thế qua các node trung gian
    static std::vector<Path> find_alternative_paths(
        const PDPTWInstance &instance,
        const Solution &solution,
        size_t source,
        size_t target,
        size_t k);
};

} // namespace construction
} // namespace pdptw
