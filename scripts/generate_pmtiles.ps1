# Requires: Java 17+, planetiler-openmaptiles.jar, pmtiles CLI in PATH
# Output: tiles\fukuchiyama.pmtiles
# Usage: Run from repo root (community_mapmaker2) in PowerShell:
#   pwsh -ExecutionPolicy Bypass -File .\scripts\generate_pmtiles.ps1

$ErrorActionPreference = 'Stop'

# Parameters
$bounds = '134.90,35.05,135.45,35.55' # west,south,east,north (Fukuchiyama area wide)
$workDir = Join-Path (Get-Location) 'tools'
$planetilerJar = Join-Path $workDir 'planetiler-openmaptiles.jar'
$outMbtiles = Join-Path $workDir 'fukuchiyama.mbtiles'
$outPmtiles = Join-Path (Join-Path (Get-Location) 'tiles') 'fukuchiyama.pmtiles'

# Ensure folders
if (!(Test-Path $workDir)) { New-Item -ItemType Directory -Path $workDir | Out-Null }
if (!(Test-Path (Join-Path (Get-Location) 'tiles'))) { New-Item -ItemType Directory -Path (Join-Path (Get-Location) 'tiles') | Out-Null }

function Assert-Cmd($cmd, $hint) {
  $exist = (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
  if (-not $exist) { throw "Command not found: $cmd. $hint" }
}

Write-Host "== Checking prerequisites =="
Assert-Cmd 'java' 'Install Java 17+ (Temurin).'
Assert-Cmd 'pmtiles' 'Install pmtiles CLI from https://github.com/protomaps/PMTiles/releases and add to PATH.'

if (!(Test-Path $planetilerJar)) {
  Write-Host "== Downloading planetiler-openmaptiles.jar =="
  $release = 'https://github.com/onthegomap/planetiler-openmaptiles/releases/latest/download/planetiler-openmaptiles.jar'
  Invoke-WebRequest -Uri $release -OutFile $planetilerJar
}

Write-Host "== Generating MBTiles with Planetiler (this may take a while) =="
& java -Xmx8g -jar $planetilerJar --download --bounds=$bounds --output=$outMbtiles

Write-Host "== Converting to PMTiles =="
& pmtiles convert $outMbtiles $outPmtiles

Write-Host "== Done =="
Write-Host "Output: $outPmtiles"
