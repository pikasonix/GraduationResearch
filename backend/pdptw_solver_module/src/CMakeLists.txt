# Thư viện PDPTW chính
add_library(pdptw_core
    # Problem: định nghĩa bài toán
    problem/pdptw.cpp
    problem/travel_matrix.cpp
    
    # REF: Resource Extension Functions
    refn/ref_node.cpp
    refn/ref_data.cpp
    
    # Solution: cấu trúc dữ liệu solution
    solution/ref_list_node.cpp
    solution/ref_node_vec.cpp
    
    # Utils: tiện ích cơ bản
    utils/logging.cpp
    utils/num.cpp
    utils/validator.cpp
    
    # Solution: cấu trúc dữ liệu solution
    solution/datastructure.cpp
    solution/description.cpp
    solution/blocknode.cpp
    solution/requestbank.cpp
    solution/misc.cpp
    solution/permutation.cpp
    solution/k_ejection.cpp

    # Decomposition: phân tách và tái kết hợp
    decomposition/splitter.cpp
    decomposition/recombiner.cpp
    
    # Construction: giải thuật khởi tạo
    construction/insertion.cpp
    construction/kdsp.cpp
    construction/bin.cpp
    construction/constructor.cpp
    
    # LNS: Large Neighborhood Search
    lns/acceptance_criterion.cpp
    lns/absence_counter.cpp
    lns/fleet_minimization.cpp
    lns/destroy/route_removal.cpp
    lns/destroy/worst_removal.cpp
    lns/destroy/adjacent_string_removal.cpp
    lns/destroy/absence_removal.cpp
    lns/repair/greedy_insertion.cpp
    lns/repair/regret_insertion.cpp
    lns/repair/hardest_first_insertion.cpp
    lns/repair/absence_based_regret.cpp
    lns/largescale/decomposition_lns.cpp
    
    # Solver: giải thuật chính
    solver/lns_solver.cpp
    
    # I/O: đọc/ghi file
    io/li_lim_reader.cpp
    io/sartori_buriol_reader.cpp
    io/sintef_solution.cpp
    
    # AGES: Fleet Minimization (tối thiểu hóa số vehicles)
    ages/ages_solver.cpp
    ages/genetic_operators.cpp
    
    # Old AGES (Genetic Algorithm) - tạm thời vô hiệu
    # ages/population.cpp
    # ages/evolution.cpp
    # ages/adaptive_control.cpp
)

target_include_directories(pdptw_core
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(pdptw_core
    PUBLIC
        spdlog::spdlog
        nlohmann_json::nlohmann_json
        tomlplusplus::tomlplusplus
)

# Tính năng tùy chọn
if(ENABLE_PROGRESS_BAR)
    target_link_libraries(pdptw_core PUBLIC indicators::indicators)
    target_compile_definitions(pdptw_core PUBLIC ENABLE_PROGRESS_BAR)
endif()

if(ENABLE_PARALLEL)
    target_link_libraries(pdptw_core PUBLIC TBB::tbb)
    target_compile_definitions(pdptw_core PUBLIC ENABLE_PARALLEL)
endif()

if(OpenMP_CXX_FOUND)
    target_link_libraries(pdptw_core PUBLIC OpenMP::OpenMP_CXX)
    target_compile_definitions(pdptw_core PUBLIC USE_OPENMP)
endif()

if(ENABLE_GUROBI)
    target_link_libraries(pdptw_core PUBLIC ${GUROBI_CXX_LIBRARY})
    target_include_directories(pdptw_core PUBLIC ${GUROBI_INCLUDE_DIRS})
    target_compile_definitions(pdptw_core PUBLIC ENABLE_GUROBI)
endif()

# Các cờ tính năng
if(ENABLE_MOVE_ASSERTS)
    target_compile_definitions(pdptw_core PUBLIC ENABLE_MOVE_ASSERTS)
endif()

if(ENABLE_SEARCH_ASSERTS)
    target_compile_definitions(pdptw_core PUBLIC ENABLE_SEARCH_ASSERTS)
endif()

if(ENABLE_PROGRESS_TRACKING)
    target_compile_definitions(pdptw_core PUBLIC ENABLE_PROGRESS_TRACKING)
endif()
