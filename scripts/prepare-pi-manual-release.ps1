#Requires -Version 5.1
<#
.SYNOPSIS
Prepares a freshly unpacked, isolated GitHub source archive for a manual Nexa release.
.DESCRIPTION
This script never fetches Git, changes the active release, touches services,
or writes to the managed Git checkout. It accepts no directory override:
its own parent repository tree is the only install destination.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtime = Join-Path $root 'scripts\pi-runtime'

function Assert-PlainDirectory {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Label is missing; use a fresh extracted GitHub archive."
    }
    $entry = Get-Item -LiteralPath $Path -Force
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "$Label must not be a symlink or junction."
    }
}

function Assert-FreshCandidate {
    Assert-PlainDirectory $root 'Candidate root'
    Assert-PlainDirectory (Join-Path $root 'scripts') 'Candidate scripts directory'
    Assert-PlainDirectory $runtime 'Pi runtime directory'
    if (Test-Path -LiteralPath (Join-Path $root '.git')) {
        throw 'Git working trees cannot be installation targets. Extract a source archive elsewhere.'
    }
    if (Test-Path -LiteralPath (Join-Path $root 'node_modules')) {
        throw 'Candidate root already contains dependencies; prepare a fresh archive instead.'
    }
    if (Test-Path -LiteralPath (Join-Path $runtime 'node_modules')) {
        throw 'Candidate Sidecar already contains dependencies; prepare a fresh archive instead.'
    }
    foreach ($relative in @(
        'package.json', 'package-lock.json',
        'scripts\pi-runtime\package.json',
        'scripts\pi-runtime\package-lock.json',
        'scripts\pi-runtime\runner.mjs',
        'scripts\pi-runtime\release-preflight.mjs'
    )) {
        $file = Join-Path $root $relative
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Missing source archive file: $relative"
        }
        $entry = Get-Item -LiteralPath $file -Force
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Source archive file must not be a link: $relative"
        }
    }
}

Assert-FreshCandidate
$node = (Get-Command 'node.exe' -CommandType Application -ErrorAction Stop).Source
$npm = (Get-Command 'npm.cmd' -CommandType Application -ErrorAction Stop).Source
$versionText = (& $node --version).Trim()
if ($LASTEXITCODE -ne 0 -or $versionText -notmatch '^v?(\d+)\.(\d+)\.(\d+)$') {
    throw 'Cannot verify the local Node version.'
}
$major = [int]$Matches[1]
$minor = [int]$Matches[2]
if ($major -lt 22 -or ($major -eq 22 -and $minor -lt 19)) {
    throw 'Pi manual release requires Node >=22.19.0.'
}

Push-Location -LiteralPath $root
try {
    & $npm ci --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        throw 'Root npm ci failed; candidate must not be deployed.'
    }
    & $npm ci --prefix $runtime --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        throw 'Pi Sidecar npm ci failed; candidate must not be deployed.'
    }
    & $node (Join-Path $runtime 'release-preflight.mjs')
    if ($LASTEXITCODE -ne 0) {
        throw 'Pi Sidecar preflight failed; candidate must not be deployed.'
    }
    # Does not switch the active release, register services, or touch the Git checkout.
    Write-Output '{"ok":true,"manual_release_candidate_prepared":true,"deployment_performed":false}'
} finally {
    Pop-Location
}
