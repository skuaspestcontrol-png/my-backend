import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Database, Download, FileDown, FileSpreadsheet, RefreshCcw, Search } from 'lucide-react';
import AppButton from './ui/AppButton';
import AppCard from './ui/AppCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB');
};

const formatCurrency = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return '';
  return String(Number(parsed.toFixed(2)));
};

const cleanText = (value, fallback = '-') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[,"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const buildCsv = (rows = [], columns = []) => [
  columns.map((column) => csvEscape(column.label)).join(','),
  ...rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(','))
].join('\n');

const downloadCsv = (rows = [], columns = [], fileName = 'export.csv') => {
  const blob = new Blob([buildCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const firstValue = (row, keys = [], fallback = '') => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return fallback;
};

const extractRows = (payload) => {
  const candidates = [
    payload,
    payload?.data,
    payload?.rows,
    payload?.items,
    payload?.customers,
    payload?.leads,
    payload?.invoices,
    payload?.quotations,
    payload?.vendors,
    payload?.contracts,
    payload?.payments,
    payload?.paymentReceived,
    payload?.renewals
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const normalizeName = (value) => String(value || '').trim().toLowerCase();

const parseDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const toInputDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const deriveContractStatus = (invoiceStatus, startDate, endDate) => {
  const statusText = String(invoiceStatus || '').trim().toLowerCase();
  if (statusText.includes('renew')) return 'Renewed';

  const today = parseDateOnly(new Date());
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (start && today && start > today) return 'Upcoming';
  if (end && today && end < today) return 'Expired';
  if (end && today) {
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 30) return 'Expiring Soon';
  }
  return 'Active';
};

const deriveContractCode = (contractNo) => {
  const raw = String(contractNo || '').trim();
  if (!raw) return '-';
  const swapped = raw.replace(/\/(?:C?INV)\/\d+$/i, '/C');
  if (swapped !== raw) return swapped;
  const bits = raw.split('/').filter(Boolean);
  if (bits.length <= 1) return raw;
  return `${bits.slice(0, -1).join('/')}/C`;
};

const getContractExportRows = async () => {
  const [invoicesResponse, customersResponse, schedulesResponse] = await Promise.all([
    axios.get(`${API_BASE_URL}/api/invoices`),
    axios.get(`${API_BASE_URL}/api/customers`),
    axios.get(`${API_BASE_URL}/api/service-schedules`)
  ]);

  const invoices = extractRows(invoicesResponse.data);
  const customers = extractRows(customersResponse.data);
  const schedules = extractRows(schedulesResponse.data);
  const customerIndex = {
    byId: new Map(),
    byName: new Map()
  };
  customers.forEach((customer) => {
    const id = String(customer?._id || customer?.id || '').trim();
    const name = normalizeName(customer?.displayName || customer?.name);
    if (id) customerIndex.byId.set(id, customer);
    if (name) customerIndex.byName.set(name, customer);
  });
  const scheduleIndex = {
    byInvoiceId: new Map(),
    byInvoiceNumber: new Map()
  };
  schedules.forEach((schedule) => {
    const invoiceId = String(schedule?.invoiceId || schedule?.contractId || schedule?.sourceInvoiceId || '').trim();
    const invoiceNumber = normalizeName(schedule?.invoiceNumber || schedule?.contractNumber || '');
    if (invoiceId) scheduleIndex.byInvoiceId.set(invoiceId, schedule);
    if (invoiceNumber) scheduleIndex.byInvoiceNumber.set(invoiceNumber, schedule);
  });

  return invoices.map((invoice, index) => {
    const lines = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [{}];
    const startCandidates = lines
      .map((line) => line.contractStartDate || line.serviceStartDate || invoice.servicePeriodStart || invoice.date)
      .filter(Boolean);
    const endCandidates = lines
      .map((line) => line.contractEndDate || line.serviceEndDate || line.renewalDate || invoice.servicePeriodEnd)
      .filter(Boolean);

    const parsedStarts = startCandidates.map(parseDateOnly).filter(Boolean);
    const parsedEnds = endCandidates.map(parseDateOnly).filter(Boolean);

    const startDate = parsedStarts.length > 0 ? new Date(Math.min(...parsedStarts.map((date) => date.getTime()))) : parseDateOnly(invoice.date);
    const endDate = parsedEnds.length > 0 ? new Date(Math.max(...parsedEnds.map((date) => date.getTime()))) : startDate;

    const customerById = invoice.customerId ? customerIndex.byId.get(String(invoice.customerId)) : null;
    const customerByName = customerIndex.byName.get(normalizeName(invoice.customerName));
    const customer = customerById || customerByName || null;

    const total = Number(invoice.total ?? invoice.amount ?? 0);
    const due = Math.max(0, Number(invoice.balanceDue ?? invoice.balance_due ?? total ?? 0));
    const paid = Math.max(0, total - due);
    const normalizedInvoiceType = String(invoice.invoiceType || '').trim().toUpperCase();
    const type = normalizedInvoiceType === 'NON GST' ? 'Non GST' : (Number(invoice.totalTax || 0) > 0 ? 'GST' : 'Non GST');
    const startInputDate = toInputDate(startDate);
    const endInputDate = toInputDate(endDate || startDate);
    const contractNo = String(invoice.invoiceNumber || '').trim() || `CONTRACT-${index + 1}`;
    const serviceMeta = scheduleIndex.byInvoiceId.get(String(invoice._id || ''))
      || scheduleIndex.byInvoiceNumber.get(normalizeName(contractNo))
      || { total: lines.length, completed: 0, nextServiceDate: '', nextServiceTime: '' };

    return {
      id: String(invoice._id || contractNo || index),
      invoiceId: invoice._id,
      contractNo,
      contractCode: deriveContractCode(contractNo),
      customer: String(invoice.customerName || customer?.displayName || customer?.name || 'Customer'),
      mobile: String(customer?.mobileNumber || customer?.workPhone || '').trim(),
      altNumber: String(customer?.altNumber || '').trim(),
      emailId: String(customer?.emailId || customer?.email || '').trim(),
      gstNumber: String(customer?.gstNumber || '').trim(),
      property: String(customer?.billingArea || customer?.shippingArea || customer?.billingAddress || customer?.shippingAddress || invoice.premiseLabel || invoice.premiseAddress || invoice.billingAddressText || invoice.shippingAddressText || '-').trim(),
      city: String(customer?.billingState || customer?.shippingState || invoice.premiseCity || invoice.premiseState || '-').trim(),
      startDate: startInputDate,
      endDate: endInputDate,
      services: Math.max(0, Number(serviceMeta.total || lines.length)),
      servicesDone: Math.max(0, Number(serviceMeta.completed || 0)),
      nextServiceDate: serviceMeta.nextServiceDate || '',
      nextServiceTime: serviceMeta.nextServiceTime || '',
      status: deriveContractStatus(invoice.status, startInputDate, endInputDate),
      type,
      total,
      paid,
      due
    };
  });
};

const moduleDefinitions = [
  {
    key: 'customers',
    label: 'Customers',
    description: 'Download the full customer master with contact and address details.',
    endpoint: '/api/customers',
    fileName: 'customers-export.csv',
    icon: Database,
    columns: [
      { key: 'displayName', label: 'Customer Name' },
      { key: 'segment', label: 'Segment' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'mobileNumber', label: 'Mobile' },
      { key: 'emailId', label: 'Email' },
      { key: 'billingAddress', label: 'Billing Address' },
      { key: 'billingState', label: 'State' },
      { key: 'billingPincode', label: 'Pincode' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      displayName: cleanText(firstValue(row, ['displayName', 'customerName', 'name'])),
      segment: cleanText(firstValue(row, ['segment', 'customerSegment'])),
      companyName: cleanText(firstValue(row, ['companyName'])),
      mobileNumber: cleanText(firstValue(row, ['mobileNumber', 'workPhone', 'mobile'])),
      emailId: cleanText(firstValue(row, ['emailId', 'email'])),
      billingAddress: cleanText(firstValue(row, ['billingAddress'])),
      billingState: cleanText(firstValue(row, ['billingState', 'state'])),
      billingPincode: cleanText(firstValue(row, ['billingPincode', 'pincode'])),
      status: cleanText(firstValue(row, ['status']))
    })
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Export all lead records, follow-ups, source tags, and assigned owners.',
    endpoint: '/api/leads',
    fileName: 'leads-export.csv',
    icon: Database,
    columns: [
      { key: 'leadDate', label: 'Lead Date' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'email', label: 'Email' },
      { key: 'pestIssue', label: 'Pest Issue' },
      { key: 'leadSource', label: 'Lead Source' },
      { key: 'status', label: 'Status' },
      { key: 'followupDate', label: 'Follow-up Date' },
      { key: 'assignedTo', label: 'Assigned To' },
      { key: 'quotationValue', label: 'Quotation Value' }
    ],
    mapRow: (row) => ({
      leadDate: formatDate(firstValue(row, ['leadDate', 'date', 'createdAt'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      mobile: cleanText(firstValue(row, ['mobileNumber', 'mobile', 'phone'])),
      email: cleanText(firstValue(row, ['emailId', 'email'])),
      pestIssue: cleanText(firstValue(row, ['pestIssue', 'issue'])),
      leadSource: cleanText(firstValue(row, ['leadSource', 'source'])),
      status: cleanText(firstValue(row, ['status', 'leadStatus'])),
      followupDate: formatDate(firstValue(row, ['followupDate', 'followUpDate'])),
      assignedTo: cleanText(firstValue(row, ['assignedTo'])),
      quotationValue: cleanText(formatCurrency(firstValue(row, ['quotationValue', 'quotation_value'])), '-')
    })
  },
  {
    key: 'contracts',
    label: 'Contracts',
    description: 'Download the contract-style records used in the contracts dashboard.',
    endpoint: '/api/invoices',
    fileName: 'contracts-export.csv',
    icon: FileDown,
    columns: [
      { key: 'contractNo', label: 'Contract #' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'property', label: 'Property' },
      { key: 'duration', label: 'Duration' },
      { key: 'invoiceType', label: 'Invoice Type' },
      { key: 'services', label: 'Services' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total' },
      { key: 'paid', label: 'Paid' },
      { key: 'due', label: 'Due' }
    ],
    loadRows: getContractExportRows,
    mapRow: (row) => ({
      contractNo: cleanText(row.contractCode || row.contractNo),
      customerName: cleanText(row.customer),
      property: cleanText(row.property),
      duration: cleanText(row.startDate && row.endDate ? `${formatDate(row.startDate)} to ${formatDate(row.endDate)}` : '-'),
      invoiceType: cleanText(row.type),
      services: cleanText(String(row.services || 0)),
      status: cleanText(row.status),
      total: cleanText(formatCurrency(row.total), '-'),
      paid: cleanText(formatCurrency(row.paid), '-'),
      due: cleanText(formatCurrency(row.due), '-')
    })
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Export invoice register data for accounting, reconciliation, and follow-up.',
    endpoint: '/api/invoices',
    fileName: 'invoices-export.csv',
    icon: FileDown,
    columns: [
      { key: 'invoiceDate', label: 'Date' },
      { key: 'invoiceNumber', label: 'Invoice' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'amount', label: 'Amount' },
      { key: 'balanceDue', label: 'Balance Due' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      invoiceDate: formatDate(firstValue(row, ['invoiceDate', 'date', 'createdAt'])),
      invoiceNumber: cleanText(firstValue(row, ['invoiceNumber', 'invoiceNo', 'invoice_no', '_id'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      dueDate: formatDate(firstValue(row, ['dueDate', 'due_date'])),
      amount: cleanText(formatCurrency(firstValue(row, ['totalAmount', 'grandTotal', 'total', 'amount'])), '-'),
      balanceDue: cleanText(formatCurrency(firstValue(row, ['balanceDue', 'dueAmount'])), '-'),
      status: cleanText(firstValue(row, ['status', 'invoiceStatus']))
    })
  },
  {
    key: 'quotations',
    label: 'Quotations',
    description: 'Export proposal records with customer, sales owner, and total value.',
    endpoint: '/api/quotations',
    fileName: 'quotations-export.csv',
    icon: FileDown,
    columns: [
      { key: 'quotationDate', label: 'Date' },
      { key: 'quotationNumber', label: 'Quotation' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'salesPerson', label: 'Sales Person' },
      { key: 'status', label: 'Status' },
      { key: 'grandTotal', label: 'Grand Total' }
    ],
    mapRow: (row) => ({
      quotationDate: formatDate(firstValue(row, ['quotationDate', 'date', 'createdAt'])),
      quotationNumber: cleanText(firstValue(row, ['quotationNumber', 'quotation_no', '_id'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      salesPerson: cleanText(firstValue(row, ['salesPerson', 'preparedBy'])),
      status: cleanText(firstValue(row, ['status'])),
      grandTotal: cleanText(formatCurrency(firstValue(row, ['grandTotal', 'totalAmount'])), '-')
    })
  },
  {
    key: 'vendors',
    label: 'Vendors',
    description: 'Download the vendor master with opening balance and contact details.',
    endpoint: '/api/vendors',
    fileName: 'vendors-export.csv',
    icon: Database,
    columns: [
      { key: 'vendorName', label: 'Vendor Name' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'contactPersonName', label: 'Contact Person' },
      { key: 'mobileNumber', label: 'Mobile' },
      { key: 'emailId', label: 'Email' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'openingBalance', label: 'Opening Balance' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      vendorName: cleanText(firstValue(row, ['vendorName', 'displayName'])),
      companyName: cleanText(firstValue(row, ['companyName'])),
      contactPersonName: cleanText(firstValue(row, ['contactPersonName'])),
      mobileNumber: cleanText(firstValue(row, ['mobileNumber', 'mobile'])),
      emailId: cleanText(firstValue(row, ['emailId', 'email'])),
      city: cleanText(firstValue(row, ['city'])),
      state: cleanText(firstValue(row, ['state'])),
      openingBalance: cleanText(formatCurrency(firstValue(row, ['openingBalance', 'opening_balance'])), '-'),
      status: cleanText(firstValue(row, ['status']))
    })
  },
  {
    key: 'vendorBills',
    label: 'Vendor Bills',
    description: 'Export purchase bills and outstanding bill balances for accounting.',
    endpoint: '/api/vendor-bills',
    fileName: 'vendor-bills-export.csv',
    icon: Database,
    columns: [
      { key: 'billDate', label: 'Date' },
      { key: 'billNumber', label: 'Bill #' },
      { key: 'vendorName', label: 'Vendor Name' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'totalAmount', label: 'Total' },
      { key: 'balanceDue', label: 'Balance Due' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      billDate: formatDate(firstValue(row, ['billDate', 'date', 'createdAt'])),
      billNumber: cleanText(firstValue(row, ['billNumber', 'bill_no', '_id'])),
      vendorName: cleanText(firstValue(row, ['vendorName'])),
      dueDate: formatDate(firstValue(row, ['dueDate', 'due_date'])),
      totalAmount: cleanText(formatCurrency(firstValue(row, ['totalAmount', 'grandTotal'])), '-'),
      balanceDue: cleanText(formatCurrency(firstValue(row, ['balanceDue'])), '-'),
      status: cleanText(firstValue(row, ['status']))
    })
  },
  {
    key: 'payments',
    label: 'Payments Received',
    description: 'Download customer receipts and payment mode history.',
    endpoint: '/api/payment-received',
    fileName: 'payments-received-export.csv',
    icon: Database,
    columns: [
      { key: 'paymentDate', label: 'Date' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'paymentMode', label: 'Payment Mode' },
      { key: 'depositTo', label: 'Deposit To' },
      { key: 'referenceNumber', label: 'Reference #' },
      { key: 'amount', label: 'Amount' }
    ],
    mapRow: (row) => ({
      paymentDate: formatDate(firstValue(row, ['paymentDate', 'date', 'createdAt'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      paymentMode: cleanText(firstValue(row, ['paymentMode', 'mode'])),
      depositTo: cleanText(firstValue(row, ['depositTo', 'deposit_to'])),
      referenceNumber: cleanText(firstValue(row, ['referenceNumber', 'referenceNo'])),
      amount: cleanText(formatCurrency(firstValue(row, ['amount'])), '-')
    })
  },
  {
    key: 'renewals',
    label: 'Renewals',
    description: 'Export renewal records, due dates, and assigned owners.',
    endpoint: '/api/renewals',
    fileName: 'renewals-export.csv',
    icon: FileDown,
    columns: [
      { key: 'renewalId', label: 'Renewal #' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'renewalDueDate', label: 'Renewal Due Date' },
      { key: 'status', label: 'Status' },
      { key: 'proposedAmount', label: 'Proposed Amount' }
    ],
    mapRow: (row) => ({
      renewalId: cleanText(firstValue(row, ['renewalDisplayId', 'renewalId', '_id'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      serviceType: cleanText(firstValue(row, ['serviceType'])),
      renewalDueDate: formatDate(firstValue(row, ['renewalDueDate', 'dueDate'])),
      status: cleanText(firstValue(row, ['status'])),
      proposedAmount: cleanText(formatCurrency(firstValue(row, ['proposedAmount'])), '-')
    })
  },
  {
    key: 'items',
    label: 'Items',
    description: 'Download the stock item master and current inventory details.',
    endpoint: '/api/items',
    fileName: 'items-export.csv',
    icon: Database,
    columns: [
      { key: 'itemName', label: 'Item Name' },
      { key: 'category', label: 'Category' },
      { key: 'unit', label: 'Unit' },
      { key: 'currentStock', label: 'Current Stock' },
      { key: 'minimumStock', label: 'Minimum Stock' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      itemName: cleanText(firstValue(row, ['itemName', 'name'])),
      category: cleanText(firstValue(row, ['category'])),
      unit: cleanText(firstValue(row, ['unit'])),
      currentStock: cleanText(firstValue(row, ['currentStock', 'current_stock'])),
      minimumStock: cleanText(firstValue(row, ['minimumStock', 'minimum_stock'])),
      status: cleanText(firstValue(row, ['status']))
    })
  }
];

const initialState = Object.fromEntries(moduleDefinitions.map((module) => [module.key, { rows: [], loading: true, error: '' }]));

const shell = {
  page: { display: 'grid', gap: 16, width: '100%', minWidth: 0 },
  hero: {
    borderRadius: 20,
    background: 'linear-gradient(135deg, rgba(17,24,39,0.98), rgba(59,130,246,0.82))',
    color: '#fff',
    padding: 24,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, 0.7fr)',
    gap: 16,
    alignItems: 'stretch'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.12)',
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  },
  title: { margin: '12px 0 0', fontSize: 32, lineHeight: 1.08, letterSpacing: '-0.03em' },
  subtitle: { margin: '10px 0 0', maxWidth: 760, color: 'rgba(255,255,255,0.86)', fontSize: 14, lineHeight: 1.7, fontWeight: 600 },
  heroPanel: {
    borderRadius: 16,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: 16,
    display: 'grid',
    gap: 12,
    alignContent: 'start'
  },
  heroStatGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  heroStat: {
    borderRadius: 14,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.14)',
    padding: 12,
    minHeight: 86
  },
  heroStatLabel: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(226,232,240,0.8)' },
  heroStatValue: { marginTop: 6, fontSize: 24, fontWeight: 800 },
  heroStatNote: { marginTop: 8, fontSize: 12, color: 'rgba(226,232,240,0.82)', lineHeight: 1.5, fontWeight: 600 },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap'
  },
  searchWrap: {
    flex: '1 1 360px',
    minWidth: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    background: '#fff',
    padding: '0 12px',
    minHeight: 40
  },
  searchInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 13,
    fontWeight: 600,
    color: '#0f172a'
  },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 },
  cardBody: { display: 'grid', gap: 12 },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' },
  cardText: { margin: 0, fontSize: 13, lineHeight: 1.6, color: '#64748b', fontWeight: 600 },
  countPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    padding: '4px 8px',
    background: 'rgba(59,130,246,0.1)',
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: 'nowrap'
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: 'nowrap'
  },
  statusReady: { background: 'rgba(22,163,74,0.12)', color: '#166534' },
  statusLoading: { background: 'rgba(59,130,246,0.12)', color: '#1d4ed8' },
  statusError: { background: 'rgba(220,38,38,0.12)', color: '#991b1b' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' }
};

export default function ExportDataDashboard() {
  const [moduleState, setModuleState] = useState(initialState);
  const [query, setQuery] = useState('');

  const loadModule = async (moduleDef) => {
    setModuleState((current) => ({
      ...current,
      [moduleDef.key]: { ...current[moduleDef.key], loading: true, error: '' }
    }));

    try {
      const rawRows = moduleDef.loadRows
        ? await moduleDef.loadRows()
        : extractRows((await axios.get(`${API_BASE_URL}${moduleDef.endpoint}`)).data);
      const rows = rawRows.map((row) => moduleDef.mapRow(row));
      setModuleState((current) => ({
        ...current,
        [moduleDef.key]: { rows, loading: false, error: '' }
      }));
    } catch (error) {
      setModuleState((current) => ({
        ...current,
        [moduleDef.key]: {
          rows: [],
          loading: false,
          error: error?.response?.data?.error || error?.message || 'Unable to load module data'
        }
      }));
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all(moduleDefinitions.map(async (moduleDef) => {
        if (!alive) return;
        await loadModule(moduleDef);
      }));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshAll = async () => {
    await Promise.all(moduleDefinitions.map((moduleDef) => loadModule(moduleDef)));
  };

  const filteredModules = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return moduleDefinitions;
    return moduleDefinitions.filter((moduleDef) => [
      moduleDef.label,
      moduleDef.description,
      moduleDef.key
    ].some((value) => String(value).toLowerCase().includes(term)));
  }, [query]);

  const readyCount = moduleDefinitions.filter((moduleDef) => !moduleState[moduleDef.key]?.loading && !moduleState[moduleDef.key]?.error).length;
  const errorCount = moduleDefinitions.filter((moduleDef) => moduleState[moduleDef.key]?.error).length;
  const totalRows = moduleDefinitions.reduce((sum, moduleDef) => sum + (moduleState[moduleDef.key]?.rows?.length || 0), 0);

  return (
    <div style={shell.page}>
      <section style={shell.hero}>
        <div>
          <div style={shell.badge}>
            <Download size={14} />
            Administration
          </div>
          <h1 style={shell.title}>Export Data</h1>
          <p style={shell.subtitle}>
            Download module data as Excel-ready CSV files from one compact place. The exports are organized for quick sharing, reporting, and offline review.
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <AppButton variant="secondary" iconLeft={<RefreshCcw size={16} />} onClick={refreshAll} style={{ minHeight: 36, height: 36 }}>
              Refresh All
            </AppButton>
            <AppButton variant="outline" iconLeft={<FileSpreadsheet size={16} />} onClick={() => window.print()} style={{ minHeight: 36, height: 36 }}>
              Print View
            </AppButton>
          </div>
        </div>
        <div style={shell.heroPanel}>
          <div style={shell.heroStatGrid}>
            <div style={shell.heroStat}>
              <div style={shell.heroStatLabel}>Modules</div>
              <div style={shell.heroStatValue}>{moduleDefinitions.length}</div>
              <div style={shell.heroStatNote}>Core business masters and ledgers ready for export.</div>
            </div>
            <div style={shell.heroStat}>
              <div style={shell.heroStatLabel}>Ready</div>
              <div style={shell.heroStatValue}>{readyCount}</div>
              <div style={shell.heroStatNote}>Modules currently loaded and available to download.</div>
            </div>
            <div style={shell.heroStat}>
              <div style={shell.heroStatLabel}>Rows</div>
              <div style={shell.heroStatValue}>{totalRows}</div>
              <div style={shell.heroStatNote}>Total rows captured across the loaded datasets.</div>
            </div>
            <div style={shell.heroStat}>
              <div style={shell.heroStatLabel}>Errors</div>
              <div style={shell.heroStatValue}>{errorCount}</div>
              <div style={shell.heroStatNote}>Modules that need a retry or backend check.</div>
            </div>
          </div>
        </div>
      </section>

      <div style={shell.toolbar}>
        <div style={shell.searchWrap}>
          <Search size={16} color="#64748b" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search modules to export..."
            style={shell.searchInput}
          />
        </div>
      </div>

      <section style={shell.cardsGrid}>
        {filteredModules.map((moduleDef) => {
          const state = moduleState[moduleDef.key] || { rows: [], loading: true, error: '' };
          const statusStyle = state.error ? shell.statusError : state.loading ? shell.statusLoading : shell.statusReady;
          const statusLabel = state.error ? 'Error' : state.loading ? 'Loading' : 'Ready';
          const Icon = moduleDef.icon || Database;

          return (
            <AppCard
              key={moduleDef.key}
              title={moduleDef.label}
              action={(
                <span style={{ ...shell.status, ...statusStyle }}>
                  {statusLabel}
                </span>
              )}
              style={{ borderRadius: 18 }}
              headerStyle={{ padding: '14px 14px 0', borderBottom: 'none' }}
              bodyStyle={{ ...shell.cardBody, paddingTop: 10 }}
            >
              <div style={shell.cardTop}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#1d4ed8', flexShrink: 0 }}>
                    <Icon size={16} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={shell.cardText}>{moduleDef.description}</p>
                  </div>
                </div>
                <span style={shell.countPill}>{state.rows.length} rows</span>
              </div>

              <div style={shell.actions}>
                <AppButton
                  variant="primary"
                  iconLeft={<FileDown size={16} />}
                  loading={state.loading}
                  disabled={state.loading || !!state.error || state.rows.length === 0}
                  onClick={() => downloadCsv(state.rows, moduleDef.columns, moduleDef.fileName)}
                  style={{ minHeight: 36, height: 36 }}
                >
                  Download CSV
                </AppButton>
                <AppButton
                  variant="outline"
                  iconLeft={<RefreshCcw size={16} />}
                  onClick={() => loadModule(moduleDef)}
                  style={{ minHeight: 36, height: 36 }}
                >
                  Retry
                </AppButton>
              </div>

              {state.error ? (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', lineHeight: 1.5 }}>
                  {state.error}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, fontWeight: 600 }}>
                  Files are CSV formatted so they open cleanly in Excel, Google Sheets, and similar spreadsheet tools.
                </div>
              )}
            </AppCard>
          );
        })}
      </section>
    </div>
  );
}
