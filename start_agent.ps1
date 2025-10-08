param (
    [Parameter(Mandatory=$true)]
    [string]$AgentName,
    
    [Parameter(Mandatory=$true)]
    [string]$Command
)

# Set the title of the terminal window
$host.ui.RawUI.WindowTitle = "MCP Agent: $AgentName"

# Change to the agents directory if needed
$agentsDir = Join-Path $PSScriptRoot "agents"
if (Test-Path $agentsDir) {
    Set-Location $agentsDir
}

Write-Host "=== Starting $AgentName Agent ===" -ForegroundColor Cyan
Write-Host "Command: $Command"
Write-Host "Working Directory: $(Get-Location)"
Write-Host "=" * 50

# Execute the command
Invoke-Expression $Command

# Keep the window open if there's an error
if ($LASTEXITCODE -ne 0) {
    Write-Host "Agent $AgentName exited with code $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}
