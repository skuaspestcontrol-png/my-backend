import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function ActionMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Options for Action"
        onClick={() => setOpen((v) => !v)}
        style={{
          minWidth: 142,
          height: 36,
          padding: '0 14px',
          borderRadius: 12,
          border: '1px solid #D1D5DB',
          background: '#fff',
          color: '#1F2937',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
          position: 'relative',
          zIndex: 1
        }}
      >
        <span>Options for Action</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div style={{ position: 'absolute', right: 0, top: 42, minWidth: 180, border: '1px solid #E5E7EB', borderRadius: 12, background: '#fff', boxShadow: '0 14px 30px rgba(15,23,42,0.12)', overflow: 'hidden', zIndex: 40 }}>
          {items.map((item) => (
            <button key={item.label} type="button" disabled={item.disabled} onClick={() => { item.onClick?.(); setOpen(false); }} style={{ width: '100%', minHeight: 40, border: 'none', background: '#fff', textAlign: 'left', padding: '0 12px', color: item.disabled ? '#9CA3AF' : '#1F2937', fontWeight: 600, cursor: item.disabled ? 'not-allowed' : 'pointer' }}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
