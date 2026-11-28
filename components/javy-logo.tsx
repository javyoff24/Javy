"use client";

type JavyLogoProps = { size?: number; className?: string };

export default function JavyLogo({ size = 24, className = "" }: JavyLogoProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 16.2C12.2 16.2 11.5 7.1 19.2 7.1M7 16.2C12.2 16.2 12.8 24.8 19.2 24.8M19.2 7.1H25M19.2 24.8H25"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.2" cy="16.2" r="3.1" fill="currentColor" />
      <circle cx="25.2" cy="7.1" r="3.1" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="25.2" cy="24.8" r="3.1" stroke="currentColor" strokeWidth="2.1" />
    </svg>
  );
}
