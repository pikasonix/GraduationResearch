# Simple test without auth - just to see the API structure
# We'll add a temporary bypass for testing

Write-Host "Testing route API response structure..." -ForegroundColor Cyan
Write-Host "Note: This will fail with 401 if no auth, but shows us the endpoint structure" -ForegroundColor Yellow

$routeId = "e0aed9cc-f318-495a-9ed5-965a57e09694"

try {
    # Try without auth to see error response
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/mobile/routes/$routeId" -Method GET
    Write-Host "✅ Success (unexpected without auth)" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ Status: $statusCode (expected 401 without auth)" -ForegroundColor Yellow
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseText = $reader.ReadToEnd()
        Write-Host "Response: $responseText" -ForegroundColor Gray
    }
}

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Analysis from SQL queries:" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

Write-Host @"

Expected API response should return:
- Route with total_stops: 8, completed_stops: 0
- Stops array with 8 items, each having:
  ✓ sequence (1-8)
  ✓ type (pickup/delivery)
  ✓ location_name: "Hoàng Văn E"
  ✓ orders: [{...}] (array with 1 order per stop)

Expected grouping in mobile app:
  Item 1: Stops 1-3 (pickup) → 3 đơn
  Item 2: Stop 4 (delivery) → 1 đơn  
  Item 3: Stop 5 (pickup) → 1 đơn
  Item 4: Stops 6-8 (delivery) → 3 đơn

Current issue:
  ❌ Stop 1-2: showing "0 orders" instead of 2
  
"@ -ForegroundColor White

Write-Host "`nDebugging next steps:" -ForegroundColor Yellow
Write-Host "1. Add logging to backend mobileRoutes.ts to see what's being returned" -ForegroundColor White
Write-Host "2. Add logging to mobile RouteDetailsViewModel to see grouping logic" -ForegroundColor White  
Write-Host "3. Check if orders array is actually empty or just not counted correctly" -ForegroundColor White
