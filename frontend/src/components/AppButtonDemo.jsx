import { Download, Plus, Trash } from 'lucide-react';
import AppButton from './AppButton';

export default function AppButtonDemo() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <AppButton fullWidth iconLeft={<Plus />}>
        Add Customer
      </AppButton>

      <AppButton variant="secondary" iconLeft={<Download />}>
        Download Report
      </AppButton>

      <AppButton variant="danger" iconLeft={<Trash />}>
        Delete
      </AppButton>

      <AppButton size="lg">Schedule Service</AppButton>

      <AppButton loading>Saving...</AppButton>
    </div>
  );
}

