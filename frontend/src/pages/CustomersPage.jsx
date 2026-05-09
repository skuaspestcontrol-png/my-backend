import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import ActionMenu from '../components/ui/ActionMenu';
import AppButton from '../components/ui/AppButton';
import AppCard from '../components/ui/AppCard';
import AppTable from '../components/ui/AppTable';
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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Customers"
        subtitle="Manage customer records, status, and outstanding balances"
        action={<AppButton fullWidth iconLeft={<Plus size={18} />} style={{ maxWidth: 200 }}>Add Customer</AppButton>}
      />

      <AppCard>
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
