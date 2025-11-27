#pragma once

#include "pdptw/refn/ref_data.hpp"
#include <cstdint>
#include <vector>

// Block-based REF data structure cho efficient solution management

namespace pdptw {
namespace problem {
class PDPTWInstance;
}

namespace solution {

// BlockNode: Block liên tục các nodes với aggregated REF data
// Cho phép O(1) concatenation của route segments
struct BlockNode {
    size_t first_node_id; // Node đầu tiên trong block
    size_t last_node_id;  // Node cuối cùng trong block
    refn::REFData data;   // REF data tổng hợp cho block

    BlockNode();
    BlockNode(size_t first, size_t last, const refn::REFData &ref_data);

    // Nối 2 blocks vào target block
    void concat_into_target(const BlockNode &other, BlockNode &target,
                            const problem::PDPTWInstance &instance) const;
};

// BlockNodes: Quản lý block nodes cho efficient route segment operations
// Cho phép: O(1) concatenation, efficient validation, lazy evaluation
class BlockNodes {
public:
    explicit BlockNodes(const problem::PDPTWInstance &instance);

    // Kiểm tra node có phải block start không
    bool is_block_start(size_t node_id) const;

    // Đánh dấu node là block start hợp lệ
    void set_block_valid(size_t node_id);

    // Vô hiệu hóa block
    void invalidate_block(size_t node_id);
    void invalidate_all();

    // Lấy block data
    const BlockNode &get_block(size_t node_id) const;
    BlockNode &get_block_mut(size_t node_id);

    size_t size() const;

    const BlockNode &operator[](size_t index) const;
    BlockNode &operator[](size_t index);

private:
    std::vector<bool> is_block_start_; ///< Tracks valid block starts
    std::vector<BlockNode> data_;      ///< Block data for each node
};

} // namespace solution
} // namespace pdptw
