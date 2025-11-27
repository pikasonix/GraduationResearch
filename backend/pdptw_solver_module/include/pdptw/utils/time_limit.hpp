#pragma once

#include <chrono>
#include <limits>

namespace pdptw::utils {

// TimeLimit:
class TimeLimit {
private:
    std::chrono::steady_clock::time_point start_time;
    double limit_seconds;

public:
    // Tạo time limit tracker (seconds = 0 → không giới hạn)
    explicit TimeLimit(double seconds = 0.0)
        : start_time(std::chrono::steady_clock::now()),
          limit_seconds(seconds) {}

    // Kiểm tra đã vượt time limit chưa
    bool is_finished() const {
        if (limit_seconds <= 0.0) {
            return false; // No limit
        }

        auto now = std::chrono::steady_clock::now();
        double elapsed = std::chrono::duration<double>(now - start_time).count();
        return elapsed >= limit_seconds;
    }

    // Lấy thời gian đã trôi qua (seconds)
    double elapsed_seconds() const {
        auto now = std::chrono::steady_clock::now();
        return std::chrono::duration<double>(now - start_time).count();
    }

    // Lấy thời gian còn lại (infinity nếu không giới hạn)
    double remaining_seconds() const {
        if (limit_seconds <= 0.0) {
            return std::numeric_limits<double>::infinity();
        }

        auto now = std::chrono::steady_clock::now();
        double elapsed = std::chrono::duration<double>(now - start_time).count();
        double remaining = limit_seconds - elapsed;
        return remaining > 0.0 ? remaining : 0.0;
    }

    // Kiểm tra còn thời gian không
    bool has_time_remaining() const {
        return !is_finished();
    }
};

} // namespace pdptw::utils
