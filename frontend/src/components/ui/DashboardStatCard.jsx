import AppCard from './AppCard';
import { theme } from '../../styles/theme';

export default function DashboardStatCard({ title, value, icon, tone = 'var(--color-primary)', style, contentStyle, titleStyle, valueStyle, className }) {
  return (
    <AppCard className={['crm-kpi-card', className].filter(Boolean).join(' ')} style={{ padding: 0, ...style }}>
      <div style={{ padding: 16, display: 'grid', gap: 12, ...contentStyle }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ color: theme.colors.muted, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', ...titleStyle }}>{title}</span>
          <span style={{ width: 42, height: 42, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--color-primary-light) 26%, var(--color-surface))', color: tone, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }}>{icon}</span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: theme.colors.text, letterSpacing: '-0.03em', lineHeight: 1, ...valueStyle }}>{value}</div>
      </div>
    </AppCard>
  );
}
