# Debug script để kiểm tra dữ liệu route
# Usage: .\debug-route.ps1 -RouteId "e0aed9cc-f318-495a-9ed5-965a57e09694"

param(
    [Parameter(Mandatory=$true)]
    [string]$RouteId = "e0aed9cc-f318-495a-9ed5-965a57e09694",
    
    [Parameter(Mandatory=$false)]
    [string]$BackendUrl = "http://localhost:3001"
)

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "DEBUG ROUTE: $RouteId" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

# 1. Test Backend Health
Write-Host "`n1️⃣  Testing Backend Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BackendUrl/api/mobile/health" -Method GET
    Write-Host "✅ Backend is running" -ForegroundColor Green
    Write-Host "Supabase enabled: $($health.supabaseEnabled)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not accessible: $_" -ForegroundColor Red
    exit 1
}

# 2. Get Auth Token (you need to provide this)
Write-Host "`n2️⃣  Auth Token..." -ForegroundColor Yellow
Write-Host "⚠️  You need to get auth token from mobile app" -ForegroundColor Magenta
Write-Host "    - Open mobile app" -ForegroundColor Gray
Write-Host "    - Login as driver" -ForegroundColor Gray
Write-Host "    - Use Android Studio's Database Inspector to view SharedPreferences" -ForegroundColor Gray
Write-Host "    - Or add Log.d() in your app to print token" -ForegroundColor Gray

$token = Read-Host "`nEnter your auth token (or press Enter to skip API test)"

if ([string]::IsNullOrEmpty($token)) {
    Write-Host "⏭️  Skipping API test (no token provided)" -ForegroundColor Yellow
} else {
    # 3. Test Route API
    Write-Host "`n3️⃣  Fetching Route Details from API..." -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri "$BackendUrl/api/mobile/routes/$RouteId" -Method GET -Headers $headers
        
        Write-Host "✅ API Response received" -ForegroundColor Green
        Write-Host "`nRoute Info:" -ForegroundColor Cyan
        Write-Host "  ID: $($response.route.id)"
        Write-Host "  Status: $($response.route.status)"
        Write-Host "  Total Stops: $($response.route.total_stops)"
        Write-Host "  Completed Stops: $($response.route.completed_stops)"
        
        Write-Host "`nStops ($($response.stops.Count) total):" -ForegroundColor Cyan
        $response.stops | ForEach-Object -Begin {$i=1} -Process {
            $ordersInfo = if ($_.orders.Count -gt 0) {
                "$($_.orders.Count) đơn: $($_.orders[0].order_number)"
            } else {
                "chưa có đơn"
            }
            
            Write-Host ("  [{0:D2}] Seq {1}: {2} | {3} | {4}" -f $i, $_.sequence, $_.type.PadRight(8), $_.location_name, $ordersInfo)
            Write-Host ("       TW: {0} - {1}" -f $_.time_window_start, $_.time_window_end) -ForegroundColor Gray
            $i++
        }
        
        # Analyze Grouping
        Write-Host "`n4️⃣  Grouping Analysis:" -ForegroundColor Yellow
        Write-Host "Rules: Same location_name AND same type → grouped" -ForegroundColor Gray
        
        $groups = @()
        $currentGroup = @()
        
        foreach ($stop in $response.stops) {
            if ($currentGroup.Count -eq 0) {
                $currentGroup += $stop
            } else {
                $lastStop = $currentGroup[-1]
                if ($stop.location_name -eq $lastStop.location_name -and $stop.type -eq $lastStop.type) {
                    $currentGroup += $stop
                } else {
                    $groups += ,@($currentGroup)
                    $currentGroup = @($stop)
                }
            }
        }
        if ($currentGroup.Count -gt 0) {
            $groups += ,@($currentGroup)
        }
        
        Write-Host "`nResult: $($groups.Count) UI items (from $($response.stops.Count) stops)" -ForegroundColor Cyan
        
        $groups | ForEach-Object -Begin {$idx=1} -Process {
            $group = $_
            if ($group.Count -eq 1) {
                $s = $group[0]
                $ordersText = if ($s.orders.Count -gt 0) { "$($s.orders.Count) đơn" } else { "chưa có đơn" }
                Write-Host ("  Item {0}: Stop {1}. {2}" -f $idx, $s.sequence, $s.location_name)
                Write-Host ("           {0} • {1} • {2}" -f $s.type, $ordersText, $s.status) -ForegroundColor Gray
            } else {
                $first = $group[0]
                $last = $group[-1]
                $totalOrders = ($group | ForEach-Object { $_.orders.Count } | Measure-Object -Sum).Sum
                $ordersText = if ($totalOrders -gt 0) { "$totalOrders đơn" } else { "chưa có đơn" }
                Write-Host ("  Item {0}: Stop {1}-{2}. {3}" -f $idx, $first.sequence, $last.sequence, $first.location_name)
                Write-Host ("           {0} • {1} • {2}" -f $first.type, $ordersText, $first.status) -ForegroundColor Gray
            }
            $idx++
        }
        
        # Save to file
        $outputFile = "debug-route-$RouteId.json"
        $response | ConvertTo-Json -Depth 10 | Out-File $outputFile
        Write-Host "`n💾 Full response saved to: $outputFile" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ API Error: $_" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "Debug complete!" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check if all stops have orders (should not be 'chưa có đơn')" -ForegroundColor White
Write-Host "2. Verify location names are correct and consistent" -ForegroundColor White
Write-Host "3. Check if stop types (pickup/delivery) match expectations" -ForegroundColor White
Write-Host "4. Compare API response with mobile app display" -ForegroundColor White
