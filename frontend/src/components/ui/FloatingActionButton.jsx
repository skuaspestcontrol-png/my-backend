export default function FloatingActionButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ position: 'fixed', right: 16, bottom: 84, minHeight: 48, borderRadius: 999, border: '1px solid #9F174D', background: '#9F174D', color: '#fff', padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 14px 30px rgba(131,24,67,0.35)', zIndex: 1200 }}>
      {icon}{label}
    </button>
  );
}
