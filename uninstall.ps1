# Removes the mods: restores the original index.html and deletes the mod files.
param([string]$GameDir = "")
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $GameDir) {
    $parent = Split-Path -Parent $here
    if (Test-Path (Join-Path $parent "SolCesto.exe")) { $GameDir = $parent }
    else { $GameDir = Read-Host "Path to the Sol Cesto folder (the one containing SolCesto.exe)" }
}
$pkg = Join-Path $GameDir "package"
$orig = Join-Path $pkg "index.original.html"
if (Test-Path $orig) { Move-Item $orig (Join-Path $pkg "index.html") -Force }
foreach ($p in "modloader.js", "mods") { $f = Join-Path $pkg $p; if (Test-Path $f) { Remove-Item $f -Recurse -Force } }
$bat = Join-Path $GameDir "Play with mods.bat"
if (Test-Path $bat) { Remove-Item $bat -Force }
Write-Host "Mods removed. (The unpacked package folder is kept; delete it if you want the disk space back.)"
