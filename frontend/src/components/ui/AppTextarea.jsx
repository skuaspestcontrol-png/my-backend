import { useState } from 'react';
import { baseControl, focusRingStyle } from './_helpers';
import { theme } from '../../styles/theme';

export default function AppTextarea({ label, helper, error, style, className, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <label className="crm-form-row">
      {label ? <span className="crm-form-label">{label}</span> : null}
      <textarea
        {...props}
        className={['crm-textarea', className].filter(Boolean).join(' ')}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={{ ...baseControl, minHeight: 80, padding: '10px 12px', ...(focus ? focusRingStyle : {}), ...(error ? { borderColor: theme.colors.danger } : {}), ...style }}
      />
      {error ? <span style={{ color: theme.colors.danger, fontSize: 12 }}>{error}</span> : helper ? <span style={{ color: theme.colors.muted, fontSize: 12 }}>{helper}</span> : null}
    </label>
  );
}
