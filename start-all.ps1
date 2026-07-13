# start-all.ps1 - starts the full Docker Compose stack (single source of truth)
Write-Host "Starting Super Ace Platform (Docker Compose)..." -ForegroundColor Cyan
docker compose up -d

Write-Host "`nWaiting for services to become healthy..." -ForegroundColor Cyan
Start-Sleep -Seconds 8

$ports = @(3001,3002,3003,3004,3005,3006,3008,3009,3010,3011,3012,3013,3014,3015,3016)
foreach ($port in $ports) {
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2
        Write-Host "Port $port : OK - $($r.service)" -ForegroundColor Green
    } catch {
        Write-Host "Port $port : DEAD" -ForegroundColor Red
    }
}
foreach ($port in @(3000,3007)) {
    $conn = netstat -ano | findstr ":$port "
    if ($conn) { Write-Host "Port $port : RUNNING (UI)" -ForegroundColor Green }
    else { Write-Host "Port $port : DEAD" -ForegroundColor Red }
}
