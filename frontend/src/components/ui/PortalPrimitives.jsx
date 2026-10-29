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
export function TablePagination({ children, className, style, ...props }) {
  return <div {...props} className={join('portal-table-pagination', className)} style={style}>{children}</div>;
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
