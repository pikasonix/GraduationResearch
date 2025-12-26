interface AddPinIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function AddPinIcon({
  width = 20,
  height = 20,
  className = "",
}: AddPinIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 512 512"
      className={className}
    >
      <linearGradient id="a" x1="256" x2="256" y1="450" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#addcff"></stop><stop offset=".503" stopColor="#eaf6ff"></stop><stop offset="1" stopColor="#eaf6ff"></stop></linearGradient><linearGradient id="b" x1="256" x2="256" y1="512" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#5558ff"></stop><stop offset="1" stopColor="#00c0ff"></stop></linearGradient><path fill="url(#a)" d="M113.344 276.237C92.185 246.562 81 211.556 81 175 81 78.504 159.505 0 256 0s175 78.504 175 175c0 36.556-11.185 71.562-32.344 101.237-19.481 27.321-45.975 48.238-76.892 60.775l-52.348 104.696c-5.528 11.056-21.305 11.056-26.833 0l-52.348-104.696c-30.917-12.537-57.41-33.454-76.891-60.775z"></path><path fill="url(#b)" d="M256 60c-63.411 0-115 51.589-115 115s51.589 115 115 115 115-51.589 115-115S319.411 60 256 60zm40 130h-25v25c0 8.284-6.716 15-15 15s-15-6.716-15-15v-25h-25c-8.284 0-15-6.716-15-15s6.716-15 15-15h25v-25c0-8.284 6.716-15 15-15s15 6.716 15 15v25h25c8.284 0 15 6.716 15 15s-6.716 15-15 15zm-26.584 251.708 19.13-38.261C342.385 408.303 391 425.504 391 457c0 37.789-69.98 55-135 55s-135-17.211-135-55c0-31.496 48.615-48.697 102.453-53.553l19.13 38.261c5.528 11.056 21.306 11.056 26.833 0z"></path>
    </svg>
  );
}
