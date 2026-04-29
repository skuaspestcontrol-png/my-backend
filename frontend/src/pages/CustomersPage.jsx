import { Plus } from 'lucide-react';
import ActionMenu from '../components/ui/ActionMenu';
import AppButton from '../components/ui/AppButton';
import AppCard from '../components/ui/AppCard';
import AppTable from '../components/ui/AppTable';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import StatusBadge from '../components/ui/StatusBadge';

const rows = [
  { id: '1', name: 'Juhi Aggarwal', city: 'Delhi', plan: 'Residential', status: 'active', due: '₹0.00' },
  { id: '2', name: 'Priya Jain', city: 'Delhi', plan: 'Commercial', status: 'pending', due: '₹3,240.00' },
  { id: '3', name: 'Nasir Ali', city: 'Noida', plan: 'Residential', status: 'info', due: '₹0.00' }
];

const columns = [
  { key: 'name', label: 'Customer' },
  { key: 'city', label: 'City' },
  { key: 'plan', label: 'Plan' },
  { key: 'due', label: 'Due Amount' },
  { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value}>{String(value).toUpperCase()}</StatusBadge> }
];

export default function CustomersPage() {
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
