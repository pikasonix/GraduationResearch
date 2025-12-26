interface MarkPinIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function MarkPinIcon({
  width = 20,
  height = 20,
  className = "",
}: MarkPinIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 512 512"
      className={className}
    >
      <linearGradient id="a" x1="256" x2="256" y1="512" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fd5900"></stop><stop offset="1" stopColor="#ffde00"></stop></linearGradient><linearGradient id="b" x1="256" x2="256" y1="307.082" y2="60.674" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffe59a"></stop><stop offset="1" stopColor="#ffffd5"></stop></linearGradient><path fill="url(#a)" d="M256 0C148.48 0 61 87.48 61 195c0 86.909 43.315 129.375 89.165 174.346 35.156 34.482 71.514 72.137 91.611 132.4C243.812 507.869 249.54 512 256 512s12.188-4.131 14.224-10.254c20.083-60.264 56.44-97.903 91.597-132.371C407.685 324.419 451 281.953 451 195 451 87.48 363.52 0 256 0z"></path><path fill="url(#b)" d="M384.394 153.296a15.004 15.004 0 0 0-12.114-10.21l-71.045-10.342-31.787-64.38c-2.52-5.127-7.983-7.69-13.448-7.69-5.464 0-10.927 2.564-13.447 7.69l-31.787 64.38-71.045 10.342a15.004 15.004 0 0 0-12.114 10.21 15.002 15.002 0 0 0 3.794 15.366l51.416 50.112-12.129 70.767a14.99 14.99 0 0 0 5.962 14.663c4.644 3.384 10.796 3.809 15.791 1.143L256 271.948l63.56 33.398c5.005 2.654 11.139 2.236 15.791-1.143a14.99 14.99 0 0 0 5.962-14.663l-12.129-70.767 51.416-50.112a15.002 15.002 0 0 0 3.794-15.365z"></path>
    </svg>
  );
}
