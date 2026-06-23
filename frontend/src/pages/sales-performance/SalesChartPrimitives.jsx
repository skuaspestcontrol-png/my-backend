import AppCard from '../../components/ui/AppCard';
import { formatCompactIndianCurrency, percent } from './salesPerformanceApi';

const gridStroke = 'rgba(148, 163, 184, 0.18)';
const axisStroke = 'rgba(148, 163, 184, 0.4)';

function roundUpWithHeadroom(dataMax, { percentScale = false } = {}) {
  const max = Number(dataMax || 0);
  if (max <= 0) return percentScale ? 10 : 1000;

  if (percentScale) {
    if (max <= 10) return 10;
    if (max <= 25) return 25;
    if (max <= 50) return 50;
    if (max <= 100) return Math.ceil(max * 1.08 / 10) * 10;
    return Math.ceil(max * 1.06 / 20) * 20;
  }

  const padded = max * (max < 100000 ? 1.08 : 1.06);
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const step = Math.max(magnitude / (padded < magnitude * 2 ? 4 : 2), 1);
  return Math.ceil(padded / step) * step;
}

export function CompactChartCard({ title, children, className, style, headerStyle, bodyStyle, isMobile }) {
  return (
    <AppCard
      title={title}
      className={['crm-chart-card', 'sales-chart-card', className].filter(Boolean).join(' ')}
      style={{ width: '100%', minWidth: 0, ...style }}
      headerStyle={{ padding: isMobile ? '12px 14px' : '14px 18px', ...headerStyle }}
      bodyStyle={{ padding: isMobile ? '12px 14px 14px' : '16px 18px 18px', ...bodyStyle }}
    >
      {children}
    </AppCard>
  );
}

export function ChartSurface({ height, minWidth, children }) {
  return (
    <div className="sales-chart-frame" style={{ height, minWidth }}>
      {children}
    </div>
  );
}

export function getChartHeight({ mobile = false, fullWidth = false } = {}) {
  if (mobile) return fullWidth ? 220 : 190;
  return fullWidth ? 300 : 248;
}

export function getChartGridStyle(viewportWidth) {
  if (viewportWidth >= 960) return { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' };
  return { display: 'grid', gap: 14, gridTemplateColumns: '1fr' };
}

export function getChartAxisProps({ mobile = false, angledMobile = true } = {}) {
  return {
    tick: { fontSize: mobile ? 10 : 11, fill: '#64748B' },
    tickLine: false,
    axisLine: { stroke: axisStroke },
    height: mobile ? 40 : 26,
    interval: 0,
    angle: mobile && angledMobile ? -18 : 0,
    textAnchor: mobile && angledMobile ? 'end' : 'middle'
  };
}

export function getChartMargin({ mobile = false } = {}) {
  return {
    top: 4,
    right: mobile ? 6 : 8,
    left: mobile ? -18 : -12,
    bottom: mobile ? 10 : 2
  };
}

export function getCurrencyAxisProps({ mobile = false } = {}) {
  return {
    width: mobile ? 44 : 56,
    tick: { fontSize: mobile ? 10 : 11, fill: '#64748B' },
    tickLine: false,
    axisLine: false,
    tickFormatter: formatCompactIndianCurrency,
    domain: [0, (dataMax) => roundUpWithHeadroom(dataMax)]
  };
}

export function getPercentAxisProps({ mobile = false } = {}) {
  return {
    width: mobile ? 34 : 42,
    tick: { fontSize: mobile ? 10 : 11, fill: '#64748B' },
    tickLine: false,
    axisLine: false,
    tickFormatter: (value) => percent(value || 0),
    domain: [0, (dataMax) => roundUpWithHeadroom(dataMax, { percentScale: true })]
  };
}

export function getBarChartProps(count = 0, { mobile = false } = {}) {
  if (count <= 1) {
    return { barCategoryGap: '52%', barGap: 6, maxBarSize: mobile ? 40 : 52 };
  }
  if (count <= 3) {
    return { barCategoryGap: '30%', barGap: 4, maxBarSize: mobile ? 36 : 44 };
  }
  if (count <= 6) {
    return { barCategoryGap: '18%', barGap: 4, maxBarSize: mobile ? 32 : 38 };
  }
  return { barCategoryGap: mobile ? '15%' : '12%', barGap: 3, maxBarSize: mobile ? 28 : 34 };
}

export function SalesChartTooltip({ active, payload, label, valueFormatter = formatCompactIndianCurrency }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        border: '1px solid rgba(15, 23, 42, 0.08)',
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 14px 28px rgba(15, 23, 42, 0.08)',
        padding: '10px 12px',
        display: 'grid',
        gap: 6,
        minWidth: 148
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: '#334155', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        {label}
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: entry.color || '#111827' }} />
            {entry.name}
          </span>
          <span style={{ color: '#0F172A', fontSize: 12, fontWeight: 800 }}>
            {valueFormatter(entry.value, entry.name, entry)}
          </span>
        </div>
      ))}
    </div>
  );
}

export const salesChartTheme = {
  gridStroke
};
