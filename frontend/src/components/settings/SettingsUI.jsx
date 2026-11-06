import { useEffect, useId, useRef } from 'react';

export function SettingsCard({ title, description, icon: Icon, children, className = '' }) {
  const id = useId();
  return <section className={`settings-card ${className}`} aria-labelledby={title ? id : undefined}>
    {title ? <header className="settings-card-heading">
      {Icon ? <span className="settings-card-icon"><Icon size={18} aria-hidden="true" /></span> : null}
      <div><h3 id={id}>{title}</h3>{description ? <p>{description}</p> : null}</div>
    </header> : null}
    <div className="settings-card-content">{children}</div>
  </section>;
}

// Associate existing controls with their visible labels without changing values or handlers.
export function useSettingsLabels(ref, enabled) {
  const prefix = useId();
  const sequence = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    for (const label of ref.current?.querySelectorAll('.settings-field-label') || []) {
      const field = label.closest('.settings-field');
      const controls = [...(field?.querySelectorAll('input,select,textarea') || [])]
        .filter(control => !['hidden', 'file', 'color'].includes(control.type));
      if (controls.length !== 1) continue;
      const control = controls[0];
      if (!control.id) control.id = `${prefix}-settings-${sequence.current++}`;
      label.htmlFor = control.id;
    }
  });
}
