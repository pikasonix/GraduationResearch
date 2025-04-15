class ConvergenceChartManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.chart = null;
        this.initChart();
    }

    initChart() {
        const ctx = this.canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Best Tour Length',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Iteration'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Tour Length'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'ACO Algorithm Convergence'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    }

    updateChart(data) {
        if (!data || !data.length) return;

        const chartData = data.map(item => ({
            x: item.iteration,
            y: item.distance
        }));

        this.chart.data.datasets[0].data = chartData;
        this.chart.update();
    }

    clearChart() {
        this.chart.data.datasets[0].data = [];
        this.chart.update();
    }
}