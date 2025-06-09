class CanvasInputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = [];
        this.nodeRadius = 10;
        this.depotColor = '#FF5733'; // Orange for depot
        this.nodeColor = '#3498DB';  // Blue for regular nodes

        // Setup event listeners
        this.setupEventListeners();

        // Initial render
        this.render();
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.addNode(x, y);
        });
    }

    addNode(x, y) {
        const id = this.nodes.length + 1;
        this.nodes.push({ id, x, y });
        this.render();
    }

    clearNodes() {
        this.nodes = [];
        this.render();
    }

    getNodes() {
        return this.nodes;
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.drawGrid();

        // Draw nodes
        this.nodes.forEach((node, i) => {
            const isDepot = i === 0;
            this.ctx.fillStyle = isDepot ? this.depotColor : this.nodeColor;

            // Draw circle
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, this.nodeRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw label
            this.ctx.fillStyle = '#000';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.id.toString(), node.x, node.y);
        });
    }

    drawGrid() {
        const gridSize = 20;
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 0.5;

        // Draw vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }
}

class VisualizationManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodeRadius = 12;
        this.depotColor = '#FF5733'; // Orange for depot
        this.nodeColor = '#3498DB';  // Blue for regular nodes
        this.pathColor = '#27AE60';  // Green for path

        // Initial clear
        this.clear();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
    }

    drawGrid() {
        const gridSize = 20;
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 0.5;

        // Draw vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    drawNodes(nodes) {
        if (!nodes || nodes.length === 0) return;

        // Calculate scale and offset to fit all nodes on canvas
        const padding = this.nodeRadius * 2;
        const { scaleX, scaleY, offsetX, offsetY } = this.calculateScaleAndOffset(nodes);

        // Draw nodes
        nodes.forEach((node, i) => {
            const isDepot = i === 0;
            const x = offsetX + node.x * scaleX;
            const y = offsetY + node.y * scaleY;

            this.ctx.fillStyle = isDepot ? this.depotColor : this.nodeColor;

            // Draw circle
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.nodeRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw label
            this.ctx.fillStyle = '#000';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.id.toString(), x, y);
        });
    }

    drawPath(nodes, path) {
        if (!nodes || nodes.length === 0 || !path || path.length === 0) return;

        // Calculate scale and offset to fit all nodes on canvas
        const { scaleX, scaleY, offsetX, offsetY } = this.calculateScaleAndOffset(nodes);

        // Draw path
        this.ctx.strokeStyle = this.pathColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        const startNode = nodes.find(n => n.id === path[0]) || nodes[0];
        this.ctx.moveTo(offsetX + startNode.x * scaleX, offsetY + startNode.y * scaleY);

        for (let i = 1; i < path.length; i++) {
            const node = nodes.find(n => n.id === path[i]) || nodes[path[i] - 1];
            this.ctx.lineTo(offsetX + node.x * scaleX, offsetY + node.y * scaleY);
        }

        this.ctx.stroke();

        // Add arrows to indicate direction
        this.drawArrows(nodes, path, scaleX, scaleY, offsetX, offsetY);
    }

    drawArrows(nodes, path, scaleX, scaleY, offsetX, offsetY) {
        const arrowSize = 8;

        for (let i = 0; i < path.length - 1; i++) {
            const fromNode = nodes.find(n => n.id === path[i]) || nodes[path[i] - 1];
            const toNode = nodes.find(n => n.id === path[i + 1]) || nodes[path[i + 1] - 1];

            const x1 = offsetX + fromNode.x * scaleX;
            const y1 = offsetY + fromNode.y * scaleY;
            const x2 = offsetX + toNode.x * scaleX;
            const y2 = offsetY + toNode.y * scaleY;

            // Calculate direction vector and normalize
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const unitX = dx / length;
            const unitY = dy / length;

            // Calculate arrow position
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            // Draw arrow
            this.ctx.fillStyle = this.pathColor;
            this.ctx.beginPath();
            this.ctx.moveTo(midX, midY);
            this.ctx.lineTo(
                midX - arrowSize * (unitX * 0.866 - unitY * 0.5),
                midY - arrowSize * (unitY * 0.866 + unitX * 0.5)
            );
            this.ctx.lineTo(
                midX - arrowSize * (unitX * 0.866 + unitY * 0.5),
                midY - arrowSize * (unitY * 0.866 - unitX * 0.5)
            );
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    calculateScaleAndOffset(nodes) {
        const padding = this.nodeRadius * 2;

        // Find min and max coordinates
        const minX = Math.min(...nodes.map(n => n.x));
        const maxX = Math.max(...nodes.map(n => n.x));
        const minY = Math.min(...nodes.map(n => n.y));
        const maxY = Math.max(...nodes.map(n => n.y));

        // Calculate required scale to fit in canvas
        const canvasWidth = this.canvas.width - padding * 2;
        const canvasHeight = this.canvas.height - padding * 2;
        const dataWidth = maxX - minX || 1; // Avoid division by zero
        const dataHeight = maxY - minY || 1;

        const scaleX = canvasWidth / dataWidth;
        const scaleY = canvasHeight / dataHeight;
        const scale = Math.min(scaleX, scaleY);

        // Calculate offset to center the visualization
        const offsetX = padding + (canvasWidth - dataWidth * scale) / 2 - minX * scale;
        const offsetY = padding + (canvasHeight - dataHeight * scale) / 2 - minY * scale;

        return { scaleX: scale, scaleY: scale, offsetX, offsetY };
    }
}