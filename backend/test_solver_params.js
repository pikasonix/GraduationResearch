const fs = require('fs');
const path = require('path');

async function testSolver() {
    // Read instance file (Li-Lim format)
    const instancePath = path.join(__dirname, 'pdptw_solver_module', 'instances', 'lr107.txt');
    const instance = fs.readFileSync(instancePath, 'utf8');

    console.log('📦 Submitting job with new parameter format...');

    const params = {
        iterations: 1000,
        max_non_improving: 500,
        time_limit: 30,
        min_destroy: 0.1,
        max_destroy: 0.4,
        acceptance: 'rtr',
        seed: 42,
        log_level: 'info',
        format: 'lilim',  // Li-Lim format
        authors: 'Test User',
        reference: 'Test Run'
    };

    try {
        // Submit job
        const submitResponse = await fetch('http://localhost:3001/api/jobs/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instance, params })
        });

        if (!submitResponse.ok) {
            throw new Error(`Failed to submit: ${submitResponse.status}`);
        }

        const { jobId } = await submitResponse.json();
        console.log('✅ Job submitted:', jobId);

        // Poll for result
        let job;
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes max

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const statusResponse = await fetch(`http://localhost:3001/api/jobs/${jobId}`);
            const responseData = await statusResponse.json();
            
            console.log('📦 Full response:', JSON.stringify(responseData, null, 2));
            
            job = responseData.job || responseData;

            console.log(`⏳ Status: ${job.status} (${job.progress}%)`);

            if (job.status === 'completed') {
                console.log('✅ Job completed!');
                console.log('📄 Solution preview:', job.result.solution.substring(0, 200));
                break;
            }

            if (job.status === 'failed') {
                console.error('❌ Job failed:', job.error);
                break;
            }

            attempts++;
        }

        if (attempts >= maxAttempts) {
            console.error('⏱️ Timeout waiting for job');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSolver();
