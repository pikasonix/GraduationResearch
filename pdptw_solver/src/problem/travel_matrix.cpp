#include "pdptw/problem/travel_matrix.hpp"
#include <stdexcept>

namespace pdptw::problem {

TravelMatrix::TravelMatrix(size_t size)
    : times_(size, std::vector<double>(size, 0.0)),
      distances_(size, std::vector<double>(size, 0.0)),
      size_(size) {}

double TravelMatrix::get_time(size_t from, size_t to) const {
    if (from >= size_ || to >= size_) {
        throw std::out_of_range("Index out of range in TravelMatrix");
    }
    return times_[from][to];
}

double TravelMatrix::get_distance(size_t from, size_t to) const {
    if (from >= size_ || to >= size_) {
        throw std::out_of_range("Index out of range in TravelMatrix");
    }
    return distances_[from][to];
}

void TravelMatrix::set_time(size_t from, size_t to, double time) {
    if (from >= size_ || to >= size_) {
        throw std::out_of_range("Index out of range in TravelMatrix");
    }
    times_[from][to] = time;
}

void TravelMatrix::set_distance(size_t from, size_t to, double distance) {
    if (from >= size_ || to >= size_) {
        throw std::out_of_range("Index out of range in TravelMatrix");
    }
    distances_[from][to] = distance;
}

size_t TravelMatrix::size() const {
    return size_;
}

} // namespace pdptw::problem
