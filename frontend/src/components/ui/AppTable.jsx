import AppCard from './AppCard';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

export default function AppTable({ columns = [], rows = [], loading = false, emptyTitle, renderRowActions }) {
  return (
    <AppCard style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 760, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ background: '#F8FAFC', color: '#6B7280', fontSize: 12, textAlign: 'left', padding: '12px 14px', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{c.label}</th>
              ))}
              {renderRowActions ? <th style={{ background: '#F8FAFC', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: 12, padding: '12px 14px', borderBottom: '1px solid #E5E7EB' }}>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + (renderRowActions ? 1 : 0)} style={{ padding: 24, textAlign: 'center' }}><LoadingSpinner /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length + (renderRowActions ? 1 : 0)}><EmptyState title={emptyTitle || 'No records'} /></td></tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {columns.map((c) => <td key={c.key} style={{ padding: '13px 14px', color: '#111827', fontSize: 14, verticalAlign: 'middle' }}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>)}
                  {renderRowActions ? <td style={{ padding: '12px 14px' }}>{renderRowActions(row)}</td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
