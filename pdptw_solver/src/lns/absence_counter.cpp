#include "pdptw/lns/absence_counter.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <numeric>

namespace pdptw {
namespace lns {

AbsenceCounter::AbsenceCounter(size_t num_requests)
    : absence_counts_(num_requests, 0) {
}

void AbsenceCounter::update(const solution::Solution &solution) {
    const auto &request_bank = solution.unassigned_requests();

    for (size_t req_id = 0; req_id < absence_counts_.size(); ++req_id) {
        if (request_bank.contains_request(req_id)) {
            ++absence_counts_[req_id];
        }
    }
}

size_t AbsenceCounter::get_absence(size_t request_id) const {
    if (request_id >= absence_counts_.size()) {
        throw std::out_of_range("Request ID out of range");
    }
    return absence_counts_[request_id];
}

std::vector<size_t> AbsenceCounter::get_by_absence() const {
    std::vector<std::pair<size_t, size_t>> pairs;
    pairs.reserve(absence_counts_.size());

    for (size_t i = 0; i < absence_counts_.size(); ++i) {
        pairs.emplace_back(i, absence_counts_[i]);
    }

    std::sort(pairs.begin(), pairs.end(),
              [](const auto &a, const auto &b) {
                  return a.second > b.second;
              });

    std::vector<size_t> result;
    result.reserve(pairs.size());
    for (const auto &pair : pairs) {
        result.push_back(pair.first);
    }

    return result;
}

void AbsenceCounter::reset() {
    std::fill(absence_counts_.begin(), absence_counts_.end(), 0);
}

size_t AbsenceCounter::get_sum_for_requests(const std::vector<size_t> &request_ids) const {
    size_t sum = 0;
    for (size_t req_id : request_ids) {
        if (req_id < absence_counts_.size()) {
            sum += absence_counts_[req_id];
        }
    }
    return sum;
}

size_t AbsenceCounter::get_sum_for_unassigned(const solution::Solution &solution) const {
    const auto &request_bank = solution.unassigned_requests();
    size_t sum = 0;

    for (size_t req_id = 0; req_id < absence_counts_.size(); ++req_id) {
        if (request_bank.contains_request(req_id)) {
            sum += absence_counts_[req_id];
        }
    }
    return sum;
}

void AbsenceCounter::increment_single_request(size_t request_id) {
    if (request_id < absence_counts_.size()) {
        ++absence_counts_[request_id];
    }
}

} // namespace lns
} // namespace pdptw
