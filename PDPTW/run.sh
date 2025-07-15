#!/bin/bash

# PDPTW Visualizer - Setup and Run Script
# This script sets up and runs both frontend and backend

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # Port is in use
    else
        return 0  # Port is available
    fi
}

print_status "🚀 PDPTW Visualizer Setup & Run Script"
echo "================================================"

# Check prerequisites
print_status "Checking prerequisites..."

# Check Python
if command_exists python3; then
    PYTHON_CMD="python3"
    print_success "Python 3 found: $(python3 --version)"
elif command_exists python; then
    PYTHON_CMD="python"
    PYTHON_VERSION=$(python --version 2>&1)
    if [[ $PYTHON_VERSION == *"Python 3"* ]]; then
        print_success "Python 3 found: $PYTHON_VERSION"
    else
        print_error "Python 3 is required, but found: $PYTHON_VERSION"
        exit 1
    fi
else
    print_error "Python 3 is not installed"
    exit 1
fi

# Check pip
if command_exists pip3; then
    PIP_CMD="pip3"
elif command_exists pip; then
    PIP_CMD="pip"
else
    print_error "pip is not installed"
    exit 1
fi

print_success "pip found: $PIP_CMD"

# Setup backend
print_status "Setting up backend..."
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv
    print_success "Virtual environment created"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    # Windows
    source venv/Scripts/activate
else
    # Linux/Mac
    source venv/bin/activate
fi

# Install Python dependencies
print_status "Installing Python dependencies..."
$PIP_CMD install -r requirements.txt
print_success "Backend dependencies installed"

# Check algorithm executables
print_status "Checking algorithm executables..."
ALGO_DIR="../RELEASE"
ALGOS=("PDPTW_ACO.exe" "PDPTW_GREEDY_INSERTION.exe" "PDPTW_HYBRID_ACO_GREEDY_V3.exe")

for algo in "${ALGOS[@]}"; do
    if [ -f "$ALGO_DIR/$algo" ]; then
        print_success "Found: $algo"
    else
        print_warning "Missing: $algo (some algorithms may not work)"
    fi
done

# Check backend port
BACKEND_PORT=5000
if check_port $BACKEND_PORT; then
    print_success "Backend port $BACKEND_PORT is available"
else
    print_warning "Port $BACKEND_PORT is already in use. Backend may conflict."
fi

# Start backend server
print_status "Starting backend server on port $BACKEND_PORT..."
$PYTHON_CMD app.py &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid
print_success "Backend server started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 3

# Test backend connection
print_status "Testing backend connection..."
if curl -f http://localhost:$BACKEND_PORT/api/health >/dev/null 2>&1; then
    print_success "Backend is responding"
else
    print_error "Backend failed to start or is not responding"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Setup frontend
cd ../frontend
print_status "Setting up frontend..."

# Check frontend port
FRONTEND_PORT=8080
if check_port $FRONTEND_PORT; then
    print_success "Frontend port $FRONTEND_PORT is available"
else
    print_warning "Port $FRONTEND_PORT is already in use. Will try alternative ports."
    for port in 8081 8082 8083; do
        if check_port $port; then
            FRONTEND_PORT=$port
            print_status "Using alternative port: $FRONTEND_PORT"
            break
        fi
    done
fi

# Start frontend server
print_status "Starting frontend server on port $FRONTEND_PORT..."

# Try different HTTP server options
if command_exists npx; then
    npx http-server -p $FRONTEND_PORT -c-1 --cors &
    FRONTEND_PID=$!
    print_success "Frontend server started with http-server (PID: $FRONTEND_PID)"
elif command_exists python3; then
    python3 -m http.server $FRONTEND_PORT &
    FRONTEND_PID=$!
    print_success "Frontend server started with Python http.server (PID: $FRONTEND_PID)"
elif command_exists python; then
    python -m http.server $FRONTEND_PORT &
    FRONTEND_PID=$!
    print_success "Frontend server started with Python http.server (PID: $FRONTEND_PID)"
else
    print_error "No suitable HTTP server found. Please install Node.js or use a different method."
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo $FRONTEND_PID > frontend.pid

# Wait for frontend to start
sleep 2

# Print success message
echo ""
echo "================================================"
print_success "🎉 PDPTW Visualizer is now running!"
echo ""
echo "📊 Backend API:  http://localhost:$BACKEND_PORT"
echo "🌐 Frontend App: http://localhost:$FRONTEND_PORT"
echo ""
echo "📝 Logs:"
echo "   Backend:  Check terminal output"
echo "   Frontend: Check browser console"
echo ""
echo "🛑 To stop the servers:"
echo "   ./stop.sh"
echo "   OR"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "📚 Documentation:"
echo "   Backend:  backend/README.md"
echo "   Frontend: frontend/README.md"
echo "================================================"

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash

# PDPTW Visualizer - Stop Script

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_status "🛑 Stopping PDPTW Visualizer..."

# Stop backend
if [ -f "backend/backend.pid" ]; then
    BACKEND_PID=$(cat backend/backend.pid)
    if kill $BACKEND_PID 2>/dev/null; then
        print_success "Backend server stopped (PID: $BACKEND_PID)"
    else
        print_status "Backend server was not running"
    fi
    rm -f backend/backend.pid
fi

# Stop frontend
if [ -f "frontend/frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend/frontend.pid)
    if kill $FRONTEND_PID 2>/dev/null; then
        print_success "Frontend server stopped (PID: $FRONTEND_PID)"
    else
        print_status "Frontend server was not running"
    fi
    rm -f frontend/frontend.pid
fi

print_success "All servers stopped"
EOF

chmod +x stop.sh

# Auto-open browser (optional)
if command_exists xdg-open; then
    # Linux
    xdg-open "http://localhost:$FRONTEND_PORT" &
elif command_exists open; then
    # macOS
    open "http://localhost:$FRONTEND_PORT" &
elif command_exists start; then
    # Windows
    start "http://localhost:$FRONTEND_PORT" &
fi

# Keep script running to monitor servers
print_status "Monitoring servers (Ctrl+C to stop)..."
trap 'echo ""; print_status "Stopping servers..."; ./stop.sh; exit 0' INT

# Monitor server health
while true; do
    sleep 30
    
    # Check backend
    if ! curl -f http://localhost:$BACKEND_PORT/api/health >/dev/null 2>&1; then
        print_error "Backend server is not responding"
    fi
    
    # Check frontend
    if ! curl -f http://localhost:$FRONTEND_PORT >/dev/null 2>&1; then
        print_error "Frontend server is not responding"
    fi
done
