interface HomePinIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function HomePinIcon({
  width = 20,
  height = 20,
  className = "",
}: HomePinIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 512 512"
      className={className}
    >
      <linearGradient id="a" x1="256" x2="256" y1="512" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a93aff"></stop><stop offset="1" stop-color="#ff81ff"></stop></linearGradient><linearGradient id="b" x1="256" x2="256" y1="300" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffbef9"></stop><stop offset="1" stop-color="#fff1ff"></stop></linearGradient><path fill="url(#a)" d="M256 512c-4.717 0-9.17-2.227-12.012-6.006L99.877 311.748C74.447 277.808 61 237.437 61 195 61 87.48 148.48 0 256 0s195 87.48 195 195c0 42.437-13.447 82.808-38.877 116.748L268.012 505.994A15.042 15.042 0 0 1 256 512z"></path><path fill="url(#b)" d="M371.605 220.605c-5.859 5.859-15.352 5.859-21.211 0L346 216.211V285c0 8.291-6.709 15-15 15h-60v-75c0-8.291-6.709-15-15-15s-15 6.709-15 15v75h-60c-8.291 0-15-6.709-15-15v-68.789l-4.395 4.395c-5.859 5.859-15.352 5.859-21.211 0s-5.859-15.352 0-21.211l105-105c5.859-5.859 15.352-5.859 21.211 0l105 105c5.86 5.859 5.86 15.351 0 21.21z"></path>
    </svg>
  );
}
