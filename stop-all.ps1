# stop-all.ps1 - stops the full Docker Compose stack
Write-Host "Stopping Super Ace Platform (Docker Compose)..." -ForegroundColor Yellow
docker compose down
Write-Host "All services stopped." -ForegroundColor Green
