# Requires: Java 17+, planetiler-openmaptiles.jar, pmtiles CLI in PATH
# Output: tiles\fukuchiyama.pmtiles
# Usage: Run from repo root (community_mapmaker2) in PowerShell:
#   pwsh -ExecutionPolicy Bypass -File .\scripts\generate_pmtiles.ps1

$ErrorActionPreference = 'Stop'

# Parameters
$bounds = '134.90,35.05,135.45,35.55' # west,south,east,north (Fukuchiyama area)
$osmPbfUrl = 'https://download.geofabrik.de/asia/japan/kansai-latest.osm.pbf'
$workDir = Join-Path (Get-Location) 'tools'
$planetilerJar = Join-Path $workDir 'planetiler.jar'
$osmPbf = Join-Path $workDir 'kansai-latest.osm.pbf'
$outPmtiles = Join-Path (Join-Path (Get-Location) 'tiles') 'fukuchiyama.pmtiles'

# Ensure folders
if (!(Test-Path $workDir)) { New-Item -ItemType Directory -Path $workDir | Out-Null }
if (!(Test-Path (Join-Path (Get-Location) 'tiles'))) { New-Item -ItemType Directory -Path (Join-Path (Get-Location) 'tiles') | Out-Null }

function Assert-Cmd($cmd, $hint) {
  $exist = (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
  if (-not $exist) { throw "Command not found: $cmd. $hint" }
}

Write-Host "== Checking prerequisites =="
# Use absolute path for Java if available
$javaExe = "java"
$javaHome = "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin\java.exe"
if (Test-Path $javaHome) {
  $javaExe = $javaHome
  Write-Host "Using Java at: $javaExe"
} else {
  Assert-Cmd 'java' 'Install Java 21+ (Temurin).'
}

if (!(Test-Path $planetilerJar)) {
  Write-Host "== Downloading planetiler.jar =="
  $release = 'https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar'
  Invoke-WebRequest -Uri $release -OutFile $planetilerJar
}

if (!(Test-Path $osmPbf)) {
  Write-Host "== Downloading Kansai OSM PBF (約630MB、数分かかります) =="
  Invoke-WebRequest -Uri $osmPbfUrl -OutFile $osmPbf
  Write-Host "Downloaded: $osmPbf"
}

Write-Host "== Generating PMTiles with Planetiler (福知山範囲のみ抽出) =="
Write-Host "Bounds: $bounds (福知山市周辺)"
Write-Host "Input: $osmPbf"
Write-Host "Output: $outPmtiles"
& $javaExe -Xmx8g -jar $planetilerJar --osm-path=$osmPbf --bounds=$bounds --output=$outPmtiles --download

Write-Host "== Done =="
Write-Host "Output: $outPmtiles"
