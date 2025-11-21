#pragma once

#include "pdptw/problem/pdptw.hpp"
#include <string>

/**
 * @file li_lim_reader.hpp
 * @brief Reader for Li & Lim / SINTEF PDPTW instance format
 *
 * Format specification from https://www.sintef.no/projectweb/top/pdptw/documentation/
 *
 * Line 1: NUMBER_OF_VEHICLES  VEHICLE_CAPACITY  SPEED(not used)
 *         K   Q   S
 *
 * Remaining lines (tab-separated):
 * TASK_NO.  X  Y  DEMAND  EARLIEST_TIME  LATEST_TIME  SERVICE_TIME  PICKUP  DELIVERY
 * 0         x0 y0 q0      e0             l0           s0            p0      d0
 * 1         x1 y1 q1      e1             l1           s1            p1      d1
 * ...
 *
 * Task 0 is the depot. For pickup tasks, PICKUP=0 and DELIVERY gives sibling index.
 * For delivery tasks, PICKUP gives sibling index.
 * Travel time equals distance (Euclidean).
 */

namespace pdptw::io {

/**
 * @brief Load PDPTW instance from Li & Lim / SINTEF format file
 *
 * @param filepath Path to instance file
 * @param max_vehicles Maximum number of vehicles (if 0, uses num_requests as default)
 * @return PDPTWInstance Loaded instance
 * @throws std::runtime_error if file cannot be read or format is invalid
 */
problem::PDPTWInstance load_li_lim_instance(
    const std::string &filepath,
    size_t max_vehicles = 0);

} // namespace pdptw::io
