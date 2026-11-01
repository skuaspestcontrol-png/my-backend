import AppCard from './AppCard';

export default function DashboardStatCard({ title, value, icon, tone = 'var(--color-primary)', style, contentStyle, titleStyle, valueStyle, className, variant, hint }) {
  const hasIcon = Boolean(icon);

  if (variant === 'glass') {
    return <AppCard className={['glass-surface glass-summary-card', className].filter(Boolean).join(' ')} style={style} bodyStyle={{ padding: 12 }}>
      <div className="glass-summary-layout">
        {hasIcon ? <span className="glass-summary-icon" style={{ color: tone }} aria-hidden="true">{icon}</span> : null}
        <div className="glass-summary-copy">
          <strong className="glass-summary-value" style={valueStyle}>{value}</strong>
          <span className="glass-summary-label" style={titleStyle}>{title}</span>
          {hint ? <small className="glass-summary-hint">{hint}</small> : null}
        </div>
      </div>
    </AppCard>;
  }

  return (
    <AppCard className={['crm-kpi-card', 'portal-summary-card', className].filter(Boolean).join(' ')} style={{ padding: 0, ...style }}>
      <div style={{ padding: 16, display: 'grid', gap: hasIcon ? 10 : 8, ...contentStyle }}>
        <div style={{ display: 'flex', justifyContent: hasIcon ? 'space-between' : 'flex-start', alignItems: 'center', minHeight: hasIcon ? 32 : 0 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', ...titleStyle }}>{title}</span>
          {hasIcon ? (
            <span
              className="crm-kpi-icon"
              style={{
                color: tone,
                width: 32,
                height: 32,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-primary-soft)'
              }}
            >
              {icon}
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.05, ...valueStyle }}>{value}</div>
      </div>
    </AppCard>
  );
}
