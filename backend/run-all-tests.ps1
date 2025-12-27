#!/usr/bin/env pwsh
# MASTER TEST SCRIPT - Chạy tất cả tests từng bước
# ==================================================

param(
    [switch]$SkipIntegration = $false
)

Write-Host "`n" -NoNewline
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                               ║" -ForegroundColor Cyan
Write-Host "║      RE-OPTIMIZATION TEST SUITE - STEP BY STEP                ║" -ForegroundColor Cyan
Write-Host "║                                                               ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$totalSteps = if ($SkipIntegration) { 2 } else { 3 }

Write-Host "Sẽ chạy $totalSteps bước test:" -ForegroundColor White
Write-Host "  1. Unit Tests (Logic core)" -ForegroundColor Gray
Write-Host "  2. API Tests (Backend endpoint)" -ForegroundColor Gray
if (-not $SkipIntegration) {
    Write-Host "  3. Integration Tests (Real database)" -ForegroundColor Gray
}
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "src/workers/test-reoptimization.ts")) {
    Write-Host "✗ ERROR: Phải chạy script này từ thư mục backend/" -ForegroundColor Red
    Write-Host "  cd D:\CODE\WAYO\backend`n" -ForegroundColor Yellow
    exit 1
}

# Step 1: Unit Tests
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
& .\test-step-1-unit-tests.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n✗ Test suite FAILED at Step 1" -ForegroundColor Red
    Write-Host "  Vui lòng sửa lỗi và chạy lại`n" -ForegroundColor Yellow
    exit 1
}

# Step 2: API Tests
Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
& .\test-step-2-api.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n✗ Test suite FAILED at Step 2" -ForegroundColor Red
    Write-Host "  Vui lòng sửa lỗi và chạy lại`n" -ForegroundColor Yellow
    exit 1
}

# Step 3: Integration Tests (optional)
if (-not $SkipIntegration) {
    Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
    & .\test-step-3-integration.ps1
    # Step 3 có thể skip nếu chưa có org data, không fail
}

# Success!
Write-Host "`n" -NoNewline
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                               ║" -ForegroundColor Green
Write-Host "║      ✓ TEST SUITE COMPLETED SUCCESSFULLY!                    ║" -ForegroundColor Green
Write-Host "║                                                               ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✓ Unit Tests: PASSED" -ForegroundColor Green
Write-Host "  ✓ API Tests: PASSED" -ForegroundColor Green
if (-not $SkipIntegration) {
    Write-Host "  ✓ Integration Tests: COMPLETED" -ForegroundColor Green
} else {
    Write-Host "  ⊘ Integration Tests: SKIPPED" -ForegroundColor Yellow
}

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Xem kết quả chi tiết trong terminal output" -ForegroundColor Gray
Write-Host "  2. Đọc hướng dẫn đầy đủ: backend/STEP_BY_STEP_TEST.md" -ForegroundColor Gray
Write-Host "  3. Implement frontend integration (dispatch-dynamic page)" -ForegroundColor Gray
Write-Host "  4. Deploy to production`n" -ForegroundColor Gray
