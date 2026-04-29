import { BarChart3, CircleDollarSign, Receipt, RefreshCw, Users, Wrench } from 'lucide-react';
import AppCard from '../components/ui/AppCard';
import AppTable from '../components/ui/AppTable';
import DashboardStatCard from '../components/ui/DashboardStatCard';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';

const stats = [
  ['Total Leads', '148', <Users size={18} />],
  ['Active Customers', '92', <Users size={18} />],
  ['Today Services', '14', <Wrench size={18} />],
  ['Pending Payments', '₹1.24L', <Receipt size={18} />],
  ['Renewals Due', '11', <RefreshCw size={18} />],
  ['Staff Present', '28', <Users size={18} />],
  ['Monthly Income', '₹8.2L', <CircleDollarSign size={18} />],
  ['Monthly Expenses', '₹4.9L', <BarChart3 size={18} />]
];

const todayColumns = [
  { key: 'customer', label: 'Customer' },
  { key: 'service', label: 'Service' },
  { key: 'time', label: 'Time' },
  { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value === 'Completed' ? 'active' : 'pending'}>{value}</StatusBadge> }
];

const todayRows = [
  { id: 1, customer: 'Juhi Aggarwal', service: 'Cockroach Control', time: '10:00 AM', status: 'Scheduled' },
  { id: 2, customer: 'Priya Jain', service: 'Termite Treatment', time: '01:30 PM', status: 'Completed' }
];

export default function DashboardPage() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader title="Dashboard" subtitle="Business snapshot and operational highlights" />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {stats.map(([title, value, icon]) => <DashboardStatCard key={title} title={title} value={value} icon={icon} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <AppCard title="Income vs Expense"><div style={{ height: 180, border: '1px dashed #E5E7EB', borderRadius: 12, display: 'grid', placeItems: 'center', color: '#6B7280' }}>Chart Placeholder</div></AppCard>
        <AppCard title="Lead Conversion"><div style={{ height: 180, border: '1px dashed #E5E7EB', borderRadius: 12, display: 'grid', placeItems: 'center', color: '#6B7280' }}>Chart Placeholder</div></AppCard>
        <AppCard title="Service Status"><div style={{ height: 180, border: '1px dashed #E5E7EB', borderRadius: 12, display: 'grid', placeItems: 'center', color: '#6B7280' }}>Chart Placeholder</div></AppCard>
        <AppCard title="Renewal Overview"><div style={{ height: 180, border: '1px dashed #E5E7EB', borderRadius: 12, display: 'grid', placeItems: 'center', color: '#6B7280' }}>Chart Placeholder</div></AppCard>
      </section>

      <AppTable columns={todayColumns} rows={todayRows} />

      <AppCard title="Renewal Reminder">
        <p style={{ margin: 0, color: '#6B7280' }}>11 contracts are due in the next 30 days. Prioritize follow-ups for high-value accounts.</p>
      </AppCard>
    </div>
  );
}
