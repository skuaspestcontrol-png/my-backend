import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

const ACTION_MENU_OPEN_EVENT = 'crm-action-menu-open';

export default function ActionMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const ref = useRef(null);
  const menuIdRef = useRef(`action-menu-${Math.random().toString(36).slice(2, 10)}`);

  const closeMenu = () => {
    setOpen(false);
    setMenuPosition(null);
  };

  const updateMenuPosition = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const menuWidth = 176;
    const menuGap = 6;
    const viewportPadding = 8;
    const menuHeight = Math.max(48, 8 + items.filter(Boolean).length * 30);
    const left = Math.max(
      viewportPadding,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
    );
    const belowTop = rect.bottom + menuGap;
    const aboveTop = rect.top - menuGap - menuHeight;
    const maxTop = window.innerHeight - viewportPadding - menuHeight;
    const hasRoomBelow = belowTop + menuHeight <= window.innerHeight - viewportPadding;
    const top = Math.max(
      viewportPadding,
      Math.min(maxTop, hasRoomBelow ? belowTop : aboveTop)
    );
    setMenuPosition({ left, top, width: menuWidth });
  };

  useEffect(() => {
    const onMenuOpen = (event) => {
      if (event?.detail === menuIdRef.current) return;
      closeMenu();
    };
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
    window.addEventListener(ACTION_MENU_OPEN_EVENT, onMenuOpen);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener(ACTION_MENU_OPEN_EVENT, onMenuOpen);
      document.removeEventListener('mousedown', onDoc);
    };
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
          window.dispatchEvent(new CustomEvent(ACTION_MENU_OPEN_EVENT, { detail: menuIdRef.current }));
          updateMenuPosition();
          setOpen(true);
        }}
        style={{
          border: '1px solid rgba(17,17,17,0.16)',
          background: '#fff',
          color: '#1F2937',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          cursor: 'pointer',
          boxSizing: 'border-box',
          minWidth: 86,
          minHeight: 32,
          height: 32,
          padding: '0 8px 0 12px',
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
          position: 'relative',
          zIndex: 2,
          pointerEvents: 'auto'
        }}
      >
        <span>Action</span>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 5,
            border: '1px solid #d1d5db',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            flexShrink: 0
          }}
        >
          <ChevronDown size={11} />
        </span>
      </button>
      {open && menuPosition ? createPortal(
        <div
          data-action-menu="true"
          style={{
            position: 'fixed',
            left: `${menuPosition.left}px`,
            top: `${menuPosition.top}px`,
            width: `${menuPosition.width}px`,
            padding: 4,
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            background: '#fff',
            boxShadow: '0 8px 18px rgba(15,23,42,0.1)',
            overflow: 'visible',
            zIndex: 5000
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
                textAlign: 'left',
                border: 'none',
                background: item.disabled ? '#F8FAFC' : '#fff',
                padding: '6px 10px',
                color: item.disabled ? '#9CA3AF' : '#1F2937',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1.1,
                minHeight: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                marginBottom: 0,
                borderRadius: 0
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
