interface MiniTruckIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function MiniTruckIcon({
  width = 20,
  height = 20,
  className = "",
}: MiniTruckIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 512 512"
      className={className}
    >
      <linearGradient id="minitruck-a" x1="256" x2="256" y1="376" y2="106" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#00b59c"></stop><stop offset="1" stopColor="#9cffac"></stop></linearGradient><linearGradient id="minitruck-b" x1="286.5" x2="286.5" y1="406" y2="106" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#c3ffe8"></stop><stop offset=".997" stopColor="#f0fff4"></stop></linearGradient><path fill="url(#minitruck-a)" d="m226 127-15-21h-90l-15 20.526V211h120zm286 114c0-1.611-.264-3.208-.762-4.746l-30-90A15.029 15.029 0 0 0 467 136H317c-8.291 0-15 6.709-15 15v135l-15 30-15-30h-15l-22.579-15H104.579L76 286H15c-8.284 0-15 6.714-15 15v60c0 8.284 6.716 15 15 15h242c8.284 0 30-6.716 30-15 0 8.291 21.709 15 30 15h180c8.291 0 15-6.709 15-15v-45l-30-15 30-15z"></path><path fill="url(#minitruck-b)" d="M106 316c-24.814 0-45 20.186-45 45s20.186 45 45 45 45-20.186 45-45-20.186-45-45-45zm301-60h75v-12.602L456.2 166H392v75c0 8.399 6.599 15 15 15zM76 286h181c8.291 0 15-6.709 15-15V121c0-8.291-6.709-15-15-15h-46v75c0 8.291-6.709 15-15 15h-60c-8.291 0-15-6.709-15-15v-75H76c-8.291 0-15 6.709-15 15v150c0 8.291 6.709 15 15 15zm226 75v-75h-30v75c0 8.399-6.599 15-15 15h60c-8.401 0-15-6.601-15-15zm105-45c-24.814 0-45 20.186-45 45s20.186 45 45 45 45-20.186 45-45-20.186-45-45-45zm60-30c-8.284 0-15 6.714-15 15 0 8.284 6.716 15 15 15h45v-30z"></path>
    </svg>
  );
}
