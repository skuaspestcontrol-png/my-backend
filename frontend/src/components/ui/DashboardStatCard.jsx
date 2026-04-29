import AppCard from './AppCard';

export default function DashboardStatCard({ title, value, icon, tone = '#9F174D' }) {
  return (
    <AppCard style={{ padding: 0 }}>
      <div style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6B7280', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{title}</span>
          <span style={{ color: tone }}>{icon}</span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#111827' }}>{value}</div>
      </div>
    </AppCard>
  );
}
