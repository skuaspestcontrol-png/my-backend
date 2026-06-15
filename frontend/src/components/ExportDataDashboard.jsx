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
    description: 'Download the filled customer form fields and contact/address details.',
    endpoint: '/api/customers',
    fileName: 'customers-export.csv',
    icon: Database,
    columns: [
      { key: 'displayName', label: 'Display Name' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'contactPersonName', label: 'Contact Person' },
      { key: 'segment', label: 'Segment' },
      { key: 'mobileNumber', label: 'Mobile' },
      { key: 'whatsappNumber', label: 'WhatsApp' },
      { key: 'emailId', label: 'Email' },
      { key: 'gstNumber', label: 'GST Number' },
      { key: 'billingAttention', label: 'Billing Attention' },
      { key: 'billingAddress', label: 'Billing Address' },
      { key: 'shippingAddress', label: 'Shipping Address' },
      { key: 'billingArea', label: 'Billing Area' },
      { key: 'billingCity', label: 'Billing City' },
      { key: 'city', label: 'City' },
      { key: 'billingState', label: 'State' },
      { key: 'billingPincode', label: 'Pincode' },
      { key: 'googlePlaceName', label: 'Google Place' },
      { key: 'billingGooglePlaceName', label: 'Billing Google Place' },
      { key: 'shippingAttention', label: 'Shipping Attention' },
      { key: 'shippingArea', label: 'Shipping Area' },
      { key: 'shippingCity', label: 'Shipping City' },
      { key: 'shippingState', label: 'Shipping State' },
      { key: 'shippingPincode', label: 'Shipping Pincode' },
      { key: 'shippingGooglePlaceName', label: 'Shipping Google Place' },
      { key: 'googlePhone', label: 'Google Phone' },
      { key: 'googleWebsite', label: 'Google Website' },
      { key: 'openingBalance', label: 'Opening Balance' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      displayName: cleanText(firstValue(row, ['displayName', 'customerName', 'name'])),
      companyName: cleanText(firstValue(row, ['companyName'])),
      contactPersonName: cleanText(firstValue(row, ['contactPersonName'])),
      segment: cleanText(firstValue(row, ['segment'])),
      mobileNumber: cleanText(firstValue(row, ['mobileNumber', 'workPhone', 'mobile'])),
      whatsappNumber: cleanText(firstValue(row, ['whatsappNumber'])),
      emailId: cleanText(firstValue(row, ['emailId', 'email'])),
      gstNumber: cleanText(firstValue(row, ['gstNumber'])),
      billingAttention: cleanText(firstValue(row, ['billingAttention'])),
      billingAddress: cleanText(firstValue(row, ['billingAddress'])),
      shippingAddress: cleanText(firstValue(row, ['shippingAddress'])),
      billingArea: cleanText(firstValue(row, ['billingArea'])),
      billingCity: cleanText(firstValue(row, ['billingCity'])),
      city: cleanText(firstValue(row, ['city'])),
      billingState: cleanText(firstValue(row, ['billingState', 'state'])),
      billingPincode: cleanText(firstValue(row, ['billingPincode', 'pincode'])),
      googlePlaceName: cleanText(firstValue(row, ['googlePlaceName'])),
      billingGooglePlaceName: cleanText(firstValue(row, ['billingGooglePlaceName'])),
      shippingAttention: cleanText(firstValue(row, ['shippingAttention'])),
      shippingArea: cleanText(firstValue(row, ['shippingArea'])),
      shippingCity: cleanText(firstValue(row, ['shippingCity'])),
      shippingState: cleanText(firstValue(row, ['shippingState'])),
      shippingPincode: cleanText(firstValue(row, ['shippingPincode'])),
      shippingGooglePlaceName: cleanText(firstValue(row, ['shippingGooglePlaceName'])),
      googlePhone: cleanText(firstValue(row, ['googlePhone'])),
      googleWebsite: cleanText(firstValue(row, ['googleWebsite'])),
      openingBalance: cleanText(formatCurrency(firstValue(row, ['openingBalance', 'opening_balance'])), '-'),
      status: cleanText(firstValue(row, ['status']))
    })
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Export the full lead form fields, follow-ups, and reference details.',
    endpoint: '/api/leads',
    fileName: 'leads-export.csv',
    icon: Database,
    columns: [
      { key: 'leadDate', label: 'Lead Date' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'whatsappNumber', label: 'WhatsApp' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Address' },
      { key: 'areaName', label: 'Area' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'pestIssue', label: 'Pest Issue' },
      { key: 'leadSource', label: 'Lead Source' },
      { key: 'propertyType', label: 'Property Type' },
      { key: 'status', label: 'Status' },
      { key: 'quotationValue', label: 'Quotation Value' },
      { key: 'followupDate', label: 'Follow-up Date' },
      { key: 'assignedTo', label: 'Assigned To' },
      { key: 'referenceCustomerName', label: 'Reference Customer' },
      { key: 'referenceCustomerDate', label: 'Reference Date' },
      { key: 'remarks', label: 'Remarks' }
    ],
    mapRow: (row) => ({
      leadDate: formatDate(firstValue(row, ['leadDate', 'date', 'createdAt'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      mobile: cleanText(firstValue(row, ['mobileNumber', 'mobile', 'phone'])),
      whatsappNumber: cleanText(firstValue(row, ['whatsappNumber'])),
      email: cleanText(firstValue(row, ['emailId', 'email'])),
      address: cleanText(firstValue(row, ['address'])),
      areaName: cleanText(firstValue(row, ['areaName'])),
      city: cleanText(firstValue(row, ['city'])),
      state: cleanText(firstValue(row, ['state'])),
      pincode: cleanText(firstValue(row, ['pincode', 'pinCode', 'postalCode', 'postal_code', 'zip'])),
      pestIssue: cleanText(firstValue(row, ['pestIssue', 'issue'])),
      leadSource: cleanText(firstValue(row, ['leadSource', 'source'])),
      propertyType: cleanText(firstValue(row, ['propertyType', 'customerSegment'])),
      status: cleanText(firstValue(row, ['status', 'leadStatus'])),
      quotationValue: cleanText(String(firstValue(row, ['quotationValue', 'quotation_value']) ?? '').trim(), '-'),
      followupDate: formatDate(firstValue(row, ['followupDate', 'followUpDate'])),
      assignedTo: cleanText(firstValue(row, ['assignedTo'])),
      referenceCustomerName: cleanText(firstValue(row, ['referenceCustomerName', 'referredByCustomerName'])),
      referenceCustomerDate: formatDate(firstValue(row, ['referenceCustomerDate', 'referredByCustomerDate'])),
      remarks: cleanText(firstValue(row, ['remarks', 'notes']))
    })
  },
  {
    key: 'contracts',
    label: 'Contracts',
    description: 'Download the filled contract form details stored with each contract record.',
    endpoint: '/api/invoices',
    fileName: 'contracts-export.csv',
    icon: FileDown,
    columns: [
      { key: 'invoiceDate', label: 'Invoice Date' },
      { key: 'contractNo', label: 'Contract #' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'customerId', label: 'Customer ID' },
      { key: 'invoiceType', label: 'Invoice Type' },
      { key: 'billingAddressSource', label: 'Billing Source' },
      { key: 'shippingAddressSource', label: 'Shipping Source' },
      { key: 'billingAddressText', label: 'Billing Address' },
      { key: 'shippingAddressText', label: 'Shipping Address' },
      { key: 'customerPremise', label: 'Customer Premise' },
      { key: 'premiseLabel', label: 'Premise Label' },
      { key: 'premiseAddress', label: 'Premise Address' },
      { key: 'premiseAreaName', label: 'Premise Area' },
      { key: 'premiseCity', label: 'Premise City' },
      { key: 'premiseState', label: 'Premise State' },
      { key: 'premisePincode', label: 'Premise Pincode' },
      { key: 'servicePeriodStart', label: 'Service Start' },
      { key: 'servicePeriodEnd', label: 'Service End' },
      { key: 'salesperson', label: 'Sales Person' },
      { key: 'subject', label: 'Subject' },
      { key: 'terms', label: 'Terms' },
      { key: 'customerNotes', label: 'Customer Notes' },
      { key: 'termsAndConditions', label: 'Terms & Conditions' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total' },
      { key: 'balanceDue', label: 'Balance Due' },
      { key: 'withholdingType', label: 'Withholding Type' },
      { key: 'withholdingRate', label: 'Withholding Rate' },
      { key: 'withholdingAmount', label: 'Withholding Amount' },
      { key: 'discount', label: 'Discount' },
      { key: 'notes', label: 'Notes' }
    ],
    loadRows: async () => extractRows((await axios.get(`${API_BASE_URL}/api/invoices`)).data),
    mapRow: (row) => ({
      invoiceDate: formatDate(firstValue(row, ['date', 'invoiceDate', 'createdAt'])),
      contractNo: cleanText(firstValue(row, ['invoiceNumber', 'contractNo', 'contractNumber', '_id'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      customerId: cleanText(firstValue(row, ['customerId', 'customer_id'])),
      invoiceType: cleanText(firstValue(row, ['invoiceType', 'invoice_type'])),
      billingAddressSource: cleanText(firstValue(row, ['billingAddressSource', 'billing_address_source'])),
      shippingAddressSource: cleanText(firstValue(row, ['shippingAddressSource', 'shipping_address_source'])),
      billingAddressText: cleanText(firstValue(row, ['billingAddressText', 'billing_address_text'])),
      shippingAddressText: cleanText(firstValue(row, ['shippingAddressText', 'shipping_address_text'])),
      customerPremise: cleanText(firstValue(row, ['customerPremiseId', 'customer_premise_id'])),
      premiseLabel: cleanText(firstValue(row, ['premiseLabel', 'premise_label'])),
      premiseAddress: cleanText(firstValue(row, ['premiseAddress', 'premise_address'])),
      premiseAreaName: cleanText(firstValue(row, ['premiseAreaName', 'premise_area_name'])),
      premiseCity: cleanText(firstValue(row, ['premiseCity', 'premise_city'])),
      premiseState: cleanText(firstValue(row, ['premiseState', 'premise_state'])),
      premisePincode: cleanText(firstValue(row, ['premisePincode', 'premise_pincode'])),
      servicePeriodStart: formatDate(firstValue(row, ['servicePeriodStart', 'contractStartDate', 'service_start_date'])),
      servicePeriodEnd: formatDate(firstValue(row, ['servicePeriodEnd', 'contractEndDate', 'service_end_date', 'dueDate'])),
      salesperson: cleanText(firstValue(row, ['salesperson', 'salesPerson', 'preparedBy'])),
      subject: cleanText(firstValue(row, ['subject'])),
      terms: cleanText(firstValue(row, ['terms'])),
      customerNotes: cleanText(firstValue(row, ['customerNotes'])),
      termsAndConditions: cleanText(firstValue(row, ['termsAndConditions'])),
      status: cleanText(firstValue(row, ['status'])),
      total: cleanText(formatCurrency(firstValue(row, ['total', 'amount'])), '-'),
      balanceDue: cleanText(formatCurrency(firstValue(row, ['balanceDue', 'balance_due'])), '-'),
      withholdingType: cleanText(firstValue(row, ['withholdingType', 'withholding_type'])),
      withholdingRate: cleanText(firstValue(row, ['withholdingRate', 'withholding_rate']), '-'),
      withholdingAmount: cleanText(formatCurrency(firstValue(row, ['withholdingAmount', 'withholding_amount'])), '-'),
      discount: cleanText(formatCurrency(firstValue(row, ['discount'])), '-'),
      notes: cleanText(firstValue(row, ['notes', 'customerNotes', 'termsAndConditions']))
    })
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Export the filled invoice form fields for accounting and reconciliation.',
    endpoint: '/api/invoices',
    fileName: 'invoices-export.csv',
    icon: FileDown,
    columns: [
      { key: 'invoiceDate', label: 'Invoice Date' },
      { key: 'invoiceNumber', label: 'Invoice' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'customerId', label: 'Customer ID' },
      { key: 'invoiceType', label: 'Invoice Type' },
      { key: 'billingAddressSource', label: 'Billing Source' },
      { key: 'shippingAddressSource', label: 'Shipping Source' },
      { key: 'billingAddressText', label: 'Billing Address' },
      { key: 'shippingAddressText', label: 'Shipping Address' },
      { key: 'customerPremiseId', label: 'Customer Premise' },
      { key: 'premiseLabel', label: 'Premise Label' },
      { key: 'premiseAddress', label: 'Premise Address' },
      { key: 'premiseAreaName', label: 'Premise Area' },
      { key: 'premiseCity', label: 'Premise City' },
      { key: 'premiseState', label: 'Premise State' },
      { key: 'premisePincode', label: 'Premise Pincode' },
      { key: 'servicePeriodStart', label: 'Service Start' },
      { key: 'servicePeriodEnd', label: 'Service End' },
      { key: 'salesperson', label: 'Sales Person' },
      { key: 'subject', label: 'Subject' },
      { key: 'customerNotes', label: 'Customer Notes' },
      { key: 'termsAndConditions', label: 'Terms & Conditions' },
      { key: 'status', label: 'Status' },
      { key: 'amount', label: 'Amount' },
      { key: 'balanceDue', label: 'Balance Due' },
      { key: 'withholdingType', label: 'Withholding Type' },
      { key: 'withholdingRate', label: 'Withholding Rate' },
      { key: 'withholdingAmount', label: 'Withholding Amount' },
      { key: 'discount', label: 'Discount' },
      { key: 'serviceScheduleDefaultTime', label: 'Service Time' },
      { key: 'paymentReceivedEnabled', label: 'Payment Received Enabled' },
      { key: 'notes', label: 'Notes' }
    ],
    mapRow: (row) => ({
      invoiceDate: formatDate(firstValue(row, ['invoiceDate', 'date', 'createdAt'])),
      invoiceNumber: cleanText(firstValue(row, ['invoiceNumber', 'invoiceNo', 'invoice_no', '_id'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      customerId: cleanText(firstValue(row, ['customerId', 'customer_id'])),
      invoiceType: cleanText(firstValue(row, ['invoiceType', 'invoice_type'])),
      billingAddressSource: cleanText(firstValue(row, ['billingAddressSource', 'billing_address_source'])),
      shippingAddressSource: cleanText(firstValue(row, ['shippingAddressSource', 'shipping_address_source'])),
      billingAddressText: cleanText(firstValue(row, ['billingAddressText', 'billing_address_text'])),
      shippingAddressText: cleanText(firstValue(row, ['shippingAddressText', 'shipping_address_text'])),
      customerPremiseId: cleanText(firstValue(row, ['customerPremiseId', 'customer_premise_id'])),
      premiseLabel: cleanText(firstValue(row, ['premiseLabel', 'premise_label'])),
      premiseAddress: cleanText(firstValue(row, ['premiseAddress', 'premise_address'])),
      premiseAreaName: cleanText(firstValue(row, ['premiseAreaName', 'premise_area_name'])),
      premiseCity: cleanText(firstValue(row, ['premiseCity', 'premise_city'])),
      premiseState: cleanText(firstValue(row, ['premiseState', 'premise_state'])),
      premisePincode: cleanText(firstValue(row, ['premisePincode', 'premise_pincode'])),
      servicePeriodStart: formatDate(firstValue(row, ['servicePeriodStart', 'contractStartDate', 'service_start_date'])),
      servicePeriodEnd: formatDate(firstValue(row, ['servicePeriodEnd', 'contractEndDate', 'service_end_date', 'dueDate'])),
      salesperson: cleanText(firstValue(row, ['salesperson', 'salesPerson', 'preparedBy'])),
      subject: cleanText(firstValue(row, ['subject'])),
      customerNotes: cleanText(firstValue(row, ['customerNotes'])),
      termsAndConditions: cleanText(firstValue(row, ['termsAndConditions'])),
      dueDate: formatDate(firstValue(row, ['dueDate', 'due_date'])),
      amount: cleanText(formatCurrency(firstValue(row, ['totalAmount', 'grandTotal', 'total', 'amount'])), '-'),
      balanceDue: cleanText(formatCurrency(firstValue(row, ['balanceDue', 'dueAmount'])), '-'),
      withholdingType: cleanText(firstValue(row, ['withholdingType', 'withholding_type'])),
      withholdingRate: cleanText(firstValue(row, ['withholdingRate', 'withholding_rate']), '-'),
      withholdingAmount: cleanText(formatCurrency(firstValue(row, ['withholdingAmount', 'withholding_amount'])), '-'),
      discount: cleanText(formatCurrency(firstValue(row, ['discount'])), '-'),
      status: cleanText(firstValue(row, ['status', 'invoiceStatus'])),
      serviceScheduleDefaultTime: cleanText(firstValue(row, ['serviceScheduleDefaultTime'])),
      paymentReceivedEnabled: String(Boolean(firstValue(row, ['paymentReceivedEnabled']))),
      notes: cleanText(firstValue(row, ['notes', 'customerNotes', 'termsAndConditions']))
    })
  },
  {
    key: 'quotations',
    label: 'Quotations',
    description: 'Export the full quotation form with cover text, terms, and item-free summary fields.',
    endpoint: '/api/quotations',
    fileName: 'quotations-export.csv',
    icon: FileDown,
    columns: [
      { key: 'quotationDate', label: 'Quotation Date' },
      { key: 'quotationNumber', label: 'Quotation' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'address', label: 'Address' },
      { key: 'phone', label: 'Phone' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'email', label: 'Email' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'sourceType', label: 'Source Type' },
      { key: 'leadId', label: 'Lead ID' },
      { key: 'customerId', label: 'Customer ID' },
      { key: 'quotationValidDays', label: 'Validity Days' },
      { key: 'preparedBy', label: 'Prepared By' },
      { key: 'salesPerson', label: 'Sales Person' },
      { key: 'designation', label: 'Designation' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'contractStartDate', label: 'Contract Start' },
      { key: 'contractEndDate', label: 'Contract End' },
      { key: 'rateType', label: 'Rate Type' },
      { key: 'status', label: 'Status' },
      { key: 'subtotalWithoutGst', label: 'Subtotal' },
      { key: 'gstTotal', label: 'GST Total' },
      { key: 'roundOff', label: 'Round Off' },
      { key: 'grandTotal', label: 'Grand Total' },
      { key: 'amountInWords', label: 'Amount in Words' },
      { key: 'openingParagraph', label: 'Opening Paragraph' },
      { key: 'paymentTerms', label: 'Payment Terms' },
      { key: 'warrantyNote', label: 'Warranty Note' },
      { key: 'disclaimer', label: 'Disclaimer' },
      { key: 'closingParagraph', label: 'Closing Paragraph' },
      { key: 'internalNote', label: 'Internal Note' },
      { key: 'itemsCount', label: 'Items Count' }
    ],
    mapRow: (row) => ({
      quotationDate: formatDate(firstValue(row, ['quotationDate', 'date', 'createdAt'])),
      quotationNumber: cleanText(firstValue(row, ['quotationNumber', 'quotation_no', '_id'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      companyName: cleanText(firstValue(row, ['companyName'])),
      address: cleanText(firstValue(row, ['address'])),
      phone: cleanText(firstValue(row, ['phone'])),
      whatsapp: cleanText(firstValue(row, ['whatsapp'])),
      email: cleanText(firstValue(row, ['email'])),
      gstin: cleanText(firstValue(row, ['gstNumber', 'gstin'])),
      sourceType: cleanText(firstValue(row, ['source_type', 'sourceType'])),
      leadId: cleanText(firstValue(row, ['lead_id', 'leadId'])),
      customerId: cleanText(firstValue(row, ['customer_id', 'customerId'])),
      quotationValidDays: cleanText(firstValue(row, ['validity_days', 'validityDays'])),
      preparedBy: cleanText(firstValue(row, ['prepared_by', 'preparedBy'])),
      salesPerson: cleanText(firstValue(row, ['salesPerson', 'preparedBy'])),
      designation: cleanText(firstValue(row, ['designation'])),
      mobile: cleanText(firstValue(row, ['mobile'])),
      contractStartDate: formatDate(firstValue(row, ['contract_start_date', 'contractStartDate'])),
      contractEndDate: formatDate(firstValue(row, ['contract_end_date', 'contractEndDate'])),
      rateType: cleanText(firstValue(row, ['rate_type', 'rateType'])),
      status: cleanText(firstValue(row, ['status'])),
      subtotalWithoutGst: cleanText(formatCurrency(firstValue(row, ['subtotal_without_gst', 'subtotalWithoutGst'])), '-'),
      gstTotal: cleanText(formatCurrency(firstValue(row, ['gst_total', 'gstTotal'])), '-'),
      roundOff: cleanText(formatCurrency(firstValue(row, ['round_off', 'roundOff'])), '-'),
      grandTotal: cleanText(formatCurrency(firstValue(row, ['grandTotal', 'totalAmount', 'total'])), '-'),
      amountInWords: cleanText(firstValue(row, ['amount_in_words', 'amountInWords'])),
      openingParagraph: cleanText(firstValue(row, ['opening_paragraph', 'openingParagraph'])),
      paymentTerms: cleanText(firstValue(row, ['payment_terms', 'paymentTerms'])),
      warrantyNote: cleanText(firstValue(row, ['warranty_note', 'warrantyNote'])),
      disclaimer: cleanText(firstValue(row, ['disclaimer', 'disclaimerParagraph'])),
      closingParagraph: cleanText(firstValue(row, ['closing_paragraph', 'closingParagraph'])),
      internalNote: cleanText(firstValue(row, ['internal_note', 'internalNote'])),
      itemsCount: String(Array.isArray(row?.items) ? row.items.length : toNum(row?.itemsCount || 0))
    })
  },
  {
    key: 'vendors',
    label: 'Vendors',
    description: 'Download the full vendor master form with billing and shipping details.',
    endpoint: '/api/vendors',
    fileName: 'vendors-export.csv',
    icon: Database,
    columns: [
      { key: 'vendorName', label: 'Vendor Name' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'contactPersonName', label: 'Contact Person' },
      { key: 'mobileNumber', label: 'Mobile' },
      { key: 'whatsappNumber', label: 'WhatsApp' },
      { key: 'emailId', label: 'Email' },
      { key: 'gstNumber', label: 'GST Number' },
      { key: 'billingAddress', label: 'Billing Address' },
      { key: 'billingArea', label: 'Billing Area' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'shippingAddress', label: 'Shipping Address' },
      { key: 'shippingArea', label: 'Shipping Area' },
      { key: 'shippingState', label: 'Shipping State' },
      { key: 'googlePlaceName', label: 'Google Place' },
      { key: 'googlePhone', label: 'Google Phone' },
      { key: 'googleWebsite', label: 'Google Website' },
      { key: 'openingBalance', label: 'Opening Balance' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      vendorName: cleanText(firstValue(row, ['vendorName', 'displayName'])),
      companyName: cleanText(firstValue(row, ['companyName'])),
      contactPersonName: cleanText(firstValue(row, ['contactPersonName'])),
      mobileNumber: cleanText(firstValue(row, ['mobileNumber', 'mobile'])),
      whatsappNumber: cleanText(firstValue(row, ['whatsappNumber'])),
      emailId: cleanText(firstValue(row, ['emailId', 'email'])),
      gstNumber: cleanText(firstValue(row, ['gstNumber'])),
      billingAddress: cleanText(firstValue(row, ['billingAddress', 'address'])),
      billingArea: cleanText(firstValue(row, ['billingArea', 'areaName'])),
      city: cleanText(firstValue(row, ['city'])),
      state: cleanText(firstValue(row, ['state'])),
      shippingAddress: cleanText(firstValue(row, ['shippingAddress'])),
      shippingArea: cleanText(firstValue(row, ['shippingArea'])),
      shippingState: cleanText(firstValue(row, ['shippingState'])),
      googlePlaceName: cleanText(firstValue(row, ['googlePlaceName'])),
      googlePhone: cleanText(firstValue(row, ['googlePhone'])),
      googleWebsite: cleanText(firstValue(row, ['googleWebsite'])),
      openingBalance: cleanText(formatCurrency(firstValue(row, ['openingBalance', 'opening_balance'])), '-'),
      status: cleanText(firstValue(row, ['status']))
    })
  },
  {
    key: 'vendorBills',
    label: 'Vendor Bills',
    description: 'Export the vendor bill form with amounts, notes, and balance details.',
    endpoint: '/api/vendor-bills',
    fileName: 'vendor-bills-export.csv',
    icon: Database,
    columns: [
      { key: 'billDate', label: 'Date' },
      { key: 'billNumber', label: 'Bill #' },
      { key: 'vendorName', label: 'Vendor Name' },
      { key: 'notes', label: 'Notes' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'taxAmount', label: 'Tax' },
      { key: 'totalAmount', label: 'Total' },
      { key: 'balanceDue', label: 'Balance Due' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      billDate: formatDate(firstValue(row, ['billDate', 'date', 'createdAt'])),
      billNumber: cleanText(firstValue(row, ['billNumber', 'bill_no', '_id'])),
      vendorName: cleanText(firstValue(row, ['vendorName'])),
      notes: cleanText(firstValue(row, ['notes'])),
      dueDate: formatDate(firstValue(row, ['dueDate', 'due_date'])),
      subtotal: cleanText(formatCurrency(firstValue(row, ['subtotal'])), '-'),
      taxAmount: cleanText(formatCurrency(firstValue(row, ['taxAmount', 'tax_amount'])), '-'),
      totalAmount: cleanText(formatCurrency(firstValue(row, ['totalAmount', 'grandTotal'])), '-'),
      balanceDue: cleanText(formatCurrency(firstValue(row, ['balanceDue'])), '-'),
      status: cleanText(firstValue(row, ['status']))
    })
  },
  {
    key: 'payments',
    label: 'Payments Received',
    description: 'Download the payment receipt form entries and linked invoice details.',
    endpoint: '/api/payment-received',
    fileName: 'payments-received-export.csv',
    icon: Database,
    columns: [
      { key: 'paymentDate', label: 'Date' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'invoiceNo', label: 'Invoice' },
      { key: 'paymentMode', label: 'Payment Mode' },
      { key: 'depositTo', label: 'Deposit To' },
      { key: 'referenceNumber', label: 'Reference #' },
      { key: 'amount', label: 'Amount' },
      { key: 'notes', label: 'Notes' }
    ],
    mapRow: (row) => ({
      paymentDate: formatDate(firstValue(row, ['paymentDate', 'date', 'createdAt'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      invoiceNo: cleanText(firstValue(row, ['invoiceNo', 'invoiceNumber'])),
      paymentMode: cleanText(firstValue(row, ['paymentMode', 'mode'])),
      depositTo: cleanText(firstValue(row, ['depositTo', 'deposit_to'])),
      referenceNumber: cleanText(firstValue(row, ['referenceNumber', 'referenceNo'])),
      amount: cleanText(formatCurrency(firstValue(row, ['amount'])), '-'),
      notes: cleanText(firstValue(row, ['notes', 'note']))
    })
  },
  {
    key: 'renewals',
    label: 'Renewals',
    description: 'Export the renewal form details including due dates and assignees.',
    endpoint: '/api/renewals',
    fileName: 'renewals-export.csv',
    icon: FileDown,
    columns: [
      { key: 'renewalId', label: 'Renewal #' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Address' },
      { key: 'areaName', label: 'Area' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'previousContractStart', label: 'Previous Start' },
      { key: 'previousContractEnd', label: 'Previous End' },
      { key: 'renewalDueDate', label: 'Renewal Due Date' },
      { key: 'previousAmount', label: 'Previous Amount' },
      { key: 'status', label: 'Status' },
      { key: 'proposedAmount', label: 'Proposed Amount' },
      { key: 'assignedSalesPersonName', label: 'Assigned Sales' },
      { key: 'renewedBySalesPersonName', label: 'Renewed By' },
      { key: 'lastFollowupNote', label: 'Last Follow-up Note' }
    ],
    mapRow: (row) => ({
      renewalId: cleanText(firstValue(row, ['renewalDisplayId', 'renewalId', '_id'])),
      customerName: cleanText(firstValue(row, ['customerName', 'displayName'])),
      mobile: cleanText(firstValue(row, ['mobile'])),
      email: cleanText(firstValue(row, ['email'])),
      address: cleanText(firstValue(row, ['address'])),
      areaName: cleanText(firstValue(row, ['areaName'])),
      serviceType: cleanText(firstValue(row, ['serviceType'])),
      previousContractStart: formatDate(firstValue(row, ['previousContractStart', 'contractStartDate'])),
      previousContractEnd: formatDate(firstValue(row, ['previousContractEnd', 'contractEndDate'])),
      renewalDueDate: formatDate(firstValue(row, ['renewalDueDate', 'dueDate'])),
      previousAmount: cleanText(formatCurrency(firstValue(row, ['previousAmount'])), '-'),
      status: cleanText(firstValue(row, ['status'])),
      proposedAmount: cleanText(formatCurrency(firstValue(row, ['proposedAmount'])), '-'),
      assignedSalesPersonName: cleanText(firstValue(row, ['assignedSalesPersonName'])),
      renewedBySalesPersonName: cleanText(firstValue(row, ['renewedBySalesPersonName'])),
      lastFollowupNote: cleanText(firstValue(row, ['lastFollowupNote']))
    })
  },
  {
    key: 'items',
    label: 'Items',
    description: 'Download the item master form fields used across stock and service modules.',
    endpoint: '/api/items',
    fileName: 'items-export.csv',
    icon: Database,
    columns: [
      { key: 'itemName', label: 'Item Name' },
      { key: 'category', label: 'Category' },
      { key: 'itemType', label: 'Type' },
      { key: 'aboutPest', label: 'About Pest' },
      { key: 'pestsCovered', label: 'Pests Covered' },
      { key: 'serviceDescription', label: 'Service Description' },
      { key: 'frequency', label: 'Frequency' },
      { key: 'whatWeDo', label: 'What We Do' },
      { key: 'unit', label: 'Unit' },
      { key: 'hsnSac', label: 'HSN/SAC' },
      { key: 'rate', label: 'Rate' },
      { key: 'purchaseDescription', label: 'Purchase Description' },
      { key: 'purchaseRate', label: 'Purchase Rate' },
      { key: 'status', label: 'Status' }
    ],
    mapRow: (row) => ({
      itemName: cleanText(firstValue(row, ['itemName', 'name'])),
      category: cleanText(firstValue(row, ['category', 'itemCategory'])),
      itemType: cleanText(firstValue(row, ['itemType'])),
      aboutPest: cleanText(firstValue(row, ['aboutPest'])),
      pestsCovered: cleanText(firstValue(row, ['pestsCovered'])),
      serviceDescription: cleanText(firstValue(row, ['serviceDescription'])),
      frequency: cleanText(firstValue(row, ['frequency'])),
      whatWeDo: cleanText(firstValue(row, ['whatWeDo'])),
      unit: cleanText(firstValue(row, ['unit'])),
      hsnSac: cleanText(firstValue(row, ['hsnSac', 'sac'])),
      rate: cleanText(formatCurrency(firstValue(row, ['rate'])), '-'),
      purchaseDescription: cleanText(firstValue(row, ['purchaseDescription'])),
      purchaseRate: cleanText(formatCurrency(firstValue(row, ['purchaseRate'])), '-'),
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
              ) : null}
            </AppCard>
          );
        })}
      </section>
    </div>
  );
}
