#include "pdptw/solution/description.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <sstream>

namespace pdptw::solution {

// Mô tả solution: lưu trữ metrics và có thể khôi phục solution
SolutionDescription::SolutionDescription(const Solution &solution) {
    num_routes_ = 0;

    // Số lượng customers được phục vụ = tổng requests - requests chưa phân công
    size_t total_requests = solution.instance().num_requests();
    size_t unassigned_requests = solution.unassigned_requests().count();
    num_customers_served_ = total_requests - unassigned_requests;

    total_distance_ = solution.total_cost();

    // Tổng thời gian: tổng duration của tất cả các routes
    total_time_ = 0.0;
    for (size_t route_id = 0; route_id < solution.instance().num_vehicles(); ++route_id) {
        size_t end_vn = route_id * 2 + 1;
        const auto &ref_data = solution.fw_data()[end_vn].data;
        total_time_ += ref_data.duration();

        if (!solution.is_route_empty(route_id)) {
            num_routes_++;
        }
    }

    // Lưu itineraries để có thể khôi phục solution sau này
    itineraries_.reserve(solution.instance().num_vehicles());
    for (size_t route_id = 0; route_id < solution.instance().num_vehicles(); ++route_id) {
        itineraries_.push_back(solution.iter_route_by_vn_id(route_id * 2));
    }
}

size_t SolutionDescription::num_routes() const { return num_routes_; }
size_t SolutionDescription::num_customers_served() const { return num_customers_served_; }
double SolutionDescription::total_distance() const { return total_distance_; }
double SolutionDescription::total_time() const { return total_time_; }

std::string SolutionDescription::to_string() const {
    std::ostringstream oss;
    oss << "Solution: " << num_routes_ << " routes, "
        << num_customers_served_ << " customers served, "
        << "distance=" << total_distance_ << ", "
        << "time=" << total_time_;
    return oss.str();
}

} // namespace pdptw::solution
