import { useState } from 'react';
import { baseControl, focusRingStyle } from './_helpers';

export default function AppInput({ label, helper, error, style, className, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <label className="crm-form-row">
      {label ? <span className="crm-form-label">{label}</span> : null}
      <input
        {...props}
        className={['crm-input', className].filter(Boolean).join(' ')}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={{ ...baseControl, ...(focus ? focusRingStyle : {}), ...(error ? { borderColor: '#DC2626' } : {}), ...style }}
      />
      {error ? <span style={{ color: '#DC2626', fontSize: 12 }}>{error}</span> : helper ? <span style={{ color: '#6B7280', fontSize: 12 }}>{helper}</span> : null}
    </label>
  );
}
