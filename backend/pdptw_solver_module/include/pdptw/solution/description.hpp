#pragma once

#include <string>
#include <vector>

namespace pdptw::solution {

class Solution;

// SolutionDescription: Thống kê và chất lượng solution
// Lưu metrics và route structure để khôi phục solution về trạng thái này sau
class SolutionDescription {
public:
    SolutionDescription() = default;
    explicit SolutionDescription(const Solution &solution);

    size_t num_routes() const;
    size_t num_customers_served() const;
    double total_distance() const;
    double total_time() const;

    // Lấy route itineraries (vector routes, mỗi route là vector node IDs)
    const std::vector<std::vector<size_t>> &itineraries() const { return itineraries_; }

    std::string to_string() const;

private:
    size_t num_routes_ = 0;
    size_t num_customers_served_ = 0;
    double total_distance_ = 0.0;
    double total_time_ = 0.0;
    std::vector<std::vector<size_t>> itineraries_; // Route structures để khôi phục
};

} // namespace pdptw::solution
