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
function Convert-ToPmtiles($mb, $pm) {
  # Try native pmtiles CLI
  $pmtilesCmd = (Get-Command 'pmtiles' -ErrorAction SilentlyContinue)
  if ($pmtilesCmd) {
    & pmtiles convert $mb $pm
    return
  }
  # Try Python pmtiles (PyPI: pmtiles)
  $py = (Get-Command 'python' -ErrorAction SilentlyContinue)
  if ($py) {
    try {
      Write-Host "== Using Python module 'pmtiles' to convert =="
      & python -m pmtiles.cli convert $mb $pm
      return
    } catch {
      Write-Host "Python module 'pmtiles' not available, trying 'pypmtiles'..."
      try {
        & python -m pypmtiles.cli convert $mb $pm
        return
      } catch {
        throw "Neither 'pmtiles' CLI nor Python modules ('pmtiles'/'pypmtiles') are available. Install one of: `n- Go: go install github.com/protomaps/go-pmtiles/cmd/pmtiles@latest`n- Python: pip install pmtiles  または pip install pypmtiles"
      }
    }
  }
  throw "Command not found: pmtiles. Install one of: `n- Go: go install github.com/protomaps/go-pmtiles/cmd/pmtiles@latest`n- Python: pip install pmtiles  または pip install pypmtiles"
}

if (!(Test-Path $planetilerJar)) {
  Write-Host "== Downloading planetiler-openmaptiles.jar =="
  $release = 'https://github.com/onthegomap/planetiler-openmaptiles/releases/latest/download/planetiler-openmaptiles.jar'
  Invoke-WebRequest -Uri $release -OutFile $planetilerJar
}

Write-Host "== Generating MBTiles with Planetiler (this may take a while) =="
& java -Xmx8g -jar $planetilerJar --download --bounds=$bounds --output=$outMbtiles

Write-Host "== Converting to PMTiles =="
Convert-ToPmtiles $outMbtiles $outPmtiles

Write-Host "== Done =="
Write-Host "Output: $outPmtiles"
