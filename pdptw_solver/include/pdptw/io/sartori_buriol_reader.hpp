#pragma once

#include "pdptw/problem/pdptw.hpp"
#include <string>

namespace pdptw::io {

/**
 * @brief Load PDPTW instance from Sartori & Buriol format file
 *
 * @param filepath Path to instance file
 * @param max_vehicles Maximum number of vehicles (if 0, uses heuristic based on node count)
 * @return PDPTWInstance Loaded instance
 * @throws std::runtime_error if file cannot be read or format is invalid
 */
problem::PDPTWInstance load_sartori_buriol_instance(
    const std::string &filepath,
    size_t max_vehicles = 0);

} // namespace pdptw::io
