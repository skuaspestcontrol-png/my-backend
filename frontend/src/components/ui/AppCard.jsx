import { theme } from '../../styles/theme';

export default function AppCard({ children, title, action, style }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${theme.colors.border}`, borderRadius: 16, boxShadow: theme.shadow.sm, ...style }}>
      {title ? (
        <header style={{ padding: 16, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: theme.colors.text }}>{title}</h3>
          {action}
        </header>
      ) : null}
      <div style={{ padding: 16 }}>{children}</div>
    </section>
  );
}
