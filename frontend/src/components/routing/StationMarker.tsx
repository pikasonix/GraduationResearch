import React from 'react';
import { Zap, Wrench } from 'lucide-react';
import type { Station, StationType } from './StationPinTool';

interface StationMarkerProps {
    station: Station;
    onClick?: () => void;
}

export const createStationMarkerElement = (station: Station, onClick?: () => void): HTMLElement => {
    const element = document.createElement('div');
    element.className = 'station-marker';

    const isRescue = station.type === 'rescue';
    const bgColor = isRescue ? 'bg-orange-500' : 'bg-green-500';
    const hoverBgColor = isRescue ? 'hover:bg-orange-600' : 'hover:bg-green-600';

    element.innerHTML = `
    <div class="flex items-center justify-center w-8 h-8 ${bgColor} ${hoverBgColor} text-white rounded-full shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 border-2 border-white">
      ${isRescue
            ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>'
            : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>'
        }
    </div>
  `;

    if (onClick) {
        element.addEventListener('click', onClick);
    }

    return element;
};

export const StationMarker: React.FC<StationMarkerProps> = ({ station, onClick }) => {
    const isRescue = station.type === 'rescue';
    const bgColor = isRescue ? 'bg-orange-500' : 'bg-green-500';
    const hoverBgColor = isRescue ? 'hover:bg-orange-600' : 'hover:bg-green-600';

    return (
        <div
            className={`flex items-center justify-center w-8 h-8 ${bgColor} ${hoverBgColor} text-white rounded-full shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 border-2 border-white`}
            onClick={onClick}
        >
            {isRescue ? <Wrench className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
        </div>
    );
};