#pragma once

#include <algorithm>
#include <stdexcept>
#include <vector>

namespace pdptw {

// Forward declaration
namespace solution {
class Solution;
}

namespace lns {

// Đếm số lần mỗi request vắng mặt (unassigned) qua các iterations
// Dùng để ưu tiên requests bị bỏ lại nhiều lần trong absence-based operators
class AbsenceCounter {
public:
    explicit AbsenceCounter(size_t num_requests);

    // Cập nhật counters dựa trên solution hiện tại (tăng counter cho mỗi request chưa assign)
    void update(const solution::Solution &solution);

    // Lấy absence count của 1 request
    size_t get_absence(size_t request_id) const;

    // Lấy tất cả requests sắp xếp theo absence count (cao → thấp)
    std::vector<size_t> get_by_absence() const;

    void reset();
    size_t size() const { return absence_counts_.size(); }

    // Tổng absence counts của các requests cụ thể
    size_t get_sum_for_requests(const std::vector<size_t> &request_ids) const;

    // Tổng absence counts của các unassigned requests trong solution
    size_t get_sum_for_unassigned(const solution::Solution &solution) const;

    // Tăng absence counters cho các requests từ iterator
    template <typename Iter>
    void increment_for_iter_requests(Iter begin, Iter end) {
        for (auto it = begin; it != end; ++it) {
            if (*it < absence_counts_.size()) {
                absence_counts_[*it]++;
            }
        }
    }

    // Tăng absence counter cho 1 request
    void increment_single_request(size_t request_id);

private:
    std::vector<size_t> absence_counts_; // Counter cho mỗi request
};

} // namespace lns
} // namespace pdptw
