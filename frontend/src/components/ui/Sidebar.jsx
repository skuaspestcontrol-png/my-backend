import { BarChart3, CalendarDays, ClipboardList, FileText, Home, Settings, Users, Wallet } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  ['Dashboard', '/ui/dashboard', Home],
  ['Leads', '/leads', Users],
  ['Customers', '/ui/customers', Users],
  ['Service Schedule', '/schedule-job', ClipboardList],
  ['Calendar', '/service-calendar', CalendarDays],
  ['Technicians', '/technician-portal', Users],
  ['Invoices', '/sales/invoices', FileText],
  ['Payments', '/sales/payment-received', Wallet],
  ['Renewals', '/sales/renewal', CalendarDays],
  ['HR', '/hr-dashboard', Users],
  ['Reports', '/dashboard', BarChart3],
  ['Settings', '/settings', Settings]
];

export default function Sidebar() {
  return (
    <aside style={{ width: 260, background: '#fff', borderRight: '1px solid #E5E7EB', padding: 12, overflowY: 'auto' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', padding: 12 }}>CRM Portal</div>
      <nav style={{ display: 'grid', gap: 4 }}>
        {items.map(([label, path, Icon]) => (
          <NavLink key={label} to={path} style={({ isActive }) => ({ minHeight: 40, borderRadius: 12, textDecoration: 'none', color: isActive ? '#fff' : '#111827', background: isActive ? '#9F174D' : 'transparent', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', fontWeight: 600 })}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
