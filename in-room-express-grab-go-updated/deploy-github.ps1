# MANA In-Room Dining — Auto Push & Deploy to GitHub (https://github.com/Khatawutt/in-room-express-grab-go)
param(
    [string]$RepoUrl = "https://github.com/Khatawutt/in-room-express-grab-go.git",
    [string]$Branch = "main",
    [string]$CommitMessage = "feat: add chef picks quick-add, store info modal with phone/map, enable alipay & credit card"
)

Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".\index.html")) {
    Write-Error "index.html not found in current folder ($PSScriptRoot)!"
    exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is not installed or not in PATH. Please install Git from https://git-scm.com/"
    exit 1
}

if (-not (Test-Path ".\.nojekyll")) {
    New-Item -ItemType File -Path ".\.nojekyll" -Force | Out-Null
}

$ErrorActionPreference = "Continue"

if (-not (Test-Path ".\.git")) {
    Write-Host "-> Initializing Git repository..." -ForegroundColor Cyan
    git init
}

git config core.autocrlf false
git branch -M $Branch

$existingRemotes = git remote
if ($existingRemotes -contains "origin") {
    git remote set-url origin $RepoUrl
} else {
    git remote add origin $RepoUrl
}

Write-Host "-> Staging all project files..." -ForegroundColor Cyan
git add -A

$status = git status --porcelain
if ($status) {
    Write-Host "-> Creating commit..." -ForegroundColor Cyan
    git commit -m $CommitMessage
} else {
    Write-Host "-> Working tree clean, pushing existing commit..." -ForegroundColor Yellow
}

Write-Host "-> Pushing to $RepoUrl ($Branch)..." -ForegroundColor Cyan
git push -u origin $Branch --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Pushed to https://github.com/Khatawutt/in-room-express-grab-go" -ForegroundColor Green
    Write-Host "GitHub Pages URL: https://khatawutt.github.io/in-room-express-grab-go/?room=101" -ForegroundColor Green
} else {
    Write-Error "git push failed with exit code $LASTEXITCODE. Please check your GitHub login/credentials."
    exit $LASTEXITCODE
}
