import { useEffect, useMemo, useState } from 'react';
import { Building2, Home, Plus, UserCheck, Users } from 'lucide-react';
import ActionMenu from '../components/ui/ActionMenu';
import AppButton from '../components/ui/AppButton';
import AppCard from '../components/ui/AppCard';
import AppTable from '../components/ui/AppTable';
import DashboardStatCard from '../components/ui/DashboardStatCard';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import StatusBadge from '../components/ui/StatusBadge';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const columns = [
  { key: 'name', label: 'Customer' },
  { key: 'city', label: 'City' },
  { key: 'plan', label: 'Plan' },
  { key: 'due', label: 'Due Amount' },
  { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value}>{String(value).toUpperCase()}</StatusBadge> }
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/customers`);
        if (!mounted) return;
        setCustomers(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Failed to load customers', error);
        if (mounted) setCustomers([]);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const rows = useMemo(() => customers.map((customer) => ({
    id: String(customer._id || customer.id || ''),
    name: String(customer.displayName || customer.name || customer.contactPersonName || '-'),
    city: String(customer.city || customer.billingState || customer.state || '-'),
    plan: String(customer.segment || '-'),
    status: 'active',
    due: '₹0.00'
  })), [customers]);

  const summary = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((customer) => String(customer.status || 'active').toLowerCase() === 'active').length;
    const residential = customers.filter((customer) => String(customer.segment || '').toLowerCase() === 'residential').length;
    const commercial = customers.filter((customer) => String(customer.segment || '').toLowerCase() === 'commercial').length;
    return { total, active, residential, commercial };
  }, [customers]);

  return (
    <div className="crm-page crm-section">
      <PageHeader
        title="Customers"
        subtitle="Manage customer records, status, and outstanding balances"
        action={<AppButton fullWidth iconLeft={<Plus size={18} />} style={{ maxWidth: 200 }}>Add Customer</AppButton>}
      />

      <section className="crm-grid crm-grid-4">
        <DashboardStatCard title="Total Customers" value={String(summary.total)} icon={<Users size={18} />} />
        <DashboardStatCard title="Active Customers" value={String(summary.active)} icon={<UserCheck size={18} />} />
        <DashboardStatCard title="Residential" value={String(summary.residential)} icon={<Home size={18} />} />
        <DashboardStatCard title="Commercial" value={String(summary.commercial)} icon={<Building2 size={18} />} />
      </section>

      <AppCard className="crm-filter-card">
        <div style={{ display: 'grid', gap: 12 }}>
          <SearchBar placeholder="Search by name, mobile, or city" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AppButton variant="secondary" size="sm">All</AppButton>
            <AppButton variant="outline" size="sm">Active</AppButton>
            <AppButton variant="outline" size="sm">Pending</AppButton>
            <AppButton variant="outline" size="sm">Overdue</AppButton>
          </div>
        </div>
      </AppCard>

      <AppTable
        columns={columns}
        rows={rows}
        renderRowActions={(row) => (
          <ActionMenu
            items={[
              { label: `View ${row.name}` },
              { label: 'Edit' },
              { label: 'Deactivate' }
            ]}
          />
        )}
      />
    </div>
  );
}
