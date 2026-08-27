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
        aria-label="Action"
        onClick={() => setOpen((v) => !v)}
        style={{
          minWidth: 120,
          height: 36,
          padding: '0 14px',
          borderRadius: 12,
          border: '1px solid #C7CDD6',
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
          zIndex: 2,
          pointerEvents: 'auto'
        }}
      >
        <span>Action</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div style={{ position: 'absolute', right: 0, top: 42, minWidth: 200, padding: 6, border: '1px solid #E5E7EB', borderRadius: 14, background: '#fff', boxShadow: '0 16px 34px rgba(15,23,42,0.14)', overflow: 'visible', zIndex: 1200 }}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => { item.onClick?.(); setOpen(false); }}
              style={{
                width: '100%',
                minHeight: 40,
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                background: item.disabled ? '#F8FAFC' : '#fff',
                textAlign: 'left',
                padding: '0 12px',
                marginBottom: 6,
                color: item.disabled ? '#9CA3AF' : '#1F2937',
                fontWeight: 700,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
