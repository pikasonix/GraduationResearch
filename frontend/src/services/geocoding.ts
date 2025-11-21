import config from '@/config/config';

export type Suggestion = {
    id: string;
    place_name: string;
    center: [number, number]; // [lng, lat]
    raw?: any;
};

export interface Geocoder {
    suggest(query: string): Promise<Suggestion[]>;
    geocode(query: string): Promise<Suggestion | null>;
    reverse?(lng: number, lat: number): Promise<string | null>;
}

class MapboxGeocoder implements Geocoder {
    private token: string;
    constructor(token: string) { this.token = token; }
    async suggest(query: string): Promise<Suggestion[]> {
        if (!this.token) return [];
        const params = new URLSearchParams({
            limit: '5', language: 'vi', country: 'VN',
            types: 'poi,address,place,locality,neighborhood,district,region',
            autocomplete: 'true', access_token: this.token,
        });
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
        const res = await fetch(url);
        const data = await res.json();
        const feats = Array.isArray(data?.features) ? data.features : [];
        return feats.filter((f: any) => Array.isArray(f.center) && f.center.length >= 2)
            .map((f: any) => ({ id: String(f.id), place_name: String(f.place_name), center: [f.center[0], f.center[1]] as [number, number], raw: f }));
    }
    async geocode(query: string): Promise<Suggestion | null> {
        const list = await this.suggest(query);
        return list[0] || null;
    }
    async reverse(lng: number, lat: number): Promise<string | null> {
        if (!this.token) return null;
        const params = new URLSearchParams({ limit: '1', language: 'vi', access_token: this.token });
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params}`;
        const res = await fetch(url);
        const data = await res.json();
        return data?.features?.[0]?.place_name ?? null;
    }
}

class NominatimGeocoder implements Geocoder {
    async suggest(query: string): Promise<Suggestion[]> {
        const params = new URLSearchParams({
            q: query, format: 'jsonv2', addressdetails: '1', limit: '5', 'accept-language': 'vi', countrycodes: 'vn',
        });
        const url = `https://nominatim.openstreetmap.org/search?${params}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const arr = await res.json();
        if (!Array.isArray(arr)) return [];
        return arr.map((f: any) => ({ id: String(f.osm_id ?? f.place_id ?? f.display_name), place_name: String(f.display_name), center: [Number(f.lon), Number(f.lat)], raw: f }));
    }
    async geocode(query: string): Promise<Suggestion | null> {
        const list = await this.suggest(query);
        return list[0] || null;
    }
    async reverse(lng: number, lat: number): Promise<string | null> {
        const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), 'accept-language': 'vi' });
        const url = `https://nominatim.openstreetmap.org/reverse?${params}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        return data?.display_name ?? null;
    }
}

class OpenCageGeocoder implements Geocoder {
    private key: string;
    constructor(key: string) { this.key = key; }
    async suggest(query: string): Promise<Suggestion[]> {
        if (!this.key) return [];
        const params = new URLSearchParams({ q: query, key: this.key, language: 'vi', countrycode: 'vn', limit: '5' });
        const url = `https://api.opencagedata.com/geocode/v1/json?${params}`;
        const res = await fetch(url);
        const data = await res.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        return results.map((r: any, idx: number) => ({ id: String(r.annotations?.osm?.url ?? r.annotations?.what3words?.words ?? idx), place_name: String(r.formatted), center: [Number(r.geometry?.lng), Number(r.geometry?.lat)], raw: r }));
    }
    async geocode(query: string): Promise<Suggestion | null> {
        const list = await this.suggest(query);
        return list[0] || null;
    }
    async reverse(lng: number, lat: number): Promise<string | null> {
        if (!this.key) return null;
        const params = new URLSearchParams({ q: `${lat}+${lng}`, key: this.key, language: 'vi', limit: '1' });
        const url = `https://api.opencagedata.com/geocode/v1/json?${params}`;
        const res = await fetch(url);
        const data = await res.json();
        return data?.results?.[0]?.formatted ?? null;
    }
}

class GoogleGeocoder implements Geocoder {
    private key: string;
    constructor(key: string) { this.key = key; }
    private get base() { return 'https://maps.googleapis.com/maps/api'; }

    async suggest(query: string): Promise<Suggestion[]> {
        if (!this.key) return [];
        // Autocomplete predictions (vi + VN), then resolve coords via Place Details
        const auParams = new URLSearchParams({
            input: query,
            language: 'vi',
            components: 'country:vn',
            key: this.key,
        });
        const auUrl = `${this.base}/place/autocomplete/json?${auParams}`;
        const auRes = await fetch(auUrl);
        const auData = await auRes.json();
        const preds: any[] = Array.isArray(auData?.predictions) ? auData.predictions : [];
        const out: Suggestion[] = [];
        // Limit to 5; resolve geometry
        for (const p of preds.slice(0, 5)) {
            const place_id = p.place_id as string | undefined;
            if (!place_id) continue;
            const detailParams = new URLSearchParams({
                place_id,
                fields: 'geometry,name,formatted_address',
                language: 'vi',
                key: this.key,
            });
            const dUrl = `${this.base}/place/details/json?${detailParams}`;
            try {
                const dRes = await fetch(dUrl);
                const dData = await dRes.json();
                const loc = dData?.result?.geometry?.location;
                if (!loc) continue;
                const name = dData?.result?.name as string | undefined;
                const addr = dData?.result?.formatted_address as string | undefined;
                const label = [name, addr].filter(Boolean).join(', ');
                out.push({ id: place_id, place_name: label || p.description || place_id, center: [Number(loc.lng), Number(loc.lat)], raw: dData });
            } catch { /* ignore bad item */ }
        }
        return out;
    }

