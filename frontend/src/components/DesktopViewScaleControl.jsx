import { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

const STORAGE_KEY = 'skuas_desktop_view_scale';
const DESKTOP_MIN_WIDTH = 1024;
const SCALE_OPTIONS = [
  { label: '90%', value: 0.9 },
  { label: '100%', value: 1 },
  { label: '110%', value: 1.1 },
  { label: '125%', value: 1.25 }
];

const getSavedScale = () => {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return SCALE_OPTIONS.some((option) => option.value === raw) ? raw : 1;
  } catch (_error) {
    return 1;
  }
};

const applyDesktopZoom = (scale) => {
  const next = Number(scale) || 1;
  document.documentElement.style.zoom = String(next);
};

export default function DesktopViewScaleControl({ viewportWidth }) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(() => getSavedScale());
  const rootRef = useRef(null);
  const restoreScaleRef = useRef(scale);
  const width = Number(viewportWidth || window.innerWidth);
  const isDesktop = width >= DESKTOP_MIN_WIDTH;

  useEffect(() => {
    restoreScaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    if (isDesktop) {
      applyDesktopZoom(scale);
      return;
    }
    applyDesktopZoom(1);
    setOpen(false);
  }, [isDesktop, scale]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(scale));
    } catch (_error) {
      // Ignore storage issues for comfort-only setting.
    }
  }, [scale]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    const handleBeforePrint = () => {
      restoreScaleRef.current = scale;
      applyDesktopZoom(1);
    };
    const handleAfterPrint = () => {
      if (window.innerWidth >= DESKTOP_MIN_WIDTH) {
        applyDesktopZoom(restoreScaleRef.current);
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [scale]);

  useEffect(() => () => {
    applyDesktopZoom(1);
  }, []);

  if (!isDesktop) return null;

  const currentLabel = `View ${Math.round(scale * 100)}%`;

  return (
    <div
      ref={rootRef}
      className="desktop-scale-control"
      style={{
        position: 'fixed',
        right: 22,
        top: 84,
        zIndex: 7000,
        display: 'grid',
        justifyItems: 'end',
        gap: 10
      }}
    >
      {open ? (
        <div
          className="desktop-scale-control__menu"
          style={{
            minWidth: 152,
            background: '#fff',
            border: '1px solid rgba(15, 23, 42, 0.1)',
            borderRadius: 16,
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
            padding: 8,
            display: 'grid',
            gap: 4
          }}
        >
          {SCALE_OPTIONS.map((option) => {
            const active = option.value === scale;
            return (
              <button
                key={option.label}
                type="button"
                className="desktop-scale-control__option"
                onClick={() => {
                  setScale(option.value);
                  setOpen(false);
                }}
                style={{
                  minHeight: 34,
                  borderRadius: 10,
                  border: '1px solid transparent',
                  background: active ? '#111827' : '#fff',
                  color: active ? '#fff' : '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: 'none'
                }}
              >
                <span>{option.label}</span>
                {active ? <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Active</span> : null}
              </button>
            );
          })}
          <button
            type="button"
            className="desktop-scale-control__reset"
            onClick={() => {
              setScale(1);
              setOpen(false);
            }}
            style={{
              minHeight: 34,
              borderRadius: 10,
              border: '1px solid rgba(15, 23, 42, 0.08)',
              background: '#F8FAFC',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'none'
            }}
          >
            Reset
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="desktop-scale-control__trigger"
        aria-label={currentLabel}
        title={currentLabel}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          minHeight: 44,
          padding: '0 14px',
          borderRadius: 999,
          border: '1px solid rgba(15, 23, 42, 0.1)',
          background: '#fff',
          color: '#111827',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Search size={16} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{currentLabel}</span>
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }} />
      </button>
    </div>
  );
}
