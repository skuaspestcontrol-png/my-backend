import { useId, useLayoutEffect, useRef, useState } from 'react';
import Modal from './Modal';
import AppButton from './AppButton';
import LoadingSpinner from './LoadingSpinner';

const join = (...parts) => parts.filter(Boolean).join(' ');

export function SummaryCardGrid({ children, className, style, ...props }) {
  return <div {...props} className={join('portal-summary-grid', className)} style={style}>{children}</div>;
}
export function FilterBar({ children, className, style, ...props }) {
  return <div {...props} className={join('portal-filter-bar', className)} style={style}>{children}</div>;
}
export function TablePagination({ children, className, style, variant, summary, currentPage, totalPages, ...props }) {
  if (variant === 'glass') {
    return <footer {...props} className={join('portal-table-pagination glass-table-footer', className)} style={style}>
      <div className="glass-footer-summary">{summary}</div>
      {children || currentPage ? <div className="glass-footer-navigation">
        {currentPage && totalPages ? <span className="glass-page-position" aria-live="polite">Page <strong>{currentPage}</strong><span>of {totalPages}</span></span> : null}
        {children}
      </div> : null}
    </footer>;
  }
  return <div {...props} className={join('portal-table-pagination', className)} style={style}>{children}</div>;
}
// Keep native tables, column sizing and page-owned controls intact.
export function TableViewport({ children, className, style, label, ...props }) {
  const viewport = useRef(null);
  const hintId = useId();
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const element = viewport.current;
    const measure = () => setOverflows(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [children]);
  return <div className="glass-table-frame">
    <div {...props} ref={viewport} className={join('glass-table-viewport', className)} style={style} role={label ? 'region' : undefined} aria-label={label} aria-describedby={overflows ? hintId : undefined} tabIndex={label ? 0 : undefined}>{children}</div>
    {overflows ? <div id={hintId} className="glass-table-scroll-hint"><span aria-hidden="true">↔</span>Scroll horizontally to view all columns and actions</div> : null}
  </div>;
}
export function TableToolbar({ children, className, ...props }) {
  return <div {...props} className={join('glass-table-toolbar', className)}>{children}</div>;
}
export function TabBar({ children, className, revealFocusedTab = false, onFocusCapture, ...props }) {
  const revealFocus = (event) => {
    onFocusCapture?.(event);
    if (!revealFocusedTab || event.defaultPrevented) return;
    const tabs = event.currentTarget, button = event.target.closest('button');
    if (button?.parentElement !== tabs || tabs.scrollWidth <= tabs.clientWidth) return;
    const bounds = tabs.getBoundingClientRect(), item = button.getBoundingClientRect();
    if (item.left < bounds.left + 8) tabs.scrollLeft -= bounds.left + 8 - item.left;
    else if (item.right > bounds.right - 8) tabs.scrollLeft += item.right - bounds.right + 8;
  };
  return <div {...props} onFocusCapture={revealFocus} className={join('glass-tabs', className)}>{children}</div>;
}
export function ResponsiveFormGrid({ children, className, style, ...props }) {
  return <div {...props} className={join('portal-form-grid', className)} style={style}>{children}</div>;
}
export function LoadingState({ message = 'Loading…', children }) {
  return <div className="portal-state" role="status" aria-live="polite"><LoadingSpinner /><span>{message}</span>{children}</div>;
}
export function ErrorState({ message, children }) {
  if (!message) return null;
  return <div className="portal-state portal-state--error" role="alert"><span>{message}</span>{children}</div>;
}
export function ConfirmDialog({ open, title, children, onClose, onConfirm, busy = false, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'primary' }) {
  return <Modal open={open} title={title} onClose={busy ? undefined : onClose} footer={<>
    <AppButton variant="outline" disabled={busy} onClick={onClose}>{cancelLabel}</AppButton>
    <AppButton variant={variant} loading={busy} onClick={onConfirm}>{confirmLabel}</AppButton>
  </>}>{children}</Modal>;
}
