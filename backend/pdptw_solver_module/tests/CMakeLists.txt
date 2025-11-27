# Unit tests using Google Test
include(FetchContent)

FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.14.0
)

# For Windows: Prevent overriding the parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

# Enable testing
include(GoogleTest)

# Test executable - modular test files
add_executable(pdptw_tests
    test_main.cpp                  # All tests in one file
    test_destroy.cpp               # Destroy operators tests (Module 3)
    test_repair.cpp                # Repair operators tests (Module 4) - Fixed and enabled
    test_fleet_minimization.cpp    # Fleet Minimization tests (Module 5)
    test_lns_solver.cpp            # LNS Solver tests (Module 7 - Phase 2)
    test_io.cpp                    # I/O tests (Module 8 - Phase 3)
    test_genetic_operators_simple.cpp  # Genetic operators simple test
)

target_link_libraries(pdptw_tests
    PRIVATE
        pdptw_core
        GTest::gtest
        GTest::gtest_main
)

# Discover tests
gtest_discover_tests(pdptw_tests)
