#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Arch = if ($args.Count -ge 1 -and $args[0]) { [string]$args[0] } else { 'x64' }
if ($Arch -notin @('x64', 'arm64')) {
	throw "Unsupported Windows arch: $Arch"
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $RepoRoot

$env:NODE_OPTIONS = '--max-old-space-size=8192'
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
$env:VSCODE_ARCH = $Arch
$env:npm_config_arch = $Arch

function Invoke-Logged([string]$File, [string[]]$NpmArgs) {
	Write-Host "==> $File $($NpmArgs -join ' ')"
	& $File @NpmArgs
	if ($LASTEXITCODE -ne 0) {
		throw "$File $($NpmArgs -join ' ') failed with $LASTEXITCODE"
	}
}

Invoke-Logged 'npm.cmd' @('ci')
Invoke-Logged 'npm.cmd' @('run', 'buildreact')
Invoke-Logged 'npm.cmd' @('run', 'gulp', '--', 'compile-build-without-mangling')
Invoke-Logged 'npm.cmd' @('run', 'gulp', '--', 'compile-extension-media')
Invoke-Logged 'npm.cmd' @('run', 'gulp', '--', 'compile-extensions-build')
Invoke-Logged 'npm.cmd' @('run', 'gulp', '--', 'minify-vscode')
Invoke-Logged 'npm.cmd' @('run', 'gulp', '--', "vscode-win32-$Arch-min-ci")
Invoke-Logged 'npm.cmd' @('run', 'gulp', '--', "vscode-win32-$Arch-inno-updater")
Invoke-Logged 'npm.cmd' @('run', 'gulp', '--', "vscode-win32-$Arch-user-setup")

$Setup = Join-Path $RepoRoot ".build\win32-$Arch\user-setup\VSCodeSetup.exe"
if (-not (Test-Path $Setup)) {
	throw "Missing Inno installer at $Setup"
}
$OutDir = Join-Path $RepoRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Dest = Join-Path $OutDir "KuundaVibeUserSetup-$Arch-unsigned.exe"
Copy-Item -Force $Setup $Dest
Write-Host "Wrote $Dest"
