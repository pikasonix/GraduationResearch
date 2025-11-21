#pragma once

#include <memory>
#include <vector>

namespace pdptw::problem {

// Ma trận lưu trữ thời gian và khoảng cách di chuyển giữa các địa điểm
class TravelMatrix {
public:
    TravelMatrix() = default;
    explicit TravelMatrix(size_t size);

    // Lấy thời gian/khoảng cách di chuyển
    double get_time(size_t from, size_t to) const;
    double get_distance(size_t from, size_t to) const;

    // Đặt thời gian/khoảng cách di chuyển
    void set_time(size_t from, size_t to, double time);
    void set_distance(size_t from, size_t to, double distance);

    size_t size() const;

private:
    std::vector<std::vector<double>> times_;
    std::vector<std::vector<double>> distances_;
    size_t size_ = 0;
};

} // namespace pdptw::problem
