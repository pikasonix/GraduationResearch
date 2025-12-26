export type ParsedRoute = {
    routeNumber: number;
    sequence: number[]; // solver node indices, without depot
};

export type ParsedSolution = {
    routes: ParsedRoute[];
};

export function parseSolverSolutionText(solutionText: string): ParsedSolution {
    const lines = (solutionText || '').split(/\r?\n/);

    const routes: ParsedRoute[] = [];
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        // Example: "Route 1 : 32 82 13"
        const match = line.match(/^Route\s+(\d+)\s*:\s*(.*)$/i);
        if (!match) continue;

        const routeNumber = Number(match[1]);
        const seqStr = match[2] ?? '';
        const sequence = seqStr
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => Number.parseInt(s, 10))
            .filter((n) => Number.isFinite(n));

        routes.push({ routeNumber, sequence });
    }

    return { routes };
}
