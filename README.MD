# Ant Colony Optimization Algorithm Visualization

This project provides an interactive web application for visualizing the Ant Colony Optimization algorithm applied to the Traveling Salesman Problem (TSP). Users can input nodes either through a canvas interface or by entering text data, adjust algorithm parameters, and visualize the optimization process.

## Features

- **Interactive Node Input**: Add nodes by clicking on the canvas or paste formatted text input
- **Customizable Algorithm Parameters**: Adjust key ACO parameters including:
  - Number of ants
  - Maximum iterations
  - Alpha - importance of pheromone trails
  - Beta - importance of heuristic information
  - Rho - pheromone evaporation rate
  - Q - pheromone deposit factor
- **Visualization**: See the optimized path displayed on the canvas
- **Iteration History**: View paths found at each iteration of the algorithm
- **Convergence Chart**: Monitor how solution quality improves over time

## Project Structure

```
project/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── main.js
│   │   ├── visualization.js
│   │   └── convergence-chart.js
│   ├── aco_solver.cpp
│   └── index.html
├── routes/
│   └── index.js
├── temp/
│   ├── aco_solver.exe
│   ├── convergence.txt
│   ├── input.txt
│   ├── iteration_paths.txt
│   └── output.txt
├── app.js
└── package.json
```

## Prerequisites

- Node.js and npm
- C++ compiler (g++)

## Installation

1. Clone the repository
```bash
git clone https://github.com/pikasonix/GraduationResearch.git
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Open browser and navigate to `http://localhost:3000`

## Usage

### Adding Nodes
1. Use the canvas input tab to click and add nodes (the first node is considered the depot)
2. Alternatively, use the text input tab to paste formatted data:
```
antCount maxIterations alpha beta rho Q
numNodes
id1 x1 y1
id2 x2 y2
...
```

### Adjusting Parameters
Modify the algorithm parameters in the left panel:
- **Number of Ants**: More ants typically explore more of the solution space
- **Max Iterations**: Higher values allow more time for optimization
- **Alpha (α)**: Controls the influence of pheromone trails
- **Beta (β)**: Controls the influence of distances between nodes
- **Rho (ρ)**: Controls the rate of pheromone evaporation
- **Q**: Impacts the amount of pheromone deposited by ants

### Running the Algorithm
1. Click "Run ACO Algorithm" to start the optimization process
2. View the results in the visualization canvas
3. Explore different iterations using the iteration selector
4. Monitor convergence in the chart at the bottom

## How It Works

1. **Node Input**: User provides the coordinates of nodes (cities)
2. **Parameter Setup**: User configures the ACO algorithm parameters
3. **Backend Processing**: 
   - Node.js server writes the input data to a file
   - C++ implementation of ACO algorithm processes the data
   - Results are written back to output files
4. **Visualization**: 
   - Frontend reads and displays the optimized path
   - Shows convergence data in a chart
   - Allows exploration of different iterations

## ACO Algorithm

The Ant Colony Optimization algorithm mimics the behavior of ants finding the shortest path between their colony and a food source. It works through:

1. **Initialization**: Initializing pheromone trails on all edges
2. **Construction**: Ants construct solutions using probabilistic rules based on pheromone levels and distances
3. **Update**: Pheromone trails are updated based on solution quality
4. **Iteration**: The process repeats for a set number of iterations
