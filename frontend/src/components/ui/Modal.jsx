export default function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal crm-modal-normal" onClick={(e) => e.stopPropagation()}>
        <header className="crm-modal-header">
          <h3 className="crm-modal-title">{title}</h3>
          <button type="button" className="crm-btn" onClick={onClose} style={{ border: '1px solid var(--brand-border-color)', background: 'transparent', color: '#fff' }}>Close</button>
        </header>
        <div className="crm-modal-body">{children}</div>
        {footer ? <footer className="crm-modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
