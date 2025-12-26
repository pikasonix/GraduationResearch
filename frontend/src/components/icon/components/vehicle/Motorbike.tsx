interface MotobikeIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function MotobikeIcon({
  width = 20,
  height = 20,
  className = "",
}: MotobikeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 512 512"
      className={className}
    >
      <linearGradient id="motorbike-a" x1="256" x2="256" y1="421" y2="76" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fd5900"></stop><stop offset="1" stopColor="#ffde00"></stop></linearGradient><linearGradient id="motorbike-b" x1="241.258" x2="241.258" y1="466" y2="226" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffe59a"></stop><stop offset="1" stopColor="#ffffd5"></stop></linearGradient><path fill="url(#motorbike-a)" d="M316 136h60c8.291 0 15-6.709 15-15s-6.709-15-15-15h-60c-8.291 0-15 6.709-15 15s6.709 15 15 15zm135 180h-30V196c0-25.356-16.055-48.091-39.99-56.572-9.518-3.484-20.01 3.679-20.01 14.136V316c0 16.538-13.447 30-30 30h-60c-16.553 0-30-13.462-30-30v-15c0-8.291-6.709-15-15-15l-25.737-15h-21.79L151 286c-59.268 0-111.332 44.224-119.799 102.861a15.022 15.022 0 0 0 3.516 11.953A14.95 14.95 0 0 0 46.055 406h15.461l44.905 15H169l40.484-15h123.032l42.063 15h56.842l48.063-15H497c8.284 0 15-6.716 15-15v-15c0-33.138-27.863-60-61-60zm-344.579-75h23.736L166 226c8.291 0 15-6.709 15-15V106l-45-30-103.422 30-31.062 30C.8 140.942 0 145.864 0 151v60c0 8.291 6.709 15 15 15h60z"></path><path fill="url(#motorbike-b)" d="M136 466c36.229 0 66.515-25.809 73.484-60H61.516c6.969 34.191 38.255 60 74.484 60zm75-240H75c-24.853 0-45 20.147-45 45 0 8.284 6.716 15 15 15h181c8.284 0 15-6.716 15-15v-15c0-16.569-13.431-30-30-30zM105 106h76V61c0-8.291-6.709-15-15-15h-61C52.245 46 8.873 85.25 1.516 136h61.062C68.76 118.539 85.43 106 105 106zm361-30h-60c-24.853 0-45 20.147-45 45v30c0 8.284 6.716 15 15 15h90c8.284 0 15-6.716 15-15V91c0-8.284-6.716-15-15-15zm-60 390c36.229 0 66.515-25.809 73.484-60H332.516c6.969 34.191 37.255 60 73.484 60z"></path>
    </svg>
  );
}
