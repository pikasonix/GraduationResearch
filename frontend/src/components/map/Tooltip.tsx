import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
    content: string;
    children?: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [show, setShow] = useState(false);

    return (
        <div className="relative inline-block">
            <div
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                className="cursor-help"
            >
                {children || <Info size={14} className="text-gray-400 hover:text-gray-600" />}
            </div>
            {show && (
                <div className="absolute z-50 left-0 bottom-full mb-2 w-max max-w-[200px] px-3 py-2 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-normal break-words">
                    {content}
                    <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
            )}
        </div>
    );
};
