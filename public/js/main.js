document.addEventListener('DOMContentLoaded', () => {
    // Original elements
    const canvasTab = document.getElementById('canvas-tab');
    const textTab = document.getElementById('text-tab');
    const canvasInput = document.getElementById('canvas-input');
    const textInput = document.getElementById('text-input');
    const inputCanvas = document.getElementById('input-canvas');
    const inputText = document.getElementById('input-text');
    const parseTextBtn = document.getElementById('parse-text');
    const clearCanvasBtn = document.getElementById('clear-canvas');
    const runAlgorithmBtn = document.getElementById('run-algorithm');
    const resultsContainer = document.getElementById('results-container');

    // New element for iteration selection
    const iterationSelector = document.createElement('div');
    iterationSelector.id = 'iteration-selector';
    iterationSelector.className = 'iteration-selector';
    iterationSelector.innerHTML = `
        <h3>Iterations</h3>
        <div class="iteration-list" id="iteration-list">
            <p>No iterations available</p>
        </div>
    `;

    // Add the iteration selector to the visualization section
    const visualizationSection = document.querySelector('.visualization');
    visualizationSection.appendChild(iterationSelector);

    // Canvas input manager
    const canvasInputManager = new CanvasInputManager(inputCanvas);

    // Visualization manager
    const visualizationCanvas = document.getElementById('visualization-canvas');
    const visualizationManager = new VisualizationManager(visualizationCanvas);

    // Convergence chart manager
    const convergenceChartCanvas = document.getElementById('convergence-chart');
    const convergenceChartManager = new ConvergenceChartManager(convergenceChartCanvas);

    // Tab switching
    canvasTab.addEventListener('click', () => {
        canvasTab.classList.add('active');
        textTab.classList.remove('active');
        canvasInput.classList.add('active');
        textInput.classList.remove('active');
    });

    textTab.addEventListener('click', () => {
        textTab.classList.add('active');
        canvasTab.classList.remove('active');
        textInput.classList.add('active');
        canvasInput.classList.remove('active');
    });

    // Parse text input
    parseTextBtn.addEventListener('click', () => {
        try {
            const text = inputText.value.trim();
            if (!text) {
                alert('Please enter input text');
                return;
            }

            const lines = text.split('\n');
            const params = lines[0].split(' ').map(Number);
            const numNodes = parseInt(lines[1]);

            if (lines.length < numNodes + 2) {
                alert('Invalid input: Not enough lines for the specified number of nodes');
                return;
            }

            // Update algorithm parameters
            document.getElementById('antCount').value = params[0] || 20;
            document.getElementById('maxIterations').value = params[1] || 100;
            document.getElementById('alpha').value = params[2] || 2.0;
            document.getElementById('beta').value = params[3] || 3.0;
            document.getElementById('rho').value = params[4] || 0.01;
            document.getElementById('q').value = params[5] || 100.0;

            // Parse nodes
            const nodes = [];
            for (let i = 0; i < numNodes; i++) {
                const nodeLine = lines[i + 2].split(' ').map(Number);
                nodes.push({
                    id: nodeLine[0],
                    x: nodeLine[1],
                    y: nodeLine[2]
                });
            }

            // Update canvas with parsed nodes
            canvasInputManager.clearNodes();
            nodes.forEach(node => {
                canvasInputManager.addNode(node.x, node.y);
            });

            // Switch to canvas tab
            canvasTab.click();

            alert('Input parsed successfully');
        } catch (error) {
            alert('Error parsing input: ' + error.message);
        }
    });

    // Clear canvas
    clearCanvasBtn.addEventListener('click', () => {
        canvasInputManager.clearNodes();
    });

    // Run ACO algorithm
    runAlgorithmBtn.addEventListener('click', async () => {
        // Get nodes from canvas
        const nodes = canvasInputManager.getNodes();
        if (nodes.length < 2) {
            alert('Please add at least 2 nodes (including the depot) or, if entering from Text Input, click Parse Text before running the algorithm!');
            return;
        }

        // Get algorithm parameters
        const parameters = {
            antCount: parseInt(document.getElementById('antCount').value) || 20,
            maxIterations: parseInt(document.getElementById('maxIterations').value) || 100,
            alpha: parseFloat(document.getElementById('alpha').value) || 2.0,
            beta: parseFloat(document.getElementById('beta').value) || 3.0,
            rho: parseFloat(document.getElementById('rho').value) || 0.01,
            Q: parseFloat(document.getElementById('q').value) || 100.0
        };

        // Show loading state
        runAlgorithmBtn.disabled = true;
        runAlgorithmBtn.textContent = 'Running...';
        resultsContainer.innerHTML = '<p>Running ACO algorithm...</p>';

        // Clear previous visualization
        visualizationManager.clear();
        document.getElementById('iteration-list').innerHTML = '<p>Loading iterations...</p>';

        try {
            // Call API to run ACO algorithm
            const response = await fetch('/run-aco', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nodes, parameters })
            });

            const data = await response.json();

            if (data.success) {
                // Display results
                resultsContainer.innerHTML = `
                    <h3>Optimal Path:</h3>
                    <p>${data.result.path.join(' → ')}</p>
                    <h3>Total Distance:</h3>
                    <p>${data.result.distance.toFixed(2)}</p>
                `;

                // Update visualization with the final result
                visualizationManager.drawNodes(nodes);
                visualizationManager.drawPath(nodes, data.result.path);

                // Update convergence chart
                if (data.convergenceData && data.convergenceData.length > 0) {
                    convergenceChartManager.updateChart(data.convergenceData);
                } else {
                    // Fallback to mock data if no real data is available
                    const mockConvergenceData = generateMockConvergenceData(parameters.maxIterations);
                    convergenceChartManager.updateChart(mockConvergenceData);
                }

                // Update iteration selector
                if (data.iterationPathsData && data.iterationPathsData.length > 0) {
                    updateIterationSelector(data.iterationPathsData, nodes);
                } else {
                    document.getElementById('iteration-list').innerHTML = '<p>No iteration data available</p>';
                }
            } else {
                resultsContainer.innerHTML = `<p>Error: ${data.error}</p>`;
            }
        } catch (error) {
            resultsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
        } finally {
            // Reset button state
            runAlgorithmBtn.disabled = false;
            runAlgorithmBtn.textContent = 'Run ACO Algorithm';
        }
    });

    // Generate mock convergence data for the chart (fallback)
    function generateMockConvergenceData(iterations) {
        const data = [];
        let value = Math.random() * 500 + 500;

        for (let i = 1; i <= iterations; i++) {
            // Simulate improvement over iterations
            value = value * (0.95 + Math.random() * 0.04);
            data.push({
                iteration: i,
                distance: value
            });
        }

        return data;
    }

    // Update iteration selector and handle click events
    function updateIterationSelector(iterationPathsData, nodes) {
        const iterationList = document.getElementById('iteration-list');
        iterationList.innerHTML = '';

        // Create buttons for each iteration
        iterationPathsData.forEach(iterData => {
            const button = document.createElement('button');
            button.className = 'iteration-btn';
            button.textContent = `Iteration ${iterData.iteration} (${iterData.distance.toFixed(2)})`;

            button.addEventListener('click', () => {
                // Update visualization for this iteration
                visualizationManager.clear();
                visualizationManager.drawNodes(nodes);
                visualizationManager.drawPath(nodes, iterData.path);

                // Highlight selected button
                document.querySelectorAll('.iteration-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
            });

            iterationList.appendChild(button);
        });

        // Add a button for the final result
        const finalButton = document.createElement('button');
        finalButton.className = 'iteration-btn active';
        finalButton.textContent = 'Final Result';
        finalButton.addEventListener('click', () => {
            // Update visualization for the final result
            visualizationManager.clear();
            visualizationManager.drawNodes(nodes);
            visualizationManager.drawPath(nodes, iterationPathsData[iterationPathsData.length - 1].path);

            // Highlight selected button
            document.querySelectorAll('.iteration-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            finalButton.classList.add('active');
        });

        iterationList.appendChild(finalButton);
    }
});