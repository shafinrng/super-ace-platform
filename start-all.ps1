# start-all.ps1 - Super Ace Platform Quick Start (Updated with RTP fixes)
param(
    [switch]$Rebuild,      # Rebuild all images after code changes
    [switch]$ResetRtp,    # Reset RTP stats (keeps settings, clears history)
    [switch]$SkipWait,     # Skip startup wait (faster but less reliable)
    [switch]$NoHealth      # Skip health checks
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Super Ace Platform - Quick Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Start Docker Compose
if ($Rebuild) {
    Write-Host "`n[1/5] Rebuilding all services..." -ForegroundColor Yellow
    docker compose up -d --build
} else {
    Write-Host "`n[1/5] Starting services..." -ForegroundColor Yellow
    docker compose up -d
}

# 2. Wait for startup
if (-not $SkipWait) {
    Write-Host "`n[2/5] Waiting 15 seconds for services..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
} else {
    Write-Host "`n[2/5] Skipping wait (-SkipWait)..." -ForegroundColor Yellow
}

# 3. Legacy health checks (original ports)
if (-not $NoHealth) {
    Write-Host "`n[3/5] Checking service health..." -ForegroundColor Yellow
    $ports = @(3001,3002,3003,3004,3005,3006,3008,3009,3010,3011,3012,3013,3014,3015,3016)
    foreach ($port in $ports) {
        try {
            $r = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2
            Write-Host "  Port $port : OK - $($r.service)" -ForegroundColor Green
        } catch {
            Write-Host "  Port $port : DEAD" -ForegroundColor Red
        }
    }
    foreach ($port in @(3000,3007)) {
        $conn = netstat -ano | findstr ":$port "
        if ($conn) { Write-Host "  Port $port : RUNNING (UI)" -ForegroundColor Green }
        else { Write-Host "  Port $port : DEAD" -ForegroundColor Red }
    }
} else {
    Write-Host "`n[3/5] Health checks skipped (-NoHealth)" -ForegroundColor Yellow
}

# 4. RTP Configuration Verification (NEW)
Write-Host "`n[4/5] Verifying RTP configuration..." -ForegroundColor Yellow

# 4b. Auto-restore critical RTP settings if missing
Write-Host "`n[4b/5] Checking RTP defaults..." -ForegroundColor Yellow
try {
    $playerId = "0c989a9b-d13f-4e65-a238-db87aa9b6775"
    $playerRtp = Invoke-RestMethod -Uri "http://localhost:3002/api/game/rtp/players/$playerId" -Method GET -TimeoutSec 3
    
    if (-not $playerRtp.rtp) {
        Write-Host "  Player override missing - restoring to 85%..." -ForegroundColor Yellow
        $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"shafin@test.com","password":"password123"}' -TimeoutSec 3
        Invoke-RestMethod -Uri "http://localhost:3006/api/admin/rtp/players/$playerId" -Method PUT -Headers @{Authorization="Bearer $($login.token)"} -ContentType "application/json" -Body '{"rtp":85}' -TimeoutSec 3 | Out-Null
        Write-Host "  Player override RESTORED to 85%." -ForegroundColor Green
    } else {
        Write-Host "  Player override: $($playerRtp.rtp)% - OK" -ForegroundColor Green
    }
} catch {
    Write-Host "  Could not verify/restore player override." -ForegroundColor Yellow
}

try {
    $playerId = "0c989a9b-d13f-4e65-a238-db87aa9b6775"
    
    # Check global target
    $globalRtp = Invoke-RestMethod -Uri "http://localhost:3002/api/game/rtp" -Method GET -TimeoutSec 5
    Write-Host "  Global Target: $($globalRtp.target)%" -ForegroundColor Cyan
    
    # Check player override
    $playerRtp = Invoke-RestMethod -Uri "http://localhost:3002/api/game/rtp/players/$playerId" -Method GET -TimeoutSec 5
    Write-Host "  Player Override: $($playerRtp.rtp)% (User: $($playerRtp.userId))" -ForegroundColor Cyan
    
    # Show current stats
    Write-Host "  Actual RTP: $([math]::Round($globalRtp.actualRtp, 2))% | Bets: $($globalRtp.totalBets) | Payouts: $($globalRtp.totalPayouts)" -ForegroundColor Cyan
    
    # Reset if requested
    if ($ResetRtp) {
        Write-Host "`n  Resetting RTP stats (-ResetRtp)..." -ForegroundColor Yellow
        $login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"shafin@test.com","password":"password123"}' -TimeoutSec 5
        Invoke-RestMethod -Uri "http://localhost:3006/api/admin/rtp/reset" -Method POST -Headers @{Authorization="Bearer $($login.token)"} -TimeoutSec 5 | Out-Null
        Write-Host "  RTP stats RESET." -ForegroundColor Green
    }
} catch {
    Write-Host "  RTP check pending (services still starting)..." -ForegroundColor Yellow
}

# 5. Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Platform Ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nCommands:" -ForegroundColor White
Write-Host "  Start:        .\start-all.ps1" -ForegroundColor Gray
Write-Host "  Rebuild:      .\start-all.ps1 -Rebuild" -ForegroundColor Gray
Write-Host "  Reset Stats:  .\start-all.ps1 -ResetRtp" -ForegroundColor Gray
Write-Host "  Fast Start:   .\start-all.ps1 -SkipWait" -ForegroundColor Gray
Write-Host "`nRTP Admin:" -ForegroundColor White
Write-Host "  Global:  PUT  http://localhost:3006/api/admin/rtp {target:96}" -ForegroundColor Gray
Write-Host "  Player:  PUT  http://localhost:3006/api/admin/rtp/players/{id} {rtp:85}" -ForegroundColor Gray
Write-Host "  Reset:   POST http://localhost:3006/api/admin/rtp/reset" -ForegroundColor Gray