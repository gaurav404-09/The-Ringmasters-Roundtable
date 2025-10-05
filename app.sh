#!/bin/bash

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to start all services
start_services() {
    echo "Starting RabbitMQ..."
    brew services start rabbitmq
    
    echo "Starting all services with PM2..."
    pm2 start ecosystem.config.js
    
    # Save the PM2 process list
    pm2 save
    
    # Set PM2 to start on system boot
    pm2 startup
    
    echo "All services started!"
    echo "Frontend: http://localhost:5173"
    echo "Backend API: http://localhost:3001"
    echo "PM2 Dashboard: Run 'pm2 monit' to monitor all services"
}

# Function to stop all services
stop_services() {
    echo "Stopping all services..."
    pm2 stop all
    brew services stop rabbitmq
    echo "All services stopped."
}

# Function to restart all services
restart_services() {
    echo "Restarting all services..."
    pm2 restart all
    echo "All services restarted."
}

# Function to show status of all services
status() {
    echo "=== Service Status ==="
    echo "RabbitMQ: $(brew services list | grep rabbitmq | awk '{print $2}')"
    echo ""
    pm2 status
}

# Function to view logs
show_logs() {
    echo "Available logs:"
    echo "1. Backend"
    echo "2. Frontend"
    echo "3. Orchestrator"
    echo "4. Map Agent"
    echo "5. Weather Agent"
    echo "6. Itinerary Agent"
    echo "7. Event Agent"
    echo "8. All logs"
    echo "0. Back to main menu"
    
    read -p "Select an option (0-8): " log_choice
    
    case $log_choice in
        1) pm2 logs backend --lines 50 ;;
        2) pm2 logs frontend --lines 50 ;;
        3) pm2 logs orchestrator --lines 50 ;;
        4) pm2 logs map-agent --lines 50 ;;
        5) pm2 logs weather-agent --lines 50 ;;
        6) pm2 logs itinerary-agent --lines 50 ;;
        7) pm2 logs event-agent --lines 50 ;;
        8) pm2 logs --lines 20 ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

# Main menu
while true; do
    echo ""
    echo "=== Trip Planning App Manager ==="
    echo "1. Start All Services"
    echo "2. Stop All Services"
    echo "3. Restart All Services"
    echo "4. Check Status"
    echo "5. View Logs"
    echo "0. Exit"
    echo ""
    
    read -p "Select an option (0-5): " choice
    
    case $choice in
        1) start_services ;;
        2) stop_services ;;
        3) restart_services ;;
        4) status ;;
        5) show_logs ;;
        0) 
            echo "Exiting..."
            exit 0
            ;;
        *) echo "Invalid option. Please try again." ;;
    esac
    
    # Pause to see the output
    read -p "Press [Enter] to continue..."
    clear
done
