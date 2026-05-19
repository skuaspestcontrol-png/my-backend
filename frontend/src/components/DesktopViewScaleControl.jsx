import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, ZoomIn } from 'lucide-react';

const STORAGE_KEY = 'skuas_desktop_view_scale';
const DESKTOP_MIN_WIDTH = 1024;
const SCALE_OPTIONS = [0.9, 1, 1.1, 1.25];

const formatScaleLabel = (scale) => `${Math.round(Number(scale || 1) * 100)}%`;

const getSavedScale = () => {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return SCALE_OPTIONS.includes(raw) ? raw : 1;
  } catch (_error) {
    return 1;
  }
};

const applyDesktopZoom = (scale) => {
  const next = Number(scale) || 1;
  document.documentElement.style.zoom = String(next);
};

const getScaleIndex = (scale) => {
  const normalized = Number(scale) || 1;
  const exactIndex = SCALE_OPTIONS.findIndex((value) => value === normalized);
  if (exactIndex >= 0) return exactIndex;
  const closestIndex = SCALE_OPTIONS.findIndex((value) => value > normalized);
  return closestIndex === -1 ? SCALE_OPTIONS.length - 1 : Math.max(0, closestIndex - 1);
};

export default function DesktopViewScaleControl({ viewportWidth }) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(() => getSavedScale());
  const rootRef = useRef(null);
  const restoreScaleRef = useRef(scale);
  const width = Number(viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 0));
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
      // Ignore storage issues for a comfort-only control.
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

  const currentLabel = `View ${formatScaleLabel(scale)}`;
  const currentIndex = getScaleIndex(scale);
  const hasLower = currentIndex > 0;
  const hasHigher = currentIndex < SCALE_OPTIONS.length - 1;

  const adjustScale = (direction) => {
    const nextIndex = direction === 'down'
      ? Math.max(0, currentIndex - 1)
      : Math.min(SCALE_OPTIONS.length - 1, currentIndex + 1);
    setScale(SCALE_OPTIONS[nextIndex]);
    setOpen(true);
  };

  return (
    <div
      ref={rootRef}
      className="desktop-scale-control"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <button
        type="button"
        className="desktop-scale-control__trigger"
        aria-label={currentLabel}
        title={currentLabel}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: 42,
          height: 42,
          borderRadius: '999px',
          border: '1px solid var(--color-border)',
          background: '#fff',
          color: 'var(--color-primary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative'
        }}
      >
        <ZoomIn size={20} />
      </button>

      {open ? (
        <div
          className="desktop-scale-control__menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            minWidth: 196,
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
            padding: 10,
            display: 'grid',
            gap: 8,
            zIndex: 6500
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Zoom
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{currentLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setScale(1);
                setOpen(false);
              }}
              style={{
                border: '1px solid rgba(15,23,42,0.08)',
                background: '#f8fafc',
                color: '#334155',
                borderRadius: 10,
                minHeight: 30,
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => adjustScale('down')}
              disabled={!hasLower}
              style={{
                minHeight: 34,
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: hasLower ? '#fff' : '#f8fafc',
                color: hasLower ? '#111827' : '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '0 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: hasLower ? 'pointer' : 'not-allowed'
              }}
            >
              <Minus size={14} />
              Out
            </button>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>
              {currentLabel}
            </div>
            <button
              type="button"
              onClick={() => adjustScale('up')}
              disabled={!hasHigher}
              style={{
                minHeight: 34,
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: hasHigher ? '#fff' : '#f8fafc',
                color: hasHigher ? '#111827' : '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '0 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: hasHigher ? 'pointer' : 'not-allowed'
              }}
            >
              In
              <Plus size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
