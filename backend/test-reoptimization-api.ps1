#!/usr/bin/env pwsh
# Test Reoptimization API Endpoint
# Usage: .\test-reoptimization-api.ps1

$API_BASE_URL = "http://localhost:3001/api"

Write-Host "`n=== Testing Reoptimization API ===" -ForegroundColor Cyan
Write-Host "API Base URL: $API_BASE_URL`n" -ForegroundColor Gray

# Test 1: Check if server is running
Write-Host "Test 1: Checking server health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_BASE_URL/jobs/stats" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Server is running" -ForegroundColor Green
        $stats = $response.Content | ConvertFrom-Json
        Write-Host "  Queue stats: $($stats.stats | ConvertTo-Json -Compress)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Server is not running or not accessible" -ForegroundColor Red
    Write-Host "  Please start the backend server first: cd backend && npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test 2: Submit a reoptimization job (mock data)
Write-Host "`nTest 2: Submitting reoptimization job..." -ForegroundColor Yellow

$reoptPayload = @{
    reoptimizationContext = @{
        organization_id = "test-org-123"
        previous_solution_id = "solution-456"
        vehicle_states = @(
            @{
                vehicle_id = "vehicle-1"
                lat = 10.770
                lng = 106.670
                bearing = 90
                picked_order_ids = @("order-1", "order-2")
            },
            @{
                vehicle_id = "vehicle-2"
                lat = 10.775
                lng = 106.675
                bearing = 180
                picked_order_ids = @()
            }
        )
        order_delta = @{
            new_order_ids = @("order-10", "order-11")
            cancelled_order_ids = @("order-5")
        }
    }
    params = @{
        iterations = 1000
        time_limit = 30
        max_vehicles = 5
        acceptance = "sa"
    }
    createdBy = "test-user"
} | ConvertTo-Json -Depth 10

Write-Host "Payload:" -ForegroundColor Gray
Write-Host $reoptPayload -ForegroundColor DarkGray

try {
    $response = Invoke-WebRequest `
        -Uri "$API_BASE_URL/jobs/reoptimize" `
        -Method POST `
        -ContentType "application/json" `
        -Body $reoptPayload `
        -TimeoutSec 30
    
    if ($response.StatusCode -eq 200) {
        $result = $response.Content | ConvertFrom-Json
        if ($result.success) {
            Write-Host "✓ Reoptimization job submitted successfully" -ForegroundColor Green
            Write-Host "  Job ID: $($result.jobId)" -ForegroundColor Gray
            
            if ($result.preprocessing_stats) {
                Write-Host "  Preprocessing stats:" -ForegroundColor Gray
                Write-Host "    - Total nodes: $($result.preprocessing_stats.total_nodes)" -ForegroundColor Gray
                Write-Host "    - Dummy nodes: $($result.preprocessing_stats.dummy_nodes)" -ForegroundColor Gray
                Write-Host "    - Ghost pickups: $($result.preprocessing_stats.ghost_pickups)" -ForegroundColor Gray
                Write-Host "    - Active vehicles: $($result.preprocessing_stats.active_vehicles)" -ForegroundColor Gray
            }
            
            # Test 3: Poll job status
            Write-Host "`nTest 3: Polling job status..." -ForegroundColor Yellow
            $jobId = $result.jobId
            $maxAttempts = 10
            $attempt = 0
            
            while ($attempt -lt $maxAttempts) {
                Start-Sleep -Seconds 2
                $attempt++
                
                $jobResponse = Invoke-WebRequest -Uri "$API_BASE_URL/jobs/$jobId" -Method GET
                $job = ($jobResponse.Content | ConvertFrom-Json).job
                
                Write-Host "  Attempt $attempt - Status: $($job.status), Progress: $($job.progress)%" -ForegroundColor Gray
                
                if ($job.status -eq "completed") {
                    Write-Host "✓ Job completed successfully" -ForegroundColor Green
                    if ($job.solutionId) {
                        Write-Host "  Solution ID: $($job.solutionId)" -ForegroundColor Gray
                        Write-Host "  Persisted: $($job.persisted)" -ForegroundColor Gray
                    }
                    break
                } elseif ($job.status -eq "failed") {
                    Write-Host "✗ Job failed: $($job.error)" -ForegroundColor Red
                    break
                }
            }
            
            if ($attempt -eq $maxAttempts) {
                Write-Host "⚠ Job still processing after $maxAttempts attempts" -ForegroundColor Yellow
            }
        } else {
            Write-Host "✗ Failed to submit job: $($result.error)" -ForegroundColor Red
        }
    }
} catch {
    $errorDetails = $_.ErrorDetails.Message
    if ($errorDetails) {
        $errorObj = $errorDetails | ConvertFrom-Json
        Write-Host "✗ API Error: $($errorObj.error)" -ForegroundColor Red
    } else {
        Write-Host "✗ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # This is expected if database is not configured
    if ($errorDetails -like "*Database not configured*" -or $errorDetails -like "*Organization not found*") {
        Write-Host "`n⚠ Note: This error is expected if Supabase is not configured." -ForegroundColor Yellow
        Write-Host "  The reoptimization endpoint requires a database connection to fetch:" -ForegroundColor Yellow
        Write-Host "  - Organization depot information" -ForegroundColor Yellow
        Write-Host "  - Active orders" -ForegroundColor Yellow
        Write-Host "  - Vehicle information" -ForegroundColor Yellow
        Write-Host "`n  To test with real data, configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
