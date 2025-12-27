#!/usr/bin/env pwsh
# BƯỚC 2: TEST BACKEND SERVER & API ENDPOINT
# ==================================================

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BUOC 2: TEST BACKEND SERVER & API ENDPOINT                  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$API_BASE_URL = "http://localhost:3001/api"

# Test 2.1: Server Health Check
Write-Host "[2.1] Kiem tra server health..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$API_BASE_URL/jobs/stats" -Method GET -TimeoutSec 5
    $stats = $response.Content | ConvertFrom-Json
    
    Write-Host "  Backend server dang chay" -ForegroundColor Green
    Write-Host "  Port: 3001" -ForegroundColor Gray
    Write-Host "  Queue size: $($stats.stats.queueSize)" -ForegroundColor Gray
    Write-Host "  Active jobs: $($stats.stats.activeJobs)" -ForegroundColor Gray
}
catch {
    Write-Host "  Backend server KHONG chay!" -ForegroundColor Red
    Write-Host "`n  Hay mo terminal moi va chay:" -ForegroundColor Yellow
    Write-Host "    cd D:\CODE\WAYO\backend" -ForegroundColor White
    Write-Host "    npm run dev`n" -ForegroundColor White
    exit 1
}

# Test 2.2: Test /reoptimize endpoint (sẽ fail vì không có real org data)
Write-Host "`n[2.2] Test reoptimization endpoint..." -ForegroundColor Yellow

$payloadData = @{
    reoptimizationContext = @{
        organization_id = "test-org-placeholder"
        vehicle_states = @(
            @{
                vehicle_id = "vehicle-1"
                lat = 10.770
                lng = 106.670
                bearing = 90
                picked_order_ids = @("order-1")
            }
        )
        order_delta = @{
            new_order_ids = @()
            cancelled_order_ids = @()
        }
    }
    params = @{
        iterations = 1000
        time_limit = 30
    }
    createdBy = "test-user"
}

$payload = $payloadData | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest `
        -Uri "$API_BASE_URL/jobs/reoptimize" `
        -Method POST `
        -ContentType "application/json" `
        -Body $payload `
        -TimeoutSec 10
    
    $result = $response.Content | ConvertFrom-Json
    Write-Host "  OK Endpoint response OK" -ForegroundColor Green
    Write-Host "  Job ID: $($result.jobId)" -ForegroundColor Gray
    
}
catch {
    $errorMessage = $_.ErrorDetails.Message
    
    if ($errorMessage -like "*Organization not found*") {
        Write-Host "  Expected error: Organization not found" -ForegroundColor Yellow
        Write-Host "    Endpoint hoat dong dung!" -ForegroundColor Green
        Write-Host "    Can organization ID that de test tiep" -ForegroundColor Gray
    } elseif ($errorMessage -like "*Database not configured*") {
        Write-Host "  Database chua duoc configure!" -ForegroundColor Red
        Write-Host "    Kiem tra .env file co SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "  Unexpected error: $errorMessage" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n BUOC 2 HOAN THANH!" -ForegroundColor Green
Write-Host "  Backend server hoat dong binh thuong" -ForegroundColor Gray
Write-Host "  API endpoint /reoptimize san sang" -ForegroundColor Gray
Write-Host "  Tiep tuc sang Buoc 3..." -ForegroundColor Gray
Write-Host ""
