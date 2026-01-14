# Auto-fix Order Status Issue
# Script tự động rebuild mobile app

param(
    [switch]$SkipClean,
    [switch]$InstallOnly
)

Write-Host "=== AUTO-FIX ORDER STATUS ISSUE ===" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# 1. Check Supabase migration
Write-Host "⚠️  QUAN TRỌNG: Đã apply migration vào Supabase chưa?" -ForegroundColor Red
Write-Host "   File: supabase\APPLY_MIGRATION_MANUALLY.sql" -ForegroundColor Gray
Write-Host "   → Mở Supabase Dashboard → SQL Editor → Run migration" -ForegroundColor Gray
Write-Host ""
$migrationDone = Read-Host "Đã apply migration? (y/n)"

if ($migrationDone -ne 'y') {
    Write-Host ""
    Write-Host "❌ Hãy apply migration trước!" -ForegroundColor Red
    Write-Host "   1. Mở https://supabase.com/dashboard" -ForegroundColor Yellow
    Write-Host "   2. SQL Editor → Copy nội dung file migration" -ForegroundColor Yellow
    Write-Host "   3. Run SQL" -ForegroundColor Yellow
    Write-Host ""
    
    # Mở file migration
    if (Test-Path "D:\CODE\WAYO\supabase\APPLY_MIGRATION_MANUALLY.sql") {
        notepad "D:\CODE\WAYO\supabase\APPLY_MIGRATION_MANUALLY.sql"
    }
    
    exit 1
}

Write-Host ""
Write-Host "✓ Migration đã apply" -ForegroundColor Green
Write-Host ""

# 2. Check backend
Write-Host "Checking backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✓ Backend đang chạy (port 3001)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend không chạy" -ForegroundColor Yellow
    Write-Host "   → Khởi động: cd backend && npm run dev" -ForegroundColor Gray
    
    $startBackend = Read-Host "Khởi động backend ngay? (y/n)"
    if ($startBackend -eq 'y') {
        Write-Host "Starting backend..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\CODE\WAYO\backend; npm run dev"
        Write-Host "✓ Backend starting in new window..." -ForegroundColor Green
        Start-Sleep -Seconds 3
    }
}
Write-Host ""

if (-not $InstallOnly) {
    # 3. Build mobile app
    Write-Host "Building mobile app..." -ForegroundColor Yellow
    Write-Host ""

    cd D:\CODE\WAYO\mobile

    if (-not $SkipClean) {
        Write-Host "Cleaning..." -ForegroundColor Gray
        & .\gradlew.bat clean
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Clean failed!" -ForegroundColor Red
            exit 1
        }
        Write-Host "✓ Clean completed" -ForegroundColor Green
        Write-Host ""
    }

    Write-Host "Building debug APK..." -ForegroundColor Gray
    & .\gradlew.bat assembleDebug
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ Build failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Thử các giải pháp:" -ForegroundColor Yellow
        Write-Host "  1. Mở Android Studio và sync project" -ForegroundColor Gray
        Write-Host "  2. Clean + Rebuild trong Android Studio" -ForegroundColor Gray
        Write-Host "  3. Xóa folder .gradle và rebuild" -ForegroundColor Gray
        exit 1
    }

    Write-Host ""
    Write-Host "✓ Build thành công!" -ForegroundColor Green
    Write-Host ""

    # Find APK
    $apkPath = "D:\CODE\WAYO\mobile\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        Write-Host "APK location:" -ForegroundColor Yellow
        Write-Host "  $apkPath" -ForegroundColor Cyan
        Write-Host ""
    }
}

# 4. Install APK
Write-Host "Cài đặt APK..." -ForegroundColor Yellow
Write-Host ""

# Check ADB
$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
    Write-Host "❌ ADB không tìm thấy!" -ForegroundColor Red
    Write-Host "   → Kết nối điện thoại và install APK thủ công" -ForegroundColor Yellow
    Write-Host "   APK: mobile\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Gray
    exit 1
}

# Check device
$devices = & adb devices | Select-String -Pattern "device$"
if ($devices.Count -eq 0) {
    Write-Host "⚠️  Không tìm thấy thiết bị Android" -ForegroundColor Yellow
    Write-Host "   → Kết nối điện thoại qua USB hoặc WiFi" -ForegroundColor Gray
    Write-Host "   → Enable USB Debugging trong Developer Options" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Hoặc install APK thủ công:" -ForegroundColor Yellow
    Write-Host "  mobile\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
    exit 1
}

Write-Host "Thiết bị tìm thấy:" -ForegroundColor Green
& adb devices
Write-Host ""

# Uninstall old app
Write-Host "Gỡ app cũ..." -ForegroundColor Gray
& adb uninstall com.pikasonix.wayo 2>$null
Write-Host ""

# Install new APK
$apkPath = "D:\CODE\WAYO\mobile\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    Write-Host "Cài đặt app mới..." -ForegroundColor Gray
    & adb install $apkPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Cài đặt thành công!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Cài đặt thất bại!" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Không tìm thấy APK!" -ForegroundColor Red
    Write-Host "   → Build lại app: .\gradlew.bat assembleDebug" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== HOÀN TẤT ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bây giờ:" -ForegroundColor Yellow
Write-Host "  1. Mở app trên điện thoại" -ForegroundColor White
Write-Host "  2. Đăng nhập và chọn route" -ForegroundColor White
Write-Host "  3. Complete một pickup stop" -ForegroundColor White
Write-Host "  4. Kiểm tra logcat để xem logs" -ForegroundColor White
Write-Host "  5. Kiểm tra web: Order status phải = 'in_transit'" -ForegroundColor White
Write-Host ""

Write-Host "View logs:" -ForegroundColor Yellow
Write-Host "  adb logcat -s StopRepository:D MapViewModel:D okhttp.OkHttpClient:I" -ForegroundColor Cyan
Write-Host ""

# Open logcat
$openLogcat = Read-Host "Mở logcat ngay? (y/n)"
if ($openLogcat -eq 'y') {
    Write-Host ""
    Write-Host "Mở logcat..." -ForegroundColor Yellow
    Write-Host "Filter: StopRepository, MapViewModel, okhttp" -ForegroundColor Gray
    Write-Host ""
    & adb logcat -s StopRepository:D MapViewModel:D okhttp.OkHttpClient:I
}
