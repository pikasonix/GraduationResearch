#include "pdptw/lns/acceptance_criterion.hpp"
#include <cmath>

namespace pdptw {
namespace lns {

AcceptanceCriterion::AcceptanceCriterion(
    AcceptanceType type,
    double initial_temperature)
    : type_(type),
      temperature_(initial_temperature),
      initial_temperature_(initial_temperature) {
}

bool AcceptanceCriterion::should_accept(
    Num current_cost,
    Num new_cost,
    Num best_cost) {
    if (new_cost < best_cost) {
        return true;
    }

    Num delta = new_cost - current_cost;

    switch (type_) {
    case AcceptanceType::HillClimbing:
        return delta < 0.0;

    case AcceptanceType::SimulatedAnnealing: {
        if (delta < 0.0) {
            return true;
        }
        double probability = std::exp(-delta / temperature_);
        return dist_(rng_) < probability;
    }

    case AcceptanceType::RecordToRecord: {
        Num threshold_cost = best_cost * (1.0 + threshold_);
        return new_cost <= threshold_cost;
    }

    case AcceptanceType::ThresholdAccepting: {
        return delta <= threshold_;
    }
    }

    return false;
}

void AcceptanceCriterion::update_temperature(size_t iteration) {
    if (type_ == AcceptanceType::SimulatedAnnealing) {
        temperature_ *= cooling_rate_;

        if (temperature_ < 0.01) {
            temperature_ = 0.01;
        }
    }
}

void AcceptanceCriterion::reset() {
    temperature_ = initial_temperature_;
}

} // namespace lns
} // namespace pdptw
