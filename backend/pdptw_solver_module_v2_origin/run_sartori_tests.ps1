#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Automated benchmark runner for all Sartori & Buriol instances
    
.DESCRIPTION
    Runs all Sartori instances with appropriate time limits:
    - pdptw_100:  60s   (1 minute)
    - pdptw_200:  120s  (2 minutes)  
    - pdptw_400:  600s  (10 minutes)
    - pdptw_1000: 1200s (20 minutes)
    - pdptw_5000: 1800s (30 minutes)
    
.EXAMPLE
    .\run_sartori_tests.ps1
#>

param(
    [int]$Seed = 12345,
    [string]$OutputDir = "benchmark_results_sartori"
)

# Colors
$C_HEADER = "Cyan"
$C_SUCCESS = "Green"
$C_INFO = "White"
$C_WARNING = "Yellow"
$C_ERROR = "Red"

# Configuration
$groups = @(
    @{Name = "pdptw_100";  TimeLimit = 60;   Pattern = "resources\instances\sartori\pdptw_100\*.txt";  ExpectedCount = 6}
    @{Name = "pdptw_200";  TimeLimit = 120;  Pattern = "resources\instances\sartori\pdptw_200\*.txt";  ExpectedCount = 6}
    @{Name = "pdptw_400";  TimeLimit = 600;  Pattern = "resources\instances\sartori\pdptw_400\*.txt";  ExpectedCount = 2}
    @{Name = "pdptw_1000"; TimeLimit = 1200; Pattern = "resources\instances\sartori\pdptw_1000\*.txt"; ExpectedCount = 1}
    @{Name = "pdptw_5000"; TimeLimit = 1800; Pattern = "resources\instances\sartori\pdptw_5000\*.txt"; ExpectedCount = 1}
)

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Write-Host "`n============================================================" -ForegroundColor $C_HEADER
Write-Host " AUTOMATED BENCHMARK - ALL SARTORI & BURIOL INSTANCES" -ForegroundColor $C_HEADER
Write-Host "============================================================" -ForegroundColor $C_HEADER
Write-Host "Configuration:" -ForegroundColor $C_INFO
Write-Host "  - pdptw_100:  60s   (1 min)  x 6 instances = ~6 min" -ForegroundColor $C_INFO
Write-Host "  - pdptw_200:  120s  (2 min)  x 6 instances = ~12 min" -ForegroundColor $C_INFO
Write-Host "  - pdptw_400:  600s  (10 min) x 2 instances = ~20 min" -ForegroundColor $C_INFO
Write-Host "  - pdptw_1000: 1200s (20 min) x 1 instance  = ~20 min" -ForegroundColor $C_INFO
Write-Host "  - pdptw_5000: 1800s (30 min) x 1 instance  = ~30 min" -ForegroundColor $C_INFO
Write-Host "  Total estimated time: ~88 minutes (1.5 hours)" -ForegroundColor $C_WARNING
Write-Host "  Output directory: $OutputDir" -ForegroundColor $C_INFO
Write-Host "  Seed: $Seed" -ForegroundColor $C_INFO
Write-Host "============================================================`n" -ForegroundColor $C_HEADER

# Build solver once
Write-Host "Building solver (release mode)..." -ForegroundColor $C_INFO
$buildOutput = cargo build --release 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor $C_ERROR
    Write-Host $buildOutput
    exit 1
}
Write-Host "Build successful!`n" -ForegroundColor $C_SUCCESS

# Track overall progress
$totalStart = Get-Date
$allResults = @()
$groupIndex = 0

