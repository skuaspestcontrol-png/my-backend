import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import ModuleWorkspace from './components/ModuleWorkspace';
import { clearPortalUser, fetchPortalUser } from './utils/portalAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: String(error?.message || 'Failed to load module.') };
  }

  componentDidCatch(error) {
    console.error('Route render failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '18px', fontFamily: 'var(--font-sans)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Module failed to load</h3>
          <p style={{ margin: '0 0 12px 0', color: '#475569' }}>{this.state.errorMessage}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', background: '#fff', cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DashboardLayout = lazyWithRetry(() => import('./components/DashboardLayout'), 'dashboard-layout');
const CustomerDashboard = lazyWithRetry(() => import('./components/CustomerDashboard'), 'customer-dashboard');
const ContractDashboard = lazyWithRetry(() => import('./components/ContractDashboard'), 'contract-dashboard');
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'), 'dashboard');
const EmployeeMaster = lazyWithRetry(() => import('./components/EmployeeMaster'), 'employee-master');
const HRDashboard = lazyWithRetry(() => import('./components/HRDashboard'), 'hr-dashboard');
const Attendance = lazyWithRetry(() => import('./components/Attendance'), 'attendance');
const PayrollModule = lazyWithRetry(() => import('./components/PayrollModule'), 'payroll-module');
const InvoiceDashboard = lazyWithRetry(() => import('./components/InvoiceDashboard'), 'invoice-dashboard');
const ItemsDashboard = lazyWithRetry(() => import('./components/ItemsDashboard'), 'items-dashboard');
const ExportDataDashboard = lazyWithRetry(() => import('./components/ExportDataDashboard'), 'export-data-dashboard');
const LeadCapture = lazyWithRetry(() => import('./components/LeadCapture'), 'leads-capture');
const LeadFollowups = lazyWithRetry(() => import('./components/LeadFollowups'), 'lead-followups');
const QuotationDashboard = lazyWithRetry(() => import('./components/QuotationDashboard'), 'quotation-dashboard');
const CreateQuote = lazyWithRetry(() => import('./components/CreateQuote'), 'create-quote');
const OperationsPortal = lazyWithRetry(() => import('./components/OperationsPortal'), 'operations-portal');
const PaymentReceivedDashboard = lazyWithRetry(() => import('./components/PaymentReceivedDashboard'), 'payment-received-dashboard');
const VendorDashboard = lazyWithRetry(() => import('./components/VendorDashboard'), 'vendor-dashboard');
const VendorBillsDashboard = lazyWithRetry(() => import('./components/VendorBillsDashboard'), 'vendor-bills-dashboard');
const VendorPaymentDashboard = lazyWithRetry(() => import('./components/VendorPaymentDashboard'), 'vendor-payment-dashboard');
const RenewalDashboard = lazyWithRetry(() => import('./components/RenewalDashboard'), 'renewal-dashboard');
const ComplaintsDashboard = lazyWithRetry(() => import('./components/ComplaintsDashboard'), 'complaints-dashboard');
const ScheduleJob = lazyWithRetry(() => import('./components/ScheduleJob'), 'schedule-job');
const SalesPortal = lazyWithRetry(() => import('./components/SalesPortal'), 'sales-portal');
const ServiceCalendar = lazyWithRetry(() => import('./components/ServiceCalendar'), 'service-calendar');
const Settings = lazyWithRetry(() => import('./components/Settings'), 'settings');
const TechnicianPortal = lazyWithRetry(() => import('./components/TechnicianPortal'), 'technician-portal');
const TrackTechnicians = lazyWithRetry(() => import('./components/TrackTechnicians'), 'track-technicians');
const WhatsAppSettings = lazyWithRetry(() => import('./pages/settings/WhatsAppSettings'), 'whatsapp-settings');
const WhatsAppTemplates = lazyWithRetry(() => import('./pages/settings/WhatsAppTemplates'), 'whatsapp-templates');
const WhatsAppLogs = lazyWithRetry(() => import('./pages/whatsapp/WhatsAppLogs'), 'whatsapp-logs');
const EmailSettings = lazyWithRetry(() => import('./pages/settings/EmailSettings'), 'email-settings');
const EmailTemplates = lazyWithRetry(() => import('./pages/settings/EmailTemplates'), 'email-templates');
const EmailLogs = lazyWithRetry(() => import('./pages/email/EmailLogs'), 'email-logs');
const UIDashboardPage = lazyWithRetry(() => import('./pages/Dashboard'), 'ui-dashboard');
const UICustomersPage = lazyWithRetry(() => import('./pages/CustomersPage'), 'ui-customers');
const SalesPerformanceDashboard = lazyWithRetry(() => import('./pages/sales-performance/SalesPerformanceDashboard'), 'sales-performance-dashboard');
const SalesTargets = lazyWithRetry(() => import('./pages/sales-performance/SalesTargets'), 'sales-performance-targets');
const SalesTeamPerformance = lazyWithRetry(() => import('./pages/sales-performance/SalesTeamPerformance'), 'sales-team-performance');
const SalesPerformanceReports = lazyWithRetry(() => import('./pages/sales-performance/SalesPerformanceReports'), 'sales-performance-reports');
const StockDashboard = lazyWithRetry(() => import('./pages/stock-management/StockDashboard'), 'stock-dashboard');
const StockItems = lazyWithRetry(() => import('./pages/stock-management/StockItems'), 'stock-items');
const StockPurchase = lazyWithRetry(() => import('./pages/stock-management/StockPurchase'), 'stock-purchase');
const StockIssueUsage = lazyWithRetry(() => import('./pages/stock-management/StockIssueUsage'), 'stock-issue-usage');
const StockReports = lazyWithRetry(() => import('./pages/stock-management/StockReports'), 'stock-reports');

const normalizePastedDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s].*)?$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, '0')}-${String(dmyMatch[1]).padStart(2, '0')}`;
  }
  const shortYearMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})(?:[T\s].*)?$/);
  if (shortYearMatch) {
    return `20${shortYearMatch[3]}-${String(shortYearMatch[2]).padStart(2, '0')}-${String(shortYearMatch[1]).padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ProtectedRoute = ({ children }) => {
  const [authState, setAuthState] = useState({ loading: true, authenticated: false });

  useEffect(() => {
    let active = true;
    fetchPortalUser(API_BASE_URL)
      .then(() => {
        if (!active) return;
        setAuthState({ loading: false, authenticated: true });
      })
      .catch(() => {
        if (!active) return;
        clearPortalUser();
        setAuthState({ loading: false, authenticated: false });
      });
    return () => {
      active = false;
    };
  }, []);

  if (authState.loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '16px', color: '#475569', fontWeight: 700 }}>
        Checking session...
      </div>
    );
  }

  return authState.authenticated ? children : <Navigate to="/" replace />;
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
  useEffect(() => {
    const handlePaste = (event) => {
      const target = event.target;
      if (!target || target.tagName !== 'INPUT' || target.type !== 'date' || target.readOnly || target.disabled) return;

      const pasted = String(event.clipboardData?.getData('text') || '').trim();
      const normalized = normalizePastedDate(pasted);
      if (!normalized) return;

      event.preventDefault();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(target, normalized);
      } else {
        target.value = normalized;
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    };

    document.addEventListener('paste', handlePaste, true);
    return () => document.removeEventListener('paste', handlePaste, true);
  }, []);

  return (
    <Router>
      <RouteErrorBoundary>
        <Suspense fallback={<div style={{ padding: '16px' }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<AppRoute element={<Dashboard />} />} />
            <Route path="/ui/dashboard" element={<AppRoute element={<UIDashboardPage />} />} />
            <Route path="/ui/customers" element={<AppRoute element={<UICustomersPage />} />} />
            <Route path="/leads" element={<AppRoute element={<LeadCapture />} />} />
            <Route path="/leads/followup" element={<AppRoute element={<LeadFollowups />} />} />
            <Route path="/quotations" element={<AppRoute element={<QuotationDashboard />} />} />
            <Route path="/quotations/new" element={<AppRoute element={<CreateQuote />} />} />
            <Route path="/sales" element={<Navigate to="/sales/customers" replace />} />
            <Route path="/sales/contracts" element={<AppRoute element={contractPage} />} />
            <Route path="/sales/customers" element={<AppRoute element={<CustomerDashboard />} />} />
            <Route path="/sales/invoices" element={<AppRoute element={<InvoiceDashboard />} />} />
            <Route path="/sales/payment-received" element={<AppRoute element={<PaymentReceivedDashboard />} />} />
            <Route path="/sales/renewal" element={<AppRoute element={renewalPage} />} />
            <Route path="/sales-performance" element={<Navigate to="/sales-performance/dashboard" replace />} />
            <Route path="/sales-performance/dashboard" element={<AppRoute element={<SalesPerformanceDashboard />} />} />
            <Route path="/sales-performance/targets" element={<AppRoute element={<SalesTargets />} />} />
            <Route path="/sales-performance/team-performance" element={<AppRoute element={<SalesTeamPerformance />} />} />
            <Route path="/sales-performance/reports" element={<AppRoute element={<SalesPerformanceReports />} />} />
            <Route path="/sales-performance/target-setup" element={<Navigate to="/sales-performance/targets" replace />} />
            <Route path="/sales-performance/weekly-performance" element={<Navigate to="/sales-performance/team-performance" replace />} />
            <Route path="/sales-performance/monthly-performance" element={<Navigate to="/sales-performance/reports" replace />} />
            <Route path="/sales-performance/yearly-performance" element={<Navigate to="/sales-performance/reports" replace />} />
            <Route path="/sales-performance/yearly-comparison" element={<Navigate to="/sales-performance/dashboard" replace />} />
            <Route path="/sales-performance/team-comparison" element={<Navigate to="/sales-performance/team-performance" replace />} />
            <Route path="/sales-performance/sales-person-report" element={<Navigate to="/sales-performance/reports" replace />} />
            <Route path="/sales-performance/incentives" element={<Navigate to="/sales-performance/reports" replace />} />
            <Route path="/sales-performance/settings" element={<Navigate to="/sales-performance/reports" replace />} />
            <Route path="/sales-performance/export" element={<Navigate to="/sales-performance/reports" replace />} />
            <Route path="/stock" element={<Navigate to="/stock/dashboard" replace />} />
            <Route path="/stock/dashboard" element={<AppRoute element={<StockDashboard />} />} />
            <Route path="/stock/items" element={<AppRoute element={<StockItems />} />} />
            <Route path="/stock/purchase" element={<AppRoute element={<StockPurchase />} />} />
            <Route path="/stock/issue-usage" element={<AppRoute element={<StockIssueUsage />} />} />
            <Route path="/stock/reports" element={<AppRoute element={<StockReports />} />} />
            <Route path="/stock/products" element={<Navigate to="/stock/items" replace />} />
            <Route path="/stock/issue" element={<Navigate to="/stock/issue-usage" replace />} />
            <Route path="/stock/usage" element={<Navigate to="/stock/issue-usage" replace />} />
            <Route path="/stock/returns" element={<Navigate to="/stock/issue-usage" replace />} />
            <Route path="/stock/technician-stock" element={<Navigate to="/stock/reports" replace />} />
            <Route path="/stock/low-stock" element={<Navigate to="/stock/reports" replace />} />
            <Route path="/stock/vendor-report" element={<Navigate to="/stock/reports" replace />} />
            <Route path="/stock/ledger" element={<Navigate to="/stock/reports" replace />} />
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
            <Route path="/technician-portal" element={<Navigate to="/tasks/detail/index" replace />} />
            <Route path="/tasks/detail" element={<AppRoute element={<TechnicianPortal />} />} />
            <Route path="/tasks/detail/index" element={<AppRoute element={<TechnicianPortal />} />} />
            <Route path="/tasks/detail/:jobId" element={<AppRoute element={<TechnicianPortal />} />} />
            <Route path="/tasks/detail/index/:jobId" element={<AppRoute element={<TechnicianPortal />} />} />
            <Route path="/operations/assigned-jobs" element={<AppRoute element={<TechnicianPortal />} />} />
            <Route path="/operations/track-technicians" element={<AppRoute element={<TrackTechnicians />} />} />
            <Route path="/sales-portal" element={<AppRoute element={<SalesPortal />} />} />
            <Route path="/operations-portal" element={<AppRoute element={<OperationsPortal />} />} />
            <Route path="/complaints" element={<AppRoute element={complaintsPage} />} />
            <Route path="/certificates" element={<AppRoute element={certificatesPage} />} />
            <Route path="/hr-dashboard" element={<AppRoute element={<HRDashboard />} />} />
            <Route path="/employees" element={<AppRoute element={<EmployeeMaster />} />} />
            <Route path="/attendance" element={<AppRoute element={<Attendance />} />} />
            <Route path="/payroll" element={<AppRoute element={<PayrollModule />} />} />
            <Route path="/items" element={<AppRoute element={<ItemsDashboard />} />} />
            <Route path="/admin/export-data" element={<AppRoute element={<ExportDataDashboard />} />} />
            <Route path="/settings" element={<AppRoute element={<Settings />} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </Router>
  );
}

export default App;
