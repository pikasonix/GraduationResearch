#include "ages/adaptive_control.h"
#include <gtest/gtest.h>

using namespace pdptw;

class AdaptiveControlTest : public ::testing::Test {
protected:
    void SetUp() override {
        params_ = AdaptiveControl::Parameters();
        adaptive_ = std::make_unique<AdaptiveControl>(params_);
    }

    AdaptiveControl::Parameters params_;
    std::unique_ptr<AdaptiveControl> adaptive_;
};

TEST_F(AdaptiveControlTest, InitialWeights) {
    // All operators should start with initial weight
    auto weights = adaptive_->get_all_weights();

    EXPECT_EQ(weights.size(), 6); // 6 operators

    for (const auto &[op, weight] : weights) {
        EXPECT_DOUBLE_EQ(weight, params_.initial_weight);
    }
}

TEST_F(AdaptiveControlTest, RecordSuccess) {
    auto initial_weight = adaptive_->get_operator_weight(
        AdaptiveControl::OperatorType::ROUTE_CROSSOVER);

    // Record successful usage
    adaptive_->record_operator_usage(
        AdaptiveControl::OperatorType::ROUTE_CROSSOVER, true, 10.0);

    auto new_weight = adaptive_->get_operator_weight(
        AdaptiveControl::OperatorType::ROUTE_CROSSOVER);

    // Weight should increase after success
    EXPECT_GT(new_weight, initial_weight);
}

TEST_F(AdaptiveControlTest, RecordFailure) {
    auto initial_weight = adaptive_->get_operator_weight(
        AdaptiveControl::OperatorType::MUTATE_RELOCATE);

    // Record failed usage
    adaptive_->record_operator_usage(
        AdaptiveControl::OperatorType::MUTATE_RELOCATE, false, 0.0);

    auto new_weight = adaptive_->get_operator_weight(
        AdaptiveControl::OperatorType::MUTATE_RELOCATE);

    // Weight should decrease after failure
    EXPECT_LT(new_weight, initial_weight);
}

TEST_F(AdaptiveControlTest, WeightClamping) {
    // Record many successes
    for (int i = 0; i < 100; ++i) {
        adaptive_->record_operator_usage(
            AdaptiveControl::OperatorType::ORDER_CROSSOVER, true, 5.0);
    }

    auto weight = adaptive_->get_operator_weight(
        AdaptiveControl::OperatorType::ORDER_CROSSOVER);

    // Weight should be clamped to max
    EXPECT_LE(weight, params_.max_weight);

    // Record many failures
    for (int i = 0; i < 100; ++i) {
        adaptive_->record_operator_usage(
            AdaptiveControl::OperatorType::MUTATE_SHUFFLE, false, 0.0);
    }

    weight = adaptive_->get_operator_weight(
        AdaptiveControl::OperatorType::MUTATE_SHUFFLE);

    // Weight should be clamped to min
    EXPECT_GE(weight, params_.min_weight);
}

TEST_F(AdaptiveControlTest, TemperatureCooling) {
    double initial_temp = adaptive_->get_temperature();

    adaptive_->cool_temperature();

    double cooled_temp = adaptive_->get_temperature();

    EXPECT_LT(cooled_temp, initial_temp);
    EXPECT_GE(cooled_temp, params_.min_temperature);
}

TEST_F(AdaptiveControlTest, TemperatureReset) {
    // Cool down temperature
    for (int i = 0; i < 10; ++i) {
        adaptive_->cool_temperature();
    }

    double cooled_temp = adaptive_->get_temperature();
    EXPECT_LT(cooled_temp, params_.initial_temperature);

    // Reset
    adaptive_->reset_temperature();

    EXPECT_DOUBLE_EQ(adaptive_->get_temperature(), params_.initial_temperature);
}

TEST_F(AdaptiveControlTest, UpdateTemperatureOnStagnation) {
    double initial_temp = adaptive_->get_temperature();

    // Cool down first
    for (int i = 0; i < 10; ++i) {
        adaptive_->cool_temperature();
    }

    EXPECT_LT(adaptive_->get_temperature(), initial_temp);

    // Report stagnation
    adaptive_->update_temperature(100); // Exceeds threshold

    // Temperature should reset
    EXPECT_DOUBLE_EQ(adaptive_->get_temperature(), params_.initial_temperature);
}

TEST_F(AdaptiveControlTest, OperatorSelection) {
    // Record different success rates for operators
    for (int i = 0; i < 10; ++i) {
        adaptive_->record_operator_usage(
            AdaptiveControl::OperatorType::ROUTE_CROSSOVER, true, 5.0);
    }

    for (int i = 0; i < 10; ++i) {
        adaptive_->record_operator_usage(
            AdaptiveControl::OperatorType::MUTATE_SWAP, false, 0.0);
    }

    // Select operators multiple times
    std::map<AdaptiveControl::OperatorType, int> selections;
    for (int i = 0; i < 100; ++i) {
        auto selected = adaptive_->select_operator();
        selections[selected]++;
    }

    // ROUTE_CROSSOVER should be selected more often (higher weight)
    EXPECT_GT(selections[AdaptiveControl::OperatorType::ROUTE_CROSSOVER],
              selections[AdaptiveControl::OperatorType::MUTATE_SWAP]);
}

TEST_F(AdaptiveControlTest, Statistics) {
    // Record some operations
    adaptive_->record_operator_usage(
        AdaptiveControl::OperatorType::ROUTE_CROSSOVER, true, 10.0);
    adaptive_->record_operator_usage(
        AdaptiveControl::OperatorType::ROUTE_CROSSOVER, false, 0.0);
    adaptive_->record_operator_usage(
        AdaptiveControl::OperatorType::MUTATE_RELOCATE, true, 5.0);

    auto stats = adaptive_->get_operator_statistics();

    EXPECT_EQ(stats.size(), 6);

    // Check ROUTE_CROSSOVER stats
    bool found_crossover = false;
    for (const auto &stat : stats) {
        if (stat.name == "Route Crossover") {
            found_crossover = true;
            EXPECT_EQ(stat.used, 2);
            EXPECT_EQ(stat.successful, 1);
            EXPECT_DOUBLE_EQ(stat.success_rate(), 0.5);
        }
    }

    EXPECT_TRUE(found_crossover);
}

TEST_F(AdaptiveControlTest, Reset) {
    // Make changes
    adaptive_->record_operator_usage(
        AdaptiveControl::OperatorType::ROUTE_CROSSOVER, true, 10.0);
    adaptive_->cool_temperature();

    // Reset
    adaptive_->reset();

    // Everything should be back to initial
    EXPECT_DOUBLE_EQ(adaptive_->get_temperature(), params_.initial_temperature);

    auto weights = adaptive_->get_all_weights();
    for (const auto &[op, weight] : weights) {
        EXPECT_DOUBLE_EQ(weight, params_.initial_weight);
    }
}

TEST_F(AdaptiveControlTest, PopulationSizeRecommendation) {
    // Low diversity should increase recommendation
    size_t low_div_size = adaptive_->get_recommended_population_size(0.1);

    // High diversity can reduce
    size_t high_div_size = adaptive_->get_recommended_population_size(0.7);

    // With adaptation disabled, should return same value
    if (!params_.enable_population_adaptation) {
        EXPECT_EQ(low_div_size, high_div_size);
    }
}
