// Bin packing cho PDPTW - gán request vào xe dựa trên ràng buộc capacity

#ifndef PDPTW_CONSTRUCTION_BIN_HPP
#define PDPTW_CONSTRUCTION_BIN_HPP

#include "pdptw/problem/pdptw.hpp"
#include <algorithm>
#include <vector>

namespace pdptw {
namespace construction {

using Num = problem::Num;
using problem::PDPTWInstance;

// Bin (xe) với các request đã gán - theo dõi capacity và routing cost
struct Bin {
    size_t vehicle_id;            // ID xe
    std::vector<size_t> requests; // Các request đã gán
    Num total_load;               // Tải trọng hiện tại
    Num capacity;                 // Sức chứa tối đa
    Num estimated_cost;           // Chi phí routing ước tính

    Bin(size_t vid, Num cap)
        : vehicle_id(vid), total_load(0), capacity(cap), estimated_cost(0) {}

    // Kiểm tra request có vừa vào bin không
    bool can_fit(const PDPTWInstance &instance, size_t request_id) const;

    // Thêm request vào bin
    void add_request(const PDPTWInstance &instance, size_t request_id);

    Num remaining_capacity() const { return capacity - total_load; }
    bool empty() const { return requests.empty(); }
    size_t size() const { return requests.size(); }
};

// Thuật toán bin packing để gán request vào xe
class BinPacking {
public:
    // First Fit Decreasing: sắp xếp theo demand giảm dần, gán vào bin đầu tiên vừa
    static std::vector<Bin> first_fit_decreasing(
        const PDPTWInstance &instance,
        const std::vector<size_t> &requests);

    // Best Fit Decreasing: sắp xếp theo demand giảm dần, gán vào bin có capacity còn lại ít nhất
    static std::vector<Bin> best_fit_decreasing(
        const PDPTWInstance &instance,
        const std::vector<size_t> &requests);

    // Lấy tổng demand của request
    static Num get_request_demand(
        const PDPTWInstance &instance,
        size_t request_id);

private:
    // Sắp xếp request theo demand giảm dần
    static std::vector<size_t> sort_by_demand(
        const PDPTWInstance &instance,
        const std::vector<size_t> &requests);
};

} // namespace construction
} // namespace pdptw

#endif // PDPTW_CONSTRUCTION_BIN_HPP
