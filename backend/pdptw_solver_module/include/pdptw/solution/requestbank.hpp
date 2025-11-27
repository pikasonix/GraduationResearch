#pragma once

#include <cstdint>
#include <vector>

namespace pdptw {
namespace problem {
class PDPTWInstance;
}

namespace solution {

// RequestBank: Quản lý unassigned requests trong solution
// Dùng bitset cho efficient storage, hỗ trợ: insert/remove, iterate, check containment, calculate penalties
class RequestBank {
public:
    // Khởi tạo từ instance (ban đầu tất cả requests unassigned)
    explicit RequestBank(const problem::PDPTWInstance &instance);

    // Iterator qua unassigned request IDs
    std::vector<size_t> iter_request_ids() const;

    // Iterator qua unassigned pickup node IDs
    std::vector<size_t> iter_pickup_ids() const;

    // Insert/remove request bằng pickup node ID
    void insert_pickup_id(size_t pickup_id);
    void remove(size_t pickup_id);

    // Kiểm tra request có unassigned không
    bool contains(size_t pickup_id) const;
    bool contains_request(size_t request_id) const;

    // Đếm số unassigned requests
    size_t count() const;

    // Clear all (mark all as assigned)
    void clear();

    // Set all as unassigned
    void set_all();

    // Kiểm tra subset
    bool is_subset(const RequestBank &other) const;

    // Penalty per unassigned request
    double penalty_per_entry() const;
    void set_penalty_per_entry(double penalty);

    // Tổng penalty = count * penalty_per_entry
    double total_penalty() const;

private:
    const problem::PDPTWInstance *instance_; // PDPTW instance reference
    std::vector<bool> requests_;             // Bitset cho unassigned requests
    double penalty_per_entry_;               // Penalty per unassigned request

    // Convert giữa pickup node ID và request ID
    size_t pickup_to_request_id(size_t pickup_id) const;
    size_t request_to_pickup_id(size_t request_id) const;
};

} // namespace solution
} // namespace pdptw
