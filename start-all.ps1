

# Start all MCP AI agents in separate terminal windows

# Function to start a Python process in a new window
function Start-ProcessInNewWindow {
    param (
        [string]$Title,
        [string]$Command,
        [string]$WorkingDir = $PWD
    )
    
    $psCommand = "`$host.UI.RawUI.WindowTitle = '$Title'; cd '$WorkingDir'; $Command; Write-Host 'Press any key to exit...'; $null = `$host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
    
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $psCommand
}

# Set the path to the mcp-ai directory
$mcpAiPath = "$PWD\backend\mcp-ai"

# Start Orchestrator Agent
Write-Host "Starting Orchestrator Agent..." -ForegroundColor Green
Start-ProcessInNewWindow -Title "Orchestrator Agent" -Command "python orchestrator_mcp.py" -WorkingDir $mcpAiPath
Start-Sleep -Seconds 2

# Start Event Agent
Write-Host "Starting Event Agent..." -ForegroundColor Green
Start-ProcessInNewWindow -Title "Event Agent" -Command "python event_agent_mcp.py" -WorkingDir $mcpAiPath
Start-Sleep -Seconds 1

# Start Itinerary Agent
Write-Host "Starting Itinerary Agent..." -ForegroundColor Green
Start-ProcessInNewWindow -Title "Itinerary Agent" -Command "python itinerary_agent_mcp.py" -WorkingDir $mcpAiPath
Start-Sleep -Seconds 1

# Start Map Agent
Write-Host "Starting Map Agent..." -ForegroundColor Green
Start-ProcessInNewWindow -Title "Map Agent" -Command "python map_agent_mcp.py" -WorkingDir $mcpAiPath
Start-Sleep -Seconds 1

# Start Weather Agent
Write-Host "Starting Weather Agent..." -ForegroundColor Green
Start-ProcessInNewWindow -Title "Weather Agent" -Command "python weather_agent_mcp.py" -WorkingDir $mcpAiPath

Write-Host "`nAll MCP AI agents have been started in separate windows." -ForegroundColor Green
Write-Host "`nPress any key to close this window..." -ForegroundColor Yellow
$null = $host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
