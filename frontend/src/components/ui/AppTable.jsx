import ResizableTable from '../table/ResizableTable';

export default function AppTable({
  columns = [],
  rows = [],
  loading = false,
  emptyTitle,
  renderRowActions,
  storageKey,
  defaultColumnWidths = {},
  columnBounds = {},
  minWidth = 760
}) {
  return (
    <ResizableTable
      columns={columns}
      rows={rows}
      loading={loading}
      emptyTitle={emptyTitle}
      renderRowActions={renderRowActions}
      storageKey={storageKey}
      defaultColumnWidths={defaultColumnWidths}
      columnBounds={columnBounds}
      minWidth={minWidth}
    />
  );
}
