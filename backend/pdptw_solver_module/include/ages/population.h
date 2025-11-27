#ifndef POPULATION_H
#define POPULATION_H

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <algorithm>
#include <cmath>
#include <memory>
#include <vector>

namespace pdptw {

// Import types
using Solution = solution::Solution;
using Instance = problem::PDPTWInstance;

// Quản lý quần thể cho AGES - lưu trữ và quản lý nhiều giải pháp
class Population {
public:
    explicit Population(const Instance &instance,
                        size_t max_size = 10,
                        double min_diversity = 0.1);

    ~Population() = default;

    Population(const Population &other) = default;
    Population(Population &&other) noexcept = default;
    Population &operator=(const Population &other) = default;
    Population &operator=(Population &&other) noexcept = default;

    // Thêm giải pháp vào quần thể (từ chối nếu quá giống các giải pháp hiện tại)
    bool add(const Solution &solution);

    // Xóa giải pháp tại vị trí index
    bool remove(size_t index);

    // Lấy giải pháp tốt nhất (objective thấp nhất)
    const Solution *get_best() const;

    // Lấy giải pháp tệ nhất (objective cao nhất)
    const Solution *get_worst() const;

    // Lấy giải pháp tại vị trí index
    const Solution *get(size_t index) const;
    Solution *get_mutable(size_t index);

    // Tính độ đa dạng giữa 2 giải pháp (BPD - Broken Pair Distance)
    // 0 = giống hệt, 1 = khác hoàn toàn
    double calculate_diversity(const Solution &sol1, const Solution &sol2) const;

    // Tính độ đa dạng trung bình của một giải pháp so với quần thể
    double calculate_average_diversity(const Solution &solution) const;

    // Tính độ đa dạng tổng thể của quần thể (trung bình từng đôi)
    double calculate_population_diversity() const;

    size_t size() const { return solutions_.size(); }
    bool empty() const { return solutions_.empty(); }
    bool is_full() const { return solutions_.size() >= max_size_; }
    size_t max_size() const { return max_size_; }

    void clear();             // Xóa tất cả giải pháp
    void sort_by_objective(); // Sắp xếp theo objective (tốt nhất trước)

    const std::vector<Solution> &get_all() const { return solutions_; }

    // Cập nhật giải pháp tốt nhất từ trước đến nay
    bool update_best_ever();
    const Solution *get_best_ever() const;

    // Tính fitness có thưởng đa dạng: fitness = objective - diversity_weight * diversity
    double calculate_fitness(const Solution &solution, double diversity_weight = 0.1) const;

private:
    const Instance &instance_;        // Tham chiếu instance bài toán
    std::vector<Solution> solutions_; // Quần thể hiện tại
    size_t max_size_;                 // Kích thước tối đa
    double min_diversity_;            // Ngưỡng đa dạng tối thiểu

    std::unique_ptr<Solution> best_ever_; // Giải pháp tốt nhất từ trước đến nay

    // Tìm vị trí giải pháp tệ nhất
    size_t find_worst_index() const;

    // Kiểm tra giải pháp có quá giống với quần thể hiện tại không
    bool is_too_similar(const Solution &solution) const;
};

} // namespace pdptw

#endif // POPULATION_H
