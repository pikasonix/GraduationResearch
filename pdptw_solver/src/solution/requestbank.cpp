#include "pdptw/solution/requestbank.hpp"
#include "pdptw/problem/pdptw.hpp"

namespace pdptw::solution {

// RequestBank: quản lý tập các requests chưa được phân công

RequestBank::RequestBank(const problem::PDPTWInstance &instance)
    : instance_(&instance), penalty_per_entry_(10000.0) {
    // Khởi tạo với tất cả requests ở trạng thái unassigned
    requests_.resize(instance.num_requests(), true);
}

// Chuyển đổi pickup_id thành request_id
size_t RequestBank::pickup_to_request_id(size_t pickup_id) const {
    return (pickup_id / 2) - instance_->num_vehicles();
}

// Chuyển đổi request_id thành pickup_id
size_t RequestBank::request_to_pickup_id(size_t request_id) const {
    return (request_id + instance_->num_vehicles()) * 2;
}

std::vector<size_t> RequestBank::iter_request_ids() const {
    std::vector<size_t> result;
    for (size_t i = 0; i < requests_.size(); ++i) {
        if (requests_[i]) {
            result.push_back(i);
        }
    }
    return result;
}

std::vector<size_t> RequestBank::iter_pickup_ids() const {
    std::vector<size_t> result;
    for (size_t i = 0; i < requests_.size(); ++i) {
        if (requests_[i]) {
            result.push_back(request_to_pickup_id(i));
        }
    }
    return result;
}

void RequestBank::insert_pickup_id(size_t pickup_id) {
    size_t request_id = pickup_to_request_id(pickup_id);
    if (request_id < requests_.size()) {
        requests_[request_id] = true;
    }
}

void RequestBank::remove(size_t pickup_id) {
    size_t request_id = pickup_to_request_id(pickup_id);
    if (request_id < requests_.size()) {
        requests_[request_id] = false;
    }
}

bool RequestBank::contains(size_t pickup_id) const {
    size_t request_id = pickup_to_request_id(pickup_id);
    return request_id < requests_.size() && requests_[request_id];
}

bool RequestBank::contains_request(size_t request_id) const {
    return request_id < requests_.size() && requests_[request_id];
}

size_t RequestBank::count() const {
    size_t cnt = 0;
    for (bool assigned : requests_) {
        if (assigned)
            ++cnt;
    }
    return cnt;
}

void RequestBank::clear() {
    std::fill(requests_.begin(), requests_.end(), false);
}

void RequestBank::set_all() {
    std::fill(requests_.begin(), requests_.end(), true);
}

bool RequestBank::is_subset(const RequestBank &other) const {
    if (requests_.size() != other.requests_.size()) {
        return false;
    }
    for (size_t i = 0; i < requests_.size(); ++i) {
        if (requests_[i] && !other.requests_[i]) {
            return false;
        }
    }
    return true;
}

double RequestBank::penalty_per_entry() const {
    return penalty_per_entry_;
}

void RequestBank::set_penalty_per_entry(double penalty) {
    penalty_per_entry_ = penalty;
}

double RequestBank::total_penalty() const {
    return count() * penalty_per_entry_;
}

} // namespace pdptw::solution
