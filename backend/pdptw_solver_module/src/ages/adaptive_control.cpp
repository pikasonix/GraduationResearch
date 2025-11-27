#include "ages/adaptive_control.h"
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <random>
#include <sstream>

namespace pdptw {

AdaptiveControl::AdaptiveControl(const Parameters &params)
    : params_(params), temperature_(params.initial_temperature), recommended_population_size_((params.min_population_size + params.max_population_size) / 2) {
    initialize_operators();
}

void AdaptiveControl::record_operator_usage(OperatorType op, bool improved, double improvement_delta) {
    auto &stats = operator_stats_[op];
    stats.used++;
    stats.recent_used++;

    if (improved) {
        stats.successful++;
        stats.recent_successful++;
    }

    // Điều chỉnh trọng số ngay lập tức (nếu bật)
    if (params_.enable_operator_adaptation) {
        if (improved) {
            stats.weight *= params_.reward_factor;
        } else {
            stats.weight *= params_.punishment_factor;
        }
        stats.weight = clamp_weight(stats.weight);
    }
}

double AdaptiveControl::get_operator_weight(OperatorType op) const {
    auto it = operator_stats_.find(op);
    if (it != operator_stats_.end()) {
        return it->second.weight;
    }
    return params_.initial_weight;
}

std::map<AdaptiveControl::OperatorType, double> AdaptiveControl::get_all_weights() const {
    std::map<OperatorType, double> weights;
    for (const auto &[op, stats] : operator_stats_) {
        weights[op] = stats.weight;
    }
    return weights;
}

AdaptiveControl::OperatorType AdaptiveControl::select_operator() const {
    // Chọn toán tử theo Roulette wheel dựa trên trọng số
    double total_weight = 0.0;
    for (const auto &[op, stats] : operator_stats_) {
        total_weight += stats.weight;
    }

    if (total_weight <= 0.0) {
        // Tất cả trọng số = 0, chọn ngẫu nhiên
        std::vector<OperatorType> ops;
        for (const auto &[op, stats] : operator_stats_) {
            ops.push_back(op);
        }
        static std::mt19937 rng(std::random_device{}());
        std::uniform_int_distribution<size_t> dist(0, ops.size() - 1);
        return ops[dist(rng)];
    }

    // Roulette wheel
    static std::mt19937 rng(std::random_device{}());
    std::uniform_real_distribution<double> dist(0.0, total_weight);
    double r = dist(rng);

    double cumulative = 0.0;
    for (const auto &[op, stats] : operator_stats_) {
        cumulative += stats.weight;
        if (r <= cumulative) {
            return op;
        }
    }

    return operator_stats_.begin()->first;
}

void AdaptiveControl::update_operator_weights() {
    if (!params_.enable_operator_adaptation) {
        return;
    }

    // Cập nhật trọng số dựa trên hiệu suất gần đây
    for (auto &[op, stats] : operator_stats_) {
        double recent_rate = stats.recent_success_rate();

        if (stats.recent_used > 0) {
            if (recent_rate > 0.5) {
                stats.weight *= (1.0 + (recent_rate - 0.5)); // Hiệu suất tốt, tăng trọng số
            } else if (recent_rate < 0.3) {
                stats.weight *= 0.9; // Hiệu suất kém, giảm trọng số
            }

            stats.weight = clamp_weight(stats.weight);
        }
    }

    clear_recent_stats();
}

void AdaptiveControl::cool_temperature() {
    if (!params_.enable_temperature_adaptation) {
        return;
    }

    temperature_ *= params_.cooling_rate;
    temperature_ = std::max(temperature_, params_.min_temperature);
    temperature_update_counter_++;
}

void AdaptiveControl::reset_temperature() {
    temperature_ = params_.initial_temperature;
    temperature_update_counter_ = 0;
}

void AdaptiveControl::update_temperature(size_t generations_without_improvement) {
    if (!params_.enable_temperature_adaptation) {
        return;
    }

    if (generations_without_improvement >= params_.temperature_reset_threshold) {
        reset_temperature(); // Tìm kiếm đình trệ, reset để thoát local optimum
    } else {
        cool_temperature(); // Làm lạnh bình thường
    }
}

size_t AdaptiveControl::get_recommended_population_size(double current_diversity) const {
    if (!params_.enable_population_adaptation) {
        return recommended_population_size_;
    }

    size_t recommended = recommended_population_size_;

    if (current_diversity < 0.2) {
        recommended = std::min(recommended + 2, params_.max_population_size); // Đa dạng thấp, cần tăng kích thước
    } else if (current_diversity > 0.6) {
        recommended = std::max(recommended - 1, params_.min_population_size); // Đa dạng cao, có thể giảm
    }

    return recommended;
}

void AdaptiveControl::update_population_size(size_t current_size,
                                             double current_diversity,
                                             double improvement_rate) {
    if (!params_.enable_population_adaptation) {
        return;
    }

    adaptation_counter_++;

    if (adaptation_counter_ < params_.adjustment_frequency) {
        return;
    }

    adaptation_counter_ = 0;

    // Điều chỉnh dựa trên đa dạng và tốc độ cải thiện
    if (current_diversity < 0.2 || improvement_rate < 0.01) {
        recommended_population_size_ = std::min(
            recommended_population_size_ + 1,
            params_.max_population_size);
    } else if (current_diversity > 0.5 && improvement_rate > 0.05) {
        recommended_population_size_ = std::max(
            recommended_population_size_ - 1,
            params_.min_population_size);
    }
}

std::vector<AdaptiveControl::OperatorStats> AdaptiveControl::get_operator_statistics() const {
    std::vector<OperatorStats> stats;
    for (const auto &[op, stat] : operator_stats_) {
        stats.push_back(stat);
    }
    return stats;
}

std::string AdaptiveControl::get_statistics_string() const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(3);

