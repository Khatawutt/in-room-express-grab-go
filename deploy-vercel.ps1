# MANA In-Room Dining — Auto Push to GitHub Root & Deploy to Vercel Production
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".\index.html") -or -not (Test-Path ".\vercel.json")) {
    Write-Error "index.html or vercel.json not found in current root folder!"
    exit 1
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    if (-not (Test-Path ".\.git")) {
        git init
        git branch -M main
        git remote add origin https://github.com/Khatawutt/in-room-express-grab-go.git
    } else {
        git remote set-url origin https://github.com/Khatawutt/in-room-express-grab-go.git 2>$null
    }
    git add .
    git commit -m "feat: restore original skin with skin/color switcher, 14 ordered categories, and remove cakes" 2>$null
    git push -u origin main --force
}

if (Get-Command vercel -ErrorAction SilentlyContinue) {
    vercel --prod
} else {
    npx vercel --prod
}
