import React from 'react';

export default function RupeeSymbol({ size = 18, style, className, title = 'Rupee', ...props }) {
  return (
    <span
      aria-hidden={title ? undefined : true}
      title={title}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${size}px`,
        fontWeight: 800,
        lineHeight: 1,
        flex: '0 0 auto',
        ...style
      }}
      {...props}
    >
      ₹
    </span>
  );
}
