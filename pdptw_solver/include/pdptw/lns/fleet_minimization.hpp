#pragma once

#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include "pdptw/solution/description.hpp"
#include <optional>
#include <random>

// Fleet Minimization sử dụng LNS: giảm thiểu số xe (fleet size) trong khi duy trì tính khả thi
//
// Thuật toán:
// 1. Bắt đầu với solution khả thi
// 2. Nếu tất cả requests đã được phục vụ (0 unassigned):
//    → Loại bỏ route có tổng absence count thấp nhất
// 3. Chạy LNS iterations:
//    → Destroy: Loại bỏ requests
//    → Repair: Chèn lại requests
//    → Chấp nhận nếu cải thiện
// 4. Khi khả thi trở lại, lặp lại bước 2

namespace pdptw::lns {

using PDPTWInstance = pdptw::problem::PDPTWInstance;
using Solution = pdptw::solution::Solution;
using SolutionDescription = pdptw::solution::SolutionDescription;

// Tham số LNS cho fleet minimization
struct FleetMinimizationParameters {
    size_t max_iterations;     // Số iterations tối đa
    size_t min_destroy;        // Số requests destroy tối thiểu
    size_t max_destroy;        // Số requests destroy tối đa
    double time_limit_seconds; // Giới hạn thời gian (0 = không giới hạn)

    // Tạo tham số mặc định dựa trên kích thước bài toán
    static FleetMinimizationParameters default_params(size_t num_requests) {
        return FleetMinimizationParameters{
            200,                                    // max_iterations
            std::max<size_t>(5, num_requests / 20), // min_destroy (5% or min 5)
            std::max<size_t>(20, num_requests / 5), // max_destroy (20% or min 20)
            0.0                                     // no time limit
        };
    }
};

// Kết quả fleet minimization
struct FleetMinimizationResult {
    Solution solution;                       // Solution cuối cùng
    std::optional<SolutionDescription> best; // Solution tốt nhất tìm được
    AbsenceCounter absence_counter;          // Absence counts cuối cùng
    size_t iterations_performed;             // Số iterations đã thực hiện
    bool time_limit_reached;                 // Có vượt giới hạn thời gian không
};

// Fleet Minimization LNS: giảm thiểu số xe sử dụng trong khi duy trì tính khả thi
class FleetMinimizationLNS {
public:
    FleetMinimizationLNS(
        const PDPTWInstance &instance,
        const FleetMinimizationParameters &params);

    // Chạy fleet minimization từ solution ban đầu
    FleetMinimizationResult run(
        Solution initial_solution,
        std::mt19937 &rng,
        std::optional<AbsenceCounter> initial_absence = std::nullopt);

private:
    // Giảm số routes bằng cách loại bỏ 1 route
    // Loại route có tổng absence count thấp nhất (requests được assign thường xuyên)
    // Sau đó giới hạn max vehicles = fleet size hiện tại
    void reduce_number_of_routes(
        Solution &solution,
        const AbsenceCounter &absence);

    // Lấy số requests cần destroy ngẫu nhiên (trong khoảng min_destroy..max_destroy)
    size_t sample_destroy_count(std::mt19937 &rng) const;

    const PDPTWInstance *instance_;
    FleetMinimizationParameters params_;
};

} // namespace pdptw::lns
