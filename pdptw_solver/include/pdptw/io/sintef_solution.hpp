#pragma once

#include "pdptw/problem/pdptw.hpp"
#include "pdptw/solution/datastructure.hpp"
#include <string>
#include <vector>

/**
 * @file sintef_solution.hpp
 * @brief Writer for SINTEF solution format
 *
 * Format specification from SINTEF TOP website:
 * https://www.sintef.no/projectweb/top/pdptw/
 *
 * Header with four fields:
 * Instance name:    <name>
 * Authors:          <authors>
 * Date:             <yyyy-mm-dd>
 * Reference:        <reference>
 *
 * Followed by:
 * Solution
 * Route 1 : n1 n2 n3 ... nk
 * Route 2 : ...
 *
 * NOTE: Depot is NOT included in route output.
 *
 * Filename convention: <instance_name>.<num_vehicles>_<cost>.txt
 * Example: lc101.10_828.32.txt
 */

namespace pdptw::io {

/**
 * @brief Solution metadata for SINTEF format
 */
struct SINTEFSolutionMetadata {
    std::string instance_name = "";
    std::string authors = "PDPTW Solver";
    std::string date = ""; // yyyy-mm-dd format
    std::string reference = "";
};

/**
 * @brief Write solution to SINTEF format file
 *
 * @param solution Solution to write
 * @param instance Instance (for extracting metadata)
 * @param filepath Output file path
 * @param metadata Solution metadata (author, date, reference)
 * @throws std::runtime_error if file cannot be written
 */
void write_sintef_solution(
    const solution::Solution &solution,
    const problem::PDPTWInstance &instance,
    const std::string &filepath,
    const SINTEFSolutionMetadata &metadata = {});

/**
 * @brief Generate SINTEF solution filename from instance and solution
 *
 * Convention: <instance_name>.<num_vehicles>_<cost>.txt
 *
 * @param instance_name Base instance name (e.g., "lc101")
 * @param num_vehicles Number of vehicles used
 * @param cost Total solution cost
 * @return std::string Generated filename
 */
std::string generate_sintef_filename(
    const std::string &instance_name,
    size_t num_vehicles,
    double cost);

} // namespace pdptw::io
