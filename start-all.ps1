# start-all.ps1
$services = @(
    @{Name="frontend"; Path="frontend"; Port=3000; Env=@{}},
    @{Name="auth-service"; Path="services/auth-service"; Port=3001; Env=@{"DATABASE_URL"="postgresql://superace:superace123@localhost:5432/superace_db"}},
    @{Name="game-engine"; Path="services/game-engine"; Port=3002; Env=@{}},
    @{Name="wallet-service"; Path="services/wallet-service"; Port=3003; Env=@{"DATABASE_URL"="postgresql://superace:superace123@localhost:5432/superace_db"}},
    @{Name="payment-service"; Path="services/payment-service"; Port=3004; Env=@{"DATABASE_URL"="postgresql://superace:superace123@localhost:5432/superace_db"}},
    @{Name="websocket-service"; Path="services/websocket-service"; Port=3005; Env=@{}},
    @{Name="admin-service"; Path="services/admin-service"; Port=3006; Env=@{"DATABASE_URL"="postgresql://superace:superace123@localhost:5432/superace_db"; "PORT"="3006"}},
    @{Name="admin-panel"; Path="admin-panel"; Port=3007; Env=@{"PORT"="3007"}},
    @{Name="session-service"; Path="services/session-service"; Port=3008; Env=@{}},
    @{Name="saga-service"; Path="services/saga-service"; Port=3009; Env=@{}},
    @{Name="rng-service"; Path="services/rng-service"; Port=3010; Env=@{"PORT"="3010"}},
    @{Name="jackpot-service"; Path="services/jackpot-service"; Port=3011; Env=@{}},
    @{Name="buybonus-service"; Path="services/buybonus-service"; Port=3012; Env=@{}},
    @{Name="notification-service"; Path="services/notification-service"; Port=3013; Env=@{}},
    @{Name="kyc-service"; Path="services/kyc-service"; Port=3014; Env=@{}},
    @{Name="audit-service"; Path="services/audit-service"; Port=3015; Env=@{}},
    @{Name="responsible-gaming-service"; Path="services/responsible-gaming-service"; Port=3016; Env=@{}}
)

foreach ($svc in $services) {
    Write-Host "Starting $($svc.Name) on port $($svc.Port)..." -ForegroundColor Cyan
    $envSet = ""
    foreach ($key in $svc.Env.Keys) {
        $val = $svc.Env[$key]
        $envSet += "`$env:$key = '$val'; "
    }
    $cmd = "cd 'C:\super-ace-platform\$($svc.Path)'; $envSet npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd -WindowStyle Minimized
    Start-Sleep -Milliseconds 500
}

Write-Host "`nAll services starting in minimized windows. Check port status in 15 seconds..." -ForegroundColor Green
Start-Sleep -Seconds 15

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
