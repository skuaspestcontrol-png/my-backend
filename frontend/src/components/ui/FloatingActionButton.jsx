export default function FloatingActionButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ position: 'fixed', right: 16, bottom: 84, minHeight: 48, borderRadius: 999, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 14px 30px color-mix(in srgb, var(--color-primary-dark) 45%, transparent)', zIndex: 1200 }}>
      {icon}{label}
    </button>
  );
}
