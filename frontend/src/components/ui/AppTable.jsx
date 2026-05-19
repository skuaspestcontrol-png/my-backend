import AppCard from './AppCard';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

export default function AppTable({ columns = [], rows = [], loading = false, emptyTitle, renderRowActions }) {
  const headerClassName = (column = {}) => [
    'table-header-cell',
    column.align === 'number' ? 'table-number-cell' : '',
    column.align === 'percent' ? 'table-percent-cell' : '',
    column.align === 'status' ? 'table-status-cell' : '',
    column.align === 'actions' ? 'table-actions-cell' : ''
  ].filter(Boolean).join(' ');

  const bodyClassName = (column = {}) => [
    column.align === 'number' ? 'table-number-cell' : 'table-text-cell',
    column.align === 'percent' ? 'table-percent-cell' : '',
    column.align === 'status' ? 'table-status-cell' : '',
    column.primary ? 'table-name-cell' : ''
  ].filter(Boolean).join(' ');

  return (
    <AppCard className="crm-table-card" style={{ overflow: 'hidden' }}>
      <div className="crm-scroll-table" style={{ overflowX: 'auto' }}>
        <table className="table-clean" style={{ width: '100%', minWidth: 760, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={headerClassName(c)}
                  style={{ textAlign: c.align === 'number' ? 'right' : c.align === 'percent' ? 'center' : 'left' }}
                >
                  <span>{c.label}</span>
                </th>
              ))}
              {renderRowActions ? <th className="table-header-cell table-actions-cell"><span>Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + (renderRowActions ? 1 : 0)} style={{ padding: 24, textAlign: 'center' }}><LoadingSpinner /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length + (renderRowActions ? 1 : 0)}><EmptyState title={emptyTitle || 'No records'} /></td></tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={bodyClassName(c)}
                      style={{ textAlign: c.align === 'number' ? 'right' : c.align === 'percent' ? 'center' : 'left' }}
                    >
                      {c.render ? c.render(row[c.key], row) : row[c.key]}
                    </td>
                  ))}
                  {renderRowActions ? <td className="table-actions-cell">{renderRowActions(row)}</td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
