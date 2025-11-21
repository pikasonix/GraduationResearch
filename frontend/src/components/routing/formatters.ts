import { pickManeuverIcon } from './maneuvers';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return ch;
    }
});

export const formatDuration = (minutes: number) => {
    if (!minutes && minutes !== 0) return '';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
    if (meters >= 100) return `${Math.round(meters / 10) * 10} m`;
    return `${Math.max(1, Math.round(meters))} m`;
};

const viDirWord = (modifier?: string) => {
    switch ((modifier || '').toLowerCase()) {
        case 'left': return 'trái';
        case 'right': return 'phải';
        case 'slight left': return 'chếch trái';
        case 'slight right': return 'chếch phải';
        case 'sharp left': return 'gắt trái';
        case 'sharp right': return 'gắt phải';
        case 'uturn': return 'quay đầu';
        case 'straight':
        default: return 'thẳng';
    }
};

export const formatInstructionVI = (step: any): string => {
    const type = step?.maneuver?.type as string | undefined;
    const modifier = step?.maneuver?.modifier as string | undefined;
    const name = step?.name as string | undefined;
    const dist = formatDistance(step?.distance || 0);
    const intoRoad = name && name !== '' && name !== 'unnamed road' ? ` vào ${name}` : '';
    switch ((type || '').toLowerCase()) {
        case 'depart': return `Bắt đầu${intoRoad ? intoRoad : ''}`;
        case 'arrive': return 'Đến nơi';
        case 'continue': return modifier && modifier.toLowerCase() !== 'straight' ? `Đi ${viDirWord(modifier)} ${dist}${intoRoad}` : `Đi thẳng ${dist}${intoRoad}`;
        case 'turn': return modifier && modifier.toLowerCase() === 'uturn' ? `Quay đầu${intoRoad}` : `Rẽ ${viDirWord(modifier)}${intoRoad}` + (step?.distance ? `, đi ${dist}` : '');
        case 'new name': return `Tiếp tục${intoRoad}` + (step?.distance ? ` trong ${dist}` : '');
        case 'merge': return `Nhập làn${intoRoad}` + (step?.distance ? ` và đi ${dist}` : '');
        case 'on ramp': return `Vào đường nhánh${intoRoad}` + (step?.distance ? ` và đi ${dist}` : '');
        case 'off ramp': return `Ra khỏi đường nhánh${intoRoad}` + (step?.distance ? ` và đi ${dist}` : '');
        case 'fork': return `Đi theo nhánh ${viDirWord(modifier)}${intoRoad}` + (step?.distance ? ` trong ${dist}` : '');
        case 'end of road': return `Cuối đường, rẽ ${viDirWord(modifier)}${intoRoad}` + (step?.distance ? ` và đi ${dist}` : '');
        case 'roundabout':
        case 'rotary': { const exit = step?.maneuver?.exit; return exit ? `Vào vòng xuyến, ra ở lối thứ ${exit}${intoRoad}` : `Vào vòng xuyến${intoRoad}`; }
        case 'roundabout turn': { const exit = step?.maneuver?.exit; return `Trong vòng xuyến, rẽ ${viDirWord(modifier)}${exit ? ` tại lối thứ ${exit}` : ''}${intoRoad}`; }
        case 'exit roundabout':
        case 'exit rotary': return `Thoát khỏi vòng xuyến${intoRoad}`;
        case 'use lane': return 'Đi theo làn đường chỉ định';
        case 'notification': return 'Tiếp tục di chuyển';
        default: return typeof step?.maneuver?.instruction === 'string' && step.maneuver.instruction.length > 0 ? step.maneuver.instruction : 'Di chuyển theo tuyến đường';
    }
};

export const renderInstructionPopupHTML = (step: any, rotateFallback: number = 0) => {
    const text = formatInstructionVI(step);
    const { src, rotate } = pickManeuverIcon(step);
    const angle = Number.isFinite(rotate) ? rotate : rotateFallback;
    const speedLimitRaw = step?.speedLimit && typeof step.speedLimit === 'object' ? step.speedLimit : null;
    const explicitValue = typeof speedLimitRaw?.value === 'number' && Number.isFinite(speedLimitRaw.value) ? speedLimitRaw.value : null;
    const inferredValue = explicitValue != null ? explicitValue : (() => {
        const fallbackCandidates = [step?.maxSpeed, step?.max_speed, step?.speedLimitValue];
        for (const cand of fallbackCandidates) {
            if (typeof cand === 'number' && Number.isFinite(cand)) return cand;
        }
        return null;
    })();
    const hasSpeedValue = inferredValue != null;
    const speedValueDisplay = hasSpeedValue ? Math.round(inferredValue) : null;
    const normalizeUnit = (unit?: string | null): string => {
        if (!unit || typeof unit !== 'string') return 'km/h';
        const trimmed = unit.trim().toLowerCase().replace(/\s+/g, '');
        if (trimmed === 'kmh' || trimmed === 'km/h' || trimmed === 'kph') return 'km/h';
        if (trimmed === 'mph') return 'mph';
        if (trimmed === 'm/s' || trimmed === 'ms' || trimmed === 'meterpersecond') return 'm/s';
        return unit.trim();
    };
    const unitFromStep = typeof speedLimitRaw?.unit === 'string' ? speedLimitRaw.unit : (typeof step?.speedUnit === 'string' ? step.speedUnit : undefined);
    const speedUnitDisplay = hasSpeedValue ? normalizeUnit(unitFromStep) : normalizeUnit(unitFromStep || null);
    const speedUnknown = !!(speedLimitRaw?.unknown && !hasSpeedValue);
    const indicatorStyleParts = [
        `width:${hasSpeedValue || speedUnknown ? '28px' : '20px'}`,
        `height:${hasSpeedValue || speedUnknown ? '28px' : '20px'}`,
        'border-radius:9999px',
        'background:#eff6ff',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'flex:0 0 auto',
        'border:1px solid #bfdbfe'
    ];
    if (hasSpeedValue) {
        indicatorStyleParts.push('flex-direction:column', 'gap:2px', 'padding:4px 2px');
    }
    const indicatorStyle = `${indicatorStyleParts.join('; ')};`;
    const indicatorContent = hasSpeedValue
        ? `<span style="font-size:13px; font-weight:700; color:#1d4ed8; line-height:1;">${speedValueDisplay}</span><span style="font-size:9px; font-weight:600; color:#1e3a8a; line-height:1; text-transform:uppercase; letter-spacing:0.3px;">${escapeHtml(speedUnitDisplay)}</span>`
        : speedUnknown
            ? `<span style="font-size:10px; font-weight:600; color:#1e3a8a; line-height:1;">N/A</span>`
            : (src
                ? `<img src="${src}" width="12" height="12" style="display:block;"/>`
                : `<svg viewBox=\"0 0 24 24\" width=\"12\" height=\"12\" style=\"transform: rotate(${angle}deg);\" fill=\"#1d4ed8\"><path d=\"M12 2 L15 10 L12 8 L9 10 Z\" /></svg>`);
    return `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system; font-size:12px; display:flex; align-items:flex-start; gap:6px;">
            <div style="${indicatorStyle}">
                ${indicatorContent}
            </div>
            <div style="min-width:0;">
                <div style="font-weight:600; color:#111827; line-height:1.2;">${text}</div>
                ${step?.name ? `<div style=\"color:#6b7280; font-size:11px; line-height:1.2; margin-top:2px;\">${step.name}</div>` : ''}
            </div>
        </div>`;
};
