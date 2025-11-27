#include "pdptw/io/sintef_solution.hpp"
#include "pdptw/solution/description.hpp"
#include <chrono>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace pdptw::io {

using namespace pdptw::solution;
using namespace pdptw::problem;

static std::string get_current_date() {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    std::tm tm;

#ifdef _WIN32
    localtime_s(&tm, &time_t);
#else
    localtime_r(&time_t, &tm);
#endif

    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%d");
    return oss.str();
}

void write_sintef_solution(
    const Solution &solution,
    const PDPTWInstance &instance,
    const std::string &filepath,
    const SINTEFSolutionMetadata &metadata) {

    std::ofstream file(filepath);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file for writing: " + filepath);
    }

    std::string instance_name = metadata.instance_name.empty()
                                    ? instance.name()
                                    : metadata.instance_name;
    std::string date = metadata.date.empty() ? get_current_date() : metadata.date;

    file << "Instance name:    " << instance_name << "\n";
    file << "Authors:          " << metadata.authors << "\n";
    file << "Date:             " << date << "\n";
    file << "Reference:        " << metadata.reference << "\n";
    file << "Solution\n";

    SolutionDescription desc(solution);
    const auto &itineraries = desc.itineraries();

    size_t route_num = 1;
    for (const auto &route : itineraries) {
        if (route.size() <= 2)
            continue;

        file << "Route " << route_num++ << " :";

        for (NodeId node_id : route) {
            NodeType node_type = instance.node_type(node_id);

            if (node_type != NodeType::Depot) {
                size_t original_id = instance.nodes()[node_id].oid();
                file << " " << original_id;
            }
        }

        file << "\n";
    }

    file.close();
}

std::string generate_sintef_filename(
    const std::string &instance_name,
    size_t num_vehicles,
    double cost) {

    std::ostringstream oss;
    oss << instance_name << "."
        << num_vehicles << "_"
        << std::fixed << std::setprecision(2) << cost
        << ".txt";
    return oss.str();
}

} // namespace pdptw::io
