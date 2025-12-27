#!/usr/bin/env pwsh
# BƯỚC 1: TEST UNIT TESTS (Không cần database)
# ==================================================

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BƯỚC 1: TEST UNIT TESTS - Preprocessing & Cleanup Logic    ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "Test này kiểm tra:" -ForegroundColor Yellow
Write-Host "  ✓ Dummy Node Generation (Virtual Start Nodes)" -ForegroundColor Gray
Write-Host "  ✓ Ghost Pickup Creation (In-transit loads)" -ForegroundColor Gray
Write-Host "  ✓ Vehicle Swapping Prevention (Capacity dimensions)" -ForegroundColor Gray
Write-Host "  ✓ Post-solve Cleanup (Remove dummy nodes)" -ForegroundColor Gray
Write-Host "  ✓ Metadata Extraction (start_time, initial_load)`n" -ForegroundColor Gray

Write-Host "Đang chạy test..." -ForegroundColor Yellow

$result = npx ts-node src/workers/test-reoptimization.ts 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host $result -ForegroundColor Green
    Write-Host "`n" -NoNewline
    Write-Host "BUOC 1 HOAN THANH!" -ForegroundColor Green
    Write-Host "  Tat ca unit tests da PASS" -ForegroundColor Gray
    Write-Host "  Tiep tuc sang Buoc 2...`n" -ForegroundColor Gray
    exit 0
} else {
    Write-Host $result -ForegroundColor Red
    Write-Host "`n" -NoNewline
    Write-Host "BUOC 1 THAT BAI!" -ForegroundColor Red
    Write-Host "  Vui long sua loi truoc khi tiep tuc`n" -ForegroundColor Yellow
    exit 1
}
