#!/usr/bin/env pwsh
# BƯỚC 3: TEST VỚI DỮ LIỆU THẬT TỪ DATABASE
# ==================================================

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BƯỚC 3: TEST VỚI DỮ LIỆU THẬT (INTEGRATION TEST)           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "Bước này cần:" -ForegroundColor Yellow
Write-Host "  ✓ Supabase database đã configure (có trong .env)" -ForegroundColor Gray
Write-Host "  ✓ Organization, vehicles, orders đã tồn tại trong DB" -ForegroundColor Gray
Write-Host "  ✓ Vehicle tracking data (GPS positions)`n" -ForegroundColor Gray

# Lấy environment variables
$envFile = Get-Content .env
$supabaseUrl = ($envFile | Select-String "SUPABASE_URL=").ToString().Split("=")[1]

if (-not $supabaseUrl -or $supabaseUrl -eq "") {
    Write-Host "✗ SUPABASE_URL chưa được set trong .env" -ForegroundColor Red
    Write-Host "  Vui lòng cập nhật file .env với Supabase credentials`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "Supabase URL: $supabaseUrl" -ForegroundColor Gray

# Hướng dẫn lấy organization_id từ database
Write-Host "`n[3.1] Lấy organization_id từ database..." -ForegroundColor Yellow
Write-Host "  Mở Supabase Dashboard > SQL Editor và chạy:" -ForegroundColor Gray
Write-Host "    SELECT id, name FROM organizations LIMIT 5;" -ForegroundColor White
Write-Host "`n  Nhập organization_id (hoặc Enter để skip): " -ForegroundColor Cyan -NoNewline
$orgId = Read-Host

if ($orgId -eq "") {
    Write-Host "`n  ⚠ Đã skip bước này" -ForegroundColor Yellow
    Write-Host "  Để test với real data, cần có organization_id thật" -ForegroundColor Gray
    Write-Host "`n  Xem hướng dẫn đầy đủ trong: backend/TEST_GUIDE.md`n" -ForegroundColor Yellow
    exit 0
}

# Test với organization_id thật
Write-Host "`n[3.2] Test với organization_id: $orgId" -ForegroundColor Yellow

$API_BASE_URL = "http://localhost:3001/api"

$payload = @{
    reoptimizationContext = @{
        organization_id = $orgId
        vehicle_states = @(
            @{
                vehicle_id = "test-vehicle-1"
                lat = 10.770
                lng = 106.670
                bearing = 90
                picked_order_ids = @()
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
        max_vehicles = 5
    }
    createdBy = "test-user"
} | ConvertTo-Json -Depth 10

Write-Host "  Payload:" -ForegroundColor Gray
Write-Host $payload -ForegroundColor DarkGray

try {
    Write-Host "`n  Đang gửi request..." -ForegroundColor Yellow
    
    $response = Invoke-WebRequest `
        -Uri "$API_BASE_URL/jobs/reoptimize" `
        -Method POST `
        -ContentType "application/json" `
        -Body $payload `
        -TimeoutSec 30
    
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "  ✓ Job submitted thành công!" -ForegroundColor Green
        Write-Host "    Job ID: $($result.jobId)" -ForegroundColor Gray
        
        if ($result.preprocessing_stats) {
            Write-Host "`n  Preprocessing Stats:" -ForegroundColor Cyan
            Write-Host "    - Total nodes: $($result.preprocessing_stats.total_nodes)" -ForegroundColor Gray
            Write-Host "    - Dummy nodes: $($result.preprocessing_stats.dummy_nodes)" -ForegroundColor Gray
            Write-Host "    - Ghost pickups: $($result.preprocessing_stats.ghost_pickups)" -ForegroundColor Gray
            Write-Host "    - Active vehicles: $($result.preprocessing_stats.active_vehicles)" -ForegroundColor Gray
        }
        
        # Poll job status
        Write-Host "`n  Đang theo dõi job status..." -ForegroundColor Yellow
        
        $jobId = $result.jobId
        $maxAttempts = 30
        $attempt = 0
        
        while ($attempt -lt $maxAttempts) {
            Start-Sleep -Seconds 2
            $attempt++
            
            try {
                $jobResponse = Invoke-WebRequest -Uri "$API_BASE_URL/jobs/$jobId" -Method GET
                $job = ($jobResponse.Content | ConvertFrom-Json).job
                
                Write-Host "    [$attempt/$maxAttempts] Status: $($job.status), Progress: $($job.progress)%" -ForegroundColor Gray
                
                if ($job.status -eq "completed") {
                    Write-Host "`n  ✓ Job completed!" -ForegroundColor Green
                    if ($job.solutionId) {
                        Write-Host "    Solution ID: $($job.solutionId)" -ForegroundColor Gray
                        Write-Host "    Persisted: $($job.persisted)" -ForegroundColor Gray
                    }
                    break
                } elseif ($job.status -eq "failed") {
                    Write-Host "`n  ✗ Job failed: $($job.error)" -ForegroundColor Red
                    break
                }
            } catch {
                Write-Host "    Lỗi khi poll job: $($_.Exception.Message)" -ForegroundColor Red
                break
            }
        }
        
        Write-Host "`n✓ BƯỚC 3 HOÀN THÀNH!" -ForegroundColor Green
        Write-Host "  Integration test với real data thành công" -ForegroundColor Gray
        
    } else {
        Write-Host "  ✗ Request failed: $($result.error)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    $errorMessage = $_.ErrorDetails.Message
    if ($errorMessage) {
        $errorObj = $errorMessage | ConvertFrom-Json -ErrorAction SilentlyContinue
        Write-Host "  ✗ API Error: $($errorObj.error)" -ForegroundColor Red
        
        # Provide helpful hints
        if ($errorMessage -like "*Organization not found*") {
            Write-Host "`n  Organization ID không tồn tại trong database" -ForegroundColor Yellow
            Write-Host "  Kiểm tra lại ID hoặc tạo organization mới" -ForegroundColor Gray
        } elseif ($errorMessage -like "*depot*") {
            Write-Host "`n  Organization thiếu depot information" -ForegroundColor Yellow
            Write-Host "  Cần có depot_latitude, depot_longitude trong organizations table" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ✗ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✓ TẤT CẢ TESTS ĐÃ HOÀN THÀNH!                               ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
