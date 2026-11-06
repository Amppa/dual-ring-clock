<#
.SYNOPSIS
    DualRing Clock Android Build & Deploy Script for PowerShell.
.DESCRIPTION
    Wraps node tools/deploy-apk.mjs with flags for build, install, or full deployment.
.EXAMPLE
    .\tools\deploy-apk.ps1               # Full build + install + launch
    .\tools\deploy-apk.ps1 -BuildOnly    # Build APK only
    .\tools\deploy-apk.ps1 -InstallOnly  # Install existing APK to phone
#>
param(
    [switch]$BuildOnly,
    [switch]$InstallOnly
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

$extraArgs = @()
if ($BuildOnly) { $extraArgs += "--build-only" }
if ($InstallOnly) { $extraArgs += "--install-only" }

node tools/deploy-apk.mjs @extraArgs

