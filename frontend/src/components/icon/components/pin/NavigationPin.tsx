interface NavigationPinIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function NavigationPinIcon({
  width = 20,
  height = 20,
  className = "",
}: NavigationPinIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 512 512"
      className={className}
    >
      <linearGradient id="a" x1="256" x2="256" y1="512" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a93aff"></stop><stop offset="1" stop-color="#ff81ff"></stop></linearGradient><linearGradient id="b" x1="256" x2="256" y1="391.023" y2="91.776" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffbef9"></stop><stop offset="1" stop-color="#fff1ff"></stop></linearGradient><circle cx="256" cy="256" r="256" fill="url(#a)"></circle><path fill="url(#b)" d="m389.711 369.906-120-270c-2.417-5.42-8.064-8.13-13.711-8.13s-11.294 2.71-13.711 8.13l-120 270c-2.563 5.786-1.23 12.568 3.354 16.934 4.57 4.395 11.426 5.449 17.065 2.578L256 332.772l113.291 56.646c5.566 2.802 12.473 1.849 17.065-2.578 4.585-4.365 5.918-11.148 3.355-16.934z"></path>
    </svg>
  );
}
