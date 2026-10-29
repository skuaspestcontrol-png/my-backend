export default function PageHeader({ title, subtitle, action, titleStyle, subtitleStyle }) {
  return (
    <div className="crm-page-header portal-page-header">
      <div className="crm-page-header-copy">
        <h1 style={titleStyle}>{title}</h1>
        {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
      </div>
      {action ? <div className="crm-page-header-action">{action}</div> : null}
    </div>
  );
}
