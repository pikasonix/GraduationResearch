cmake_minimum_required(VERSION 3.15)
project(pdptw_solver VERSION 0.1.0 LANGUAGES CXX)

# C++ Standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler settings
if(MSVC)
    add_compile_options(/W4 /permissive-)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

option(ENABLE_CLASSIC_PDPTW "Enable classic PDPTW mode" OFF)
option(ENABLE_PARALLEL "Enable parallel processing with TBB/OpenMP" OFF)
option(ENABLE_GUROBI "Enable Gurobi optimizer" OFF)
option(ENABLE_PROGRESS_BAR "Enable progress bars" ON)
option(ENABLE_TIMED_LOGGER "Enable timed solution logger" OFF)
option(DISABLE_DECOMPOSITION "Disable decomposition" OFF)
option(ENABLE_PROGRESS_TRACKING "Enable progress tracking" OFF)
option(ENABLE_MOVE_ASSERTS "Enable assertions when applying moves" OFF)
option(ENABLE_SEARCH_ASSERTS "Enable assertions for search state" OFF)
option(BUILD_TESTS "Build unit tests" ON)
option(BUILD_BENCHMARKS "Build benchmarks" OFF)

# Add FetchContent for dependencies
include(FetchContent)

# spdlog for logging
FetchContent_Declare(
    spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG v1.12.0
)

# CLI11 for command-line parsing
FetchContent_Declare(
    cli11
    GIT_REPOSITORY https://github.com/CLIUtils/CLI11.git
    GIT_TAG v2.4.2
)

# nlohmann/json for JSON
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)

# toml++ for TOML parsing
FetchContent_Declare(
    tomlplusplus
    GIT_REPOSITORY https://github.com/marzer/tomlplusplus.git
    GIT_TAG v3.4.0
)

FetchContent_MakeAvailable(spdlog cli11 json tomlplusplus)

# Optional: Progress indicators
if(ENABLE_PROGRESS_BAR)
    FetchContent_Declare(
        indicators
        GIT_REPOSITORY https://github.com/p-ranav/indicators.git
        GIT_TAG v2.3
    )
    FetchContent_MakeAvailable(indicators)
endif()

# Optional: Intel TBB for parallelism
if(ENABLE_PARALLEL)
    find_package(TBB)
    if(NOT TBB_FOUND)
        message(STATUS "TBB not found, trying to fetch...")
        FetchContent_Declare(
            tbb
            GIT_REPOSITORY https://github.com/oneapi-src/oneTBB.git
            GIT_TAG v2021.10.0
        )
        FetchContent_MakeAvailable(tbb)
    endif()
endif()

# OpenMP for parallel processing
find_package(OpenMP)
if(OpenMP_CXX_FOUND)
    message(STATUS "OpenMP found: ${OpenMP_CXX_VERSION}")
else()
    message(WARNING "OpenMP not found - parallel features will be disabled")
endif()

# Optional: Gurobi
if(ENABLE_GUROBI)
    find_package(GUROBI REQUIRED)
endif()

# Local libraries
add_subdirectory(libs)

# Main library
add_subdirectory(src)

# Applications
add_subdirectory(apps)

# Tests
if(BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

# Installation rules
install(TARGETS pdptw_core
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
)

install(DIRECTORY include/pdptw
    DESTINATION include
)
