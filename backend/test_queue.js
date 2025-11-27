const fs = require('fs');
const path = require('path');

// Test script for Job Queue API

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

// Read test instance
const testInstance = fs.readFileSync(
    path.join(__dirname, 'pdptw_solver_module', 'instances', 'lr107.txt'),
    'utf8'
);

const testParams = {
    max_iterations: 1000,
    max_non_improving: 500,
    time_limit: 30,
    min_destroy: 0.10,
    max_destroy: 0.40,
    seed: 42,
    acceptance: 'rtr',
    log_level: 'info',
    format: 'auto'
};

console.log('='.repeat(60));
console.log('  PDPTW Solver - Job Queue Test');
console.log('='.repeat(60));
console.log(`  API URL: ${BASE_URL}`);
console.log(`  Instance: lr107.txt`);
console.log(`  Time limit: ${testParams.time_limit}s`);
console.log('='.repeat(60));
console.log('');

async function testQueue() {
    try {
        // 1. Check health
        console.log('1. Checking server health...');
        const healthRes = await fetch(`${BASE_URL}/health`);
        const health = await healthRes.json();
        console.log('   ✓ Server is healthy');
        console.log('   Queue stats:', JSON.stringify(health.queue, null, 2));
        console.log('');

        // 2. Submit job
        console.log('2. Submitting job...');
        const submitRes = await fetch(`${BASE_URL}/api/jobs/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instance: testInstance, params: testParams })
        });
        const submitData = await submitRes.json();
        
        if (!submitData.success) {
            throw new Error(`Failed to submit: ${submitData.error}`);
        }
        
        const jobId = submitData.jobId;
        console.log('   ✓ Job submitted');
        console.log('   Job ID:', jobId);
        console.log('');

        // 3. Poll job status
        console.log('3. Polling job status...');
        let completed = false;
        let lastProgress = -1;
        
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
                const statusData = await statusRes.json();
                
                if (!statusData.success) {
                    clearInterval(pollInterval);
                    console.error('   ✗ Error getting status:', statusData.error);
                    return;
                }
                
                const job = statusData.job;
                
                // Show progress only when changed
                if (job.progress !== lastProgress) {
                    const progressBar = '█'.repeat(Math.floor(job.progress / 5)) + 
                                      '░'.repeat(20 - Math.floor(job.progress / 5));
                    console.log(`   [${progressBar}] ${job.progress}% - ${job.status}`);
                    lastProgress = job.progress;
                }
                
                // Show queue position if pending
                if (job.status === 'pending' && job.queuePosition > 0) {
                    console.log(`   Queue position: ${job.queuePosition}`);
                }
                
                // Check if completed
                if (job.status === 'completed') {
                    clearInterval(pollInterval);
                    completed = true;
                    
                    console.log('');
                    console.log('4. Job completed! ✓');
                    console.log('   Duration:', job.duration + 's');
                    console.log('   Solution file:', job.result.filename);
                    console.log('');
                    console.log('   Solution preview (first 30 lines):');
                    console.log('   ' + '─'.repeat(58));
                    const lines = job.result.solution.split('\n').slice(0, 30);
                    lines.forEach(line => console.log('   ' + line));
                    console.log('   ' + '─'.repeat(58));
                    console.log('');
                    
                    // 5. Get updated stats
                    console.log('5. Final queue stats:');
                    const finalHealthRes = await fetch(`${BASE_URL}/health`);
                    const finalHealth = await finalHealthRes.json();
                    console.log('   ' + JSON.stringify(finalHealth.queue, null, 2).split('\n').join('\n   '));
                    
                } else if (job.status === 'failed') {
                    clearInterval(pollInterval);
                    console.error('');
                    console.error('4. Job failed! ✗');
                    console.error('   Error:', job.error);
                }
                
            } catch (err) {
                clearInterval(pollInterval);
                console.error('   ✗ Error polling:', err.message);
            }
        }, 2000); // Poll every 2 seconds
        
    } catch (error) {
        console.error('');
        console.error('✗ Test failed:', error.message);
        console.error('');
        console.error('Make sure the server is running: npm start');
    }
}

// Run test
testQueue();
