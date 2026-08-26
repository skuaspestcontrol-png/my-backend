import { theme } from '../../styles/theme';

export default function AppCard({ children, title, action, style, headerStyle, bodyStyle, className }) {
  return (
    <section
      className={['crm-card', className].filter(Boolean).join(' ')}
      style={{
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,250,252,0.98) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
        ...style
      }}
    >
      {title ? (
        <header style={{
          padding: 16,
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.88) 100%)',
          ...headerStyle
        }}>
          <h3 style={{ margin: 0, fontSize: 18, color: theme.colors.text }}>{title}</h3>
          {action}
        </header>
      ) : null}
      <div style={{ padding: 16, ...bodyStyle }}>{children}</div>
    </section>
  );
}
