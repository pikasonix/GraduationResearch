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

/**
 * Snap GPS coordinates to nearest valid road node
 * @param lat Latitude
 * @param lng Longitude
 * @param bearing Optional bearing direction (0-360 degrees) for better snapping
 * @returns Snapped location with metadata
 */
export async function snapToRoad(
    lat: number,
    lng: number,
    bearing?: number
): Promise<{ lat: number; lng: number; snapped: boolean; distance_from_original: number }> {
    // Check if enrichment API is configured
    if (!process.env.ENRICHMENT_API_BASE_URL || !process.env.ENRICHMENT_API_KEY) {
        console.warn('Enrichment API not configured, using original coordinates');
        return { lat, lng, snapped: false, distance_from_original: 0 };
    }

    const provider = getProvider();
    const baseUrl = requireEnv('ENRICHMENT_API_BASE_URL').replace(/\/$/, '');
    const apiKey = requireEnv('ENRICHMENT_API_KEY');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

    try {
        if (provider === 'mapbox') {
            // Mapbox Map Matching API for snapping to road
            const coordString = `${lng},${lat}`;
            const bearingParam = bearing !== undefined ? `&radiuses=50&bearings=${bearing},45` : '&radiuses=50';
            const url = `${baseUrl}/matching/v5/mapbox/driving/${coordString}?access_token=${encodeURIComponent(apiKey)}${bearingParam}`;

            const resp = await fetch(url, { signal: controller.signal });
            if (!resp.ok) {
                // Fallback to original coordinates if snapping fails
                console.warn(`Mapbox snap-to-road failed: ${resp.status}, using original coordinates`);
                return { lat, lng, snapped: false, distance_from_original: 0 };
            }

            const data: any = await resp.json();
            const match = data?.matchings?.[0];
            if (match?.geometry?.coordinates?.length > 0) {
                const [snappedLng, snappedLat] = match.geometry.coordinates[0];
                const distance = haversineDistance(lat, lng, snappedLat, snappedLng);
                return { lat: snappedLat, lng: snappedLng, snapped: true, distance_from_original: distance };
            }

            return { lat, lng, snapped: false, distance_from_original: 0 };
        } else {
            // Custom enrichment API - check if it has snap-to-road endpoint
            const resp = await fetch(`${baseUrl}/snap-to-road`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'authorization': `Bearer ${apiKey}`,
                    'x-api-key': apiKey,
                },
                body: JSON.stringify({ lat, lng, bearing }),
                signal: controller.signal,
            });

            if (!resp.ok) {
                // Fallback to original coordinates if API doesn't support or fails
                console.warn(`Custom snap-to-road failed or not supported: ${resp.status}, using original coordinates`);
                return { lat, lng, snapped: false, distance_from_original: 0 };
            }

            const data: any = await resp.json();
            const snappedLat = Number(data?.lat ?? data?.latitude);
            const snappedLng = Number(data?.lng ?? data?.longitude);

            if (!Number.isFinite(snappedLat) || !Number.isFinite(snappedLng)) {
                return { lat, lng, snapped: false, distance_from_original: 0 };
            }

            const distance = haversineDistance(lat, lng, snappedLat, snappedLng);
            return { lat: snappedLat, lng: snappedLng, snapped: true, distance_from_original: distance };
        }
    } catch (error) {
        console.warn('Snap-to-road error:', error, 'using original coordinates');
        return { lat, lng, snapped: false, distance_from_original: 0 };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}