    async geocode(query: string): Promise<Suggestion | null> {
        if (!this.key) return null;
        // Use Find Place From Text for better POI handling
        const fpParams = new URLSearchParams({
            input: query,
            inputtype: 'textquery',
            fields: 'geometry,formatted_address,name',
            language: 'vi',
            key: this.key,
        });
        const fpUrl = `${this.base}/place/findplacefromtext/json?${fpParams}`;
        try {
            const res = await fetch(fpUrl);
            const data = await res.json();
            const c = Array.isArray(data?.candidates) ? data.candidates[0] : null;
            if (!c?.geometry?.location) return null;
            const loc = c.geometry.location;
            const label = [c.name, c.formatted_address].filter(Boolean).join(', ');
            return { id: c.place_id || query, place_name: label || query, center: [Number(loc.lng), Number(loc.lat)], raw: c };
        } catch { return null; }
    }

    async reverse(lng: number, lat: number): Promise<string | null> {
        if (!this.key) return null;
        const rvParams = new URLSearchParams({ latlng: `${lat},${lng}`, language: 'vi', key: this.key });
        const rvUrl = `${this.base}/geocode/json?${rvParams}`;
        try {
            const res = await fetch(rvUrl);
            const data = await res.json();
            return data?.results?.[0]?.formatted_address ?? null;
        } catch { return null; }
    }
}

class GoongGeocoder implements Geocoder {
    private key: string;
    constructor(key: string) { this.key = key; }

    private get base() { return 'https://rsapi.goong.io'; }

    async suggest(query: string): Promise<Suggestion[]> {
        if (!this.key) return [];
        // 1) Autocomplete to get predictions with place_id
        const acParams = new URLSearchParams({ input: query, limit: '5', api_key: this.key });
        const acUrl = `${this.base}/Place/AutoComplete?${acParams}`;
        let predictions: any[] = [];
        try {
            const res = await fetch(acUrl);
            const data = await res.json();
            predictions = Array.isArray(data?.predictions) ? data.predictions : [];
        } catch {
            return [];
        }

        // 2) For each prediction, fetch Place Detail to get geometry (lat/lng)
        const results: Suggestion[] = [];
        for (const p of predictions) {
            const placeId = p?.place_id as string | undefined;
            if (!placeId) continue;
            const detailParams = new URLSearchParams({ place_id: placeId, api_key: this.key });
            const dUrl = `${this.base}/Place/Detail?${detailParams}`;
            try {
                const dRes = await fetch(dUrl);
                const dData = await dRes.json();
                const loc = dData?.result?.geometry?.location;
                if (!loc) continue;
                const name: string | undefined = dData?.result?.name;
                const addr: string | undefined = dData?.result?.formatted_address;
                const label = [name, addr].filter(Boolean).join(', ') || p?.description || placeId;
                results.push({ id: placeId, place_name: label, center: [Number(loc.lng), Number(loc.lat)], raw: dData });
            } catch {
                // ignore this prediction if detail fails
            }
        }
        return results;
    }

    async geocode(query: string): Promise<Suggestion | null> {
        if (!this.key) return null;
        // Forward geocoding via Geocode endpoint
        const params = new URLSearchParams({ address: query, api_key: this.key });
        const url = `${this.base}/geocode?${params}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            const r = Array.isArray(data?.results) ? data.results[0] : null;
            const loc = r?.geometry?.location;
            if (!loc) return null;
            const formatted = r?.formatted_address as string | undefined;
            return { id: r?.place_id || query, place_name: formatted || query, center: [Number(loc.lng), Number(loc.lat)], raw: r };
        } catch {
            return null;
        }
    }

    async reverse(lng: number, lat: number): Promise<string | null> {
        if (!this.key) return null;
        // Reverse geocoding
        const params = new URLSearchParams({ latlng: `${lat},${lng}`, api_key: this.key });
        const url = `${this.base}/Geocode?${params}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            return data?.results?.[0]?.formatted_address ?? null;
        } catch {
            return null;
        }
    }
}

export function getGeocoder(): Geocoder {
    const provider = (config as any).geocoding?.provider || 'mapbox';
    if (provider === 'nominatim') return new NominatimGeocoder();
    if (provider === 'opencage') return new OpenCageGeocoder((config as any).geocoding?.opencageKey || '');
    if (provider === 'google') return new GoogleGeocoder((config as any).geocoding?.googleKey || '');
    if (provider === 'goong') return new GoongGeocoder((config as any).geocoding?.goongKey || '');
    // default to Mapbox
    return new MapboxGeocoder(config.mapbox?.accessToken || '');
}
