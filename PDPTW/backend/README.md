# PDPTW Backend

Python Flask backend for PDPTW problem solving and visualization.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure algorithm executables are available in `../RELEASE/` folder:
   - `PDPTW_ACO.exe`
   - `PDPTW_GREEDY_INSERTION.exe`
   - `PDPTW_HYBRID_ACO_GREEDY_V3.exe`

3. Run the server:
```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Algorithms
- `GET /api/algorithms` - List available algorithms

### Instance Management
- `POST /api/validate-instance` - Validate instance format
- `POST /api/upload-instance` - Upload instance file
- `GET /api/sample-instance` - Get sample instance

### Problem Solving
- `POST /api/solve` - Solve PDPTW problem

### Solution Management
- `POST /api/upload-solution` - Upload solution file

## API Usage Examples

### Solve Problem
```javascript
const response = await fetch('/api/solve', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        instance: instanceContent,
        algorithm: 'hybrid',
        params: {
            num_routes: 7,
            ants: 10,
            iterations: 20,
            alpha: 2.0,
            beta: 5.0,
            rho: 0.1,
            tau_max: 50.0,
            tau_min: 0.01,
            greedy_bias: 0.85,
            elite_solutions: 4,
            local_search_prob: 0.7,
            restart_threshold: 2
        }
    })
});

const result = await response.json();
```
