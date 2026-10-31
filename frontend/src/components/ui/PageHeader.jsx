import { LayoutGrid, Users, Target, FileText, Receipt, Boxes } from 'lucide-react';

const headingIcons = { customers: Users, leads: Target, contracts: FileText, invoices: Receipt, stock: Boxes };

export function PageHeaderTitle({ title, subtitle, icon, kind, titleStyle, subtitleStyle }) {
  const Icon = icon === undefined ? (headingIcons[kind] || LayoutGrid) : icon;
  return <div className="portal-page-heading">
    {Icon ? <span className="portal-page-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></span> : null}
    <div className="crm-page-header-copy"><h1 style={titleStyle}>{title}</h1>{subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}</div>
  </div>;
}

export default function PageHeader({ title, subtitle, action, titleStyle, subtitleStyle, icon, kind }) {
  return <div className="crm-page-header portal-page-header portal-page-toolbar portal-page-toolbar--flush">
    <PageHeaderTitle title={title} subtitle={subtitle} icon={icon} kind={kind} titleStyle={titleStyle} subtitleStyle={subtitleStyle} />
    {action ? <div className="crm-page-header-action">{action}</div> : null}
  </div>;
}
