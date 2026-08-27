import AppCard from './AppCard';

export default function DashboardStatCard({ title, value, icon, tone = 'var(--color-primary)', style, contentStyle, titleStyle, valueStyle, className }) {
  const hasIcon = Boolean(icon);

  return (
    <AppCard className={['crm-kpi-card', className].filter(Boolean).join(' ')} style={{ padding: 0, ...style }}>
      <div style={{ padding: 16, display: 'grid', gap: hasIcon ? 10 : 8, ...contentStyle }}>
        <div style={{ display: 'flex', justifyContent: hasIcon ? 'space-between' : 'flex-start', alignItems: 'center', minHeight: hasIcon ? 32 : 0 }}>
          <span style={{ color: '#4b5563', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', ...titleStyle }}>{title}</span>
          {hasIcon ? (
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
          ) : null}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.05, ...valueStyle }}>{value}</div>
      </div>
    </AppCard>
  );
}
