import { useState } from 'react';
import { baseControl, focusRingStyle } from './_helpers';

export default function AppInput({ label, helper, error, style, className, ...props }) {
  const [focus, setFocus] = useState(false);
  const isDateInput = props.type === 'date';
  return (
    <label className="crm-form-row">
      {label ? <span className="crm-form-label">{label}</span> : null}
      <input
        {...props}
        className={['crm-input', className].filter(Boolean).join(' ')}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={{
          ...baseControl,
          ...(isDateInput ? { appearance: 'none', WebkitAppearance: 'none', minWidth: 0, overflow: 'hidden' } : {}),
          ...(focus ? focusRingStyle : {}),
          ...(error ? { borderColor: '#DC2626' } : {}),
          ...style
        }}
      />
      {error ? <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error}</span> : helper ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{helper}</span> : null}
    </label>
  );
}
