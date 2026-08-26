export default function PageHeader({ title, subtitle, action, titleStyle, subtitleStyle }) {
  return (
    <div className="crm-page-header" style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.92) 100%)',
      border: '1px solid rgba(148, 163, 184, 0.16)',
      borderRadius: '22px',
      boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)',
      padding: '0'
    }}>
      <div className="crm-page-header-copy">
        <h1 style={{ margin: 0, fontSize: 30, color: '#111827', fontWeight: 700, letterSpacing: '-0.03em', ...titleStyle }}>{title}</h1>
        {subtitle ? <p style={{ margin: 0, color: '#6B7280', fontSize: 14, lineHeight: 1.45, ...subtitleStyle }}>{subtitle}</p> : null}
      </div>
      {action ? <div className="crm-page-header-action">{action}</div> : null}
    </div>
  );
}
