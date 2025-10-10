param (
    [Parameter(Mandatory = $true)]
    [string]$AgentName,

    [Parameter(Mandatory = $true)]
    [string]$Script
)

function Get-PowerShellExecutable {
    $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($pwshCommand) {
        return $pwshCommand.Source
    }

    $windowsPowerShell = Join-Path $env:SystemRoot "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    if (Test-Path -LiteralPath $windowsPowerShell) {
        return $windowsPowerShell
    }

    throw "Unable to locate a PowerShell executable (tried pwsh.exe and Windows PowerShell)."
}

$repoRootCandidates = @()
if ($PSScriptRoot) {
    $repoRootCandidates += $PSScriptRoot
    $repoRootCandidates += (Split-Path -Parent $PSScriptRoot)
}

$mcpDir = $null
foreach ($candidate in $repoRootCandidates) {
    if (-not $candidate) { continue }
    $path = Join-Path $candidate "backend\mcp-ai"
    if (Test-Path -LiteralPath $path) {
        $mcpDir = $path
        break
    }
}

if (-not $mcpDir) {
    Write-Error "MCP directory not found. Tried: $($repoRootCandidates | ForEach-Object { Join-Path $_ 'backend\mcp-ai' })"
    exit 1
}

$pythonPath = Join-Path $mcpDir "venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonPath)) {
    Write-Error "Python virtual environment not found. Expected at '$pythonPath'. Run 'python -m venv backend\\mcp-ai\\venv' and install dependencies before starting agents."
    exit 1
}

$scriptPath = Join-Path $mcpDir $Script
if (-not (Test-Path -LiteralPath $scriptPath)) {
    Write-Error "Agent script '$Script' not found in '$mcpDir'."
    exit 1
}

$windowTitle = "MCP Agent: $AgentName"
$commandTemplate = @'
$host.UI.RawUI.WindowTitle = '{0}'
Set-Location -LiteralPath '{1}'
Write-Host '=== Starting {2} Agent ===' -ForegroundColor Cyan
Write-Host 'Python: {3}'
Write-Host 'Script: {4}'
Write-Host ('=' * 50)
& '{3}' '{4}'
if ($LASTEXITCODE -ne 0) {{
  Write-Host "Agent {2} exited with code $LASTEXITCODE" -ForegroundColor Red
  Write-Host 'Press any key to exit...'
  $null = $host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}} else {{
  Write-Host 'Agent {2} started successfully.' -ForegroundColor Green
  Write-Host 'Press Ctrl+C to stop this agent.'
}}
'@

$psCommand = [string]::Format($commandTemplate, $windowTitle, $mcpDir, $AgentName, $pythonPath, $scriptPath)
$shellPath = Get-PowerShellExecutable

Start-Process -FilePath $shellPath -ArgumentList "-NoExit", "-Command", $psCommand
