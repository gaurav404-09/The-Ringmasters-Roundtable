# Start all MCP AI agents in separate terminal windows

# Function to start a Python process in a new window
function Start-PythonAgent {
    param (
        [string]$Title,
        [string]$ScriptPath
    )
    
    $command = "python $ScriptPath"
    $psCommand = "`$host.UI.RawUI.WindowTitle = '$Title'; cd '$PWD\\backend\\mcp-ai'; $command; Write-Host 'Press any key to exit...'; $null = `$host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
    
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $psCommand
}

# Change to the mcp-ai directory
$mcpAiPath = "$PWD\backend\mcp-ai"

# Start Orchestrator Agent
Write-Host "Starting Orchestrator Agent..." -ForegroundColor Green
Start-PythonAgent -Title "Orchestrator Agent" -ScriptPath "orchestrator_mcp.py"

# Start Event Agent
Write-Host "Starting Event Agent..." -ForegroundColor Green
Start-PythonAgent -Title "Event Agent" -ScriptPath "event_agent_mcp.py"

# Start Itinerary Agent
Write-Host "Starting Itinerary Agent..." -ForegroundColor Green
Start-PythonAgent -Title "Itinerary Agent" -ScriptPath "itinerary_agent_mcp.py"

# Start Map Agent
Write-Host "Starting Map Agent..." -ForegroundColor Green
Start-PythonAgent -Title "Map Agent" -ScriptPath "map_agent_mcp.py"

# Start Weather Agent
Write-Host "Starting Weather Agent..." -ForegroundColor Green
Start-PythonAgent -Title "Weather Agent" -ScriptPath "weather_agent_mcp.py"

Write-Host "`nAll MCP AI agents have been started in separate windows." -ForegroundColor Green
Write-Host "`nPress any key to close this window..." -ForegroundColor Yellow
$null = $host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
