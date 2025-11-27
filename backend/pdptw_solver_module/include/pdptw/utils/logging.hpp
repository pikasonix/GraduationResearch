#pragma once

#include <memory>
#include <string>

namespace pdptw::utils {

// Khởi tạo logging system (sử dụng spdlog)
void init_logging(const std::string &level = "info");

// Shutdown logging system
void shutdown_logging();

} // namespace pdptw::utils
