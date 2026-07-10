# stop-all.ps1
$ports = @(3000,3001,3002,3003,3004,3005,3006,3007,3008,3009,3010,3011,3012,3013,3014,3015,3016)
foreach ($port in $ports) {
    $line = netstat -ano | findstr ":$port " | Select-Object -First 1
    if ($line) {
        $procId = ($line -split "\s+")[-1]
        if ($procId -match "^\d+$") {
            Write-Host "Killing PID $procId on port $port" -ForegroundColor Yellow
            taskkill /PID $procId /F 2>$null
        }
    }
}
Write-Host "All services stopped." -ForegroundColor Green
