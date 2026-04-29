import React from 'react';
import ModuleWorkspace from './ModuleWorkspace';

export default function SalesPortal() {
  return (
    <ModuleWorkspace
      badge="Sales Portal"
      title="Sales Team Dashboard"
      description="Track daily leads, conversion pipeline, renewals, and collections from one focused sales control center."
      stats={[
        { label: 'Lead Queue', value: 'Today' },
        { label: 'Conversion Focus', value: 'Active' },
        { label: 'Followups', value: 'Priority' }
      ]}
      queueTitle="Sales Priorities"
      queueItems={[
        { title: 'New leads review', description: 'Validate incoming lead quality and assign follow-up owner quickly.', meta: 'Immediate', tone: 'var(--color-primary)' },
        { title: 'Pending invoice collections', description: 'Reach out to customers with unpaid invoices and close dues.', meta: 'Today', tone: '#dc2626' },
        { title: 'Upcoming renewals', description: 'Plan renewal calls and offer upgrades where suitable.', meta: 'Retention', tone: '#0f766e' }
      ]}
      actionTitle="Sales Actions"
      actions={[
        { label: 'Open Leads', href: '/leads' },
        { label: 'Open Customers', href: '/sales/customers' },
        { label: 'Open Invoices', href: '/sales/invoices' },
        { label: 'Open Renewals', href: '/sales/renewal' }
      ]}
      sideTitle="Pipeline discipline"
      sideText="A clean handoff from lead to contract to invoice keeps revenue predictable and teams aligned."
    />
  );
}
