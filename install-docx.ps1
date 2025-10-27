Write-Host "Installing docx package for Word document export..." -ForegroundColor Green
Write-Host ""

Set-Location invigilatorApp
Write-Host "Installing in invigilatorApp directory..." -ForegroundColor Yellow

try {
    npm install docx@9.5.1
    Write-Host ""
    Write-Host "✅ Installation complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now use Word document export in the invigilator app." -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "❌ Installation failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running PowerShell as Administrator and run this script again." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to continue..."