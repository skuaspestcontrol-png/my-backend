export default function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', zIndex: 4000, padding: 16, backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: 'var(--shadow-lg)' }}>
        <header style={{ padding: 16, borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close modal" style={{ border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff', minHeight: 34, padding: '0 10px', fontWeight: 700 }}>Close</button>
        </header>
        <div style={{ padding: 16 }}>{children}</div>
        {footer ? <footer style={{ padding: 16, borderTop: '1px solid #E5E7EB' }}>{footer}</footer> : null}
      </div>
    </div>
  );
}
