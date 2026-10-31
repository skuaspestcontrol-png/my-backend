import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getPortalBreadcrumbs } from '../../utils/portalPageMeta';

export default function PortalBreadcrumbs() {
  const { pathname } = useLocation();
  const items = getPortalBreadcrumbs(pathname);
  return <nav className="portal-breadcrumbs" aria-label="Breadcrumb"><ol>
    {items.map((item, index) => <li key={`${item.label}-${index}`} className={item.group ? 'portal-breadcrumb-group' : undefined}>
      {index > 0 ? <ChevronRight size={12} aria-hidden="true" /> : null}
      {item.to ? <Link to={item.to}><Home size={13} aria-hidden="true" />{item.label}</Link> : <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>}
    </li>)}
  </ol></nav>;
}
