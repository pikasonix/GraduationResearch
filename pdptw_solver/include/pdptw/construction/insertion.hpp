#ifndef PDPTW_CONSTRUCTION_INSERTION_HPP
#define PDPTW_CONSTRUCTION_INSERTION_HPP

#include "../problem/pdptw.hpp"
#include "../solution/datastructure.hpp"
#include <limits>
#include <vector>

namespace pdptw::construction {

using pdptw::problem::Num;
using pdptw::problem::PDPTWInstance;

// Chiến lược chèn request
enum class InsertionStrategy {
    BestCost,  // Tối thiểu hóa tăng chi phí
    Regret2,   // 2-regret (chênh lệch giữa tốt nhất và tốt thứ 2)
    Regret3,   // 3-regret (chênh lệch giữa tốt nhất và tốt thứ 3)
    Sequential // Chèn tuần tự đơn giản
};

// Ứng viên chèn cho một request
struct InsertionCandidate {
    size_t request_id;     // Request cần chèn
    size_t vehicle_id;     // Xe để chèn vào
    size_t pickup_after;   // Chèn pickup sau VN này
    size_t delivery_after; // Chèn delivery sau VN này
    Num cost_increase;     // Tăng chi phí tuyến
    Num regret_value;      // Giá trị regret
    bool feasible;         // Chèn có khả thi không

    InsertionCandidate()
        : request_id(0), vehicle_id(0), pickup_after(0), delivery_after(0),
          cost_increase(std::numeric_limits<Num>::infinity()),
          regret_value(0.0), feasible(false) {}

    InsertionCandidate(size_t req, size_t veh,
                       size_t p_after, size_t d_after,
                       Num cost, bool feas = true)
        : request_id(req), vehicle_id(veh),
          pickup_after(p_after), delivery_after(d_after),
          cost_increase(cost), regret_value(0.0), feasible(feas) {}

    bool operator<(const InsertionCandidate &other) const {
        return cost_increase < other.cost_increase;
    }
};

// Heuristic chèn request vào giải pháp PDPTW
class Insertion {
public:
    // Tìm vị trí chèn tốt nhất cho request
    static InsertionCandidate find_best_insertion(
        const solution::Solution &solution,
        size_t request_id,
        InsertionStrategy strategy = InsertionStrategy::BestCost);

    // Tính tăng chi phí khi chèn request vào vị trí cụ thể
    static Num calculate_insertion_cost(
        const solution::Solution &solution,
        size_t request_id,
        size_t vehicle_id,
        size_t pickup_after,
        size_t delivery_after);

    // Kiểm tra chèn có khả thi không (time window, capacity, precedence)
    static bool is_feasible_insertion(
        const solution::Solution &solution,
        size_t request_id,
        size_t vehicle_id,
        size_t pickup_after,
        size_t delivery_after);

    // Thực hiện chèn request theo ứng viên đã chọn
    static void insert_request(
        solution::Solution &solution,
        const InsertionCandidate &candidate);

    // Tính k-regret cho các request chưa gán
    static std::vector<InsertionCandidate> calculate_regret(
        const solution::Solution &solution,
        const std::vector<size_t> &unassigned_requests,
        size_t k = 2);

private:
    /**
     * @brief Find all feasible insertions for a request
     *
     * @param solution Current solution
     * @param request_id Request to insert
     * @return Vector of all feasible insertion candidates
     */
    static std::vector<InsertionCandidate> find_all_insertions(
        const solution::Solution &solution,
        size_t request_id);

    /**
     * @brief Get VN ID for a request's pickup node
     *
     * @param instance Problem instance
     * @param request_id Request ID
     * @return VN ID of pickup node
     */
    static size_t get_pickup_vn(const PDPTWInstance &instance,
                                size_t request_id);

    /**
     * @brief Get VN ID for a request's delivery node
     *
     * @param instance Problem instance
     * @param request_id Request ID
     * @return VN ID of delivery node
     */
    static size_t get_delivery_vn(const PDPTWInstance &instance,
                                  size_t request_id);
};

} // namespace pdptw::construction

#endif // PDPTW_CONSTRUCTION_INSERTION_HPP
