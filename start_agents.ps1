# Start all MCP agents in separate terminals

# Function to start an agent in a new terminal window
function Start-Agent {
    param (
        [string]$AgentName,
        [string]$Command
    )
    
    $psCommand = "$PSScriptRoot\start_agent.ps1 -AgentName '$AgentName' -Command '$Command'"
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "$psCommand"
}

# Start each agent in a new terminal
Start-Agent -AgentName "Orchestrator" -Command "python orchestrator.py"
Start-Agent -AgentName "Planner" -Command "python planner_agent.py"
Start-Agent -AgentName "Researcher" -Command "python researcher_agent.py"
Start-Agent -AgentName "Critic" -Command "python critic_agent.py"
Start-Agent -AgentName "Executor" -Command "python executor_agent.py"

Write-Host "All MCP agents have been started in separate terminal windows." -ForegroundColor Green
