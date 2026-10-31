export default function RecordAvatar({ name, className = '' }) {
  const initials = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
  return <span aria-hidden="true" className={`glass-record-avatar ${className}`}>{initials || '•'}</span>;
}
