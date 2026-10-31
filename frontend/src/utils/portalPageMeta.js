// Display metadata only. App.jsx remains the authority for routes and access.
export const portalPages = [
  {
    "path": "/",
    "title": "Sign in",
    "group": "Sales & CRM"
  },
  {
    "path": "/dashboard",
    "title": "Dashboard",
    "group": "Sales & CRM"
  },
  {
    "path": "/ui/dashboard",
    "title": "UI Dashboard",
    "group": "Sales & CRM"
  },
  {
    "path": "/ui/customers",
    "title": "UI Customers",
    "group": "Sales & CRM"
  },
  {
    "path": "/leads",
    "title": "Leads",
    "group": "Sales & CRM"
  },
  {
    "path": "/leads/followup",
    "title": "Lead Follow-ups",
    "group": "Sales & CRM"
  },
  {
    "path": "/quotations",
    "title": "Quotations",
    "group": "Sales & CRM"
  },
  {
    "path": "/quotations/new",
    "title": "New Quotation",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales/contracts",
    "title": "All Contracts",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales/customers",
    "title": "Active Customers",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales/invoices",
    "title": "All Invoices",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales/payment-received",
    "title": "Payment Received",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales/renewal",
    "title": "Renewals",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales/whatsapp-marketing",
    "title": "WhatsApp Marketing",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales/whatsapp-marketing/campaigns/:id",
    "title": "Campaign Details",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales-performance/dashboard",
    "title": "Sales Performance",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales-performance/targets",
    "title": "Targets",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales-performance/team-performance",
    "title": "Team Performance",
    "group": "Sales & CRM"
  },
  {
    "path": "/sales-performance/reports",
    "title": "Sales Reports",
    "group": "Sales & CRM"
  },
  {
    "path": "/stock/dashboard",
    "title": "Stock Dashboard",
    "group": "Inventory"
  },
  {
    "path": "/stock/items",
    "title": "Stock Items",
    "group": "Inventory"
  },
  {
    "path": "/stock/purchase",
    "title": "Stock In / Purchase",
    "group": "Inventory"
  },
  {
    "path": "/stock/issue-usage",
    "title": "Issue & Usage",
    "group": "Inventory"
  },
  {
    "path": "/stock/reports",
    "title": "Stock Reports",
    "group": "Inventory"
  },
  {
    "path": "/purchase/vendors",
    "title": "Vendors",
    "group": "Purchase"
  },
  {
    "path": "/purchase/bills",
    "title": "Vendor Bills",
    "group": "Purchase"
  },
  {
    "path": "/purchase/payment-received",
    "title": "Vendor Payments",
    "group": "Purchase"
  },
  {
    "path": "/whatsapp",
    "title": "WhatsApp Workspace",
    "group": "Administration"
  },
  {
    "path": "/settings/whatsapp",
    "title": "WhatsApp Settings",
    "group": "Administration"
  },
  {
    "path": "/settings/whatsapp/templates",
    "title": "WhatsApp Templates",
    "group": "Administration"
  },
  {
    "path": "/whatsapp/logs",
    "title": "WhatsApp Logs",
    "group": "Administration"
  },
  {
    "path": "/settings/email",
    "title": "Email Settings",
    "group": "Administration"
  },
  {
    "path": "/settings/email/templates",
    "title": "Email Templates",
    "group": "Administration"
  },
  {
    "path": "/email/logs",
    "title": "Email Logs",
    "group": "Administration"
  },
  {
    "path": "/schedule-job",
    "title": "Assign Services",
    "group": "Operations"
  },
  {
    "path": "/operations/assign-services",
    "title": "Assign Services",
    "group": "Operations"
  },
  {
    "path": "/service-calendar",
    "title": "Service Calendar",
    "group": "Operations"
  },
  {
    "path": "/tasks/detail",
    "title": "Assigned Jobs",
    "group": "Operations"
  },
  {
    "path": "/tasks/detail/index",
    "title": "Assigned Jobs",
    "group": "Operations"
  },
  {
    "path": "/tasks/detail/:jobId",
    "title": "Job Details",
    "group": "Operations"
  },
  {
    "path": "/tasks/detail/index/:jobId",
    "title": "Job Details",
    "group": "Operations"
  },
  {
    "path": "/operations/assigned-jobs",
    "title": "Assigned Jobs",
    "group": "Operations"
  },
  {
    "path": "/operations/track-technicians",
    "title": "Track Technicians",
    "group": "Operations"
  },
  {
    "path": "/sales-portal",
    "title": "Sales Portal",
    "group": "Sales & CRM"
  },
  {
    "path": "/operations-portal",
    "title": "Operations Portal",
    "group": "Operations"
  },
  {
    "path": "/complaints",
    "title": "Complaints",
    "group": "Operations"
  },
  {
    "path": "/certificates",
    "title": "Certificates",
    "group": "Operations"
  },
  {
    "path": "/hr-dashboard",
    "title": "HR Dashboard",
    "group": "People"
  },
  {
    "path": "/employees",
    "title": "Employees",
    "group": "People"
  },
  {
    "path": "/attendance",
    "title": "Attendance",
    "group": "People"
  },
  {
    "path": "/payroll",
    "title": "Payroll",
    "group": "People"
  },
  {
    "path": "/items",
    "title": "Items",
    "group": "Administration"
  },
  {
    "path": "/admin/export-data",
    "title": "Export Data",
    "group": "Administration"
  },
  {
    "path": "/settings",
    "title": "Settings",
    "group": "Administration"
  }
];

export function getPortalBreadcrumbs(pathname) {
  const path = String(pathname || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path === '/') return [];
  const segments = path.split('/');
  const matches = portalPages.filter(page => {
    const parts = page.path.split('/');
    return parts.length === segments.length && parts.every((part, index) => part.startsWith(':') || part === segments[index]);
  });
  const page = matches.find(entry => !entry.path.includes(':')) || matches[0];
  if (path === '/dashboard') return [{ label: 'Dashboard' }];
  return [{ label: 'Dashboard', to: '/dashboard' }, ...(page ? [{ label: page.group, group: true }] : []), { label: page?.title || 'Workspace' }];
}
