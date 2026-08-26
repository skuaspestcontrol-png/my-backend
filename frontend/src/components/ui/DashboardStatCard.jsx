import AppCard from './AppCard';

export default function DashboardStatCard({ title, value, icon, tone = 'var(--color-primary)', style, contentStyle, titleStyle, valueStyle, className }) {
  return (
    <AppCard className={['crm-kpi-card', className].filter(Boolean).join(' ')} style={{ padding: 0, ...style }}>
      <div style={{ padding: 16, display: 'grid', gap: 10, ...contentStyle }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#4b5563', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', ...titleStyle }}>{title}</span>
          <span
            style={{
              color: tone,
              width: 32,
              height: 32,
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(124, 58, 237, 0.12)'
            }}
          >
            {icon}
          </span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', ...valueStyle }}>{value}</div>
      </div>
    </AppCard>
  );
}
