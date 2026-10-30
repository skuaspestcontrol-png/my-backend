import { Children, cloneElement, isValidElement, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import '../../styles/crmForm.css';

const classes = (...values) => values.filter(Boolean).join(' ');

// Opt-in primitives: callers retain form values, validation, save/close handlers and Escape policy.
export function CRMModal({ as: Element = 'div', children, className, onKeyDown, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('.skuas-modal-close')?.focus();
    return () => { if (previous?.isConnected) previous.focus?.(); };
  }, []);
  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Tab') return;
    // A caller may open its existing duplicate/review dialog above this form.
    const surfaces = [...document.querySelectorAll('.crm-modal-surface, [role="dialog"]')].filter((node) => node.getClientRects().length);
    if (surfaces[surfaces.length - 1] !== ref.current) return;
    const controls = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter((node) => node.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <Element {...props} ref={ref} role="dialog" aria-modal="true" className={classes('crm-modal-surface skuas-form-modal', className)} onKeyDown={handleKeyDown}>{children}</Element>;
}
export function CRMModalCloseButton({ className, 'aria-label': ariaLabel = 'Close', title = 'Close', ...props }) {
  return <button {...props} type="button" aria-label={ariaLabel} title={title} className={classes('skuas-modal-close', className)}><X size={22} aria-hidden="true" /></button>;
}
export function CRMModalHeader({ title, subtitle, titleId, onClose, closeDisabled = false, icon: Icon }) {
  return <header className="crm-modal-surface-header skuas-modal-header"><div className={Icon ? 'crm-form-heading' : undefined}>{Icon ? <Icon size={28} aria-hidden="true" /> : null}<div><h3 id={titleId}>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div></div><CRMModalCloseButton onClick={onClose} disabled={closeDisabled} /></header>;
}
export function CRMModalBody({ children, className, ...props }) {
  return <div {...props} className={classes('crm-modal-surface-body skuas-modal-body', className)}>{children}</div>;
}
export function CRMModalFooter({ children, className, ...props }) {
  return <footer {...props} className={classes('crm-modal-surface-footer skuas-modal-footer', className)}>{children}</footer>;
}
export function CRMFormSection({ title, children, className, ...props }) {
  const id = useId();
  return <section {...props} className={classes('skuas-form-section', className)} aria-labelledby={title ? id : undefined}>{title ? <h4 id={id}>{title}</h4> : null}{children}</section>;
}
export function CRMFormGrid({ children, className, ...props }) {
  return <div {...props} className={classes('skuas-form-grid', className)}>{children}</div>;
}
export function CRMFormField({ label, children, className, requiredHint, ...props }) {
  const id = useId();
  const control = Children.count(children) === 1 ? Children.only(children) : null;
  const native = isValidElement(control) && ['input', 'select', 'textarea'].includes(control.type);
  const controlId = native ? (control.props.id || `${id}-control`) : undefined;
  return <div {...props} data-required-hint={requiredHint || undefined} className={classes('skuas-form-field', className)}><label id={`${id}-label`} htmlFor={controlId}>{label}</label>{native ? cloneElement(control, { id: controlId, ...(requiredHint ? { 'aria-required': true } : {}) }) : <div role="group" aria-labelledby={`${id}-label`}>{children}</div>}</div>;
}
export function CRMFormActions({ children, className, ...props }) {
  return <div {...props} className={classes('skuas-form-actions', className)}>{children}</div>;
}
