param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ExpectedActiveEngineHash = '9fc2984b3126b12fd35d6ca57b1c05f7038f7fd7414726ab6c12a9c2f308dd55'
$ExpectedCompressedRulesHash = 'f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db'

Set-Location $ProjectRoot

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$OutputDir = Join-Path $ProjectRoot 'data\outputs\manual_validation'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$TranscriptPath = Join-Path $OutputDir "medical-final-validation-$Stamp.log"
$SummaryPath = Join-Path $OutputDir "medical-final-validation-$Stamp-summary.txt"

$Failures = New-Object 'System.Collections.Generic.List[string]'
$Results = New-Object 'System.Collections.Generic.List[object]'

function Add-Result {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Details
    )

    $Results.Add([PSCustomObject]@{
        Step    = $Name
        Status  = $Status
        Details = $Details
    })
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    Write-Host "STEP: $Name" -ForegroundColor Cyan
    Write-Host ('=' * 78) -ForegroundColor DarkGray

    $global:LASTEXITCODE = 0

    try {
        & $Action

        if ($global:LASTEXITCODE -ne 0) {
            throw "External command exited with code $global:LASTEXITCODE"
        }

        Add-Result -Name $Name -Status 'PASS' -Details ''
        Write-Host "PASS: $Name" -ForegroundColor Green
    }
    catch {
        $message = $_.Exception.Message
        $Failures.Add("$Name :: $message")
        Add-Result -Name $Name -Status 'FAIL' -Details $message
        Write-Host "FAIL: $Name" -ForegroundColor Red
        Write-Host $message -ForegroundColor Red
    }
}

function Get-LowerSha256 {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Missing file: $Path"
    }

    return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Invoke-NpmScriptIfPresent {
    param(
        [object]$PackageJson,
        [string]$ScriptName
    )

    $property = $PackageJson.scripts.PSObject.Properties |
        Where-Object { $_.Name -eq $ScriptName } |
        Select-Object -First 1

    if ($null -eq $property) {
        Write-Host "SKIP: npm script '$ScriptName' does not exist." -ForegroundColor Yellow
        Add-Result -Name "npm run $ScriptName" -Status 'SKIP' -Details 'Script not present'
        return
    }

    Invoke-Step -Name "npm run $ScriptName" -Action {
        & npm run $ScriptName
    }
}

Start-Transcript -Path $TranscriptPath -Force | Out-Null

