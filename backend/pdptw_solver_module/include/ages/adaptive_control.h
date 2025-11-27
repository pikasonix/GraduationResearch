#ifndef ADAPTIVE_CONTROL_H
#define ADAPTIVE_CONTROL_H

#include <map>
#include <string>
#include <vector>

namespace pdptw {

// AGES - tự động điều chỉnh tham số tìm kiếm
class AdaptiveControl {
public:
    enum class OperatorType {
        ROUTE_CROSSOVER,      // Lai ghép tuyến đường
        ORDER_CROSSOVER,      // Lai ghép thứ tự
        BEST_ROUTE_CROSSOVER, // Lai ghép tuyến tốt nhất
        MUTATE_RELOCATE,      // Đột biến: di chuyển điểm
        MUTATE_SWAP,          // Đột biến: hoán đổi
        MUTATE_SHUFFLE        // Đột biến: xáo trộn
    };

    struct Parameters {
        // Trọng số
        double initial_weight = 1.0;     // Trọng số ban đầu
        double reward_factor = 1.1;      // Hệ số thưởng khi thành công (+10%)
        double punishment_factor = 0.95; // Hệ số phạt khi thất bại (-5%)
        double min_weight = 0.1;         // Trọng số tối thiểu
        double max_weight = 10.0;        // Trọng số tối đa

        // SA
        double initial_temperature = 0.1;         // Nhiệt độ ban đầu
        double cooling_rate = 0.95;               // Hệ số làm lạnh (nhân mỗi lần)
        double min_temperature = 0.001;           // Nhiệt độ thấp nhất
        double temperature_reset_threshold = 100; // Reset sau N vòng không cải thiện

        // Quần thể
        size_t min_population_size = 5;   // Số cá thể tối thiểu
        size_t max_population_size = 20;  // Số cá thể tối đa
        size_t adjustment_frequency = 10; // Điều chỉnh sau mỗi N thế hệ

        // enable/disable adaptive features
        bool enable_operator_adaptation = true;    // Điều chỉnh trọng số toán tử
        bool enable_temperature_adaptation = true; // Điều chỉnh nhiệt độ
        bool enable_population_adaptation = false; // Điều chỉnh kích thước quần thể
    };

    // Thống kê hiệu quả của từng toán tử
    struct OperatorStats {
        std::string name;
        double weight = 1.0;
        size_t used = 0;              // Tổng số lần sử dụng
        size_t successful = 0;        // Tổng số lần thành công
        size_t recent_used = 0;       // Số lần dùng gần đây
        size_t recent_successful = 0; // Số lần thành công gần đây

        // Tỷ lệ thành công tổng thể
        double success_rate() const {
            return used > 0 ? static_cast<double>(successful) / used : 0.0;
        }

        // Tỷ lệ thành công gần đây (quan trọng hơn)
        double recent_success_rate() const {
            return recent_used > 0 ? static_cast<double>(recent_successful) / recent_used : 0.0;
        }
    };

    explicit AdaptiveControl(const Parameters &params = Parameters());

    // Ghi nhận khi sử dụng toán tử (thành công hay thất bại)
    void record_operator_usage(OperatorType op, bool improved, double improvement_delta = 0.0);

    // Lấy trọng số của toán tử
    double get_operator_weight(OperatorType op) const;
    std::map<OperatorType, double> get_all_weights() const;

    // Chọn toán tử theo trọng số (Roulette wheel selection)
    OperatorType select_operator() const;

    // Cập nhật trọng số dựa trên hiệu quả gần đây
    void update_operator_weights();

    // Quản lý nhiệt độ
    double get_temperature() const { return temperature_; }
    void cool_temperature();                                         // Giảm nhiệt độ
    void reset_temperature();                                        // Reset về nhiệt độ ban đầu
    void update_temperature(size_t generations_without_improvement); // Cập nhật dựa trên tiến trình

    // Điều khiển kích thước quần thể
    size_t get_recommended_population_size(double current_diversity) const;
    void update_population_size(size_t current_size, double current_diversity, double improvement_rate);

    // Thống kê
    std::vector<OperatorStats> get_operator_statistics() const;
    std::string get_statistics_string() const;
    void reset();              // Reset tất cả thống kê
    void clear_recent_stats(); // Xóa thống kê cửa sổ gần đây

private:
    Parameters params_;

    // Theo dõi hiệu quả toán tử
    std::map<OperatorType, OperatorStats> operator_stats_;

    // Điều khiển nhiệt độ
    double temperature_;
    size_t temperature_update_counter_ = 0;

    // Điều khiển kích thước quần thể
    size_t recommended_population_size_;
    size_t adaptation_counter_ = 0;

    void initialize_operators();                           // Khởi tạo toán tử
    double clamp_weight(double weight) const;              // Giới hạn trọng số trong khoảng hợp lệ
    static std::string get_operator_name(OperatorType op); // Lấy tên toán tử
};

} // namespace pdptw

#endif // ADAPTIVE_CONTROL_H
