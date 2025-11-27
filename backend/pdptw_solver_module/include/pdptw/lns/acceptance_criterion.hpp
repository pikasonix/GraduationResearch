#pragma once

#include "pdptw/problem/pdptw.hpp"
#include <cmath>
#include <random>

namespace pdptw {
namespace lns {

using Num = problem::Num;

// Các loại acceptance criterion
enum class AcceptanceType {
    HillClimbing,       // Chỉ chấp nhận cải thiện
    SimulatedAnnealing, // Chấp nhận xấu hơn với xác suất (SA)
    RecordToRecord,     // Chấp nhận trong ngưỡng so với best
    ThresholdAccepting  // Chấp nhận trong ngưỡng tuyệt đối
};

// Acceptance criterion cho LNS: quyết định có chấp nhận solution mới hay không
class AcceptanceCriterion {
public:
    explicit AcceptanceCriterion(
        AcceptanceType type = AcceptanceType::SimulatedAnnealing,
        double initial_temperature = 10.0);

    // Quyết định có chấp nhận solution mới không
    bool should_accept(
        Num current_cost,
        Num new_cost,
        Num best_cost);

    // Cập nhật temperature/threshold sau mỗi iteration
    void update_temperature(size_t iteration);

    void reset();

    AcceptanceType type() const { return type_; }
    double temperature() const { return temperature_; }
    double initial_temperature() const { return initial_temperature_; }

    void set_cooling_rate(double rate) { cooling_rate_ = rate; }
    void set_threshold(double threshold) { threshold_ = threshold; }

private:
    AcceptanceType type_;
    double temperature_;
    double initial_temperature_;
    double cooling_rate_ = 0.99975; // Tốc độ làm lạnh (slow cooling)
    double threshold_ = 0.05;       // Ngưỡng cho threshold accepting

    std::mt19937 rng_{std::random_device{}()};
    std::uniform_real_distribution<double> dist_{0.0, 1.0};
};

} // namespace lns
} // namespace pdptw
