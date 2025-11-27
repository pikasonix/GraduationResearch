#pragma once

#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include "pdptw/utils/time_limit.hpp"
#include <optional>
#include <random>

namespace pdptw::ages {

// Tham số AGES (Adaptive Genetic and Evolutionary Strategies)
struct AGESParameters {
    size_t max_perturbation_phases = 100;            // Số pha nhiễu loạn tối đa
    size_t min_perturbation_moves = 1;               // Số bước nhiễu loạn tối thiểu
    size_t max_perturbation_moves = 3;               // Số bước nhiễu loạn tối đa
    bool count_successful_perturbations_only = true; // Chỉ đếm nhiễu loạn thành công
    bool use_shuffle_stack = true;                   // Xáo trộn stack sau perturbation
    double shift_probability = 0.5;                  // Xác suất shift vs exchange
    bool use_k_ejection = true;                      // Sử dụng k-ejection
    bool use_perturbation = true;                    // Sử dụng perturbation

    static AGESParameters default_params(size_t num_requests) {
        return AGESParameters{};
    }
};

// AGES Solver - thuật toán giảm số xe bằng cách loại bỏ tuyến ngẫu nhiên
// Quy trình: Eject route ngẫu nhiên → Xáo trộn stack → Chèn lại → Perturbation
class AGESSolver {
public:
    AGESSolver(const problem::PDPTWInstance &instance, const AGESParameters &params);

    // Chạy AGES từ giải pháp ban đầu, trả về giải pháp ít xe nhất
    solution::Solution run(
        solution::Solution initial_solution,
        std::mt19937 &rng,
        std::optional<lns::AbsenceCounter> initial_absence = std::nullopt,
        utils::TimeLimit *time_limit = nullptr);

private:
    const problem::PDPTWInstance *instance_;
    AGESParameters params_;

    // Thử chèn request bằng cách loại bỏ (eject) 1-2 request khác
    void eject_and_insert(
        solution::Solution &sol,
        size_t u,
        std::vector<size_t> &stack,
        std::mt19937 &rng,
        lns::AbsenceCounter &abs);

    // Thực hiện nhiễu loạn (shift/exchange ngẫu nhiên)
    size_t perform_perturbation(
        solution::Solution &sol,
        std::mt19937 &rng,
        size_t num_perturbations);
};

} // namespace pdptw::ages
