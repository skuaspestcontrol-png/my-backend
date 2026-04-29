import { CalendarDays, Home, Settings, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const tabs = [
  ['Home', '/ui/dashboard', Home],
  ['Leads', '/leads', Users],
  ['Calendar', '/service-calendar', CalendarDays],
  ['Settings', '/settings', Settings]
];

export default function MobileBottomNav() {
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, minHeight: 62, background: '#fff', borderTop: '1px solid #E5E7EB', display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, zIndex: 1200 }}>
      {tabs.map(([label, path, Icon]) => (
        <NavLink key={label} to={path} style={({ isActive }) => ({ textDecoration: 'none', color: isActive ? '#9F174D' : '#6B7280', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 })}>
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
