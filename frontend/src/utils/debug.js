// Debug helper để kiểm tra solution format
export const debugSolution = (solutionText) => {
    console.log('=== DEBUGGING SOLUTION ===');
    console.log('Raw solution text:');
    console.log(solutionText);

    const lines = solutionText.split('\n');
    console.log('Number of lines:', lines.length);

    lines.forEach((line, index) => {
        if (line.trim()) {
            console.log(`Line ${index}: "${line}"`);

            if (line.includes(':')) {
                const [token, value] = line.split(':', 2);
                console.log(`  Token: "${token.trim()}"`, `Value: "${value?.trim()}"`);
            }
        }
    });

    console.log('=== END DEBUG ===');
};

export const debugInstance = (instance) => {
    console.log('=== DEBUGGING INSTANCE ===');
    if (!instance) {
        console.log('Instance is null/undefined');
        return;
    }

    console.log('Instance name:', instance.name);
    console.log('Instance size:', instance.size);
    console.log('Instance capacity:', instance.capacity);
    console.log('Number of nodes:', instance.nodes?.length);
    console.log('Number of times entries:', instance.times?.length);

    if (instance.nodes && instance.nodes.length > 0) {
        console.log('First node:', instance.nodes[0]);
        console.log('Last node:', instance.nodes[instance.nodes.length - 1]);
    }

    if (instance.times && instance.times.length > 0) {
        console.log('First times row length:', instance.times[0]?.length);
    }

    console.log('=== END DEBUG ===');
};
