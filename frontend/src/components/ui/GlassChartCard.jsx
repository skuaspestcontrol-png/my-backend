import { createContext, useContext, useEffect, useState } from 'react';
import AppCard from './AppCard';
import { TableViewport } from './PortalPrimitives';
import { ChartSurface } from '../../pages/sales-performance/SalesChartPrimitives';

const ChartDetailContext = createContext(null);
function ChartValues({ label, entries }) {
  return <><strong>{label}</strong><dl>{entries.map(([key, name, value]) => <div key={key}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></>;
}
export function GlassChartTooltip({ active, payload, label, formatValue = String, formatLabel = String }) {
  const detail = useContext(ChartDetailContext);
  const serialized = JSON.stringify({ label: formatLabel(label ?? ''), entries: (payload || []).map(entry => [entry.dataKey, entry.name, entry.value == null ? 'Unavailable' : formatValue(entry.value)]) });
  const docked = detail?.docked, setValue = detail?.setValue;
  useEffect(() => { if (active && docked && payload?.length) setValue(JSON.parse(serialized)); }, [active, docked, serialized, setValue]);
  if (!active || !payload?.length || docked) return null;
  return <div className="glass-overview-tooltip" role="status"><ChartValues {...JSON.parse(serialized)} /></div>;
}
// Retain caller-owned Recharts data/series; expose the same values to keyboard and screen-reader users.
export default function GlassChartCard({ title, minWidth = 480, height = 280, rows = [], columns = [], docked = false, children }) {
  const [value, setValue] = useState(null);
  return <AppCard title={title} className="glass-surface glass-overview-chart">
    <ChartDetailContext.Provider value={{ docked, setValue }}><div className="glass-overview-chart-scroll" role="region" aria-label={`${title} chart`} tabIndex={0}>
      <ChartSurface height={height} minWidth={minWidth}>{children}</ChartSurface>
    </div></ChartDetailContext.Provider>
    {docked ? <div className="glass-overview-chart-dock" role="status" aria-live="polite">{value ? <ChartValues {...value} /> : <p>Tap a chart point for values, or open View chart data.</p>}</div> : null}
    <details className="glass-overview-chart-data"><summary>View chart data</summary><TableViewport label={`${title} source data`}>
      <table className="portal-data-table"><caption>{title}</caption><thead><tr>{columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>
        {rows.map((row, index) => <tr key={index}>{columns.map((column, cell) => cell === 0 ? <th scope="row" key={column.key}>{column.format ? column.format(row[column.key]) : row[column.key]}</th> : <td key={column.key}>{column.format ? column.format(row[column.key]) : row[column.key]}</td>)}</tr>)}
      </tbody></table>
    </TableViewport></details>
  </AppCard>;
}
