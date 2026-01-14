# Test API Complete Stop
# Script này giúp test API endpoint trực tiếp để debug

param(
    [string]$StopId,
    [string]$Token
)

Write-Host "=== TEST API COMPLETE STOP ===" -ForegroundColor Cyan
Write-Host ""

if (-not $StopId) {
    Write-Host "❌ Thiếu Stop ID" -ForegroundColor Red
    Write-Host ""
    Write-Host "Cách dùng:" -ForegroundColor Yellow
    Write-Host '  .\test-complete-stop-api.ps1 -StopId "<stop-uuid>" -Token "<auth-token>"' -ForegroundColor White
    Write-Host ""
    Write-Host "Lấy Stop ID từ Supabase:" -ForegroundColor Yellow
    Write-Host '  SELECT id, stop_type FROM route_stops WHERE route_id = ''<route-id>'' LIMIT 1;' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Lấy Token từ mobile app:" -ForegroundColor Yellow
    Write-Host "  1. Mở Android Studio → Logcat" -ForegroundColor Gray
    Write-Host "  2. Filter: 'Authorization'" -ForegroundColor Gray
    Write-Host "  3. Copy Bearer token" -ForegroundColor Gray
    exit
}

$apiUrl = "http://localhost:3001/api/mobile/stops/$StopId/complete"
$completedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$headers = @{
    "Content-Type" = "application/json"
}

if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
}

$body = @{
    completed_at = $completedAt
    notes = "Test from PowerShell script"
} | ConvertTo-Json

Write-Host "Request Details:" -ForegroundColor Yellow
Write-Host "  URL: $apiUrl" -ForegroundColor Gray
Write-Host "  Stop ID: $StopId" -ForegroundColor Gray
Write-Host "  Completed At: $completedAt" -ForegroundColor Gray
Write-Host "  Has Token: $($Token -ne $null -and $Token -ne '')" -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "Sending request..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
    Write-Host ""
    
    if ($response.stop) {
        Write-Host "Stop Status:" -ForegroundColor Yellow
        Write-Host "  ID: $($response.stop.id)" -ForegroundColor Gray
        Write-Host "  Type: $($response.stop.stop_type)" -ForegroundColor Gray
        Write-Host "  Completed: $($response.stop.is_completed)" -ForegroundColor Gray
        Write-Host ""
        
        if ($response.stop.order) {
            Write-Host "Order Status:" -ForegroundColor Yellow
            Write-Host "  ID: $($response.stop.order.id)" -ForegroundColor Gray
            Write-Host "  Status: $($response.stop.order.status)" -ForegroundColor Cyan
            Write-Host ""
        }
    }
    
    Write-Host "✅ Bây giờ kiểm tra web để xem order status đã đổi chưa!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Yellow
        
        switch ($statusCode) {
            401 { Write-Host "  → Cần authentication token" -ForegroundColor Gray }
            403 { Write-Host "  → Token không hợp lệ hoặc không có quyền" -ForegroundColor Gray }
            404 { Write-Host "  → Stop ID không tồn tại" -ForegroundColor Gray }
            500 { Write-Host "  → Lỗi server - check backend logs" -ForegroundColor Gray }
        }
    }
    
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Kiểm tra backend đang chạy: http://localhost:3001/health" -ForegroundColor Gray
    Write-Host "  2. Kiểm tra Stop ID có đúng không (dùng Supabase)" -ForegroundColor Gray
    Write-Host "  3. Kiểm tra auth token còn valid không" -ForegroundColor Gray
}
