

# Start Backend and Frontend only

Write-Host "Starting Backend Server (Port 3000)..."

# Start backend server in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; node server.js" -WindowStyle Normal

# Wait a moment for backend to start
Start-Sleep -Seconds 3

Write-Host "Starting Frontend Development Server (Port 5173)..."

# Start frontend development server in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal

Write-Host "Frontend (http://localhost:5173) and Backend (http://localhost:3000) started in separate windows."
Write-Host "Press Ctrl+C in each window to stop the servers."
