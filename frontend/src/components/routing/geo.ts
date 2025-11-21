export const computeBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
};

export const norm360 = (a: number) => ((a % 360) + 360) % 360;

export const shortestDeltaDeg = (from: number, to: number) => {
    let d = norm360(to) - norm360(from);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
};

export const stepBearingTowards = (from: number, to: number, maxStepDeg: number) => {
    const delta = shortestDeltaDeg(from, to);
    const step = Math.max(-maxStepDeg, Math.min(maxStepDeg, delta));
    return norm360(from + step);
};

export const distanceMeters = (a: [number, number], b: [number, number]) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const [lon1, lat1] = a; const [lon2, lat2] = b;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const la1 = toRad(lat1);
    const la2 = toRad(lat2);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(s1 * s1 + Math.cos(la1) * Math.cos(la2) * s2 * s2), Math.sqrt(1 - (s1 * s1 + Math.cos(la1) * Math.cos(la2) * s2 * s2)));
    return R * c;
};
