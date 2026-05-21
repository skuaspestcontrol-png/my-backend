import AppCard from '../ui/AppCard';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import useColumnResize from './useColumnResize';

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

export default function ResizableTable({
  columns = [],
  rows = [],
  loading = false,
  emptyTitle,
  renderRowActions,
  storageKey,
  defaultColumnWidths = {},
  columnBounds = {},
  minWidth = 760,
  className = 'crm-table-card',
  tableClassName = 'table-clean',
  cardStyle,
  tableStyle,
  showResetColumns = true
}) {
  const {
    getColumnStyle,
    resetColumns,
    startResize
  } = useColumnResize({
    storageKey,
    columns,
    defaultColumnWidths,
    columnBounds,
    minWidth,
    enabled: Boolean(storageKey)
  });

  const totalColSpan = columns.length + (renderRowActions ? 1 : 0);

  return (
    <AppCard className={className} style={{ overflow: 'hidden', ...cardStyle }}>
      {storageKey && showResetColumns ? (
        <div className="table-resize-toolbar">
          <button type="button" className="table-reset-columns-button" onClick={resetColumns}>
            Reset Columns
          </button>
        </div>
      ) : null}
      <div className="crm-scroll-table" style={{ overflowX: 'auto' }}>
        <table
          className={tableClassName}
          style={{
            width: '100%',
            minWidth,
            borderCollapse: 'separate',
            borderSpacing: 0,
            tableLayout: 'fixed',
            ...tableStyle
          }}
        >
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={headerClassName(column)}
                  style={{
                    ...getColumnStyle(column.key, { align: column.align || 'left' }),
                    position: 'relative',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>{column.label}</span>
                  {storageKey && column.resizable !== false ? (
                    <span
                      aria-hidden="true"
                      title="Drag to resize"
                      className="table-resize-handle"
                      onPointerDown={(event) => startResize(column.key, event)}
                    />
                  ) : null}
                </th>
              ))}
              {renderRowActions ? <th className="table-header-cell table-actions-cell"><span>Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={totalColSpan} style={{ padding: 24, textAlign: 'center' }}>
                  <LoadingSpinner />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={totalColSpan}>
                  <EmptyState title={emptyTitle || 'No records'} />
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={bodyClassName(column)}
                      style={{
                        ...getColumnStyle(column.key, { align: column.align || 'left' }),
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
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
