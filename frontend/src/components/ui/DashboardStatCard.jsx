import AppCard from './AppCard';

export default function DashboardStatCard({ title, value, icon, tone = 'var(--color-primary)', style, contentStyle, titleStyle, valueStyle, className }) {
  return (
    <AppCard className={['crm-kpi-card', className].filter(Boolean).join(' ')} style={{ padding: 0, ...style }}>
      <div style={{ padding: 16, display: 'grid', gap: 10, ...contentStyle }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6B7280', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', ...titleStyle }}>{title}</span>
          <span style={{ color: tone }}>{icon}</span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#111827', ...valueStyle }}>{value}</div>
      </div>
    </AppCard>
  );
}
