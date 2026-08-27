import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function ActionMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const ref = useRef(null);

  const closeMenu = () => {
    setOpen(false);
    setMenuPosition(null);
  };

  const updateMenuPosition = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const menuWidth = 220;
    const menuGap = 6;
    const viewportPadding = 8;
    const left = Math.max(
      viewportPadding,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
    );
    const belowTop = rect.bottom + menuGap;
    const aboveTop = rect.top - menuGap - 10;
    const maxTop = window.innerHeight - viewportPadding - 10;
    const hasRoomBelow = belowTop + 10 <= window.innerHeight - viewportPadding;
    const top = Math.max(
      viewportPadding,
      Math.min(maxTop, hasRoomBelow ? belowTop : aboveTop)
    );
    setMenuPosition({ left, top, width: menuWidth });
  };

  useEffect(() => {
    const onDoc = (e) => {
      const target = e.target;
      const insideTrigger = target && typeof target.closest === 'function'
        ? target.closest('[data-action-trigger="true"]')
        : null;
      const insideMenu = target && typeof target.closest === 'function'
        ? target.closest('[data-action-menu="true"]')
        : null;
      if (!insideTrigger && !insideMenu) closeMenu();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onViewportChange = () => closeMenu();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  const menuItems = useMemo(() => items.filter(Boolean), [items]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Action"
        data-action-trigger="true"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => {
          if (open) {
            closeMenu();
            return;
          }
          updateMenuPosition();
          setOpen(true);
        }}
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
      {open && menuPosition ? createPortal(
        <div
          data-action-menu="true"
          style={{
            position: 'fixed',
            left: `${menuPosition.left}px`,
            top: `${menuPosition.top}px`,
            width: `${menuPosition.width}px`,
            padding: 6,
            border: '1px solid #E5E7EB',
            borderRadius: 14,
            background: '#fff',
            boxShadow: '0 16px 34px rgba(15,23,42,0.14)',
            overflow: 'visible',
            zIndex: 6000
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.onClick?.();
                closeMenu();
              }}
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
        </div>,
        document.body
      ) : null}
    </div>
  );
}
