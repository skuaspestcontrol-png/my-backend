import { useEffect, useId, useRef } from 'react';

export default function Modal({ open, title, onClose, children, footer }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || []).filter((element) => element.getClientRects().length > 0);
    (focusable()[0] || dialog)?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog?.addEventListener('keydown', keydown);
    return () => { dialog?.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="crm-modal crm-modal-normal" onClick={(event) => event.stopPropagation()}>
        <header className="crm-modal-header">
          <h3 id={titleId} className="crm-modal-title">{title}</h3>
          <button type="button" className="crm-btn" disabled={!onClose} onClick={onClose} style={{ border: '1px solid var(--brand-border-color)', background: 'transparent', color: '#fff' }}>Close</button>
        </header>
        <div className="crm-modal-body">{children}</div>
        {footer ? <footer className="crm-modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
