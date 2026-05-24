import { theme } from '../../styles/theme';

export default function AppCard({ children, title, action, style, headerStyle, bodyStyle, className }) {
  return (
    <section className={['crm-card', className].filter(Boolean).join(' ')} style={style}>
      {title ? (
        <header style={{ padding: 16, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, ...headerStyle }}>
          <h3 style={{ margin: 0, fontSize: 18, color: theme.colors.text, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h3>
          {action}
        </header>
      ) : null}
      <div style={{ padding: 16, ...bodyStyle }}>{children}</div>
    </section>
  );
}
