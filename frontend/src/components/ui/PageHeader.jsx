export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="crm-page-header">
      <div className="crm-page-header-copy">
        <h1 style={{ margin: 0, fontSize: 30, color: '#111827' }}>{title}</h1>
        {subtitle ? <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>{subtitle}</p> : null}
      </div>
      {action ? <div className="crm-page-header-action">{action}</div> : null}
    </div>
  );
}
