# Installs the Sol Cesto mods into YOUR copy of the game.
# Usage: right-click install.bat > Run, or: powershell -ExecutionPolicy Bypass -File install.ps1 [-GameDir "D:\SteamLibrary\steamapps\common\Sol Cesto"]
param([string]$GameDir = "")

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Locate the game folder (the one that contains SolCesto.exe)
if (-not $GameDir) {
    $parent = Split-Path -Parent $here
    if (Test-Path (Join-Path $parent "SolCesto.exe")) { $GameDir = $parent }
    else { $GameDir = Read-Host "Path to the Sol Cesto folder (the one containing SolCesto.exe)" }
}
if (-not (Test-Path (Join-Path $GameDir "SolCesto.exe"))) { throw "SolCesto.exe not found in '$GameDir'" }
$pkg = Join-Path $GameDir "package"

# 2. Unpack the game's own package.zip into package\ (once)
if (-not (Test-Path (Join-Path $pkg "index.html"))) {
    Write-Host "Unpacking package.zip (about 230 MB, this takes a moment)..."
    Expand-Archive -Path (Join-Path $GameDir "package.zip") -DestinationPath $pkg -Force
}

# 3. Copy the mod loader and the mods
Copy-Item (Join-Path $here "modloader.js") $pkg -Force
Copy-Item (Join-Path $here "mods") $pkg -Recurse -Force

# 4. Load the mod loader from index.html (original kept as index.original.html)
$index = Join-Path $pkg "index.html"
$html = Get-Content $index -Raw -Encoding UTF8
if ($html -notmatch "modloader\.js") {
    Copy-Item $index (Join-Path $pkg "index.original.html") -Force
    $html = $html -replace '(\s*)<script src="scripts/modernjscheck.js"></script>', "`$1<script src=`"modloader.js`"></script>`$1<script src=`"scripts/modernjscheck.js`"></script>"
    [IO.File]::WriteAllText($index, $html, (New-Object Text.UTF8Encoding $false))
}

# 5. Steam app id, so Steam features (achievements) work when launched this way
$appid = Join-Path $pkg "steam_appid.txt"
if (-not (Test-Path $appid)) { Set-Content $appid "2738490" -NoNewline }

# 6. Launcher
$bat = Join-Path $GameDir "Play with mods.bat"
Set-Content $bat "@echo off`r`ncd /d `"%~dp0`"`r`nstart `"`" SolCesto.exe package`r`n"

Write-Host ""
Write-Host "Done. Start the game with: $bat"
Write-Host "(Steam's normal Play button still launches the unmodded game.)"
