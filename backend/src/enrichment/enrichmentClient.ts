export type Waypoint = { lat: number; lng: number };

export type RouteMetrics = {
    distance_meters: number;
    duration_seconds: number;
};

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

function getTimeoutMs(): number {
    const raw = process.env.ENRICHMENT_TIMEOUT_MS;
    const n = raw ? Number.parseInt(raw, 10) : 10000;
    return Number.isFinite(n) ? n : 10000;
}

function getProvider(): 'custom' | 'mapbox' {
    const raw = (process.env.ENRICHMENT_PROVIDER || 'custom').trim().toLowerCase();
    return raw === 'mapbox' ? 'mapbox' : 'custom';
}

function splitIntoChunksWithOverlap<T>(items: T[], maxChunkSize: number): T[][] {
    if (maxChunkSize < 2) throw new Error('maxChunkSize must be >= 2');
    if (items.length <= maxChunkSize) return [items];

    const chunks: T[][] = [];
    let i = 0;
    while (i < items.length) {
        const end = Math.min(i + maxChunkSize, items.length);
        const chunk = items.slice(i, end);
        chunks.push(chunk);
        if (end >= items.length) break;
        i = end - 1; // overlap last element
    }
    return chunks;
}

async function fetchRouteMetricsFromMapbox(waypoints: Waypoint[]): Promise<RouteMetrics> {
    const accessToken = requireEnv('ENRICHMENT_API_KEY');
    const profile = (process.env.ENRICHMENT_MAPBOX_PROFILE || 'driving').trim();
    const baseUrl = (process.env.ENRICHMENT_API_BASE_URL || 'https://api.mapbox.com').replace(/\/$/, '');

    // Mapbox Directions Matrix has a 25 coordinate limit.
    const MAX_COORDS = 25;
    const chunks = splitIntoChunksWithOverlap(waypoints, MAX_COORDS);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

    try {
        let totalDistance = 0;
        let totalDuration = 0;

        for (const chunk of chunks) {
            if (chunk.length < 2) continue;

            const coordString = chunk.map((w) => `${w.lng},${w.lat}`).join(';');
            const url = `${baseUrl}/directions-matrix/v1/mapbox/${encodeURIComponent(profile)}/${coordString}`
                + `?annotations=distance,duration&access_token=${encodeURIComponent(accessToken)}`;

            const resp = await fetch(url, { signal: controller.signal });
            if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                throw new Error(`Mapbox matrix failed: ${resp.status} ${resp.statusText}${text ? ` - ${text}` : ''}`);
            }

            const data: any = await resp.json();
            const distances: any = data?.distances;
            const durations: any = data?.durations;

            if (!Array.isArray(distances) || !Array.isArray(durations)) {
                throw new Error('Mapbox matrix response missing distances/durations');
            }

            // Sum along the path i -> i+1 inside this chunk.
            for (let i = 0; i < chunk.length - 1; i++) {
                const d = Number(distances?.[i]?.[i + 1]);
                const t = Number(durations?.[i]?.[i + 1]);
                if (!Number.isFinite(d) || !Number.isFinite(t)) {
                    throw new Error('Mapbox matrix response missing leg distance/duration');
                }
                totalDistance += d;
                totalDuration += t;
            }
        }

        return { distance_meters: totalDistance, duration_seconds: totalDuration };
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchRouteMetricsFromCustomEnrichmentApi(waypoints: Waypoint[]): Promise<RouteMetrics> {
    const baseUrl = requireEnv('ENRICHMENT_API_BASE_URL');
    const apiKey = requireEnv('ENRICHMENT_API_KEY');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

    try {
        const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/route-metrics`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${apiKey}`,
                'x-api-key': apiKey,
            },
            body: JSON.stringify({ waypoints }),
            signal: controller.signal,
        });

        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Enrichment API failed: ${resp.status} ${resp.statusText}${text ? ` - ${text}` : ''}`);
        }

        const data: any = await resp.json();

        const distance =
            Number(data?.distance_meters ?? data?.distanceMeters ?? data?.distance ?? data?.meters);
        const duration =
            Number(data?.duration_seconds ?? data?.durationSeconds ?? data?.duration ?? data?.seconds);

        if (!Number.isFinite(distance) || !Number.isFinite(duration)) {
            throw new Error('Enrichment API response missing distance_meters / duration_seconds');
        }

        return { distance_meters: distance, duration_seconds: duration };
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchRouteMetricsFromEnrichmentApi(waypoints: Waypoint[]): Promise<RouteMetrics> {
    const provider = getProvider();
    if (provider === 'mapbox') {
        return fetchRouteMetricsFromMapbox(waypoints);
    }
    return fetchRouteMetricsFromCustomEnrichmentApi(waypoints);
}
