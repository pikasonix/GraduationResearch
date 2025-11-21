# Main application
add_executable(pdptw_solver
    main.cpp
)

target_link_libraries(pdptw_solver
    PRIVATE
        pdptw_core
        CLI11::CLI11
)

# Installation
install(TARGETS pdptw_solver
    RUNTIME DESTINATION bin
)