try {
    Invoke-Step -Name 'Repository preflight' -Action {
        Write-Host "Project: $ProjectRoot"
        Write-Host "Branch:"
        & git branch --show-current

        Write-Host "HEAD:"
        & git rev-parse HEAD

        Write-Host "Git status:"
        & git status --short

        if (-not (Test-Path '.\package.json')) {
            throw 'package.json is missing'
        }

        & node --version
        & npm --version
    }

    Invoke-Step -Name 'Protected file hash baseline' -Action {
        $activeHash = Get-LowerSha256 '.\data\canon_db\active_engine.md'
        $rulesHash = Get-LowerSha256 '.\data\error_report_db\compressed_rules.md'

        Write-Host "active_engine.md:   $activeHash"
        Write-Host "compressed_rules.md: $rulesHash"

        if ($activeHash -ne $ExpectedActiveEngineHash) {
            throw "active_engine hash mismatch. Expected $ExpectedActiveEngineHash, got $activeHash"
        }

        if ($rulesHash -ne $ExpectedCompressedRulesHash) {
            throw "compressed_rules hash mismatch. Expected $ExpectedCompressedRulesHash, got $rulesHash"
        }
    }

    Invoke-Step -Name 'Existing candidate and review records' -Action {
        $reviewRoot = '.\data\outputs\engine_candidate_reviews\engine_review_20260723-213559-57a3547b'

        $required = @(
            "$reviewRoot\review.json",
            "$reviewRoot\diff.md"
        )

        foreach ($path in $required) {
            if (-not (Test-Path $path)) {
                throw "Missing review artifact: $path"
            }

            Write-Host "Found: $path"
        }

        $reviewText = Get-Content "$reviewRoot\review.json" -Raw

        if ($reviewText -notmatch 'engine_candidate_20260723-213559-faed1ed5') {
            throw 'Review does not reference expected candidate ID'
        }

        if ($reviewText -notmatch '"engine_activation_requested"\s*:\s*false') {
            throw 'Review does not confirm activation_requested=false'
        }

        if ($reviewText -notmatch '"active_engine_modified"\s*:\s*false') {
            throw 'Review does not confirm active_engine_modified=false'
        }
    }

    Invoke-Step -Name 'Medical configuration JSON parse' -Action {
        $config = Get-Content '.\config\medical-continuity.json' -Raw |
            ConvertFrom-Json

        if ($null -eq $config) {
            throw 'medical-continuity.json parsed as null'
        }

        Write-Host 'medical-continuity.json parsed successfully.'
    }

    Invoke-Step -Name 'Semantic source scan' -Action {
        $sourceRoots = @(
            '.\config',
            '.\server\src',
            '.\scripts'
        )

        $sourceFiles = foreach ($root in $sourceRoots) {
            if (Test-Path $root) {
                Get-ChildItem $root -Recurse -File |
                    Where-Object {
                        $_.Extension -in @('.json', '.mjs', '.js', '.md')
                    }
            }
        }

        $staleVersion = $sourceFiles |
            Select-String -Pattern '本版為.+v5\.0\.19' -ErrorAction SilentlyContinue

        if ($staleVersion) {
            $lines = $staleVersion |
                ForEach-Object { "$($_.Path):$($_.LineNumber)" }

            throw "Stale v5.0.19 source text remains: $($lines -join ', ')"
        }

        $medicalText = Get-Content '.\config\medical-continuity.json' -Raw

        $requiredTerms = @(
            '生命復歸',
            '自我治療',
            '本源',
            'ordinary',
            'recovery',
            'competition',
            'active_restrictions'
        )

        foreach ($term in $requiredTerms) {
            if ($medicalText -notmatch [regex]::Escape($term)) {
                throw "medical-continuity.json is missing required semantic term: $term"
            }
        }
    }

    Invoke-Step -Name 'JavaScript and MJS syntax checks' -Action {
        $changedFiles = @(& git diff --name-only --diff-filter=ACMR)

        $scriptFiles = $changedFiles |
            Where-Object {
                $_ -match '\.(mjs|cjs|js)$' -and
                (Test-Path $_)
            }

        if (-not $scriptFiles) {
            Write-Host 'No changed JavaScript/MJS files found.'
            return
        }

        foreach ($file in $scriptFiles) {
            Write-Host "node --check $file"
            & node --check $file

            if ($LASTEXITCODE -ne 0) {
                throw "Syntax check failed: $file"
            }
        }
    }

    Invoke-Step -Name 'Changed tests individually' -Action {
        $changedTests = @(& git diff --name-only --diff-filter=ACMR) |
            Where-Object {
                $_ -match '^tests/.+\.test\.mjs$' -and
                (Test-Path $_)
            }

        if (-not $changedTests) {
            Write-Host 'No changed test files detected.'
            return
        }

        foreach ($test in $changedTests) {
            Write-Host ''
            Write-Host "Running: node $test" -ForegroundColor DarkCyan
            & node $test

            if ($LASTEXITCODE -ne 0) {
                throw "Changed test failed: $test"
            }
        }
    }

    $packageJson = Get-Content '.\package.json' -Raw | ConvertFrom-Json

    $optionalScripts = @(
        'lint',
        'typecheck',
        'type-check',
        'check:types',
        'format:check',
        'format-check',
        'check:format'
    )

    foreach ($script in $optionalScripts) {
        Invoke-NpmScriptIfPresent -PackageJson $packageJson -ScriptName $script
    }

    Invoke-Step -Name 'Complete npm test suite' -Action {
        & npm test
    }

    Invoke-Step -Name 'Git whitespace and patch validation' -Action {
        & git diff --check
    }

    Invoke-Step -Name 'Protected hashes after testing' -Action {
        $activeHash = Get-LowerSha256 '.\data\canon_db\active_engine.md'
        $rulesHash = Get-LowerSha256 '.\data\error_report_db\compressed_rules.md'

        Write-Host "active_engine.md:   $activeHash"
        Write-Host "compressed_rules.md: $rulesHash"

        if ($activeHash -ne $ExpectedActiveEngineHash) {
            throw "active_engine changed during validation: $activeHash"
        }

        if ($rulesHash -ne $ExpectedCompressedRulesHash) {
            throw "compressed_rules changed during validation: $rulesHash"
        }
    }

    Invoke-Step -Name 'Final git status' -Action {
        & git status --short
        Write-Host ''
        & git diff --stat
    }
}
finally {
    $summaryLines = New-Object 'System.Collections.Generic.List[string]'

    $summaryLines.Add("Medical final validation: $Stamp")
    $summaryLines.Add('')
    $summaryLines.Add('Results:')

    foreach ($result in $Results) {
        $summaryLines.Add(
            ('[{0}] {1} {2}' -f $result.Status, $result.Step, $result.Details)
        )
    }

    $summaryLines.Add('')
    $summaryLines.Add("Failure count: $($Failures.Count)")

    foreach ($failure in $Failures) {
        $summaryLines.Add("FAILURE: $failure")
    }

    $summaryLines.Add('')
    $summaryLines.Add("Transcript: $TranscriptPath")

    $summaryLines |
        Set-Content -Encoding UTF8 -Path $SummaryPath

    Stop-Transcript | Out-Null

    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    Write-Host "Summary: $SummaryPath" -ForegroundColor Cyan
    Write-Host "Transcript: $TranscriptPath" -ForegroundColor Cyan
    Write-Host ('=' * 78) -ForegroundColor DarkGray
}

if ($Failures.Count -gt 0) {
    Write-Host "Validation finished with $($Failures.Count) failure(s)." -ForegroundColor Red
    exit 1
}

Write-Host 'All validation steps passed.' -ForegroundColor Green
exit 0