# Process each group
foreach ($group in $groups) {
    $groupIndex++
    $groupName = $group.Name
    $timeLimit = $group.TimeLimit
    $pattern = $group.Pattern
    
    Write-Host "`n[$groupIndex/5] ========== $groupName (${timeLimit}s) ==========" -ForegroundColor $C_HEADER
    
    # Get instances
    $instances = Get-ChildItem -Path $pattern -File | Sort-Object Name
    
    if ($instances.Count -eq 0) {
        Write-Host "  [WARNING] No instances found for pattern: $pattern" -ForegroundColor $C_WARNING
        continue
    }
    
    Write-Host "  Found $($instances.Count) instances" -ForegroundColor $C_INFO
    Write-Host "  Expected time: $([math]::Round($instances.Count * $timeLimit / 60, 1)) minutes`n" -ForegroundColor $C_WARNING
    
    $instanceIndex = 0
    
    # Process each instance
    foreach ($instance in $instances) {
        $instanceIndex++
        $instanceName = [System.IO.Path]::GetFileNameWithoutExtension($instance.FullName)
        $progress = "[$instanceIndex/$($instances.Count)]"
        
        Write-Host "  $progress $instanceName - Starting..." -ForegroundColor $C_INFO
        
        # Clean old solution files
        Remove-Item "solutions\${instanceName}*.sol" -Force -ErrorAction SilentlyContinue
        
        # Run solver
        $startTime = Get-Date
        $solverOutput = & ".\target\release\ls-pdptw-solver.exe" `
            --instance $instance.FullName `
            --format sartori `
            --solver ls-ages-lns `
            --time-limit $timeLimit `
            --seed $Seed 2>&1
        $elapsed = ((Get-Date) - $startTime).TotalSeconds
        
        # Find solution file
        $solutionFile = Get-ChildItem "solutions\${instanceName}*.sol" -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($null -eq $solutionFile) {
            Write-Host "  $progress $instanceName - [FAILED] (no solution file)" -ForegroundColor $C_ERROR
            $allResults += [PSCustomObject]@{
                Group = $groupName
                Instance = $instanceName
                Status = "FAILED"
                Unassigned = $null
                Vehicles = $null
                Cost = $null
                Time = [math]::Round($elapsed, 2)
            }
            continue
        }
        
        # Parse solution
        $content = Get-Content $solutionFile.FullName -Raw
        if ($content -match "Solution:\s*(\d+);(\d+);([0-9.]+);") {
            $unassigned = [int]$Matches[1]
            $vehicles = [int]$Matches[2]
            $cost = $Matches[3]
            
            # Create formatted output file
            $outputFileName = "${instanceName}.${vehicles}.${cost}.txt"
            $outputPath = Join-Path $OutputDir $outputFileName
            Copy-Item $solutionFile.FullName $outputPath -Force
            
            $status = if ($unassigned -eq 0) { "[SUCCESS]" } else { "[PARTIAL]" }
            $statusColor = if ($unassigned -eq 0) { $C_SUCCESS } else { $C_WARNING }
            
            Write-Host "  $progress $instanceName - $status (V:$vehicles C:$cost T:$([math]::Round($elapsed,1))s)" -ForegroundColor $statusColor
            
            $allResults += [PSCustomObject]@{
                Group = $groupName
                Instance = $instanceName
                Status = if ($unassigned -eq 0) { "SUCCESS" } else { "PARTIAL" }
                Unassigned = $unassigned
                Vehicles = $vehicles
                Cost = $cost
                Time = [math]::Round($elapsed, 2)
            }
        } else {
            Write-Host "  $progress $instanceName - [PARSE ERROR]" -ForegroundColor $C_ERROR
            $allResults += [PSCustomObject]@{
                Group = $groupName
                Instance = $instanceName
                Status = "PARSE_ERROR"
                Unassigned = $null
                Vehicles = $null
                Cost = $null
                Time = [math]::Round($elapsed, 2)
            }
        }
    }
    
    Write-Host "  ========== $groupName COMPLETED ==========`n" -ForegroundColor $C_SUCCESS
}

$totalElapsed = ((Get-Date) - $totalStart).TotalMinutes

# Final summary
Write-Host "`n============================================================" -ForegroundColor $C_HEADER
Write-Host " BENCHMARK COMPLETED!" -ForegroundColor $C_SUCCESS
Write-Host "============================================================" -ForegroundColor $C_HEADER

$successCount = ($allResults | Where-Object { $_.Status -eq "SUCCESS" }).Count
$partialCount = ($allResults | Where-Object { $_.Status -eq "PARTIAL" }).Count
$failedCount = ($allResults | Where-Object { $_.Status -like "*ERROR" -or $_.Status -eq "FAILED" }).Count

Write-Host "Total instances: $($allResults.Count)" -ForegroundColor $C_INFO
Write-Host "Success: $successCount" -ForegroundColor $C_SUCCESS
Write-Host "Partial: $partialCount" -ForegroundColor $C_WARNING
Write-Host "Failed: $failedCount" -ForegroundColor $(if ($failedCount -gt 0) { $C_ERROR } else { $C_INFO })
Write-Host "Total time: $([math]::Round($totalElapsed, 2)) minutes" -ForegroundColor $C_INFO

# Save summary CSV
$csvPath = Join-Path $OutputDir "summary.csv"
$allResults | Export-Csv -Path $csvPath -NoTypeInformation
Write-Host "`nResults saved to:" -ForegroundColor $C_SUCCESS
Write-Host "  Files: $OutputDir\<name>.<vehicles>.<cost>.txt" -ForegroundColor $C_INFO
Write-Host "  CSV:   $csvPath" -ForegroundColor $C_INFO
Write-Host "============================================================`n" -ForegroundColor $C_HEADER

# Display detailed results by group
Write-Host "Detailed Results by Group:`n" -ForegroundColor $C_HEADER
$allResults | Format-Table -Property Group, Instance, Status, Vehicles, Cost, Time -AutoSize

Write-Host "`n[COMPLETED] ALL TESTS FINISHED SUCCESSFULLY!" -ForegroundColor $C_SUCCESS
