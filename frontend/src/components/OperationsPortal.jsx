import React from 'react';
import ModuleWorkspace from './ModuleWorkspace';

export default function OperationsPortal() {
  return (
    <ModuleWorkspace
      badge="Operations Portal"
      title="Operations Team Dashboard"
      description="Coordinate field scheduling, technician assignments, complaints, and service quality through a single operations workspace."
      stats={[
        { label: 'Dispatch Status', value: 'Running' },
        { label: 'Service Visits', value: 'Planned' },
        { label: 'Escalations', value: 'Monitored' }
      ]}
      queueTitle="Operations Priorities"
      queueItems={[
        { title: 'Today dispatch review', description: 'Confirm assignments, routes, and customer timing for all scheduled services.', meta: 'Now', tone: 'var(--color-primary)' },
        { title: 'Technician utilization', description: 'Balance workload and close open service windows.', meta: 'Live', tone: '#0891b2' },
        { title: 'Complaint follow-up', description: 'Resolve pending complaints and schedule revisits without delay.', meta: 'Urgent', tone: '#dc2626' }
      ]}
      actionTitle="Operations Actions"
      actions={[
        { label: 'Assign Services', href: '/schedule-job' },
        { label: 'Open Service Calendar', href: '/service-calendar' },
        { label: 'Open Assigned Jobs', href: '/operations/assigned-jobs' },
        { label: 'Open Complaints', href: '/complaints' }
      ]}
      sideTitle="Execution reliability"
      sideText="Strong daily planning and fast issue response are the core of consistent field service quality."
    />
  );
}
