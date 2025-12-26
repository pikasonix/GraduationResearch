interface BigTruckIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function BigTruckIcon({
  width = 20,
  height = 20,
  className = "",
}: BigTruckIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 512 512"
      className={className}
    >
      <linearGradient id="bigtruck-a" x1="256" x2="256" y1="436" y2="151" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#e64c4c"></stop><stop offset="1" stopColor="#f06262"></stop></linearGradient><linearGradient id="bigtruck-b" x1="256" x2="256" y1="451" y2="61" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fca5a5"></stop><stop offset="1" stopColor="#fecaca"></stop></linearGradient><path fill="url(#bigtruck-a)" d="M512 286c0-1.201-.3-2.4-.3-3.6l-104.7-30L377 151h-61c-8.401 0-15 6.599-15 15v135H30c-16.5 0-30 13.5-30 30v75c0 8.399 6.599 15 15 15 65.958-.436 58.242.764 63.968-.76C84.005 429.553 93.474 436 105 436c11.536 0 21.013-6.455 26.047-15.78 4.205 1.144 33.708 1.143 37.908 0C173.989 429.545 183.464 436 195 436c11.526 0 20.997-6.447 26.034-15.76 1.298.346 2.582.76 3.966.76h152c1.384 0 2.666-.414 3.97-.76C386.005 429.553 395.472 436 407 436s20.999-6.447 26.034-15.76c5.711 1.52-1.968.324 63.966.76 8.401 0 15-6.601 15-15v-45l-30-15 30-15z"></path><path fill="url(#bigtruck-b)" d="M481.7 162.4c-1.802-6.601-7.8-11.4-14.7-11.4h-90v131.4h134.7zM105 361c-24.901 0-45 20.1-45 45 0 24.899 20.099 45 45 45s45-20.101 45-45c0-24.9-20.099-45-45-45zm0 60c-8.401 0-15-6.601-15-15 0-8.401 6.599-15 15-15s15 6.599 15 15c0 8.399-6.599 15-15 15zm90-60c-24.901 0-45 20.1-45 45 0 24.899 20.099 45 45 45s45-20.101 45-45c0-24.9-20.099-45-45-45zm0 60c-8.401 0-15-6.601-15-15 0-8.401 6.599-15 15-15s15 6.599 15 15c0 8.399-6.599 15-15 15zm212-60c-24.902 0-45 20.1-45 45 0 24.899 20.098 45 45 45s45-20.101 45-45c0-24.9-20.098-45-45-45zm0 60c-8.401 0-15-6.601-15-15 0-8.401 6.599-15 15-15s15 6.599 15 15c0 8.399-6.599 15-15 15zm60-90c-8.401 0-15 6.599-15 15 0 8.399 6.599 15 15 15h45v-30zM316 61H15C6.716 61 0 67.716 0 76v255h316c8.284 0 15-6.716 15-15V76c0-8.284-6.716-15-15-15z"></path>
    </svg>
  );
}
