@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo  Deploying MANA In-Room Dining to GitHub...
echo  Target: https://github.com/Khatawutt/in-room-express-grab-go
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-github.ps1"
echo.
pause
