#pragma once

#include "pdptw/construction/bin.hpp"
#include "pdptw/construction/insertion.hpp"
#include "pdptw/construction/kdsp.hpp"
#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"

namespace pdptw::construction {

// Chiến lược xây dựng giải pháp ban đầu
enum class ConstructionStrategy {
    SequentialInsertion, // Chèn tuần tự đơn giản
    RegretInsertion,     // Chèn dựa trên regret (ưu tiên request khó chèn)
    BinPackingFirst      // Bin packing trước, sau đó chèn
};

// Constructor - xây dựng giải pháp PDPTW ban đầu
class Constructor {
public:
    // Xây dựng giải pháp ban đầu theo chiến lược chỉ định
    static Solution construct(
        const PDPTWInstance &instance,
        ConstructionStrategy strategy = ConstructionStrategy::SequentialInsertion);

    // Chèn tuần tự: chèn từng request vào vị trí tốt nhất
    static Solution sequential_construction(const PDPTWInstance &instance);

    // Chèn dựa trên regret: ưu tiên request có regret cao (khó chèn)
    // Regret = chênh lệch giữa vị trí tốt nhất và tốt thứ k
    static Solution regret_construction(const PDPTWInstance &instance, size_t k = 2);

    // Bin packing trước, sau đó xây tuyến cho mỗi xe
    static Solution bin_packing_construction(const PDPTWInstance &instance);

private:
    // Xây tuyến cho xe từ danh sách request đã gán
    static void build_route_for_vehicle(
        Solution &solution,
        size_t vehicle_id,
        const std::vector<size_t> &requests);
};

} // namespace pdptw::construction
