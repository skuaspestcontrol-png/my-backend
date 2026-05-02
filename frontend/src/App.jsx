import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import ModuleWorkspace from './components/ModuleWorkspace';

const lazyWithRetry = (importer, storageKey = 'lazy-retry') =>
  lazy(() =>
    importer().catch((error) => {
      if (typeof window === 'undefined') throw error;
      const key = `retry-${storageKey}`;
      const alreadyRetried = window.sessionStorage.getItem(key) === '1';
      if (!alreadyRetried) {
        window.sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      window.sessionStorage.removeItem(key);
      throw error;
    }).then((module) => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(`retry-${storageKey}`);
      }
      return module;
    })
  );

const DashboardLayout = lazy(() => import('./components/DashboardLayout'));
const CustomerDashboard = lazy(() => import('./components/CustomerDashboard'));
const ContractDashboard = lazy(() => import('./components/ContractDashboard'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const EmployeeMaster = lazy(() => import('./components/EmployeeMaster'));
const HRDashboard = lazy(() => import('./components/HRDashboard'));
const Attendance = lazy(() => import('./components/Attendance'));
const PayrollModule = lazy(() => import('./components/PayrollModule'));
const InvoiceDashboard = lazy(() => import('./components/InvoiceDashboard'));
const ItemsDashboard = lazy(() => import('./components/ItemsDashboard'));
const LeadCapture = lazyWithRetry(() => import('./components/LeadCapture'), 'leads-capture');
const OperationsPortal = lazy(() => import('./components/OperationsPortal'));
const PaymentReceivedDashboard = lazy(() => import('./components/PaymentReceivedDashboard'));
const VendorDashboard = lazy(() => import('./components/VendorDashboard'));
const VendorBillsDashboard = lazy(() => import('./components/VendorBillsDashboard'));
const VendorPaymentDashboard = lazy(() => import('./components/VendorPaymentDashboard'));
const RenewalDashboard = lazy(() => import('./components/RenewalDashboard'));
const ComplaintsDashboard = lazy(() => import('./components/ComplaintsDashboard'));
const ScheduleJob = lazy(() => import('./components/ScheduleJob'));
const SalesPortal = lazy(() => import('./components/SalesPortal'));
const ServiceCalendar = lazy(() => import('./components/ServiceCalendar'));
const Settings = lazy(() => import('./components/Settings'));
const TechnicianPortal = lazy(() => import('./components/TechnicianPortal'));
const TrackTechnicians = lazy(() => import('./components/TrackTechnicians'));
const WhatsAppSettings = lazy(() => import('./pages/settings/WhatsAppSettings'));
const WhatsAppTemplates = lazy(() => import('./pages/settings/WhatsAppTemplates'));
const WhatsAppLogs = lazy(() => import('./pages/whatsapp/WhatsAppLogs'));
const EmailSettings = lazy(() => import('./pages/settings/EmailSettings'));
const EmailTemplates = lazy(() => import('./pages/settings/EmailTemplates'));
const EmailLogs = lazy(() => import('./pages/email/EmailLogs'));
const UIDashboardPage = lazy(() => import('./pages/Dashboard'));
const UICustomersPage = lazy(() => import('./pages/CustomersPage'));

const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  return isLoggedIn ? children : <Navigate to="/" replace />;
};

const AppRoute = ({ element }) => (
  <ProtectedRoute>
    <DashboardLayout>{element}</DashboardLayout>
  </ProtectedRoute>
);

const contractPage = <ContractDashboard />;

const renewalPage = <RenewalDashboard />;

const vendorsPage = <VendorDashboard />;
const billsPage = <VendorBillsDashboard />;

const purchasePaymentReceivedPage = <VendorPaymentDashboard />;

const whatsappPage = (
  <ModuleWorkspace
    badge="Campaign Desk"
    title="WhatsApp Marketing Workspace"
    description="Organize campaign batches, remarketing followups, and customer communication sequences in one communication hub."
    stats={[
      { label: 'Campaign Type', value: 'Broadcast' },
      { label: 'Audience Mix', value: 'Leads + Clients' },
      { label: 'Response Goal', value: 'Fast' }
    ]}
    queueTitle="Messaging Queue"
    queueItems={[
      { title: 'Followup campaign list', description: 'Prepare a clean list of leads due for reminders or proposal nudges.', meta: 'Sales', tone: '#15803d' },
      { title: 'Service reminder copy', description: 'Draft short messages for upcoming service visits and technician arrival notices.', meta: 'Ops', tone: '#0891b2' },
      { title: 'Reactivation push', description: 'Reconnect with customers whose previous treatment cycle is due for renewal.', meta: 'Retention', tone: '#dc2626' }
    ]}
    actions={[
      { label: 'Open Leads Module', href: '/leads' },
      { label: 'Review Customer Settings', href: '/settings' },
      { label: 'Back to Dashboard', href: '/dashboard' }
    ]}
    sideTitle="Message with context"
    sideText="The best campaigns are timely and relevant. Use lead stage, service stage, and past customer history to segment your communication."
  />
);

const complaintsPage = <ComplaintsDashboard />;

const certificatesPage = (
  <ModuleWorkspace
    badge="Compliance"
    title="Certificates Workspace"
    description="Manage service certificates, treatment proof, and client-facing documentation after jobs are completed."
    stats={[
      { label: 'Document State', value: 'Organized' },
      { label: 'Delivery Mode', value: 'Digital' },
      { label: 'Compliance Readiness', value: 'Strong' }
    ]}
    queueTitle="Documentation Queue"
    queueItems={[
      { title: 'Pending service certificates', description: 'Generate customer-facing proof after treatment completion and technician signoff.', meta: 'After job', tone: 'var(--color-primary-dark)' },
      { title: 'Commercial account packs', description: 'Prepare formal documentation for recurring service contracts and audits.', meta: 'Commercial', tone: '#0f766e' },
      { title: 'Archive review', description: 'Keep completed records easy to retrieve for renewals and complaint handling.', meta: 'Back office', tone: '#64748b' }
    ]}
    actions={[
      { label: 'Open Assigned Jobs', href: '/operations/assigned-jobs' },
      { label: 'Open Complaints', href: '/complaints' },
      { label: 'Return to Dashboard', href: '/dashboard' }
    ]}
    sideTitle="Close the service loop"
    sideText="Certificates should be the final polished output of a finished job, backed by technician proof and clear customer-facing details."
  />
);

const stockPage = (
  <ModuleWorkspace
    badge="Inventory Control"
    title="Stock Management Workspace"
    description="Track chemicals, equipment, replenishment, and field consumption so operations stay supplied without overspending."
    stats={[
      { label: 'Inventory State', value: 'Tracked' },
      { label: 'Field Usage', value: 'Watch' },
      { label: 'Reorder Style', value: 'Planned' }
    ]}
    queueTitle="Inventory Queue"
    queueItems={[
      { title: 'Fast-moving stock', description: 'Review materials most frequently consumed across scheduled service jobs.', meta: 'Monitor', tone: '#475569' },
      { title: 'Reorder threshold setup', description: 'Create simple rules for high-usage chemicals, safety gear, and consumables.', meta: 'Policy', tone: '#d97706' },
      { title: 'Dispatch linkage', description: 'Align stock planning with scheduled field assignments to avoid service delays.', meta: 'Ops sync', tone: 'var(--color-primary)' }
    ]}
    actions={[
      { label: 'Open Purchase Workspace', href: '/purchase/vendors' },
      { label: 'Open Assign Services', href: '/schedule-job' },
      { label: 'Return to Dashboard', href: '/dashboard' }
    ]}
    sideTitle="Inventory should support service"
    sideText="This workspace is strongest when it mirrors actual technician usage patterns and upcoming service demand."
  />
);

const hrPage = (
  <ModuleWorkspace
    badge="People Ops"
    title="HR Dashboard"
    description="See the team through roles, salary structure, field utilization, and staffing readiness across sales and operations."
    stats={[
      { label: 'Headcount View', value: 'Live' },
      { label: 'Payroll Lens', value: 'Monthly' },
      { label: 'Staffing Focus', value: 'Role Based' }
    ]}
    queueTitle="HR Priorities"
    queueItems={[
      { title: 'Role coverage', description: 'Check whether sales, field operations, and support functions are properly staffed.', meta: 'Coverage', tone: '#9333ea' },
      { title: 'Payroll review', description: 'Use salary data from employee master to keep monthly planning visible.', meta: 'Finance', tone: '#dc2626' },
      { title: 'Portal access cleanup', description: 'Make sure the right employees have the right visibility into ERP workflows.', meta: 'Admin', tone: 'var(--color-primary)' }
    ]}
    actions={[
      { label: 'Open Employee Master', href: '/employees' },
      { label: 'Open Attendance', href: '/attendance' },
      { label: 'Open Payroll', href: '/payroll' },
      { label: 'Open Settings', href: '/settings' },
      { label: 'Return to Dashboard', href: '/dashboard' }
    ]}
    sideTitle="People data powers everything"
    sideText="Hiring, field quality, and sales followups all improve when employee data is current and role assignment is clean."
  />
);

function App() {
  return (
    <Router>
      <Suspense fallback={<div style={{ padding: '16px' }}>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<AppRoute element={<Dashboard />} />} />
          <Route path="/ui/dashboard" element={<AppRoute element={<UIDashboardPage />} />} />
          <Route path="/ui/customers" element={<AppRoute element={<UICustomersPage />} />} />
          <Route path="/leads" element={<AppRoute element={<LeadCapture />} />} />
          <Route path="/sales" element={<Navigate to="/sales/customers" replace />} />
          <Route path="/sales/contracts" element={<AppRoute element={contractPage} />} />
          <Route path="/sales/customers" element={<AppRoute element={<CustomerDashboard />} />} />
          <Route path="/sales/invoices" element={<AppRoute element={<InvoiceDashboard />} />} />
          <Route path="/sales/payment-received" element={<AppRoute element={<PaymentReceivedDashboard />} />} />
          <Route path="/sales/renewal" element={<AppRoute element={renewalPage} />} />
          <Route path="/purchase" element={<Navigate to="/purchase/vendors" replace />} />
          <Route path="/purchase/vendors" element={<AppRoute element={vendorsPage} />} />
          <Route path="/purchase/bills" element={<AppRoute element={billsPage} />} />
          <Route path="/purchase/payment-received" element={<AppRoute element={purchasePaymentReceivedPage} />} />
          <Route path="/whatsapp" element={<AppRoute element={whatsappPage} />} />
          <Route path="/settings/whatsapp" element={<AppRoute element={<WhatsAppSettings />} />} />
          <Route path="/settings/whatsapp/templates" element={<AppRoute element={<WhatsAppTemplates />} />} />
          <Route path="/whatsapp/logs" element={<AppRoute element={<WhatsAppLogs />} />} />
          <Route path="/settings/email" element={<AppRoute element={<EmailSettings />} />} />
          <Route path="/settings/email/templates" element={<AppRoute element={<EmailTemplates />} />} />
          <Route path="/email/logs" element={<AppRoute element={<EmailLogs />} />} />
          <Route path="/schedule-job" element={<AppRoute element={<ScheduleJob />} />} />
          <Route path="/operations/assign-services" element={<AppRoute element={<ScheduleJob />} />} />
          <Route path="/service-calendar" element={<AppRoute element={<ServiceCalendar />} />} />
          <Route path="/technician-portal" element={<Navigate to="/operations/assigned-jobs" replace />} />
          <Route path="/operations/assigned-jobs" element={<AppRoute element={<TechnicianPortal />} />} />
          <Route path="/operations/track-technicians" element={<AppRoute element={<TrackTechnicians />} />} />
          <Route path="/sales-portal" element={<AppRoute element={<SalesPortal />} />} />
          <Route path="/operations-portal" element={<AppRoute element={<OperationsPortal />} />} />
          <Route path="/complaints" element={<AppRoute element={complaintsPage} />} />
          <Route path="/certificates" element={<AppRoute element={certificatesPage} />} />
          <Route path="/stock" element={<AppRoute element={stockPage} />} />
          <Route path="/hr-dashboard" element={<AppRoute element={<HRDashboard />} />} />
          <Route path="/employees" element={<AppRoute element={<EmployeeMaster />} />} />
          <Route path="/attendance" element={<AppRoute element={<Attendance />} />} />
          <Route path="/payroll" element={<AppRoute element={<PayrollModule />} />} />
          <Route path="/items" element={<AppRoute element={<ItemsDashboard />} />} />
          <Route path="/settings" element={<AppRoute element={<Settings />} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
