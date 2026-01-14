# Debug script - Kiểm tra tại sao order status không update
# Chạy script này để xem vấn đề ở đâu

Write-Host "=== KIỂM TRA HỆ THỐNG ===" -ForegroundColor Cyan
Write-Host ""

# 1. Kiểm tra Backend
Write-Host "1. Backend Status:" -ForegroundColor Yellow
$backendProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*node.exe*" }
if ($backendProcess) {
    Write-Host "   ✓ Backend đang chạy (PID: $($backendProcess.Id))" -ForegroundColor Green
    Write-Host "   → Backend URL: http://localhost:3001" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Backend KHÔNG chạy!" -ForegroundColor Red
    Write-Host "   → Chạy: cd backend && npm run dev" -ForegroundColor Yellow
}
Write-Host ""

# 2. Test Backend API
Write-Host "2. Test Backend Health:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✓ Backend responding: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend không trả lời: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 3. Kiểm tra Migration File
Write-Host "3. Migration File:" -ForegroundColor Yellow
$migrationFile = "D:\CODE\WAYO\supabase\migrations\20260114_auto_update_order_status_on_stop_completion.sql"
if (Test-Path $migrationFile) {
    Write-Host "   ✓ Migration file tồn tại" -ForegroundColor Green
    $fileSize = (Get-Item $migrationFile).Length
    Write-Host "   → Size: $fileSize bytes" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Migration file KHÔNG tồn tại!" -ForegroundColor Red
}
Write-Host ""

# 4. Hướng dẫn tiếp theo
Write-Host "=== HƯỚNG DẪN TIẾP THEO ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "BỨC 1: Apply Migration vào Supabase" -ForegroundColor Yellow
Write-Host "   1. Mở Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "   2. Chọn project của bạn" -ForegroundColor White
Write-Host "   3. Vào SQL Editor (biểu tượng Database)" -ForegroundColor White
Write-Host "   4. Copy toàn bộ nội dung file:" -ForegroundColor White
Write-Host "      D:\CODE\WAYO\supabase\APPLY_MIGRATION_MANUALLY.sql" -ForegroundColor Cyan
Write-Host "   5. Paste vào SQL Editor và click 'Run'" -ForegroundColor White
Write-Host ""

Write-Host "BƯỚC 2: Test trên Mobile App" -ForegroundColor Yellow
Write-Host "   1. Mở app và chọn một route" -ForegroundColor White
Write-Host "   2. Click vào pickup stop → Complete" -ForegroundColor White
Write-Host "   3. Kiểm tra web: Order status phải là 'in_transit'" -ForegroundColor White
Write-Host "   4. Click vào delivery stop → Complete" -ForegroundColor White
Write-Host "   5. Kiểm tra web: Order status phải là 'completed'" -ForegroundColor White
Write-Host ""

Write-Host "BƯỚC 3: Debug nếu vẫn lỗi" -ForegroundColor Yellow
Write-Host "   Xem logs:" -ForegroundColor White
Write-Host "   → Backend logs trong terminal đang chạy npm run dev" -ForegroundColor Gray
Write-Host "   → Mobile logs trong Android Studio Logcat" -ForegroundColor Gray
Write-Host ""

Write-Host "=== THÔNG TIN QUAN TRỌNG ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend API Endpoint:" -ForegroundColor Yellow
Write-Host "   POST http://localhost:3001/api/mobile/stops/:id/complete" -ForegroundColor White
Write-Host ""
Write-Host "Logic cập nhật:" -ForegroundColor Yellow
Write-Host "   • Pickup completed → Order status = 'in_transit'" -ForegroundColor White
Write-Host "   • Cả pickup + delivery completed → Order status = 'completed'" -ForegroundColor White
Write-Host ""

# Mở file migration để user copy
Write-Host "Đang mở file migration để bạn copy..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
notepad "D:\CODE\WAYO\supabase\APPLY_MIGRATION_MANUALLY.sql"
