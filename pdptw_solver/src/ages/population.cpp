#include "ages/population.h"
#include <limits>
#include <stdexcept>
#include <unordered_set>

namespace pdptw {

Population::Population(const Instance &instance, size_t max_size, double min_diversity)
    : instance_(instance), max_size_(max_size), min_diversity_(min_diversity), best_ever_(nullptr) {
    solutions_.reserve(max_size);
}

bool Population::add(const Solution &solution) {
    if (is_too_similar(solution)) {
        return false;
    }

    if (!is_full()) {
        solutions_.push_back(solution);
        update_best_ever();
        return true;
    }

    size_t worst_idx = find_worst_index();
    if (solution.objective() < solutions_[worst_idx].objective()) {
        solutions_[worst_idx] = solution;
        update_best_ever();
        return true;
    }

    return false;
}

bool Population::remove(size_t index) {
    if (index >= solutions_.size()) {
        return false;
    }

    solutions_.erase(solutions_.begin() + index);
    return true;
}

const Solution *Population::get_best() const {
    if (solutions_.empty()) {
        return nullptr;
    }

    auto it = std::min_element(solutions_.begin(), solutions_.end(),
                               [](const Solution &a, const Solution &b) {
                                   return a.objective() < b.objective();
                               });

    return &(*it);
}

const Solution *Population::get_worst() const {
    if (solutions_.empty()) {
        return nullptr;
    }

    auto it = std::max_element(solutions_.begin(), solutions_.end(),
                               [](const Solution &a, const Solution &b) {
                                   return a.objective() < b.objective();
                               });

    return &(*it);
}

const Solution *Population::get(size_t index) const {
    if (index >= solutions_.size()) {
        return nullptr;
    }
    return &solutions_[index];
}

Solution *Population::get_mutable(size_t index) {
    if (index >= solutions_.size()) {
        return nullptr;
    }
    return &solutions_[index];
}

double Population::calculate_diversity(const Solution &sol1, const Solution &sol2) const {
    // TODO: Triển khai Broken Pair Distance (BPD)
    // Tạm thời dùng chênh lệch objective

    double obj1 = sol1.objective();
    double obj2 = sol2.objective();
    double diff = std::abs(obj1 - obj2);

    double avg_obj = (obj1 + obj2) / 2.0;
    if (avg_obj > 0.0) {
        return std::min(1.0, diff / avg_obj);
    }

    return 0.5;
}

double Population::calculate_average_diversity(const Solution &solution) const {
    if (solutions_.empty()) {
        return 1.0;
    }

    double total_diversity = 0.0;
    for (const auto &pop_sol : solutions_) {
        total_diversity += calculate_diversity(solution, pop_sol);
    }

    return total_diversity / static_cast<double>(solutions_.size());
}

double Population::calculate_population_diversity() const {
    if (solutions_.size() < 2) {
        return 0.0;
    }

    double total_diversity = 0.0;
    size_t count = 0;

    for (size_t i = 0; i < solutions_.size(); ++i) {
        for (size_t j = i + 1; j < solutions_.size(); ++j) {
            total_diversity += calculate_diversity(solutions_[i], solutions_[j]);
            count++;
        }
    }

    return count > 0 ? total_diversity / count : 0.0;
}

void Population::clear() {
    solutions_.clear();
}

void Population::sort_by_objective() {
    std::sort(solutions_.begin(), solutions_.end(),
              [](const Solution &a, const Solution &b) {
                  return a.objective() < b.objective();
              });
}

bool Population::update_best_ever() {
    const Solution *current_best = get_best();
    if (!current_best) {
        return false;
    }

    if (!best_ever_ || current_best->objective() < best_ever_->objective()) {
        best_ever_ = std::make_unique<Solution>(*current_best);
        return true;
    }

    return false;
}

const Solution *Population::get_best_ever() const {
    return best_ever_.get();
}

double Population::calculate_fitness(const Solution &solution, double diversity_weight) const {
    double objective = solution.objective();
    double diversity = calculate_average_diversity(solution);

    // fitness = objective - diversity_bonus (đa dạng cao → fitness thấp)
    return objective - diversity_weight * diversity;
}

size_t Population::find_worst_index() const {
    if (solutions_.empty()) {
        return 0;
    }

    double worst_obj = -std::numeric_limits<double>::infinity();
    size_t worst_idx = 0;

    for (size_t i = 0; i < solutions_.size(); ++i) {
        if (solutions_[i].objective() > worst_obj) {
            worst_obj = solutions_[i].objective();
            worst_idx = i;
        }
    }

    return worst_idx;
}

bool Population::is_too_similar(const Solution &solution) const {
    for (const auto &pop_sol : solutions_) {
        double diversity = calculate_diversity(solution, pop_sol);
        if (diversity < min_diversity_) {
            return true;
        }
    }
    return false;
}

} // namespace pdptw
