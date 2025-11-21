#pragma once

#include <algorithm>
#include <cmath>
#include <limits>

namespace pdptw::utils {

constexpr double EPSILON = 1e-9;

// Kiểm tra 2 số floating point có gần bằng nhau không
inline bool approx_equal(double a, double b, double eps = EPSILON) {
    return std::abs(a - b) < eps;
}

// Kiểm tra a < b (với tolerance)
inline bool less_than(double a, double b, double eps = EPSILON) {
    return a < b - eps;
}

// Kiểm tra a > b (với tolerance)
inline bool greater_than(double a, double b, double eps = EPSILON) {
    return a > b + eps;
}

// Clamp value giữa min và max
template <typename T>
inline T clamp(T value, T min_val, T max_val) {
    return std::max(min_val, std::min(value, max_val));
}

} // namespace pdptw::utils
