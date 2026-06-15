import React from 'react';

export default function SortChevronIcon({ size = 14, color = 'currentColor', className = '', style = {} }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, color, ...style }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.75"
        y="0.75"
        width="16.5"
        height="16.5"
        rx="5"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M5.25 7.25L9 3.5L12.75 7.25"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.25 10.75L9 14.5L12.75 10.75"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
