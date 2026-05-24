import { useState } from 'react';
import { baseControl, focusRingStyle } from './_helpers';

export default function AppSelect({ label, helper, error, children, style, className, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <label className="crm-form-row">
      {label ? <span className="crm-form-label">{label}</span> : null}
      <select
        {...props}
        className={['crm-select', className].filter(Boolean).join(' ')}
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
