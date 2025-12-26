interface PinIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function PinIcon({
  width = 20,
  height = 20,
  className = "",
}: PinIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 512 512"
      className={className}
    >
      <linearGradient id="a" x1="256" x2="256" y1="512" y2="0" gradientUnits="userSpaceOnUse"><stop stopOpacity="1" stopColor="#5558ff" offset="0.01234566665716917"></stop><stop stopOpacity="1" stopColor="#00c0ff" offset="1"></stop></linearGradient><linearGradient id="b" x1="256" x2="256" y1="301" y2="91" gradientUnits="userSpaceOnUse"><stop stopOpacity="1" stopColor="#a6d5f8" offset="0"></stop><stop stopOpacity="1" stopColor="#eaf6ff" offset="1"></stop></linearGradient><path fill="url(#a)" d="M256 0C148.48 0 61 87.48 61 195c0 86.895 43.315 129.375 89.165 174.346 35.156 34.482 71.514 72.137 91.611 132.4C243.812 507.869 249.54 512 256 512s12.188-4.131 14.224-10.254c20.083-60.264 56.44-97.889 91.597-132.371C407.685 324.434 451 281.953 451 195 451 87.48 363.52 0 256 0z"></path><circle cx="256" cy="196" r="105" fill="url(#b)"></circle>
    </svg>
  );
}
