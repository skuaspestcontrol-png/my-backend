import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartSurface } from '../../pages/sales-performance/SalesChartPrimitives';
import { formatCompactIndianCurrency } from '../../pages/sales-performance/salesPerformanceApi';
import { comboAxisDomain, exactSalesMoney, exactSalesPercent, prepareSalesComboTrend, salesComboTotals } from './salesTeamComboData';
import './salesTeamComboChart.css';

function MonthValues({ row, year }) {
  return <><strong>{row.name} {year}</strong><dl>
    <div><dt>Target</dt><dd>{exactSalesMoney(row.target)}</dd></div>
    <div><dt>Achieved</dt><dd>{exactSalesMoney(row.achieved)}</dd></div>
    <div><dt>Achievement</dt><dd>{exactSalesPercent(row.achievementPercent)}{row.nonPositiveTarget ? ' *' : ''}</dd></div>
  </dl>{row.note ? <p>{row.note}</p> : null}</>;
}
function ExactTooltip({ active, payload, year }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="sales-combo-tooltip"><MonthValues row={row} year={year} /></div>;
}
export default function SalesTeamComboChart({ trend, totalTarget, totalAchieved, year, teamLabel, loading, available, formatTotal, mobile }) {
  const [visible, setVisible] = useState({ target: true, achieved: true, achievementPercent: true });
  const prepared = useMemo(() => prepareSalesComboTrend(trend), [trend]);
  const totals = salesComboTotals(prepared, totalTarget, totalAchieved);
  const currencyDomain = comboAxisDomain(prepared.months.flatMap(row => [row.target, row.achieved]));
  const percentDomain = comboAxisDomain(prepared.months.map(row => row.achievementPercent), true);
  const hasData = prepared.targetMonths > 0 || prepared.achievedMonths > 0;
  const series = [['target', 'Target', 'navy'], ['achieved', 'Achieved', 'blue'], ['achievementPercent', 'Achievement %', 'green']];
  const showTotal = value => value === null ? 'Unavailable' : formatTotal(value);
  if (loading) return <div className="sales-combo sales-combo-state" role="status">Loading sales performance…</div>;
  if (!available) return <div className="sales-combo sales-combo-state" role="alert">Unable to load sales performance. Refresh the page or change a filter to try again.</div>;
  if (!hasData) return <div className="sales-combo sales-combo-state" role="status">No sales performance data available for this selection.</div>;
  return <div className="sales-combo">
    <div className="sales-combo-kpis" aria-label="Selected year monthly-plan totals">
      <div><span>Total Target</span><strong>{showTotal(totals.target)}</strong><small>Sum of monthly targets{!totals.complete ? ' · partial response' : ''}</small></div>
      <div><span>Total Achieved</span><strong>{showTotal(totals.achieved)}</strong><small>Invoice revenue{!totals.complete ? ' · partial response' : ''}</small></div>
      <div><span>Achievement</span><strong>{exactSalesPercent(totals.achievementPercent)}{totals.complete && totals.target <= 0 ? ' *' : ''}</strong><small>Against the monthly plan</small></div>
      <div><span>Target Variance</span><strong>{totals.variance === null ? 'Unavailable' : `${totals.variance > 0 ? '+' : ''}${formatTotal(totals.variance)}`}</strong><small>{totals.variance === null ? 'Requires a complete monthly plan' : totals.variance > 0 ? 'Above monthly plan' : totals.variance < 0 ? 'Below monthly plan' : 'On monthly plan'}</small></div>
    </div>
    <div className="sales-combo-toolbar"><div className="sales-combo-legend" aria-label="Chart series visibility">
      {series.map(([key, name, color]) => <button type="button" key={key} aria-pressed={visible[key]} onClick={() => setVisible(previous => ({ ...previous, [key]: !previous[key] }))}><i className={`sales-combo-swatch sales-combo-${color}`} aria-hidden="true" />{name}</button>)}
    </div><span>{teamLabel} · {year}</span></div>
    <div className="sales-combo-scroll" role="region" tabIndex={0} aria-label="Monthly target, achieved and achievement percentage chart">
      <ChartSurface height={mobile ? 300 : 350} minWidth={960}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={prepared.months} margin={{ top: 20, right: 12, bottom: 6, left: 10 }} barGap={3} barCategoryGap="24%" accessibilityLayer>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 4" />
            <XAxis dataKey="label" interval={0} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} height={30} />
            <YAxis yAxisId="money" domain={currencyDomain} width={84} tickFormatter={formatCompactIndianCurrency} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="rate" orientation="right" domain={percentDomain} width={68} tickFormatter={value => `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} tickLine={false} axisLine={false} />
            <ReferenceLine yAxisId="money" y={0} stroke="var(--chart-axis)" />
            <Tooltip trigger={mobile ? 'click' : 'hover'} isAnimationActive={false} cursor={{ fill: 'var(--ui-action-soft)' }} content={<ExactTooltip year={year} />} />
            <Bar yAxisId="money" dataKey="target" name="Target" fill="var(--sales-combo-target)" maxBarSize={28} hide={!visible.target} isAnimationActive={false} />
            <Bar yAxisId="money" dataKey="achieved" name="Achieved" fill="var(--sales-combo-achieved)" maxBarSize={28} hide={!visible.achieved} isAnimationActive={false} />
            <Line yAxisId="rate" dataKey="achievementPercent" name="Achievement %" type="linear" stroke="var(--sales-combo-rate)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--ui-card)', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} hide={!visible.achievementPercent} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartSurface>
    </div>
    {!Object.values(visible).some(Boolean) ? <p role="status" className="sales-combo-help">All chart series are hidden. Use the legend buttons to show them again.</p> : null}
    {!prepared.complete ? <p className="sales-combo-help" role="status">Partial or invalid response: {prepared.targetMonths}/12 target months and {prepared.achievedMonths}/12 achieved months supplied. Missing months are gaps; percentage and variance totals require complete data.</p> : null}
  </div>;
}
