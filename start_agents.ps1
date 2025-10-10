# Start all MCP agents required for the travel orchestration workflow

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

$shellPath = Get-PowerShellExecutable

function Start-AgentWindow {
    param (
        [string]$AgentName,
        [string]$ScriptName,
        [int]$DelaySeconds = 1
    )

    $helperScript = Join-Path $PSScriptRoot "start_agent.ps1"
    if (-not (Test-Path -LiteralPath $helperScript)) {
        Write-Error "Helper script '$helperScript' not found."
        exit 1
    }

    Write-Host "Starting $AgentName..." -ForegroundColor Green
    Start-Process -FilePath $shellPath -ArgumentList "-NoExit", "-File", $helperScript, "-AgentName", $AgentName, "-Script", $ScriptName
    Start-Sleep -Seconds $DelaySeconds
}

Start-AgentWindow -AgentName "Orchestrator" -ScriptName "orchestrator_mcp.py" -DelaySeconds 2
Start-AgentWindow -AgentName "Map"          -ScriptName "map_agent_mcp.py"
Start-AgentWindow -AgentName "Weather"      -ScriptName "weather_agent_mcp.py"
Start-AgentWindow -AgentName "Itinerary"    -ScriptName "itinerary_agent_mcp.py"
Start-AgentWindow -AgentName "Event"        -ScriptName "event_agent_mcp.py"

Write-Host "All MCP agents launched." -ForegroundColor Cyan
