@echo off
REM Validate PDPTW solution using Python validator
REM Usage: validate_solution.bat <instance_file> <solution_file_or_directory>

set INSTANCE=%~1
set SOLUTION=%~2

if "%INSTANCE%"=="" (
    echo Usage: validate_solution.bat ^<instance_file^> ^<solution_file_or_directory^>
    exit /b 1
)

if "%SOLUTION%"=="" (
    echo Usage: validate_solution.bat ^<instance_file^> ^<solution_file_or_directory^>
    exit /b 1
)

REM Use the improved validate.py script
python validate.py "%INSTANCE%" "%SOLUTION%"
