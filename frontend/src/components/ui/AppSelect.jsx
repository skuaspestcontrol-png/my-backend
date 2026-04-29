import { useState } from 'react';
import { baseControl, focusRingStyle } from './_helpers';

export default function AppSelect({ label, helper, error, children, style, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      {label ? <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{label}</span> : null}
      <select
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={{ ...baseControl, ...(focus ? focusRingStyle : {}), ...(error ? { borderColor: '#DC2626' } : {}), ...style }}
      >
        {children}
      </select>
      {error ? <span style={{ color: '#DC2626', fontSize: 12 }}>{error}</span> : helper ? <span style={{ color: '#6B7280', fontSize: 12 }}>{helper}</span> : null}
    </label>
  );
}
