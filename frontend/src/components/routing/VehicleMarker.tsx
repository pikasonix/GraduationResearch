'use client';

export interface VehicleMarkerOptions {
    color?: string;
}

const STYLE_ELEMENT_ID = 'routing-vehicle-marker-animations';
let stylesInjected = false;

type VehicleMarkerParts = {
    content: HTMLDivElement;
    ring: HTMLDivElement;
    halo: HTMLDivElement;
    pulse: HTMLDivElement;
    path: SVGPathElement;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
    const normalized = hex.trim();
    const regex = /^#?([\da-fA-F]{3}|[\da-fA-F]{6})$/;
    if (!regex.test(normalized)) return null;
    let value = normalized.replace('#', '');
    if (value.length === 3) {
        value = value.split('').map((c) => c + c).join('');
    }
    const num = parseInt(value, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

const rgba = (hex: string, alpha: number): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const [r, g, b] = rgb;
    return `rgba(${r}, ${g}, ${b}, ${Math.min(Math.max(alpha, 0), 1)})`;
};

const applyColorToParts = (color: string, parts: VehicleMarkerParts) => {
    const haloInner = rgba(color, 0.65);
    const haloMid = rgba(color, 0.25);
    parts.content.style.boxShadow = `0 12px 20px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.12), 0 0 12px ${rgba(color, 0.2)}`;
    parts.ring.style.borderColor = rgba(color, 0.85);
    parts.ring.style.boxShadow = `0 0 12px ${rgba(color, 0.35)}, 0 0 6px ${rgba(color, 0.45)} inset`;
    parts.halo.style.background = `radial-gradient(circle, ${haloInner} 0%, ${haloMid} 38%, transparent 90%)`;
    parts.pulse.style.border = `1px solid ${rgba(color, 0.55)}`;
    parts.path.setAttribute('fill', color);
};

export const updateVehicleMarkerElementColor = (element: HTMLElement, color: string) => {
    const parts = (element as any)?.__vehicleMarkerParts as VehicleMarkerParts | undefined;
    if (!parts) return;
    applyColorToParts(color, parts);
    element.setAttribute('data-marker-color', color);
};

const ensureVehicleMarkerStyles = () => {
    if (stylesInjected || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ELEMENT_ID)) {
        stylesInjected = true;
        return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = `
        @keyframes wayo-marker-float {
            0%, 100% { transform: translateY(-6px) scale(1); filter: brightness(1); }
            35% { transform: translateY(-9px) scale(1.015); filter: brightness(1.05); }
            65% { transform: translateY(-7px) scale(1.008); filter: brightness(1.03); }
        }

        @keyframes wayo-marker-pulse {
            0% { transform: translate(-50%, -50%) scale(0.72); opacity: 0.55; border-width: 1px; }
            45% { opacity: 0.82; }
            100% { transform: translate(-50%, -50%) scale(1.35); opacity: 0; border-width: 2px; }
        }

        @keyframes wayo-marker-glow {
            0%, 100% { opacity: 0.45; filter: blur(0.4px); }
            50% { opacity: 0.9; filter: blur(0.2px); }
        }

        @keyframes wayo-marker-arrow {
            0%, 100% { transform: translateY(0); filter: drop-shadow(0 4px 5px rgba(0,0,0,0.55)); }
            50% { transform: translateY(-1.5px); filter: drop-shadow(0 5px 6px rgba(0,0,0,0.6)); }
        }
    `;

    document.head.appendChild(style);
    stylesInjected = true;
};

export const createVehicleMarkerElement = (color: string = '#0ea5e9') => {
    ensureVehicleMarkerStyles();

    const el = document.createElement('div');
    el.style.width = '36px';
    el.style.height = '36px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.position = 'relative';
    el.style.cursor = 'pointer';
    el.style.pointerEvents = 'auto';

    const content = document.createElement('div');
    content.style.width = '36px';
    content.style.height = '36px';
    content.style.borderRadius = '50%';
    content.style.background = 'linear-gradient(180deg, rgba(18,18,20,0.96), rgba(18,18,20,0.58))';
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';
    content.style.boxShadow = '0 12px 20px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.12)';
    content.style.backdropFilter = 'blur(2px)';
    content.style.position = 'relative';
    content.style.overflow = 'visible';
    content.style.animation = 'wayo-marker-float 3.4s ease-in-out infinite';
    content.style.willChange = 'transform, box-shadow';

    const ring = document.createElement('div');
    ring.style.position = 'absolute';
    ring.style.top = '50%';
    ring.style.left = '50%';
    ring.style.transform = 'translate(-50%, -50%)';
    ring.style.width = '42px';
    ring.style.height = '42px';
    ring.style.borderRadius = '50%';
    ring.style.border = '3px solid transparent';
    ring.style.pointerEvents = 'none';
    ring.style.zIndex = '0';
    content.appendChild(ring);

    const halo = document.createElement('div');
    halo.style.position = 'absolute';
    halo.style.inset = '0';
    halo.style.borderRadius = '50%';
    halo.style.filter = 'blur(0.2px)';
    halo.style.zIndex = '-1';
    halo.style.pointerEvents = 'none';
    halo.style.animation = 'wayo-marker-glow 2.6s ease-in-out infinite';
    content.appendChild(halo);

    const pulse = document.createElement('div');
    pulse.style.position = 'absolute';
    pulse.style.width = '46px';
    pulse.style.height = '46px';
    pulse.style.borderRadius = '50%';
    pulse.style.border = '1px solid transparent';
    pulse.style.top = '50%';
    pulse.style.left = '50%';
    pulse.style.transform = 'translate(-50%, -50%)';
    pulse.style.opacity = '0';
    pulse.style.pointerEvents = 'none';
    pulse.style.animation = 'wayo-marker-pulse 2.8s ease-out infinite';
    content.appendChild(pulse);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.style.position = 'relative';
    svg.style.zIndex = '1';
    svg.style.filter = 'drop-shadow(0 4px 5px rgba(0,0,0,0.55))';
    svg.style.animation = 'wayo-marker-arrow 2.1s ease-in-out infinite';

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M12 2 L18 20 L12 16 L6 20 Z');

    svg.appendChild(path);
    content.appendChild(svg);
    el.appendChild(content);

    const parts: VehicleMarkerParts = { content, ring, halo, pulse, path };
    (el as any).__vehicleMarkerParts = parts;
    applyColorToParts(color, parts);
    el.setAttribute('data-marker-color', color);

    return el;
};