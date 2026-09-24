# Builds the Windows dev environment from scratch and runs the test suite.
# Needs Node.js 20.9+ (Next 16). Install: winget install OpenJS.NodeJS.LTS
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js not found on PATH. Install it with: winget install OpenJS.NodeJS.LTS'
}
Write-Host "node $(node -v)"

# npm ci installs exactly what package-lock.json pins, including the
# win32 builds of native packages (swc, lightningcss, tailwind oxide).
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

npm test
if ($LASTEXITCODE -ne 0) { throw 'npm test failed' }

Write-Host 'Setup complete. Start the dev server with: npm run dev'