    oss << "Adaptive Control Statistics:\n";
    oss << "  Temperature: " << temperature_ << "\n";
    oss << "  Recommended population size: " << recommended_population_size_ << "\n";
    oss << "\n  Operator Weights:\n";

    for (const auto &[op, stats] : operator_stats_) {
        oss << "    " << stats.name << ":\n";
        oss << "      Weight: " << stats.weight << "\n";
        oss << "      Used: " << stats.used << "\n";
        oss << "      Success rate: " << (stats.success_rate() * 100.0) << "%\n";
        if (stats.recent_used > 0) {
            oss << "      Recent success rate: " << (stats.recent_success_rate() * 100.0) << "%\n";
        }
    }

    return oss.str();
}

void AdaptiveControl::reset() {
    initialize_operators();
    temperature_ = params_.initial_temperature;
    temperature_update_counter_ = 0;
    recommended_population_size_ = (params_.min_population_size + params_.max_population_size) / 2;
    adaptation_counter_ = 0;
}

void AdaptiveControl::clear_recent_stats() {
    for (auto &[op, stats] : operator_stats_) {
        stats.recent_used = 0;
        stats.recent_successful = 0;
    }
}

void AdaptiveControl::initialize_operators() {
    operator_stats_.clear();

    std::vector<OperatorType> operators = {
        OperatorType::ROUTE_CROSSOVER,
        OperatorType::ORDER_CROSSOVER,
        OperatorType::BEST_ROUTE_CROSSOVER,
        OperatorType::MUTATE_RELOCATE,
        OperatorType::MUTATE_SWAP,
        OperatorType::MUTATE_SHUFFLE};

    for (auto op : operators) {
        OperatorStats stats;
        stats.name = get_operator_name(op);
        stats.weight = params_.initial_weight;
        operator_stats_[op] = stats;
    }
}

double AdaptiveControl::clamp_weight(double weight) const {
    return std::max(params_.min_weight, std::min(weight, params_.max_weight));
}

std::string AdaptiveControl::get_operator_name(OperatorType op) {
    switch (op) {
    case OperatorType::ROUTE_CROSSOVER:
        return "Route Crossover";
    case OperatorType::ORDER_CROSSOVER:
        return "Order Crossover";
    case OperatorType::BEST_ROUTE_CROSSOVER:
        return "Best Route Crossover";
    case OperatorType::MUTATE_RELOCATE:
        return "Mutate Relocate";
    case OperatorType::MUTATE_SWAP:
        return "Mutate Swap";
    case OperatorType::MUTATE_SHUFFLE:
        return "Mutate Shuffle";
    default:
        return "Unknown";
    }
}

} // namespace pdptw
