import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useColumnResize from './table/useColumnResize';
import PdfPreviewModal from './PdfPreviewModal';
import WhatsAppPreviewModal from './whatsapp/WhatsAppPreviewModal';
import ActionMenu from './ui/ActionMenu';
import { consumeRenewalsFocus, subscribeRenewalsRefresh, triggerContractsRefresh } from '../pages/sales-performance/salesPerformanceApi';
import { getPortalUser, getPortalUserId, getPortalUserName, getPortalUserRole } from '../utils/portalAuth';
import { formatIndianMobileNumber, normalizeIndianMobileNumber } from '../utils/phone';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MessageCircleMore,
  Phone,
  RefreshCw,
  Search,
  XCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const RENEWAL_PAGE_SIZE = 20;
const RENEWAL_DASHBOARD_CACHE_KEY = 'renewal_dashboard_cache_v1';
const statuses = [
  { value: 'All', label: 'All' },
  { value: 'Not Due', label: 'Not Due' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Due', label: 'Due' },
  { value: 'Follow-up', label: 'Follow-up' },
  { value: 'Overdue', label: 'Overdue' },
  { value: 'Renewed', label: 'Won' },
  { value: 'Declined', label: 'Lost' }
];
const relationshipTypes = [
  { value: 'All', label: 'All Contracts' },
  { value: 'CONTRACT', label: 'Contracts' },
  { value: 'ONE_TIME', label: 'Jobbing' },
  { value: 'RECURRING', label: 'Recurring Review' },
  { value: 'NEEDS_REVIEW', label: 'Needs Review' }
];
const durationFilters = [
  { value: '', label: 'All Durations' },
  { value: '1_year', label: '1 Year' },
  { value: '2_years', label: '2 Years' },
  { value: 'over_2_years', label: '>2 Years' }
];
const ranges = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'threeMonths', label: 'Coming 3 Months' },
  { value: 'nextMonth', label: 'Next Month' },
  { value: 'custom', label: 'Custom Month' },
  { value: 'year', label: 'Year Wise' }
];
const searchScopes = [
  { value: 'all', label: 'All Fields' },
  { value: 'customer', label: 'Customer' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'service', label: 'Service' },
  { value: 'salesPerson', label: 'Sales Person' },
  { value: 'status', label: 'Status' },
  { value: 'renewalId', label: 'Renewal ID' },
  { value: 'followup', label: 'Follow-up Note' }
];
const tabs = ['Renewals', 'Renewal Letters', 'Upcoming', 'Overdue', 'Won', 'Lost', 'Jobbing', 'Reports', 'Needs Review'];
const renewalTableTabs = ['Renewals', 'Upcoming', 'Overdue', 'Won', 'Lost', 'Jobbing', 'Needs Review'];
const jobbingContractPeriods = new Set(['single_time', 'single_time_plus_7', 'single_time_plus_10']);
const renewalColumns = [
  { key: 'customer', label: 'Customer' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'svc', label: 'Service' },
  { key: 'period', label: 'Period' },
  { key: 'amount', label: 'Amount' },
  { key: 'salesPerson', label: 'Sales' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' }
];
const renewalDefaultWidths = {
  customer: 210,
  mobile: 110,
  svc: 280,
  period: 200,
  amount: 100,
  salesPerson: 140,
  status: 90,
  actions: 156
};
const renewalColumnBounds = {
  customer: { min: 180, max: 360 },
  mobile: { min: 100, max: 160 },
  svc: { min: 260, max: 480 },
  period: { min: 190, max: 260 },
  amount: { min: 100, max: 160 },
  salesPerson: { min: 130, max: 220 },
  status: { min: 90, max: 150 },
  actions: { min: 156, max: 190 }
};

const shell = {
  page: { display: 'grid', gap: 12, fontFamily: 'var(--font-sans)' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: 0, color: 'var(--text-primary)' },
  subtitle: { margin: '4px 0 0', color: 'var(--color-muted)', fontSize: 13, fontWeight: 650 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' },
  primaryBtn: { minHeight: 34, height: 34, border: 'none', borderRadius: 9, padding: '0 12px', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' },
  ghostBtn: { minHeight: 34, height: 34, border: '1px solid var(--border)', borderRadius: 9, padding: '0 12px', background: 'var(--surface-card-elevated)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' },
  dangerBtn: { minHeight: 34, border: '1px solid color-mix(in srgb, var(--color-danger) 34%, var(--color-border))', borderRadius: 9, padding: '0 12px', background: 'color-mix(in srgb, var(--color-danger) 12%, var(--surface-card))', color: 'var(--color-danger)', fontSize: 12, fontWeight: 800, cursor: 'pointer' },
  panel: { border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--surface-card)', overflow: 'hidden', boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)' },
  panelPad: { padding: 12 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, justifyContent: 'stretch', alignItems: 'stretch' },
  stat: { border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 14px', background: 'var(--surface-card-elevated)', minHeight: 96, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, minWidth: 0, outline: 'none', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' },
  statLabel: { width: '100%', textAlign: 'left', fontSize: 11, lineHeight: 1.25, textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 800, letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', cursor: 'pointer' },
  statValue: { width: '100%', textAlign: 'left', marginTop: 0, fontSize: 24, lineHeight: 1.05, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statMeta: { marginTop: 0, fontSize: 12, lineHeight: 1.35, fontWeight: 700, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(8, minmax(120px, 1fr))', gap: 8, alignItems: 'end' },
  field: { display: 'grid', gap: 3 },
  label: { fontSize: 11, lineHeight: 1.1, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: '0.01em', textTransform: 'uppercase' },
  input: { width: '100%', minHeight: 34, height: 34, border: '1px solid var(--color-border)', borderRadius: 11, background: 'var(--surface-card-elevated)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, padding: '0 10px', boxSizing: 'border-box' },
  tabs: { display: 'flex', gap: 6, padding: 8, overflowX: 'auto', borderBottom: '1px solid var(--card-header-border)', background: 'var(--table-header-bg)' },
  tabsMobile: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: 10, overflowX: 'visible', borderBottom: '1px solid var(--card-header-border)', background: 'var(--table-header-bg)' },
  tab: { flex: '0 0 auto', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--surface-card-elevated)', color: 'var(--text-primary)', minHeight: 30, padding: '0 10px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.10)' },
  tabMobile: { width: '100%', minHeight: 44, padding: '8px 10px', whiteSpace: 'normal', lineHeight: 1.2, textAlign: 'center', justifyContent: 'center' },
  activeTab: { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)', fontWeight: 900, boxShadow: '0 0 0 2px var(--color-primary-soft), 0 4px 10px rgba(15, 23, 42, 0.22)' },
  tableWrap: { width: '100%', overflowX: 'auto', overflowY: 'hidden' },
  table: { width: '100%', minWidth: 1080, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  th: { textAlign: 'left', padding: '8px 7px', fontSize: 11, color: 'var(--table-header-text)', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', background: 'var(--table-header-bg)', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', letterSpacing: '0.03em', lineHeight: 1.25, minHeight: '42px', height: 'auto', textShadow: '0 1px 1px rgba(15, 23, 42, 0.25)' },
  td: { padding: '7px', fontSize: 11.5, color: 'var(--text-primary)', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 },
  rowActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 5, flexWrap: 'nowrap' },
  iconBtn: { width: 30, height: 30, minWidth: 30, minHeight: 30, padding: 0, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-card-elevated)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  status: { display: 'inline-flex', alignItems: 'center', minHeight: 24, borderRadius: 999, padding: '0 8px', fontSize: 11, fontWeight: 850 },
  chartGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 },
  miniRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 64px minmax(92px, auto)', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 12 },
  letterTable: { width: '100%', minWidth: 860, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  letterCustomerCell: { width: '22%' },
  letterServiceCell: { width: '17%' },
  letterDateCell: { width: '12%' },
  letterPeriodCell: { width: '21%', textAlign: 'center' },
  letterAmountCell: { width: '11%', textAlign: 'center' },
  letterPdfCell: { width: '8%', textAlign: 'center' },
  letterActionsCell: { width: 160, textAlign: 'left' },
  modalOverlay: { position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', padding: 14 },
  modal: { width: 'min(760px, 96vw)', maxHeight: '92vh', background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 24px 70px rgba(2,6,23,0.34)', overflow: 'hidden', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)' },
  modalHead: { minHeight: 64, height: 64, boxSizing: 'border-box', padding: '0 28px', borderBottom: '1px solid var(--card-header-border)', background: 'var(--card-header-bg)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 24, fontWeight: 800 },
  modalBody: { padding: 18, display: 'grid', gap: 12, overflowY: 'auto', background: 'var(--surface-card)', color: 'var(--text-primary)' },
  modalCloseBtn: { width: 40, height: 40, minWidth: 40, minHeight: 40, padding: 0, border: '1px solid rgba(255,255,255,0.34)', borderRadius: 10, background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 22, lineHeight: 1, boxShadow: '0 1px 0 rgba(255,255,255,0.12) inset' },
  mobileCard: { border: '1px solid var(--color-border)', borderRadius: 10, padding: 10, display: 'grid', gap: 8, background: 'var(--surface-card)' },
  mobileMeta: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--color-muted)' },
  mobileCustomerStack: { display: 'grid', gap: 2, alignItems: 'start', minWidth: 0 },
  mobileCustomerName: { margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' },
  mobileCustomerMobile: { fontSize: 12, color: 'var(--color-muted)', fontWeight: 700, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  searchRow: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  searchBox: { width: 'min(100%, 420px)', justifySelf: 'center' },
  searchWrap: { position: 'relative', display: 'block', alignItems: 'center', minWidth: 0, width: '100%', maxWidth: '100%', justifySelf: 'center' },
  searchIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' },
  pagination: { padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'var(--table-footer-bg)', color: 'var(--table-footer-text)' },
  paginationInfo: { color: 'var(--table-footer-text)', fontSize: 12, fontWeight: 700 },
  paginationActions: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  paginationBtn: { width: 34, minWidth: 34, minHeight: 32, height: 32, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--surface-card-elevated)', color: 'var(--color-primary)', padding: 0, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  paginationBtnDisabled: { opacity: 0.48, cursor: 'not-allowed' }
};

const formatDate = (value) => {
  if (!value) return '-';
  const raw = String(value).slice(0, 10);
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (parts) return `${parts[3]}/${parts[2]}/${parts[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN');
};
const formatINR = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '₹0';
  const formatted = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₹${formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted}`;
};
const numericAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};
const toDateInput = (value) => {
  if (!value) return '';
  const raw = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};
const parseDateInput = (value) => {
  const input = toDateInput(value);
  if (!input) return null;
  const parsed = new Date(`${input}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const todayInput = () => new Date().toISOString().slice(0, 10);
const addMonthsDate = (date, months) => {
  const source = date instanceof Date ? date : new Date(`${todayInput()}T00:00:00`);
  const target = new Date(source.getFullYear(), source.getMonth() + Number(months || 0), 1);
  return target;
};
const isSameMonth = (left, right) => (
  left instanceof Date &&
  right instanceof Date &&
  !Number.isNaN(left.getTime()) &&
  !Number.isNaN(right.getTime()) &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth()
);
const renewalDateValue = (row) => (
  row?.renewalDueDate ||
  row?.previousContractEnd ||
  row?.contractEndDate ||
  row?.concludeDate ||
  row?.conclude_date ||
  row?.renewalDate ||
  ''
);
const rowStatusText = (row) => String(row?.status || row?.renewalStatus || row?.renewal_status || '').trim();
const rowOutcomeText = (row) => String(row?.renewalOutcome || row?.renewal_outcome || '').trim().toUpperCase();
const isWonRenewal = (row) => rowOutcomeText(row) === 'WON' || ['Renewed', 'Done', 'Won'].includes(rowStatusText(row));
const isLostRenewal = (row) => rowOutcomeText(row) === 'LOST' || ['Declined', 'Lost'].includes(rowStatusText(row));
const isPendingRenewal = (row) => !isWonRenewal(row) && !isLostRenewal(row);
const displayStatusLabel = (status) => {
  if (status === 'Renewed' || status === 'Done') return 'Won';
  if (status === 'Declined') return 'Lost';
  return status || 'Pending';
};
const renewalAmountValue = (row) => (
  row?.agreedContractAmount ||
  row?.finalRenewalAmount ||
  row?.proposedAmount ||
  row?.previousContractAmount ||
  row?.previousAmount ||
  row?.contractAmount ||
  row?.amount ||
  0
);
const renewalOldAmountValue = (row) => (
  row?.previousContractAmount ||
  row?.previousAmount ||
  row?.contractAmount ||
  row?.proposedAmount ||
  0
);
const renewalNewAmountValue = (row) => (
  row?.agreedContractAmount ||
  row?.finalRenewalAmount ||
  row?.amount ||
  0
);
const wonContractStartValue = (row) => (
  row?.newContractStartDate ||
  row?.new_contract_start_date ||
  row?.contractStartDate ||
  row?.contract_start_date ||
  fallbackWonContractStartValue(row)
);
const wonContractEndValue = (row) => (
  row?.newContractEndDate ||
  row?.new_contract_end_date ||
  row?.contractEndDate ||
  row?.contract_end_date ||
  fallbackWonContractEndValue(row)
);
const wonContractIdValue = (row) => (
  row?.newContractId ||
  row?.new_contract_id ||
  row?.convertedContractId ||
  row?.converted_contract_id ||
  ''
);
const isLetterRow = (row) => Boolean(row?.renewalLetterUrl || row?.pdf_url);
const isJobbingRow = (row) => {
  const period = String(row?.contractPeriod || row?.contract_period || '').trim().toLowerCase();
  const serviceType = String(row?.serviceType || row?.service_type || '').trim().toLowerCase();
  const sourceItems = Array.isArray(row?.sourceInvoiceItems) ? row.sourceInvoiceItems : [];
  return row?.serviceRelationshipType === 'ONE_TIME' ||
    jobbingContractPeriods.has(period) ||
    /single\s*time/.test(period) ||
    /single\s*time/.test(serviceType) ||
    sourceItems.some((item) => jobbingContractPeriods.has(String(item?.contractPeriod || item?.contract_period || '').trim().toLowerCase()));
};
const isReviewRow = (row) => (
  row?.serviceRelationshipType === 'NEEDS_REVIEW' ||
  row?.serviceRelationshipType === 'RECURRING' ||
  (!isJobbingRow(row) && row?.serviceRelationshipType !== 'CONTRACT') ||
  (!isJobbingRow(row) && row?.serviceRelationshipType !== 'ONE_TIME' && !row?.renewalEligible)
);
const isRenewalContractSummaryRow = (row) => {
  if (isJobbingRow(row)) return false;
  if (isLetterRow(row)) return row?.serviceRelationshipType !== 'ONE_TIME';
  return row?.serviceRelationshipType === 'CONTRACT' && row?.renewalEligible && !isReviewRow(row);
};
const addMonthsClampedInput = (date, months) => {
  const source = new Date(`${date}T00:00:00`);
  if (Number.isNaN(source.getTime())) return '';
  const day = source.getDate();
  const target = new Date(source.getFullYear(), source.getMonth() + Number(months || 0), 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
};
const addDaysInput = (date, days) => {
  const source = new Date(`${date}T00:00:00`);
  if (Number.isNaN(source.getTime())) return '';
  source.setDate(source.getDate() + Number(days || 0));
  return source.toISOString().slice(0, 10);
};
const calculateContractEndInput = (startDate, durationValue, durationUnit) => {
  const start = toDateInput(startDate);
  if (!start) return '';
  const value = Math.max(1, Number(durationValue || 1) || 1);
  const unit = String(durationUnit || 'MONTH').toUpperCase();
  if (unit === 'DAY') return addDaysInput(start, value - 1);
  const months = unit === 'YEAR' ? value * 12 : value;
  return addDaysInput(addMonthsClampedInput(start, months), -1);
};
const fallbackWonContractStartValue = (row) => {
  const previousEnd = toDateInput(row?.previousContractEnd || row?.previous_contract_end || row?.renewalDueDate || row?.renewal_due_date);
  return previousEnd ? addDaysInput(previousEnd, 1) : '';
};
const fallbackWonContractEndValue = (row) => {
  const start = fallbackWonContractStartValue(row);
  if (!start) return '';
  return calculateContractEndInput(start, row?.contractDurationValue || row?.contract_duration_value || 12, row?.contractDurationUnit || row?.contract_duration_unit || 'MONTH');
};
const normalizeSummaryPayload = (payload = {}) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  if (!source.filtered && !source.global) return source;
  return {
    ...(source.filtered || {}),
    filtered: source.filtered || {},
    global: source.global || {},
    summaryScope: source.summaryScope || 'filtered'
  };
};
const hasAmount = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const hasNumericValue = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const formatOptionalINR = (value) => (hasAmount(value) ? formatINR(value) : '-');
const contractDurationText = (row) => {
  const value = Number(row?.contractDurationValue || 0);
  const unit = String(row?.contractDurationUnit || '').trim();
  if (!value || !unit) return '-';
  const label = unit === 'YEAR' ? 'Year' : unit === 'MONTH' ? 'Month' : 'Day';
  return `${value} ${label}${value === 1 ? '' : 's'}`;
};
const serviceProgressText = (row) => {
  const hasCompleted = hasNumericValue(row?.completedServiceVisits);
  const hasTotal = hasNumericValue(row?.totalServiceVisits) && Number(row.totalServiceVisits) > 0;
  const next = formatDate(row?.nextServiceDate);
  const parts = [];
  if (hasCompleted && hasTotal) parts.push(`${Number(row.completedServiceVisits)}/${Number(row.totalServiceVisits)} visits`);
  if (next !== '-') parts.push(`Next ${next}`);
  return parts.join(' • ') || '-';
};
const normalizeSearchText = (value) => String(value || '').toLowerCase().trim();
const serviceShort = (value) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  const known = {
    'cockroach control': 'CC',
    'termite control': 'TC',
    'general pest control': 'GPC',
    'rodent control': 'RC',
    'bed bug control': 'BBC',
    'mosquito control': 'MC',
    'wood borer control': 'WBC'
  };
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  if (known[normalized]) return known[normalized];
  return text
    .split(/[\s/&+-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
};
const statusStyle = (status) => {
  const map = {
    Done: ['color-mix(in srgb, var(--color-success) 16%, var(--surface-card))', 'var(--color-success)'],
    Renewed: ['color-mix(in srgb, var(--color-success) 16%, var(--surface-card))', 'var(--color-success)'],
    Won: ['color-mix(in srgb, var(--color-success) 16%, var(--surface-card))', 'var(--color-success)'],
    Declined: ['color-mix(in srgb, var(--color-danger) 14%, var(--surface-card))', 'var(--color-danger)'],
    Lost: ['color-mix(in srgb, var(--color-danger) 14%, var(--surface-card))', 'var(--color-danger)'],
    Overdue: ['color-mix(in srgb, var(--color-warning) 18%, var(--surface-card))', 'var(--color-warning)'],
    'Follow-up': ['color-mix(in srgb, var(--color-primary) 14%, var(--surface-card))', 'var(--color-primary)'],
    Upcoming: ['color-mix(in srgb, var(--color-primary) 12%, var(--surface-card))', 'var(--color-primary)'],
    Due: ['color-mix(in srgb, var(--color-warning) 14%, var(--surface-card))', 'var(--color-warning)'],
    'Not Due': ['color-mix(in srgb, var(--color-muted) 12%, var(--surface-card))', 'var(--color-muted)'],
    Pending: ['color-mix(in srgb, var(--color-muted) 12%, var(--surface-card))', 'var(--color-muted)']
  };
  const [bg, color] = map[status] || map.Pending;
  return { ...shell.status, background: bg, color };
};
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: 'all', label: 'All' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(currentYear, i, 1).toLocaleString('en-IN', { month: 'short' }) }))
];
const getRenewalSearchText = (row) => [
  row?.customerName,
  row?.mobile,
  row?.areaName,
  row?.address,
  row?.serviceType,
  row?.assignedSalesPersonName,
  row?.status,
  row?.renewalId,
  row?.renewalDisplayId,
  row?.contractId,
  row?.invoiceNumber,
  row?.lastFollowupNote,
  row?.followupDate
].map((part) => String(part || '').trim()).filter(Boolean).join(' ').toLowerCase();

const readRenewalDashboardCache = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(RENEWAL_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const mergeRenewalDashboardCache = (patch) => {
  try {
    if (typeof window === 'undefined') return;
    const current = readRenewalDashboardCache() || {};
    window.sessionStorage.setItem(RENEWAL_DASHBOARD_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best effort only.
  }
};

export default function RenewalDashboard() {
  const navigate = useNavigate();
  const autoSyncAttempted = useRef(false);
  const renewalRowRefs = useRef(new Map());
  const focusHighlightTimerRef = useRef(null);
  const [cachedDashboard] = useState(() => readRenewalDashboardCache());
  const [rows, setRows] = useState(() => Array.isArray(cachedDashboard?.rows) ? cachedDashboard.rows : []);
  const [summary, setSummary] = useState(() => (cachedDashboard?.summary && typeof cachedDashboard.summary === 'object' ? cachedDashboard.summary : {}));
  const [employees, setEmployees] = useState(() => Array.isArray(cachedDashboard?.employees) ? cachedDashboard.employees : []);
  const [letters, setLetters] = useState(() => Array.isArray(cachedDashboard?.letters) ? cachedDashboard.letters : []);
  const [auditSummary, setAuditSummary] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [selectedAuditIds, setSelectedAuditIds] = useState([]);
  const [highlightedRenewalId, setHighlightedRenewalId] = useState('');
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [loading, setLoading] = useState(() => !cachedDashboard);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState({ type: '', row: null });
  const [form, setForm] = useState({});
  const [existingLinks, setExistingLinks] = useState({ loading: false, error: '', candidates: [], search: '' });
  const [existingLinksReload, setExistingLinksReload] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const [pdfPreview, setPdfPreview] = useState({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', renewalId: '', shareContext: null });
  const [whatsappComposer, setWhatsappComposer] = useState({ open: false, row: null, previewData: null, recipientName: '', recipientPhone: '', recipientType: 'Customer' });
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 760);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    range: 'custom',
    month: 'all',
    year: currentYear,
    fromDate: '',
    toDate: '',
    status: 'All',
    relationshipType: 'All',
    duration: '',
    assignedSalesPersonId: '',
    searchScope: 'all',
    search: ''
  });
  const loadRequestRef = useRef(0);
  const initialSearchSyncRef = useRef(true);
  const initialFilterSyncRef = useRef(true);
  const skipNextSearchSyncRef = useRef(false);
  const toastTimerRef = useRef(null);

  const showToast = (text) => {
    const messageText = String(text || '').trim();
    if (!messageText) return;
    setToastMessage(messageText);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, 3500);
  };

  const registerRenewalRowRef = (renewalId) => (node) => {
    const key = String(renewalId || '').trim();
    if (!key) return;
    if (node) {
      renewalRowRefs.current.set(key, node);
    } else {
      renewalRowRefs.current.delete(key);
    }
  };

  useEffect(() => () => {
    if (focusHighlightTimerRef.current) {
      window.clearTimeout(focusHighlightTimerRef.current);
      focusHighlightTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const applyFocusHint = () => {
      const focus = consumeRenewalsFocus();
      const focusRenewalId = String(focus?.renewalId || '').trim();
      if (!focusRenewalId) return;
      setHighlightedRenewalId(focusRenewalId);
      setActiveTab('Renewals');
    };

    const onFocusEvent = () => {
      applyFocusHint();
    };

    applyFocusHint();
    window.addEventListener('renewals:focus', onFocusEvent);
    return () => window.removeEventListener('renewals:focus', onFocusEvent);
  }, []);

  useEffect(() => {
    if (!highlightedRenewalId || loading || rows.length === 0) return;
    const rowIndex = rows.findIndex((row) => String(row?.renewalId || '').trim() === String(highlightedRenewalId).trim());
    if (rowIndex < 0) return;

    const targetPage = Math.floor(rowIndex / RENEWAL_PAGE_SIZE) + 1;
    if (page !== targetPage) {
      setPage(targetPage);
      return;
    }

    const timer = window.setTimeout(() => {
      const rowNode = renewalRowRefs.current.get(highlightedRenewalId);
      if (rowNode?.scrollIntoView) {
        rowNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      if (focusHighlightTimerRef.current) {
        window.clearTimeout(focusHighlightTimerRef.current);
      }
      focusHighlightTimerRef.current = window.setTimeout(() => {
        setHighlightedRenewalId('');
        focusHighlightTimerRef.current = null;
      }, 2200);
    }, 90);

    return () => window.clearTimeout(timer);
  }, [highlightedRenewalId, rows, page, loading]);

  const sortedLetters = useMemo(() => {
    const toLetterDateValue = (letter) => {
      const raw = letter?.conclude_date || letter?.concludeDate || letter?.generated_at || letter?.generatedAt || '';
      const date = raw ? new Date(raw) : null;
      return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
    };
    return [...(letters || [])].sort((a, b) => {
      const left = toLetterDateValue(a);
      const right = toLetterDateValue(b);
      if (left === right) return String(a.customer_name || '').localeCompare(String(b.customer_name || ''));
      return left - right;
    });
  }, [letters]);
  const visibleLetterRows = useMemo(() => {
    const merged = new Map();
    const addRow = (row) => {
      const renewalId = String(row?.renewalId || row?.renewal_id || row?.renewal_id || row?.id || '').trim();
      if (!renewalId) return;
      const pdfUrl = String(row?.pdf_url || row?.renewalLetterUrl || '').trim();
      const concludeDate = row?.conclude_date || row?.concludeDate || row?.previousContractEnd || row?.renewalDueDate || '';
      const next = {
        ...row,
        renewalId,
        renewal_id: renewalId,
        serviceRelationshipType: row?.serviceRelationshipType || row?.service_relationship_type || 'CONTRACT',
        renewalEligible: row?.renewalEligible ?? row?.renewal_eligible ?? true,
        renewalLetterUrl: row?.renewalLetterUrl || pdfUrl,
        pdf_url: pdfUrl,
        conclude_date: concludeDate,
        concludeDate,
        previousContractStart: row?.previousContractStart || row?.previous_contract_start || row?.contract_start_date || '',
        previousContractEnd: row?.previousContractEnd || row?.previous_contract_end || row?.contract_end_date || row?.concludeDate || row?.conclude_date || '',
        customer_name: String(row?.customer_name || row?.customerName || '').trim(),
        customerName: String(row?.customerName || row?.customer_name || '').trim(),
        mobile: String(row?.mobile || '').trim(),
        serviceType: String(row?.serviceType || row?.service_type || '').trim(),
        contractAmount: row?.contractAmount ?? row?.contract_amount ?? row?.proposedAmount ?? row?.proposed_amount ?? row?.previousAmount ?? row?.previous_amount ?? '',
        proposedAmount: row?.proposedAmount ?? row?.proposed_amount ?? '',
        previousAmount: row?.previousAmount ?? row?.previous_amount ?? '',
        previousContractAmount: row?.previousContractAmount ?? row?.previous_contract_amount ?? '',
        agreedContractAmount: row?.agreedContractAmount ?? row?.agreed_contract_amount ?? '',
        finalRenewalAmount: row?.finalRenewalAmount ?? row?.final_renewal_amount ?? ''
      };
      const existing = merged.get(renewalId);
      if (!existing) {
        merged.set(renewalId, next);
        return;
      }
      merged.set(renewalId, {
        ...existing,
        ...next,
        pdf_url: next.pdf_url || existing.pdf_url,
        renewalLetterUrl: next.renewalLetterUrl || existing.renewalLetterUrl,
        conclude_date: next.conclude_date || existing.conclude_date,
        concludeDate: next.concludeDate || existing.concludeDate,
        previousContractStart: next.previousContractStart || existing.previousContractStart,
        previousContractEnd: next.previousContractEnd || existing.previousContractEnd,
        customerName: next.customerName || existing.customerName,
        customer_name: next.customer_name || existing.customer_name,
        mobile: next.mobile || existing.mobile,
        serviceType: next.serviceType || existing.serviceType,
        contractAmount: next.contractAmount || existing.contractAmount,
        proposedAmount: next.proposedAmount || existing.proposedAmount,
        previousAmount: next.previousAmount || existing.previousAmount,
        previousContractAmount: next.previousContractAmount || existing.previousContractAmount,
        agreedContractAmount: next.agreedContractAmount || existing.agreedContractAmount,
        finalRenewalAmount: next.finalRenewalAmount || existing.finalRenewalAmount
      });
    };

    (sortedLetters || []).forEach(addRow);
    (rows || []).forEach((row) => {
      if (!row?.renewalLetterUrl && !row?.pdf_url) return;
      addRow(row);
    });

    return Array.from(merged.values()).sort((a, b) => {
      const left = String(a.conclude_date || a.concludeDate || a.generated_at || '').slice(0, 10);
      const right = String(b.conclude_date || b.concludeDate || b.generated_at || '').slice(0, 10);
      return left.localeCompare(right);
    });
  }, [sortedLetters, rows]);

  const buildRenewalPdfUrl = (row) => {
    const sourceUrl = String(row?.renewalLetterUrl || row?.pdf_url || '').trim();
    const rawUrl = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : sourceUrl ? `${API_BASE}${sourceUrl}` : '';
    if (!rawUrl) return '';
    const cacheBuster = String(
      row?.generated_at ||
      row?.generatedAt ||
      row?.updatedAt ||
      row?.updated_at ||
      row?.conclude_date ||
      row?.concludeDate ||
      row?.renewalDisplayId ||
      row?.renewal_display_id ||
      row?.renewalId ||
      row?.renewal_id ||
      ''
    ).trim() || String(Date.now());
    return `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheBuster)}`;
  };

  const buildWonContractPdfUrl = (row) => {
    const contractId = String(wonContractIdValue(row) || '').trim();
    if (!contractId) return '';
    const cacheBuster = String(
      row?.updatedAt ||
      row?.updated_at ||
      row?.renewedAt ||
      row?.renewed_at ||
      row?.outcomeRecordedAt ||
      row?.outcome_recorded_at ||
      contractId
    ).trim() || String(Date.now());
    return `${API_BASE}/api/invoices/${encodeURIComponent(contractId)}/pdf?ref=${encodeURIComponent(contractId)}&v=${encodeURIComponent(cacheBuster)}`;
  };

  const openRenewalWhatsAppComposer = async (row) => {
    const titleName = String(row?.customerName || row?.customer_name || 'Customer').trim() || 'Customer';
	  const renewalId = String(row?.renewalId || row?.renewal_id || row?.id || '').trim();
	  if (!renewalId) return;
	  const isOneTimeTreatment = row?.serviceRelationshipType === 'ONE_TIME';

	  let sourceRow = row;
	  let pdfUrl = buildRenewalPdfUrl(sourceRow);

	  if (!pdfUrl && !isOneTimeTreatment) {
	    setMessage('Generate the renewal letter explicitly before sharing it on WhatsApp.');
	    return;
	  }

    const phoneSource = String(
      sourceRow?.mobile
      || row?.mobile
      || row?.phone
      || row?.mobileNumber
      || row?.whatsappNumber
      || row?.phoneNumber
      || ''
    ).trim();
    if (!phoneSource) {
      showToast(`No WhatsApp number found for ${titleName}.`);
      return;
    }
    const customerPhone = normalizeIndianMobileNumber(phoneSource);
    const displayPhone = formatIndianMobileNumber(phoneSource);
    const renewalDisplayId = String(sourceRow?.renewalDisplayId || sourceRow?.renewal_display_id || sourceRow?.renewalId || sourceRow?.renewal_id || renewalId).trim() || renewalId;
    const serviceType = String(sourceRow?.serviceType || sourceRow?.service_type || 'Renewal Letter').trim() || 'Renewal Letter';

    setWhatsappComposer({
      open: true,
      row: sourceRow,
      previewData: {
        previewMessage: '',
	        attachmentOption: isOneTimeTreatment ? 'None' : 'Renewal Letter PDF',
        template: {
          id: 'renewal_reminder',
          templateType: 'renewal_reminder',
	          templateName: isOneTimeTreatment ? 'Service Follow-up' : 'Renewal Reminder'
        },
        contextData: {
          customer_name: titleName,
          customer_phone: customerPhone,
          service_type: serviceType,
          renewal_display_id: renewalDisplayId,
          renewal_id: renewalId,
	          renewal_date: String(sourceRow?.contractEndDate || sourceRow?.renewalDate || sourceRow?.renewalDueDate || '').trim(),
          pdf_url: pdfUrl,
          company_name: 'SKUAS Pest Control'
        }
      },
      recipientName: titleName,
      recipientPhone: displayPhone,
      recipientType: 'Customer'
    });
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 760);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const loadData = async (overrideFilters = filters, options = {}) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    try {
      if (!options.silent) setLoading(true);
      const params = { ...overrideFilters, t: Date.now() };
      const [renewalRes, summaryRes, employeeRes, letterRes] = await Promise.all([
        axios.get(`${API_BASE}/api/renewals`, { params }),
        axios.get(`${API_BASE}/api/renewals/summary`, { params }),
        axios.get(`${API_BASE}/api/employees`, { params: { t: Date.now() } }),
        axios.get(`${API_BASE}/api/renewals/letters`, { params: { ...params, t: Date.now() } }).catch(() => ({ data: [] }))
      ]);
      if (loadRequestRef.current !== requestId) return;
      const renewalRows = Array.isArray(renewalRes.data) ? renewalRes.data : [];
      const letterRows = Array.isArray(letterRes.data) ? letterRes.data : [];
      const nextSummary = normalizeSummaryPayload(summaryRes.data || {});
      setRows(renewalRows);
      setSummary(nextSummary);
      setEmployees(Array.isArray(employeeRes.data) ? employeeRes.data : []);
      setLetters(letterRows);
      mergeRenewalDashboardCache({
        rows: renewalRows,
        summary: nextSummary,
        employees: Array.isArray(employeeRes.data) ? employeeRes.data : [],
        letters: letterRows
      });
      if (options.autoSync && !autoSyncAttempted.current && Array.isArray(renewalRes.data) && renewalRes.data.length === 0) {
        autoSyncAttempted.current = true;
        await axios.post(`${API_BASE}/api/renewals/sync`);
        return loadData(overrideFilters, { autoSync: false });
      }
    } catch (error) {
      console.error('Renewal load failed', error);
      setMessage(error?.response?.data?.error || 'Unable to load renewals right now.');
    } finally {
      if (loadRequestRef.current === requestId && !options.silent) setLoading(false);
    }
  };

  const openRenewalPdfPreview = async (row) => {
    const titleName = String(row?.customerName || row?.customer_name || 'Customer').trim();
    const fileLabel = String(row?.renewalDisplayId || row?.renewal_display_id || titleName || row?.renewalId || row?.renewal_id || 'renewal-letter').trim();
    const renewalId = String(row?.renewalId || row?.renewal_id || row?.id || '').trim();
    if (!renewalId) return;
    const pdfUrl = buildRenewalPdfUrl(row);
    if (!pdfUrl) {
      setMessage('Generate the renewal letter explicitly before previewing it.');
      return;
    }
    const downloadName = `REN-${titleName || fileLabel || 'Renewal'}.pdf`;
    setPdfPreview({
      open: true,
      title: `Renewal Letter - ${titleName}`,
      pdfUrl,
      downloadFileName: downloadName,
      publicShareUrl: pdfUrl,
      renewalId,
      shareContext: {
        customerName: titleName,
        customerEmail: String(row?.email || row?.customerEmail || row?.customer_email || '').trim(),
        customerPhone: String(row?.mobile || row?.phone || '').trim(),
        renewalDisplayId: fileLabel,
        serviceType: String(row?.serviceType || row?.service_type || 'Renewal Letter').trim() || 'Renewal Letter',
        pdfUrl
      }
    });
  };

  const openWonContractPdfPreview = (row) => {
    const contractId = String(wonContractIdValue(row) || '').trim();
    const pdfUrl = buildWonContractPdfUrl(row);
    if (!contractId || !pdfUrl) {
      setMessage('New contract invoice PDF is not ready for this won renewal.');
      return;
    }
    const titleName = String(row?.customerName || row?.customer_name || 'Customer').trim() || 'Customer';
    setPdfPreview({
      open: true,
      title: `Invoice - ${titleName}`,
      pdfUrl,
      downloadFileName: `${String(contractId || titleName || 'invoice').replace(/[^\w.-]+/g, '_')}.pdf`,
      publicShareUrl: pdfUrl,
      renewalId: String(row?.renewalId || row?.renewal_id || row?.id || '').trim(),
      shareContext: null
    });
  };

  const shareRenewalLetterByEmail = async () => {
    const context = pdfPreview.shareContext || {};
    const defaultEmail = String(context.customerEmail || '').trim();
    const recipientEmail = String(window.prompt('Enter recipient email', defaultEmail) || '').trim();
    if (!recipientEmail) return;

    const customerName = String(context.customerName || 'Customer').trim() || 'Customer';
    const renewalDisplayId = String(context.renewalDisplayId || pdfPreview.title.replace(/^Renewal Letter -\s*/i, '') || 'Renewal').trim();
    const shareUrl = String(pdfPreview.publicShareUrl || pdfPreview.pdfUrl || '').trim();
    const subject = `Renewal Letter - ${renewalDisplayId} from SKUAS Pest Control`;
    const body = `
      <div style="font-family:Arial,sans-serif;color:#111827;font-size:14px;line-height:1.5">
        <p>Dear ${customerName},</p>
        <p>Please find attached your renewal letter for <strong>${renewalDisplayId}</strong>.</p>
        ${shareUrl ? `<p>PDF link: <a href="${shareUrl}" target="_blank" rel="noreferrer">${shareUrl}</a></p>` : ''}
        <p>Regards,<br/>SKUAS Pest Control</p>
      </div>
    `;

    try {
      const response = await axios.post(`${API_BASE}/api/email/send`, {
        moduleType: 'renewal',
        moduleName: 'Renewal Letter',
        templateType: 'custom_email',
        recipientEmail,
        recipientName: customerName,
        recipientType: 'Customer',
        sentByUser: getPortalUserName() || 'User',
        subject,
        body,
        attachmentUrl: shareUrl,
        attachmentName: `REN-${String(context.customerName || renewalDisplayId || 'Renewal').trim()}.pdf`,
        contextData: {
          customer_name: customerName,
          customer_email: recipientEmail,
          customer_phone: String(context.customerPhone || '').trim(),
          service_type: String(context.serviceType || 'Renewal Letter').trim(),
          address: '',
          company_name: 'SKUAS Pest Control'
        }
      });
      window.alert(response.data?.success ? 'Renewal letter email sent successfully.' : 'Renewal letter email queued.');
    } catch (error) {
      console.error('Failed to send renewal letter email', error);
      window.alert(error?.response?.data?.error || 'Could not send renewal letter email.');
    }
  };

  useEffect(() => {
    const initialLoad = async () => {
      try {
        if (!cachedDashboard) {
          autoSyncAttempted.current = true;
          await axios.post(`${API_BASE}/api/renewals/sync`);
        }
      } catch (error) {
        console.error('Initial renewal sync skipped', error);
      }
      await loadData(filters, { autoSync: false, silent: Boolean(cachedDashboard) });
    };
    initialLoad();
  }, [cachedDashboard]);

  useEffect(() => subscribeRenewalsRefresh(() => {
    void loadData(filters, { autoSync: false, autoGenerateLetters: false });
  }), [filters]);

  useAutoRefresh(() => loadData(filters, { autoSync: false, autoGenerateLetters: false }), { enabled: !modal.type });

  const salesPeople = useMemo(() => {
    const list = employees
      .filter((employee) => String(employee.role || employee.roleName || '').toLowerCase().includes('sales'))
      .map((employee) => ({
        id: employee._id || employee.empCode || employee.id || '',
        name: employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.name || employee.empCode || 'Sales Person'
      }));
    const assigned = rows
      .filter((row) => row.assignedSalesPersonName)
      .map((row) => ({ id: row.assignedSalesPersonId || row.assignedSalesPersonName, name: row.assignedSalesPersonName }));
    const seenNames = new Set();
    const seenIds = new Set();
    return [...list, ...assigned].filter((person) => {
      const nameKey = String(person.name || '').trim().toLowerCase();
      const idKey = String(person.id || '').trim().toLowerCase();
      if (!nameKey) return false;
      if (seenNames.has(nameKey)) return false;
      if (idKey && seenIds.has(idKey)) return false;
      seenNames.add(nameKey);
      if (idKey) seenIds.add(idKey);
      return true;
    });
  }, [employees, rows]);

  const serviceOptions = useMemo(() => {
    const services = new Set([...rows, ...visibleLetterRows].map((row) => String(row.serviceType || '').trim()).filter(Boolean));
    return Array.from(services).sort((a, b) => a.localeCompare(b));
  }, [rows, visibleLetterRows]);
  const mergedVisibleRows = useMemo(() => {
    const merged = new Map();
    [...rows, ...visibleLetterRows].forEach((row, index) => {
      const key = String(row?.renewalId || row?.renewal_id || row?.id || `row-${index}`).trim();
      if (!key) return;
      const existing = merged.get(key);
      merged.set(key, existing ? { ...existing, ...row } : row);
    });
    return Array.from(merged.values());
  }, [rows, visibleLetterRows]);
  const visibleRows = useMemo(() => {
    const onlyContracts = isRenewalContractSummaryRow;
    const nextMonth = addMonthsDate(new Date(), 1);
    if (activeTab === 'Jobbing') return mergedVisibleRows.filter(isJobbingRow);
    if (activeTab === 'Needs Review') return mergedVisibleRows.filter(isReviewRow);
    if (activeTab === 'Upcoming') {
      return mergedVisibleRows.filter((row) => onlyContracts(row) && isPendingRenewal(row) && isSameMonth(parseDateInput(renewalDateValue(row)), nextMonth));
    }
    if (activeTab === 'Overdue') {
      const today = parseDateInput(todayInput());
      return mergedVisibleRows.filter((row) => {
        const dueDate = parseDateInput(renewalDateValue(row));
        return onlyContracts(row) && isPendingRenewal(row) && (
          rowStatusText(row) === 'Overdue' ||
          rowStatusText(row) === 'Follow-up' ||
          (dueDate && today && dueDate.getTime() < today.getTime())
        );
      });
    }
    if (activeTab === 'Won') return mergedVisibleRows.filter((row) => onlyContracts(row) && isWonRenewal(row));
    if (activeTab === 'Lost') return mergedVisibleRows.filter((row) => onlyContracts(row) && isLostRenewal(row));
    return mergedVisibleRows.filter((row) => onlyContracts(row) && isPendingRenewal(row));
  }, [activeTab, mergedVisibleRows]);
  const tabStatusLabel = (row) => {
    if (activeTab === 'Upcoming') return 'Upcoming';
    if (activeTab === 'Overdue') return 'Overdue';
    return displayStatusLabel(row.status);
  };
  const tabStatusStyle = (row) => statusStyle(tabStatusLabel(row));

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / RENEWAL_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * RENEWAL_PAGE_SIZE;
    return visibleRows.slice(start, start + RENEWAL_PAGE_SIZE);
  }, [visibleRows, safePage]);
  const firstRecord = visibleRows.length ? ((safePage - 1) * RENEWAL_PAGE_SIZE) + 1 : 0;
  const lastRecord = Math.min(safePage * RENEWAL_PAGE_SIZE, visibleRows.length);
  const paginationText = visibleRows.length ? `${firstRecord}-${lastRecord} of ${visibleRows.length} records` : '0 records';
  const paginationStyle = isMobile ? { ...shell.pagination, flexDirection: 'column', alignItems: 'stretch' } : shell.pagination;
  const paginationActionsStyle = isMobile ? { ...shell.paginationActions, justifyContent: 'flex-end' } : shell.paginationActions;
  const portalUser = getPortalUser() || {};
  const portalRole = String(getPortalUserRole() || '').trim().toLowerCase();
  const portalName = String(getPortalUserName() || portalUser.name || '').trim().toLowerCase();
  const portalIds = new Set([
    getPortalUserId(),
    portalUser.id,
    portalUser.employeeId,
    portalUser.employeeCode,
    portalName
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase()));
  const canAdminRenewals = portalRole === 'admin' || portalRole === 'super admin' || portalRole === 'superadmin';
  const canManageRenewals = canAdminRenewals || portalRole.includes('manager') || ['operations', 'sales lead', 'team lead'].includes(portalRole);
  const canUseAssignedRenewal = (row = {}) => {
    if (canManageRenewals) return true;
    if (!portalRole.includes('sales')) return false;
    return [
      row.assignedSalesPersonId,
      row.assigned_sales_person_id,
      row.assignedSalesPersonName,
      row.assigned_sales_person_name,
      row.renewedBySalesPersonId,
      row.renewedBySalesPersonName
    ].filter(Boolean).some((value) => portalIds.has(String(value).trim().toLowerCase()));
  };

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);
  useEffect(() => {
    setPage(1);
  }, [activeTab]);
  const {
    getColumnWidth,
    startResize,
    resetColumns: resetRenewalColumns
  } = useColumnResize({
    storageKey: 'renewal_column_widths',
    columns: renewalColumns.map((column) => column.key),
    defaultColumnWidths: renewalDefaultWidths,
    columnBounds: renewalColumnBounds,
    minWidth: 80,
  });

  const renewalTableMinWidth = renewalColumns.reduce((sum, column) => sum + (getColumnWidth(column.key) || renewalDefaultWidths[column.key] || 80), 0);
  const renewalTableContentWidth = Math.max(1080, renewalTableMinWidth);
  const renewalTableContentStyle = {
    minWidth: `${renewalTableContentWidth}px`,
    width: '100%'
  };
  const renewalTableStyle = {
    ...shell.table,
    minWidth: '100%',
    width: '100%'
  };
  const renewalHeadCellStyle = (key, align = 'left') => {
    const isActions = key === 'actions';
    return {
      ...shell.th,
      position: isActions ? 'sticky' : 'relative',
      right: isActions ? 0 : undefined,
      zIndex: isActions ? 4 : undefined,
      width: `${getColumnWidth(key)}px`,
      minWidth: `${getColumnWidth(key)}px`,
      maxWidth: `${getColumnWidth(key)}px`,
      textAlign: align,
      background: 'var(--table-header-bg)',
      boxShadow: isActions ? '-1px 0 0 var(--color-border)' : undefined
    };
  };
  const renewalBodyCellStyle = (key, align = 'left') => ({
    ...shell.td,
    width: `${getColumnWidth(key)}px`,
    minWidth: `${getColumnWidth(key)}px`,
    maxWidth: `${getColumnWidth(key)}px`,
    textAlign: align
  });
  const renewalActionCellStyle = {
    ...renewalBodyCellStyle('actions', 'left'),
    position: 'sticky',
    right: 0,
    zIndex: 2,
    background: 'var(--surface-card)',
    boxShadow: '-1px 0 0 var(--color-border)',
    overflow: 'visible'
  };

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const openModal = (type, row) => {
    const agreementDate = todayInput();
    const durationValue = row?.contractDurationValue || 12;
    const durationUnit = row?.contractDurationUnit || 'MONTH';
    const previousAmount = row?.previousContractAmount || row?.previousAmount || row?.contractAmount || row?.proposedAmount || '';
    const startDate = agreementDate;
    setModal({ type, row });
    setExistingLinks({ loading: false, error: '', candidates: [], search: '' });
    setForm({
      wonMode: 'existing',
      existingCandidateKey: '',
      correctExistingLink: Boolean(row?.existingRenewalLink),
      salesPersonId: row?.assignedSalesPersonId || '',
      salesPersonName: row?.assignedSalesPersonName || '',
      followupDate: row?.followupDate || '',
      note: type === 'convert' ? '' : row?.lastFollowupNote || '',
      finalAmount: row?.finalRenewalAmount || row?.proposedAmount || '',
      renewedBySalesPersonId: row?.assignedSalesPersonId || '',
      renewedBySalesPersonName: row?.assignedSalesPersonName || '',
      reason: '',
      reasonCategory: '',
      lostNotes: '',
      outcomeDecisionDate: agreementDate,
      agreementDate: type === 'convert' ? '' : agreementDate,
      priceOption: 'same',
      previousContractAmount: previousAmount,
      serviceType: row?.serviceType || '',
      renewalDueDate: row?.renewalDueDate || '',
      proposedAmount: row?.proposedAmount || '',
      status: row?.status || 'Pending',
      contractDurationValue: durationValue,
      contractDurationUnit: durationUnit,
      contractStartDate: startDate,
      contractEndDate: calculateContractEndInput(startDate, durationValue, durationUnit),
      amount: row?.agreedContractAmount || row?.finalRenewalAmount || previousAmount || ''
    });
  };
  const updateConvertForm = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'agreementDate') && !prev.contractStartTouched) {
        next.contractStartDate = patch.agreementDate;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'contractStartDate')) next.contractStartTouched = true;
      if (Object.prototype.hasOwnProperty.call(patch, 'priceOption') && patch.priceOption === 'same') {
        next.amount = next.previousContractAmount || '';
      }
      if (['contractStartDate', 'contractDurationValue', 'contractDurationUnit', 'agreementDate'].some((key) => Object.prototype.hasOwnProperty.call(patch, key))) {
        next.contractEndDate = calculateContractEndInput(next.contractStartDate || next.agreementDate, next.contractDurationValue, next.contractDurationUnit);
      }
      return next;
    });
  };
  const closeModal = () => setModal({ type: '', row: null });
  useEffect(() => {
    if (modal.type !== 'convert' || form.wonMode !== 'existing' || !modal.row?.renewalId) return undefined;
    let cancelled = false;
    setExistingLinks((prev) => ({ ...prev, loading: true, error: '', candidates: [] }));
    axios.get(`${API_BASE}/api/renewals/${encodeURIComponent(modal.row.renewalId)}/existing-contracts`)
      .then(({ data }) => { if (!cancelled) setExistingLinks((prev) => ({ ...prev, loading: false, candidates: data.candidates || [] })); })
      .catch((error) => { if (!cancelled) setExistingLinks((prev) => ({ ...prev, loading: false, error: error?.response?.data?.error || 'Unable to load matching contracts. Please retry.' })); });
    return () => { cancelled = true; };
  }, [modal.type, modal.row?.renewalId, form.wonMode, existingLinksReload]);
  const handleLinkExisting = async () => {
    if (busy) return;
    const selected = existingLinks.candidates.find((item) => item.key === form.existingCandidateKey);
    if (!selected || selected.eligible === false || !form.agreementDate) return;
    if (!window.confirm(`Link ${selected.invoiceNumber} (${formatDate(selected.start)} – ${formatDate(selected.end)}) and mark this renewal Won? No contract or invoice will be created.`)) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE}/api/renewals/${encodeURIComponent(modal.row.renewalId)}/link-existing`, {
        invoiceId: selected.invoiceId, candidateKey: selected.key, invoiceVersion: selected.invoiceVersion,
        agreementDate: form.agreementDate, notes: form.note || '', correctLink: form.correctExistingLink === true
      });
      setMessage(data.message);
      closeModal();
      await loadData(filters, { silent: true, autoSync: false, autoGenerateLetters: false });
      triggerContractsRefresh();
    } catch (error) {
      setExistingLinks((prev) => ({ ...prev, error: error?.response?.data?.error || 'Unable to link existing records. Please retry.' }));
    } finally { setBusy(false); }
  };
  const handleConvertToContract = async () => {
    if (!modal.row?.renewalId || busy || form.wonMode !== 'new') return;
    const amount = Number(form.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage('Amount must be numeric.');
      return;
    }
    const startLabel = formatDate(form.contractStartDate);
    const endLabel = formatDate(form.contractEndDate);
    if (!window.confirm(`Mark this renewal as won and create a new contract from ${startLabel} to ${endLabel} for ${formatINR(amount)}?`)) return;
    try {
      setBusy(true);
      const response = await axios.post(`${API_BASE}/api/renewals/${modal.row.renewalId}/convert-contract`, {
        ...form,
        customerType: modal.row?.serviceRelationshipType === 'ONE_TIME' ? 'New' : 'Renewal'
      });
      const contract = response?.data?.contract;
      setMessage(response?.data?.message || 'Converted to contract');
      closeModal();
      await loadData(filters, { silent: true, autoSync: false, autoGenerateLetters: false });
      triggerContractsRefresh();
      if (contract?._id) {
        navigate(`/sales/contracts?openInvoiceId=${encodeURIComponent(contract._id)}&fromContract=1&viewContract=1`, {
          replace: true
        });
      }
    } catch (error) {
      console.error('Converted to contract', error);
      setMessage(error?.response?.data?.error || 'Unable to convert renewal to contract right now.');
    } finally {
      setBusy(false);
    }
  };
  const runAction = async (label, callback) => {
    try {
      setBusy(true);
      const response = await callback();
      setMessage(response?.data?.message || label);
      closeModal();
      await loadData(filters, { silent: true, autoSync: false, autoGenerateLetters: false });
    } catch (error) {
      console.error(label, error);
      setMessage(error?.response?.data?.error || `Unable to complete: ${label}`);
    } finally {
      setBusy(false);
    }
  };
  const loadRenewalAudit = async () => {
    try {
      setBusy(true);
      const response = await axios.get(`${API_BASE}/api/renewals/audit`, { params: { t: Date.now() } });
      setAuditSummary(response.data || {});
      setAuditRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
      setSelectedAuditIds([]);
    } catch (error) {
      console.error('Renewal audit load failed', error);
      setMessage(error?.response?.data?.error || 'Unable to load renewal audit right now.');
    } finally {
      setBusy(false);
    }
  };
  const toggleAuditRow = (renewalId) => {
    setSelectedAuditIds((prev) => prev.includes(renewalId) ? prev.filter((id) => id !== renewalId) : [...prev, renewalId]);
  };
  const runAuditAction = async (action, label) => {
    if (selectedAuditIds.length === 0) {
      setMessage('Select at least one audit record.');
      return;
    }
    if (!window.confirm(`${label} for ${selectedAuditIds.length} selected record(s)?`)) return;
    try {
      setBusy(true);
      const response = await axios.post(`${API_BASE}/api/renewals/audit/classify`, { renewalIds: selectedAuditIds, action });
      setMessage(response?.data?.message || label);
      await loadRenewalAudit();
      await loadData(filters, { silent: true, autoSync: false, autoGenerateLetters: false });
    } catch (error) {
      console.error(label, error);
      setMessage(error?.response?.data?.error || 'Unable to update renewal audit records right now.');
    } finally {
      setBusy(false);
    }
  };
  const applyFilters = () => {
    setPage(1);
    loadData();
  };
  const drillDownBySalesPerson = (item) => {
    const salesPersonId = String(item?.id || item?.assignedSalesPersonId || item?.name || item?.assignedSalesPersonName || '').trim();
    if (!salesPersonId) return;
    const next = { ...filters, assignedSalesPersonId: salesPersonId };
    setFilters(next);
    setPage(1);
    setActiveTab('Renewals');
    loadData(next);
  };
  const resetFilters = () => {
    const next = { range: 'custom', month: 'all', year: currentYear, fromDate: '', toDate: '', status: 'All', relationshipType: 'All', duration: '', serviceType: '', assignedSalesPersonId: '', searchScope: 'all', search: '' };
    setPage(1);
    skipNextSearchSyncRef.current = true;
    setFilters(next);
    loadData(next);
  };
  const isFinalRow = (row) => !isPendingRenewal(row);
  const isOneTimeRow = (row) => row?.serviceRelationshipType === 'ONE_TIME';
  const canRenewRow = (row) => canUseAssignedRenewal(row) && row?.serviceRelationshipType === 'CONTRACT' && row?.renewalEligible && !isFinalRow(row);
  const canWinLetterRow = (row) => isLetterRow(row) && String(row?.renewalId || row?.renewal_id || '').trim() && !isFinalRow(row);
  const canConvertOneTimeRow = (row) => canUseAssignedRenewal(row) && isOneTimeRow(row) && !row?.convertedContractId;
  const rowMoreItems = (row) => [
    { label: 'View Details', onClick: () => openModal('view', row) },
    canUseAssignedRenewal(row) && (row.serviceRelationshipType === 'CONTRACT' || row.renewalLetterUrl || row.pdf_url) ? { label: 'Renewal Letter', onClick: () => openRenewalPdfPreview(row) } : null,
    canUseAssignedRenewal(row) && (row.renewalLetterUrl || row.pdf_url) ? { label: 'WhatsApp Letter', onClick: () => openRenewalWhatsAppComposer(row) } : null,
    canUseAssignedRenewal(row) && row.serviceRelationshipType === 'CONTRACT' ? { label: 'Regenerate Letter', onClick: () => runAction('Renewal letter regenerated', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/generate-letter`)) } : null,
    canManageRenewals ? { label: 'Assign / Change Sales Person', onClick: () => openModal('assign', row) } : null,
    canUseAssignedRenewal(row) && !isFinalRow(row) && (row.serviceRelationshipType === 'CONTRACT' || canWinLetterRow(row)) ? { label: 'Mark as Lost', onClick: () => openModal('decline', row) } : null
  ];
  const renderRowActions = (row, mobile = false) => {
    const buttonBase = mobile ? shell.ghostBtn : shell.iconBtn;
    const outcomeLabel = isWonRenewal(row) ? 'Won' : isLostRenewal(row) ? 'Lost' : '';
    if (outcomeLabel) {
      const outcomeStyle = statusStyle(outcomeLabel);
      return (
        <div style={{ ...shell.rowActions, justifyContent: 'flex-start', flexWrap: mobile ? 'wrap' : 'nowrap' }}>
          <button
            type="button"
            style={{ ...shell.iconBtn, width: 100, minWidth: 100, fontSize: 12, fontWeight: 700, background: outcomeStyle.background, color: outcomeStyle.color }}
            title={`View ${outcomeLabel} renewal details`}
            aria-label={`View ${outcomeLabel} renewal details`}
            onClick={() => openModal('view', row)}
          >
            {outcomeLabel}
          </button>
          <ActionMenu items={rowMoreItems(row)} compact triggerTitle="More Actions" />
        </div>
      );
    }
    return (
      <div style={{ ...shell.rowActions, justifyContent: 'flex-start', flexWrap: mobile ? 'wrap' : 'nowrap' }}>
        {canUseAssignedRenewal(row) && !isFinalRow(row) ? (
          <button
            className="crm-icon-action-btn"
            style={buttonBase}
            title="Follow-up"
            aria-label="Follow-up"
            onClick={() => openModal('followup', row)}
          >
            {mobile ? 'Follow-up' : <CalendarClock size={15} />}
          </button>
        ) : null}
        {canRenewRow(row) || canWinLetterRow(row) ? (
          <button
            className="crm-icon-action-btn"
            style={mobile ? shell.primaryBtn : shell.iconBtn}
            title="Mark as Won"
            aria-label="Mark as Won"
            onClick={() => openModal('convert', row)}
          >
            {mobile ? 'Mark as Won' : <CheckCircle2 size={15} />}
          </button>
        ) : null}
        {canUseAssignedRenewal(row) && !isFinalRow(row) && (row.serviceRelationshipType === 'CONTRACT' || canWinLetterRow(row)) ? (
          <button
            className="crm-icon-action-btn"
            style={buttonBase}
            title="Mark as Lost"
            aria-label="Mark as Lost"
            onClick={() => openModal('decline', row)}
          >
            {mobile ? 'Mark as Lost' : <XCircle size={15} />}
          </button>
        ) : null}
        {canConvertOneTimeRow(row) ? (
          <button
            className="crm-icon-action-btn"
            style={mobile ? shell.primaryBtn : shell.iconBtn}
            title="Convert to Contract"
            aria-label="Convert to Contract"
            onClick={() => openModal('convert', row)}
          >
            {mobile ? 'Convert to Contract' : <CheckCircle2 size={15} />}
          </button>
        ) : null}
        <ActionMenu items={rowMoreItems(row)} compact triggerTitle="More Actions" />
      </div>
    );
  };

  useEffect(() => {
    if (initialSearchSyncRef.current) {
      initialSearchSyncRef.current = false;
      return;
    }
    if (skipNextSearchSyncRef.current) {
      skipNextSearchSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setPage(1);
      loadData({ ...filters }, { silent: true, autoGenerateLetters: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters.search, filters.searchScope]);

  useEffect(() => {
    if (initialFilterSyncRef.current) {
      initialFilterSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setPage(1);
      loadData({ ...filters }, { silent: true, autoSync: false, autoGenerateLetters: false });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    filters.range,
    filters.month,
    filters.year,
    filters.fromDate,
    filters.toDate,
    filters.status,
    filters.relationshipType,
    filters.duration,
    filters.serviceType,
    filters.assignedSalesPersonId
  ]);

  const clientSummary = useMemo(() => {
    const merged = new Map();
    [...rows, ...visibleLetterRows].forEach((row, index) => {
      const key = String(row?.renewalId || row?.renewal_id || row?.id || `row-${index}`).trim();
      if (!key) return;
      const existing = merged.get(key);
      merged.set(key, existing ? { ...existing, ...row } : row);
    });
    const summaryRows = Array.from(merged.values());
    const contractRows = summaryRows.filter(isRenewalContractSummaryRow);
    const pendingRows = contractRows.filter(isPendingRenewal);
    const wonRows = contractRows.filter(isWonRenewal);
    const lostRows = contractRows.filter(isLostRenewal);
    const jobbingRows = summaryRows.filter(isJobbingRow);
    const today = parseDateInput(todayInput());
    const amountFor = (row) => numericAmount(renewalAmountValue(row));
    const wonAmountFor = (row) => numericAmount(row?.agreedContractAmount || row?.finalRenewalAmount || renewalAmountValue(row));
    const timingText = (row) => String(row?.renewalTiming || row?.renewal_timing || '').trim().toUpperCase();
    const isOverdue = (row) => {
      const dueDate = parseDateInput(renewalDateValue(row));
      return rowStatusText(row) === 'Overdue' || rowStatusText(row) === 'Follow-up' || (dueDate && today && dueDate.getTime() < today.getTime());
    };
    const isDueIn30 = (row) => {
      const dueDate = parseDateInput(renewalDateValue(row));
      if (!dueDate || !today) return false;
      const days = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
      return days >= 0 && days <= 30;
    };
    const overdueRows = pendingRows.filter(isOverdue);
    return {
      totalEligibleRenewalOpportunities: contractRows.length,
      totalRenewalContractValue: contractRows.reduce((sum, row) => sum + amountFor(row), 0),
      activeContractCount: pendingRows.length,
      dueIn30Count: pendingRows.filter(isDueIn30).length,
      overduePendingCount: overdueRows.length,
      overduePendingValue: overdueRows.reduce((sum, row) => sum + amountFor(row), 0),
      wonCount: wonRows.length,
      lostCount: lostRows.length,
      pendingCount: pendingRows.length,
      onTimeWonCount: wonRows.filter((row) => timingText(row) === 'ON_TIME' || timingText(row) === 'ON TIME').length,
      lateWonCount: wonRows.filter((row) => timingText(row) === 'LATE').length,
      wonRenewalRevenue: wonRows.reduce((sum, row) => sum + wonAmountFor(row), 0),
      lostOpportunityValue: lostRows.reduce((sum, row) => sum + amountFor(row), 0),
      pendingOpportunityValue: pendingRows.reduce((sum, row) => sum + amountFor(row), 0),
      oneTimeTreatmentCount: jobbingRows.length,
      oneTimeTreatmentValue: jobbingRows.reduce((sum, row) => sum + amountFor(row), 0)
    };
  }, [rows, visibleLetterRows]);
  const filteredSummary = { ...(summary.filtered || summary), ...clientSummary };
  const stats = [
    {
      label: 'Total No of Renewal Contract',
      count: filteredSummary.totalEligibleRenewalOpportunities ?? filteredSummary.totalRenewals ?? 0,
      value: filteredSummary.totalRenewalContractValue ?? filteredSummary.totalRenewalAmount ?? 0,
      targetTab: 'Renewal Letters'
    },
    { label: 'Won Contract', count: filteredSummary.wonCount ?? filteredSummary.doneCount ?? 0, value: filteredSummary.wonRenewalRevenue || 0, targetTab: 'Won' },
    { label: 'Lost Contract', count: filteredSummary.lostCount ?? filteredSummary.declinedCount ?? 0, value: filteredSummary.lostOpportunityValue || 0, targetTab: 'Lost' },
    { label: 'Overdue Contract', count: filteredSummary.overduePendingCount ?? filteredSummary.overdueCount ?? 0, value: filteredSummary.overduePendingValue || 0, targetTab: 'Overdue' },
    { label: 'Jobbing', count: filteredSummary.oneTimeTreatmentCount || 0, value: filteredSummary.oneTimeTreatmentValue || 0, targetTab: 'Jobbing' }
  ];
  const openSummaryCard = (targetTab) => {
    if (!targetTab) return;
    setActiveTab(targetTab);
    setPage(1);
  };

  const headerSearchStyle = isMobile
    ? { width: '100%', maxWidth: '100%' }
    : { width: '420px', minWidth: '420px', maxWidth: '420px', height: '36px', justifySelf: 'center' };
  const headerSearchInputStyle = {
    ...shell.input,
    height: '36px',
    minHeight: '36px',
    paddingLeft: '38px'
  };
  const headerSearchWrapStyle = {
    position: 'relative',
    display: 'block',
    alignItems: 'center',
    minWidth: 0,
    width: isMobile ? '100%' : '420px',
    maxWidth: isMobile ? '100%' : '420px',
    height: '36px',
    justifySelf: 'center'
  };
  const headerSearchIconStyle = {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--color-muted)',
    pointerEvents: 'none'
  };
  const headerSearchActionsStyle = isMobile
    ? { ...shell.actions, justifyContent: 'stretch', width: '100%' }
    : { ...shell.actions, justifyContent: 'flex-end' };

  const renderFilters = () => (
    <div style={shell.panel}>
      <div style={{ ...shell.panelPad, ...shell.filters, gridTemplateColumns: isMobile ? '1fr' : 'repeat(6, minmax(118px, 1fr)) auto', padding: '10px 12px 12px' }}>
        <label style={shell.field}><span style={shell.label}>Range</span><select style={shell.input} value={filters.range} onChange={(e) => updateFilter('range', e.target.value)}>{ranges.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Month</span><select style={shell.input} value={filters.month} onChange={(e) => updateFilter('month', e.target.value)}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Year</span><select style={shell.input} value={filters.year} onChange={(e) => updateFilter('year', e.target.value)}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Relationship Type</span><select style={shell.input} value={filters.relationshipType} onChange={(e) => updateFilter('relationshipType', e.target.value)}>{relationshipTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>Sales Person</span><select style={shell.input} value={filters.assignedSalesPersonId} onChange={(e) => updateFilter('assignedSalesPersonId', e.target.value)}><option value="">All Sales</option>{salesPeople.map((p) => <option key={p.id || p.name} value={p.id || p.name}>{p.name}</option>)}</select></label>
        <label style={shell.field}><span style={shell.label}>All Fields</span><select style={shell.input} value={filters.searchScope} onChange={(e) => updateFilter('searchScope', e.target.value)}>{searchScopes.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</select></label>
        <div style={headerSearchActionsStyle}>
          <button type="button" style={shell.primaryBtn} onClick={applyFilters}>Apply</button>
          <button type="button" style={shell.ghostBtn} onClick={resetFilters}>Reset</button>
        </div>
      </div>
    </div>
  );

  const renderRows = () => {
    const displayRenewalId = (row) => row.renewalDisplayId || row.renewal_display_id || row.renewalId || row.renewal_id || '';
    if (pagedRows.length === 0) {
      return (
        <div style={{ ...shell.panelPad, color: 'var(--color-muted)', fontSize: 13, fontWeight: 700 }}>
          {rows.length === 0 ? 'No renewal records are available.' : 'No renewal records match the current filters.'}
        </div>
      );
    }
    if (isMobile) {
      return (
        <div style={{ display: 'grid', gap: 8, padding: 10 }}>
          {pagedRows.map((row) => (
            <div
              key={row.renewalId}
              ref={registerRenewalRowRef(row.renewalId)}
              style={{
                ...shell.mobileCard,
                ...(highlightedRenewalId === String(row.renewalId || '').trim()
                  ? { outline: '2px solid rgba(99,102,241,0.28)', boxShadow: '0 0 0 4px rgba(99,102,241,0.08)' }
                  : {})
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={shell.mobileCustomerStack}>
                  <strong style={shell.mobileCustomerName}>{row.customerName}</strong>
                  <span style={shell.mobileCustomerMobile}>{row.mobile || '-'}</span>
                </div>
                <span style={tabStatusStyle(row)}>{tabStatusLabel(row)}</span>
              </div>
              <div style={shell.mobileMeta}>
                <span>Expiry: {formatDate(row.previousContractEnd || row.renewalDueDate)}</span>
                <span title={row.serviceType}>{row.serviceType || '-'}</span>
                <span>{contractDurationText(row)}</span>
                <span>{formatOptionalINR(renewalAmountValue(row))}</span>
                <span>Due: {formatOptionalINR(row.outstandingAmount)}</span>
              </div>
              {renderRowActions(row, true)}
            </div>
          ))}
        </div>
      );
    }
    if (activeTab === 'Won') {
      return (
        <div style={shell.tableWrap}>
          <table className="crm-compact-table renewal-dashboard-table" style={{ ...shell.letterTable, minWidth: 780 }}>
            <thead>
              <tr>
                <th style={{ ...shell.th, ...shell.letterCustomerCell }}>Customer</th>
                <th style={{ ...shell.th, ...shell.letterServiceCell }}>Service Name</th>
                <th style={{ ...shell.th, ...shell.letterPeriodCell }}>Contract Period</th>
                <th style={{ ...shell.th, ...shell.letterAmountCell }}>Old Amount</th>
                <th style={{ ...shell.th, ...shell.letterAmountCell }}>New Amount</th>
                <th style={{ ...shell.th, ...shell.letterPdfCell }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                const contractStart = wonContractStartValue(row);
                const contractEnd = wonContractEndValue(row);
                const invoicePdfUrl = buildWonContractPdfUrl(row);
                return (
                  <tr key={row.id || row.renewalId || row.newContractId || row.convertedContractId || row.pdf_url}>
                    <td style={{ ...shell.td, ...shell.letterCustomerCell }} title={row.customerName || row.customer_name || ''}>
                      <strong>{row.customerName || row.customer_name || '-'}</strong>
                    </td>
                    <td style={{ ...shell.td, ...shell.letterServiceCell }} title={row.serviceType || ''}>{row.serviceType || '-'}</td>
                    <td style={{ ...shell.td, ...shell.letterPeriodCell }} title={`${formatDate(contractStart)} - ${formatDate(contractEnd)}`}>
                      {formatDate(contractStart)} - {formatDate(contractEnd)}
                    </td>
                    <td style={{ ...shell.td, ...shell.letterAmountCell }}>{formatOptionalINR(renewalOldAmountValue(row))}</td>
                    <td style={{ ...shell.td, ...shell.letterAmountCell }}>{formatOptionalINR(renewalNewAmountValue(row))}</td>
                    <td style={{ ...shell.td, ...shell.letterPdfCell }}>
                      {invoicePdfUrl ? <a href={invoicePdfUrl} onClick={(event) => { event.preventDefault(); openWonContractPdfPreview(row); }} rel="noreferrer">Open PDF</a> : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={paginationStyle}>
            <div style={shell.paginationInfo}>{paginationText}</div>
            <div style={paginationActionsStyle}>
              <button type="button" style={{ ...shell.paginationBtn, ...(safePage <= 1 ? shell.paginationBtnDisabled : {}) }} disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" title="Previous page"><ChevronLeft size={16} /></button>
              <button type="button" style={{ ...shell.paginationBtn, ...(safePage >= totalPages ? shell.paginationBtnDisabled : {}) }} disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page" title="Next page"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      );
    }
    if (activeTab === 'Lost') {
      return (
        <div style={shell.tableWrap}>
          <table className="crm-compact-table renewal-dashboard-table" style={shell.letterTable}>
            <thead>
              <tr>
                <th style={{ ...shell.th, ...shell.letterCustomerCell }}>Customer</th>
                <th style={{ ...shell.th, ...shell.letterServiceCell }}>Service</th>
                <th style={{ ...shell.th, ...shell.letterDateCell }}>Letter Date</th>
                <th style={{ ...shell.th, ...shell.letterPeriodCell }}>Contract Period</th>
                <th style={{ ...shell.th, ...shell.letterAmountCell }}>Amount</th>
                <th style={{ ...shell.th, ...shell.letterPdfCell }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.id || row.renewalId || row.pdf_url}>
                  <td style={{ ...shell.td, ...shell.letterCustomerCell }} title={row.customerName || row.customer_name || ''}>
                    <strong>{row.customerName || row.customer_name || '-'}</strong>
                  </td>
                  <td style={{ ...shell.td, ...shell.letterServiceCell }} title={row.serviceType || ''}>{row.serviceType || '-'}</td>
                  <td style={{ ...shell.td, ...shell.letterDateCell }}>{formatDate(row.conclude_date || row.concludeDate || row.generated_at || row.outcomeDecisionDate || row.renewalDueDate)}</td>
                  <td style={{ ...shell.td, ...shell.letterPeriodCell }} title={`${formatDate(row.previousContractStart)} - ${formatDate(row.previousContractEnd)}`}>
                    {formatDate(row.previousContractStart)} - {formatDate(row.previousContractEnd)}
                  </td>
                  <td style={{ ...shell.td, ...shell.letterAmountCell }}>{formatOptionalINR(renewalAmountValue(row))}</td>
                  <td style={{ ...shell.td, ...shell.letterPdfCell }}>
                    {buildRenewalPdfUrl(row) ? <a href={buildRenewalPdfUrl(row)} onClick={(event) => { event.preventDefault(); openRenewalPdfPreview(row); }} rel="noreferrer">Open PDF</a> : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={paginationStyle}>
            <div style={shell.paginationInfo}>{paginationText}</div>
            <div style={paginationActionsStyle}>
              <button type="button" style={{ ...shell.paginationBtn, ...(safePage <= 1 ? shell.paginationBtnDisabled : {}) }} disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" title="Previous page"><ChevronLeft size={16} /></button>
              <button type="button" style={{ ...shell.paginationBtn, ...(safePage >= totalPages ? shell.paginationBtnDisabled : {}) }} disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page" title="Next page"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={shell.tableWrap}>
        <div style={renewalTableContentStyle}>
          <table className="crm-compact-table renewal-dashboard-table renewal-register-table" style={renewalTableStyle}>
            <colgroup>
              {renewalColumns.map((column) => (
                <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={renewalHeadCellStyle('customer')}>Customer</th>
                <th style={renewalHeadCellStyle('mobile', 'center')}>Mobile</th>
                <th style={renewalHeadCellStyle('svc')}>Service</th>
                <th style={renewalHeadCellStyle('period', 'center')}>Period</th>
                <th style={renewalHeadCellStyle('amount', 'center')}>Amount</th>
                <th style={renewalHeadCellStyle('salesPerson')}>Sales</th>
                <th style={renewalHeadCellStyle('status', 'center')}>Status</th>
                <th style={renewalHeadCellStyle('actions', 'center')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr
                  key={row.renewalId}
                  ref={registerRenewalRowRef(row.renewalId)}
                  style={highlightedRenewalId === String(row.renewalId || '').trim() ? { background: 'rgba(99,102,241,0.06)' } : undefined}
                >
                  <td style={renewalBodyCellStyle('customer')} title={`${row.customerName} • ${displayRenewalId(row)}`}><strong>{row.customerName}</strong></td>
                  <td style={renewalBodyCellStyle('mobile', 'center')}>{row.mobile || '-'}</td>
                  <td style={renewalBodyCellStyle('svc')} title={row.serviceType}>{row.serviceType || '-'}</td>
                  <td style={renewalBodyCellStyle('period', 'center')} title={`${formatDate(row.previousContractStart)} - ${formatDate(row.previousContractEnd)} (${contractDurationText(row)})`}>
                    {formatDate(row.previousContractStart)} – {formatDate(row.previousContractEnd)}
                  </td>
                  <td style={renewalBodyCellStyle('amount', 'center')}>{formatOptionalINR(renewalAmountValue(row))}</td>
                  <td style={renewalBodyCellStyle('salesPerson')} title={row.assignedSalesPersonName}>{row.assignedSalesPersonName || '-'}</td>
                  <td style={renewalBodyCellStyle('status', 'center')}><span style={tabStatusStyle(row)}>{tabStatusLabel(row)}</span></td>
                  <td style={renewalActionCellStyle}>{renderRowActions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={paginationStyle}>
            <div style={shell.paginationInfo}>{paginationText}</div>
            <div style={paginationActionsStyle}>
              <button
                type="button"
                style={{ ...shell.paginationBtn, ...(safePage <= 1 ? shell.paginationBtnDisabled : {}) }}
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                style={{ ...shell.paginationBtn, ...(safePage >= totalPages ? shell.paginationBtnDisabled : {}) }}
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryList = (items, labelKey, valueKey = 'count', options = {}) => (
    <div style={shell.panel}>
      <div style={shell.panelPad}>
        {(items || []).length === 0 ? <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 13 }}>No records.</p> : items.map((item) => (
          <div key={item[labelKey] || item.name} style={shell.miniRow}>
            <strong style={{ minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.25 }}>{item[labelKey] || item.name}</strong>
            <button
              type="button"
              onClick={() => options.onCountClick?.(item)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                color: options.onCountClick ? 'var(--color-primary-dark)' : 'var(--text-primary)',
                fontWeight: 800,
                textAlign: 'right',
                cursor: options.onCountClick ? 'pointer' : 'default',
                justifySelf: 'end'
              }}
            >
              {item[valueKey] ?? item.total ?? 0}
            </button>
            <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{formatINR(item.amount || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAuditPanel = () => (
    <div style={shell.panel}>
      <div style={{ ...shell.panelPad, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong>Renewal Data Audit</strong>
          <button type="button" style={shell.ghostBtn} disabled={busy} onClick={loadRenewalAudit}>Scan Records</button>
        </div>
        {auditSummary ? (
          <div style={{ ...shell.stats, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
            {[
              ['Records Scanned', auditSummary.totalRecordsScanned || 0],
              ['Likely Contracts', auditSummary.likelyContracts || 0],
              ['Likely Jobbing', auditSummary.likelyOneTimeTreatments || 0],
              ['Needs Review', auditSummary.needsReview || 0]
            ].map(([label, value]) => <div key={label} style={shell.stat}><div style={shell.statLabel}>{label}</div><div style={shell.statValue}>{value}</div></div>)}
          </div>
        ) : null}
        {!auditSummary ? (
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.4 }}>
            Click Scan Records to run a read-only renewal classification check. Records are changed only after selecting rows and applying an audit action.
          </p>
        ) : null}
        {auditRows.length > 0 ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={shell.ghostBtn} disabled={busy} onClick={() => runAuditAction('mark_contract', 'Mark as Contract')}>Mark as Contract</button>
              <button type="button" style={shell.ghostBtn} disabled={busy} onClick={() => runAuditAction('mark_one_time', 'Mark as Jobbing')}>Mark as Jobbing</button>
              <button type="button" style={shell.ghostBtn} disabled={busy} onClick={() => runAuditAction('keep_as_renewal', 'Keep as Renewal')}>Keep as Renewal</button>
              <button type="button" style={shell.dangerBtn} disabled={busy} onClick={() => runAuditAction('exclude_from_renewal', 'Exclude from Renewal')}>Exclude from Renewal</button>
            </div>
            <div style={shell.tableWrap}>
              <table style={{ ...shell.table, minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={shell.th}>Select</th>
                    <th style={shell.th}>Customer</th>
                    <th style={shell.th}>Service</th>
                    <th style={shell.th}>Type</th>
                    <th style={shell.th}>Eligible</th>
                    <th style={shell.th}>Suggestion</th>
                    <th style={shell.th}>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.slice(0, 80).map((row) => (
                    <tr key={row.renewalId}>
                      <td style={shell.td}><input type="checkbox" checked={selectedAuditIds.includes(row.renewalId)} onChange={() => toggleAuditRow(row.renewalId)} aria-label={`Select ${row.customerName || row.renewalId}`} /></td>
                      <td style={shell.td} title={row.customerName}>{row.customerName || '-'}</td>
                      <td style={shell.td} title={row.serviceType}>{row.serviceType || '-'}</td>
                      <td style={shell.td}>{row.serviceRelationshipType || '-'}</td>
                      <td style={shell.td}>{row.renewalEligible ? 'Yes' : 'No'}</td>
                      <td style={shell.td}>{row.auditSuggestion || '-'}</td>
                      <td style={shell.td} title={(row.auditEvidence || []).join(', ')}>{(row.auditEvidence || []).join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : auditSummary ? <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 13 }}>No audit rows found.</p> : null}
      </div>
    </div>
  );

  const renderModal = () => {
    if (!modal.type || !modal.row) return null;
    const row = modal.row;
    const displayRenewalId = row.renewalDisplayId || row.renewal_display_id || row.renewalId || row.renewal_id || '';
    const selectedExisting = existingLinks.candidates.find((item) => item.key === form.existingCandidateKey);
    const matchingExisting = existingLinks.candidates.filter((item) => `${item.invoiceNumber} ${item.customerName} ${item.serviceType} ${item.premiseLabel} ${item.start} ${item.end} ${item.contractStatusLabel || ''}`.toLowerCase().includes(existingLinks.search.toLowerCase()) || item.key === form.existingCandidateKey);
    const titleMap = {
      view: 'Renewal Details',
      edit: 'Edit Renewal',
      assign: 'Assign Sales Person',
      followup: 'Log Follow-up',
      done: row.status === 'Renewed' ? 'Renewal Done' : 'Renew Contract',
      decline: row.status === 'Lost' || row.status === 'Declined' ? 'Renewal Lost' : 'Mark as Lost',
      convert: row.serviceRelationshipType === 'ONE_TIME' ? 'Convert to Contract' : 'Mark as Won'
    };
    const declineReasons = ['Price too high', 'Competitor selected', 'Customer no longer requires service', 'Customer dissatisfied with previous service', 'Property vacated or closed', 'Budget unavailable', 'Customer unreachable', 'Service no longer applicable', 'Other'];
    return (
      <div style={shell.modalOverlay}>
        <div style={shell.modal}>
          <div style={shell.modalHead}><strong>{titleMap[modal.type]}</strong><button style={shell.modalCloseBtn} onClick={closeModal} title="Close" aria-label="Close">×</button></div>
          <div style={shell.modalBody}>
            {modal.type === 'view' && (
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <strong>{row.customerName}</strong>
                <span>Renewal ID: {displayRenewalId || '-'}</span>
                <span>Mobile: {row.mobile || '-'}</span>
                <span>Service: {row.serviceType || '-'}</span>
                <span>Contract / Invoice: {row.invoiceNumber || row.contractId || '-'}</span>
                <span>Contract Period: {formatDate(row.previousContractStart)} - {formatDate(row.previousContractEnd)}</span>
                <span>Duration: {contractDurationText(row)}</span>
                {row.existingRenewalLink ? (
                  <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, display: 'grid', gap: 6 }}>
                    <strong>Won — linked to existing records</strong>
                    <span>Invoice: {row.existingRenewalLink.invoiceNumber}</span>
                    <span>Renewed period: {formatDate(row.existingRenewalLink.start)} – {formatDate(row.existingRenewalLink.end)}</span>
                    <span>Agreement date: {formatDate(row.existingRenewalLink.agreementDate)}</span>
                    <span>Linked by: {row.existingRenewalLink.linkedBy} · {formatDate(row.existingRenewalLink.linkedAt)}</span>
                    {row.existingRenewalLink.notes ? <span>Notes: {row.existingRenewalLink.notes}</span> : null}
                    <a href={`/sales/contracts?openInvoiceId=${encodeURIComponent(row.existingRenewalLink.invoiceId)}&fromContract=1&viewContract=1`} target="_blank" rel="noreferrer">Open linked contract / invoice</a>
                    {canManageRenewals ? <button style={shell.ghostBtn} onClick={() => openModal('convert', row)}>Correct existing link</button> : null}
                  </div>
                ) : isWonRenewal(row) && !row.convertedContractId && !row.newContractId && canUseAssignedRenewal(row) ? (
                  <button style={shell.ghostBtn} onClick={() => openModal('convert', row)}>Link existing contract / invoice</button>
                ) : null}
                <span>Renewal Date: {formatDate(row.renewalDueDate || row.previousContractEnd)}</span>
                <span>Service Progress: {serviceProgressText(row)}</span>
                <span>Contract Amount: {formatOptionalINR(row.contractAmount)}</span>
                <span>Paid: {formatOptionalINR(row.paidAmount)}</span>
                <span>Outstanding: {formatOptionalINR(row.outstandingAmount)}</span>
                <span>Proposed Amount: {formatOptionalINR(row.proposedAmount)}</span>
                <span>Sales Person: {row.assignedSalesPersonName || '-'}</span>
                {row.renewalLetterUrl ? <a href={`${API_BASE}${row.renewalLetterUrl}`} onClick={(event) => { event.preventDefault(); openRenewalPdfPreview(row); }} rel="noreferrer">Open renewal letter</a> : null}
                {canUseAssignedRenewal(row) ? <button style={shell.ghostBtn} onClick={() => openModal('edit', row)}>Edit Renewal</button> : null}
                {canUseAssignedRenewal(row) && row.status === 'Done' && !row.convertedContractId ? <button style={shell.primaryBtn} onClick={() => openModal('convert', row)}>Convert to New Contract</button> : null}
              </div>
            )}
            {modal.type === 'edit' && (
              <>
                <label style={shell.field}><span style={shell.label}>Service Type</span><input style={shell.input} value={form.serviceType} onChange={(e) => setForm((p) => ({ ...p, serviceType: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Renewal Due Date</span><input type="date" style={shell.input} value={form.renewalDueDate} onChange={(e) => setForm((p) => ({ ...p, renewalDueDate: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Proposed Amount</span><input style={shell.input} value={form.proposedAmount} onChange={(e) => setForm((p) => ({ ...p, proposedAmount: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Status</span><select style={shell.input} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>{statuses.filter((s) => s !== 'All').map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                <button
                  style={shell.primaryBtn}
                  disabled={busy}
                  onClick={() => runAction('Renewal updated', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/edit`, form))}
                >
                  Save Renewal
                </button>
              </>
            )}
            {modal.type === 'assign' && (
              <>
                <label style={shell.field}><span style={shell.label}>Sales Person</span><select style={shell.input} value={form.salesPersonId} onChange={(e) => {
                  const selected = salesPeople.find((p) => String(p.id || p.name) === e.target.value);
                  setForm((prev) => ({ ...prev, salesPersonId: e.target.value, salesPersonName: selected?.name || '' }));
                }}><option value="">Select sales person</option>{salesPeople.map((p) => <option key={p.id || p.name} value={p.id || p.name}>{p.name}</option>)}</select></label>
                <button style={shell.primaryBtn} disabled={busy} onClick={() => runAction('Sales person assigned', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/assign`, form))}>Assign</button>
              </>
            )}
            {modal.type === 'followup' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 8, fontSize: 13 }}>
                  <span><strong>Customer:</strong> {row.customerName || '-'}</span>
                  <span><strong>Mobile:</strong> {row.mobile || '-'}</span>
                  <span><strong>Service:</strong> {row.serviceType || '-'}</span>
                  <span><strong>Status:</strong> {row.status || '-'}</span>
                </div>
                <label style={shell.field}><span style={shell.label}>Follow-up Date</span><input type="date" style={shell.input} value={form.followupDate} onChange={(e) => setForm((p) => ({ ...p, followupDate: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Note</span><textarea style={{ ...shell.input, height: 86, paddingTop: 8 }} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} /></label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a style={{ ...shell.ghostBtn, textDecoration: 'none' }} href={row.mobile ? `tel:${row.mobile}` : undefined} title="Call customer" aria-label="Call customer"><Phone size={15} />Call</a>
                  <button type="button" style={shell.ghostBtn} title="WhatsApp customer" aria-label="WhatsApp customer" onClick={() => openRenewalWhatsAppComposer(row)}><MessageCircleMore size={15} />WhatsApp</button>
                  <button type="button" style={shell.primaryBtn} disabled={busy} onClick={() => runAction('Follow-up saved', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/followup`, form))}>Save Follow-up</button>
                  <button type="button" style={shell.ghostBtn} onClick={closeModal}>Cancel</button>
                </div>
              </>
            )}
            {modal.type === 'done' && (
              row.status === 'Done' ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'color-mix(in srgb, var(--color-success) 14%, var(--surface-card))', border: '1px solid color-mix(in srgb, var(--color-success) 34%, var(--color-border))', color: 'var(--color-success)', fontWeight: 800, fontSize: 16 }}>
                    Renewal Done
                  </div>
                  <div style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span><strong>Final Amount:</strong> {formatINR(row.finalRenewalAmount || row.finalAmount || row.proposedAmount)}</span>
                    <span><strong>Notes:</strong> {String(row.renewalNotes || row.notes || row.lastNote || '-')}</span>
                  </div>
                  <button style={shell.ghostBtn} onClick={closeModal}>Close</button>
                </div>
              ) : (
                <>
                  <label style={shell.field}><span style={shell.label}>Final Amount</span><input style={shell.input} value={form.finalAmount} onChange={(e) => setForm((p) => ({ ...p, finalAmount: e.target.value }))} /></label>
                  <label style={shell.field}><span style={shell.label}>Notes</span><textarea style={{ ...shell.input, height: 76, paddingTop: 8 }} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value, notes: e.target.value }))} /></label>
                  <button style={shell.primaryBtn} disabled={busy} onClick={() => runAction('Renewal marked done', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/mark-done`, form))}>Mark Done</button>
                </>
              )
            )}
            {modal.type === 'decline' && (
              row.status === 'Declined' || row.status === 'Lost' ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'color-mix(in srgb, var(--color-danger) 12%, var(--surface-card))', border: '1px solid color-mix(in srgb, var(--color-danger) 34%, var(--color-border))', color: 'var(--color-danger)', fontWeight: 800, fontSize: 16 }}>
                    Renewal Lost
                  </div>
                  <div style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span><strong>Reason:</strong> {String(row.lostReason || row.declineReason || row.reason || row.remarks || '-')}</span>
                    <span><strong>Notes:</strong> {String(row.lostNotes || row.lastFollowupNote || '-')}</span>
                  </div>
                  <button style={shell.ghostBtn} onClick={closeModal}>Close</button>
                </div>
              ) : (
                <>
                  <label style={shell.field}><span style={shell.label}>Decision Date</span><input type="date" style={shell.input} value={form.outcomeDecisionDate || ''} onChange={(e) => setForm((p) => ({ ...p, outcomeDecisionDate: e.target.value }))} /></label>
                  <label style={shell.field}><span style={shell.label}>Lost Reason</span><select style={shell.input} value={form.reasonCategory || ''} onChange={(e) => setForm((p) => ({ ...p, reasonCategory: e.target.value, reason: e.target.value === 'Other' ? p.reason : e.target.value }))}><option value="">Select reason</option>{declineReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label>
                  {form.reasonCategory === 'Other' ? <label style={shell.field}><span style={shell.label}>Other Reason</span><input style={shell.input} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} /></label> : null}
                  <label style={shell.field}><span style={shell.label}>Notes</span><textarea style={{ ...shell.input, height: 76, paddingTop: 8 }} value={form.lostNotes || ''} onChange={(e) => setForm((p) => ({ ...p, lostNotes: e.target.value, notes: e.target.value }))} /></label>
                  <button style={shell.dangerBtn} disabled={busy} onClick={() => {
                    if (!window.confirm('Mark this renewal as lost?')) return;
                    runAction('Renewal marked lost', () => axios.post(`${API_BASE}/api/renewals/${row.renewalId}/decline`, form));
                  }}>Mark as Lost</button>
                </>
              )
            )}
            {modal.type === 'convert' && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={form.wonMode === 'existing' ? shell.primaryBtn : shell.ghostBtn} disabled={busy} onClick={() => setForm((prev) => ({ ...prev, wonMode: 'existing', existingCandidateKey: '', agreementDate: '' }))}>Already renewed — Link existing records</button>
                  {!form.correctExistingLink ? <button type="button" style={form.wonMode === 'new' ? shell.primaryBtn : shell.ghostBtn} disabled={busy} onClick={() => setForm((prev) => ({ ...prev, wonMode: 'new', agreementDate: todayInput() }))}>New renewal — Create contract</button> : null}
                </div>
                {form.wonMode === 'existing' ? (
                  <>
                    <strong>{row.customerName} · {row.serviceType}</strong>
                    <span>Previous contract: {row.invoiceNumber || row.contractId} · {formatDate(row.previousContractStart)} – {formatDate(row.previousContractEnd)}</span>
                    <p style={{ margin: 0 }}>Select the renewed contract / invoice that already exists. Saving marks this renewal Won without creating another contract or invoice.</p>
                    <label style={shell.field}><span style={shell.label}>Search existing invoices — Active & Expired</span><input style={shell.input} value={existingLinks.search} onChange={(event) => setExistingLinks((prev) => ({ ...prev, search: event.target.value }))} placeholder="Invoice number, service, premises or period" /></label>
                    <button type="button" style={shell.ghostBtn} disabled={existingLinks.loading || busy} onClick={() => { setForm((prev) => ({ ...prev, existingCandidateKey: '', agreementDate: '' })); setExistingLinksReload((prev) => prev + 1); }}>Refresh records</button>
                    {existingLinks.loading ? <span>Loading customer invoice history…</span> : null}
                    {existingLinks.error ? <p role="alert" style={{ color: 'var(--color-danger)', margin: 0 }}>{existingLinks.error}</p> : null}
                    {!existingLinks.loading && !existingLinks.error && existingLinks.candidates.length === 0 ? <p>No invoice records were found for this customer. Refresh records to check again.</p> : null}
                    {!existingLinks.loading && !existingLinks.error && existingLinks.candidates.length > 0 && matchingExisting.length === 0 ? <p role="status">No invoice numbers match this search. Try the complete invoice number or clear the search to see all active and expired records.</p> : null}
                    <label style={shell.field}><span style={shell.label}>Existing contract / invoice</span><select style={shell.input} value={form.existingCandidateKey || ''} disabled={existingLinks.loading || busy} onChange={(event) => { const candidate = existingLinks.candidates.find((item) => item.key === event.target.value); setForm((prev) => ({ ...prev, existingCandidateKey: event.target.value, agreementDate: candidate?.agreementDate || '' })); }}>
                      <option value="">Select a record</option>
                      {matchingExisting.map((item) => <option key={item.key} value={item.key}>{item.invoiceNumber} · {item.contractStatusLabel || 'Contract'} · {item.serviceType} · {formatDate(item.start)} – {formatDate(item.end)} · {formatOptionalINR(item.amount)}{item.eligible === false ? ' · Review required' : ''}</option>)}
                    </select></label>
                    {selectedExisting ? <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, display: 'grid', gap: 6 }}>
                      <strong>{selectedExisting.invoiceNumber} · {selectedExisting.contractStatusLabel || 'Contract'}</strong>
                      <span>{selectedExisting.customerName}</span>
                      {selectedExisting.eligible === false ? <p role="status" style={{ margin: 0, color: 'var(--color-danger)' }}>{selectedExisting.eligibilityReason}</p> : null}
                      <span>{selectedExisting.serviceType} · {selectedExisting.premiseLabel}</span>
                      <span>Renewed period: {formatDate(selectedExisting.start)} – {formatDate(selectedExisting.end)}</span>
                      <span>{selectedExisting.eligible === false ? 'Invoice amount' : 'Renewal amount'}: {formatOptionalINR(selectedExisting.amount)}</span>
                      <span>{selectedExisting.amountBasis}. Invoice total: {formatOptionalINR(selectedExisting.invoiceTotal)}.</span>
                      <a href={`/sales/contracts?openInvoiceId=${encodeURIComponent(selectedExisting.invoiceId)}&fromContract=1&viewContract=1`} target="_blank" rel="noreferrer">Review existing contract / invoice</a>
                    </div> : null}
                    <label style={shell.field}><span style={shell.label}>Actual agreement date</span><input type="date" style={shell.input} value={form.agreementDate || ''} max={todayInput()} onChange={(event) => setForm((prev) => ({ ...prev, agreementDate: event.target.value }))} /></label>
                    <span>Invoice date is suggested when no agreement date is stored. Confirm the actual agreement date; the time this link is recorded is tracked separately.</span>
                    <label style={shell.field}><span style={shell.label}>{form.correctExistingLink ? 'Correction reason (required)' : 'Notes'}</span><textarea style={{ ...shell.input, height: 70 }} value={form.note || ''} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} /></label>
                    <button type="button" style={shell.primaryBtn} disabled={busy || existingLinks.loading || !selectedExisting || selectedExisting.eligible === false || !form.agreementDate || (form.correctExistingLink && !form.note?.trim())} onClick={handleLinkExisting}>{form.correctExistingLink ? 'Save corrected link' : 'Link existing records & mark Won'}</button>
                  </>
                ) : (
                  <>
                <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                  <strong>{row.customerName}</strong>
                  <span>{row.serviceRelationshipType === 'ONE_TIME' ? 'Create a new contract from this jobbing service.' : 'Mark this renewal as won and create a linked new contract.'}</span>
                  <span><strong>Previous Contract:</strong> {row.invoiceNumber || row.contractId || '-'}</span>
                  <span><strong>Previous Period:</strong> {formatDate(row.previousContractStart)} - {formatDate(row.previousContractEnd)}</span>
                  <span><strong>Previous Amount:</strong> {formatOptionalINR(form.previousContractAmount)}</span>
                </div>
                <label style={shell.field}><span style={shell.label}>Agreement Date</span><input type="date" style={shell.input} value={form.agreementDate || ''} onChange={(e) => updateConvertForm({ agreementDate: e.target.value })} /></label>
                <label style={shell.field}><span style={shell.label}>New Contract Start</span><input type="date" style={shell.input} value={form.contractStartDate} onChange={(e) => updateConvertForm({ contractStartDate: e.target.value })} /></label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  <label style={shell.field}><span style={shell.label}>Duration</span><input style={shell.input} value={form.contractDurationValue || ''} onChange={(e) => updateConvertForm({ contractDurationValue: e.target.value })} /></label>
                  <label style={shell.field}><span style={shell.label}>Duration Unit</span><select style={shell.input} value={form.contractDurationUnit || 'MONTH'} onChange={(e) => updateConvertForm({ contractDurationUnit: e.target.value })}><option value="DAY">Day</option><option value="MONTH">Month</option><option value="YEAR">Year</option></select></label>
                </div>
                <label style={shell.field}><span style={shell.label}>New Contract End</span><input type="date" style={shell.input} value={form.contractEndDate} onChange={(e) => setForm((p) => ({ ...p, contractEndDate: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Service</span><input style={shell.input} value={form.serviceType} onChange={(e) => setForm((p) => ({ ...p, serviceType: e.target.value }))} /></label>
                <label style={shell.field}><span style={shell.label}>Price</span><select style={shell.input} value={form.priceOption || 'same'} onChange={(e) => updateConvertForm({ priceOption: e.target.value })}><option value="same">Same as previous contract</option><option value="revised">Revised price</option></select></label>
                <label style={shell.field}><span style={shell.label}>Agreed Amount</span><input style={shell.input} value={form.amount} readOnly={form.priceOption === 'same'} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value, priceOption: 'revised' }))} /></label>
                <label style={shell.field}><span style={shell.label}>Notes</span><textarea style={{ ...shell.input, height: 70, paddingTop: 8 }} value={form.note || ''} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value, notes: e.target.value }))} /></label>
                <button style={shell.primaryBtn} disabled={busy} onClick={handleConvertToContract}>{row.serviceRelationshipType === 'ONE_TIME' ? 'Convert to Contract' : 'Mark as Won'}</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={shell.page}>
      <div style={shell.hero}>
        <div>
          <h1 style={shell.title}>Renewals</h1>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: isMobile ? 'stretch' : 'center' }}>
          <div style={shell.searchRow}>
            <div style={headerSearchStyle}>
              <div style={headerSearchWrapStyle}>
                <Search size={16} style={headerSearchIconStyle} />
                <input
                  type="search"
                  style={headerSearchInputStyle}
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Customer, renewal ID, mobile, service..."
                />
              </div>
            </div>
          </div>
        </div>
        <div style={shell.actions}>
          <button type="button" style={shell.ghostBtn} onClick={() => loadData(filters, { autoSync: false, autoGenerateLetters: false })}><RefreshCw size={15} />Refresh</button>
        </div>
      </div>

      {message ? <div style={{ ...shell.panelPad, border: '1px solid var(--color-primary-soft)', borderRadius: 10, background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', fontSize: 13, fontWeight: 800 }}>{message}</div> : null}

      <section style={isMobile ? { ...shell.stats, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : shell.stats}>
        {stats.map((item) => (
          <button
            key={item.label}
            type="button"
            style={{ ...shell.stat, width: '100%', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => openSummaryCard(item.targetTab)}
            aria-label={`Open ${item.label}`}
            title={`Open ${item.label}`}
          >
            <div style={shell.statLabel}>{item.label}</div>
            <div style={{ width: '100%', textAlign: 'left' }}>
              <div style={shell.statValue}>{item.count}</div>
              <div style={shell.statMeta}>{formatINR(item.value || 0)}</div>
            </div>
          </button>
        ))}
      </section>

      {renderFilters()}

      <section style={shell.panel}>
        <div style={isMobile ? shell.tabsMobile : shell.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              style={{
                ...shell.tab,
                ...(isMobile ? shell.tabMobile : {}),
                ...(activeTab === tab ? shell.activeTab : {})
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {loading ? <div style={shell.panelPad}>Loading renewals...</div> : null}
        {!loading && renewalTableTabs.includes(activeTab) ? renderRows() : null}
        {!loading && activeTab === 'Reports' ? (
          <div style={{ ...shell.chartGrid, padding: 12 }}>
            {canAdminRenewals ? renderAuditPanel() : null}
            {renderSummaryList(filteredSummary.monthWiseSummary, 'period')}
            {renderSummaryList(filteredSummary.yearWiseSummary, 'year')}
            {renderSummaryList(filteredSummary.serviceWiseSummary, 'name')}
            {renderSummaryList(filteredSummary.durationWiseSummary, 'name')}
            {renderSummaryList(filteredSummary.salespersonWiseSummary, 'name', 'total', { onCountClick: drillDownBySalesPerson })}
          </div>
        ) : null}
        {!loading && activeTab === 'Renewal Letters' ? (
          <div style={shell.panelPad}>
            {(visibleLetterRows || []).length === 0 ? (
              <p style={{ margin: 0, color: 'var(--color-muted)' }}>No renewal letters generated yet.</p>
            ) : (
              <div style={shell.tableWrap}>
                <table className="crm-compact-table renewal-dashboard-table" style={shell.letterTable}>
                  <thead>
                    <tr>
                      <th style={{ ...shell.th, ...shell.letterCustomerCell }}>Customer</th>
                      <th style={{ ...shell.th, ...shell.letterServiceCell }}>Service</th>
                      <th style={{ ...shell.th, ...shell.letterDateCell }}>Letter Date</th>
                      <th style={{ ...shell.th, ...shell.letterPeriodCell }}>Contract Period</th>
                      <th style={{ ...shell.th, ...shell.letterAmountCell }}>Amount</th>
                      <th style={{ ...shell.th, ...shell.letterPdfCell }}>PDF</th>
                      <th style={{ ...shell.th, ...shell.letterActionsCell }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLetterRows.map((letter) => (
                      <tr key={letter.id || letter.renewalId || letter.pdf_url}>
                        <td style={{ ...shell.td, ...shell.letterCustomerCell }} title={letter.customerName || letter.customer_name || ''}>
                          <strong>{letter.customerName || letter.customer_name || '-'}</strong>
                        </td>
                        <td style={{ ...shell.td, ...shell.letterServiceCell }} title={letter.serviceType || ''}>
                          {letter.serviceType || '-'}
                        </td>
                        <td style={{ ...shell.td, ...shell.letterDateCell }}>
                          {formatDate(letter.conclude_date || letter.concludeDate || letter.generated_at)}
                        </td>
                        <td style={{ ...shell.td, ...shell.letterPeriodCell }} title={`${formatDate(letter.previousContractStart)} - ${formatDate(letter.previousContractEnd)}`}>
                          {formatDate(letter.previousContractStart)} - {formatDate(letter.previousContractEnd)}
                        </td>
                        <td style={{ ...shell.td, ...shell.letterAmountCell }}>
                          {formatOptionalINR(renewalAmountValue(letter))}
                        </td>
                        <td style={{ ...shell.td, ...shell.letterPdfCell }}>
                          <a href={buildRenewalPdfUrl(letter)} onClick={(event) => { event.preventDefault(); openRenewalPdfPreview(letter); }} rel="noreferrer">Open PDF</a>
                        </td>
                        <td style={{ ...shell.td, ...shell.letterActionsCell, overflow: 'visible' }}>
                          {renderRowActions(letter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>
      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        pdfUrl={pdfPreview.pdfUrl}
        downloadFileName={pdfPreview.downloadFileName}
        onClose={() => setPdfPreview({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', renewalId: '', shareContext: null })}
        onShareEmail={pdfPreview.shareContext ? shareRenewalLetterByEmail : undefined}
        onShareWhatsApp={pdfPreview.shareContext ? () => {
          const context = pdfPreview.shareContext || {};
          const renewalId = String(pdfPreview.renewalId || context.renewalId || context.renewal_id || '').trim();
          if (!renewalId) return;
          openRenewalWhatsAppComposer({
            renewalId,
            id: renewalId,
            customerName: context.customerName,
            customer_name: context.customerName,
            mobile: context.customerPhone,
            phone: context.customerPhone,
            renewalDisplayId: context.renewalDisplayId,
            renewal_display_id: context.renewalDisplayId,
            serviceType: context.serviceType,
            service_type: context.serviceType,
            pdf_url: context.pdfUrl,
            renewalLetterUrl: context.pdfUrl
          });
        } : undefined}
        publicShareUrl={pdfPreview.publicShareUrl}
      />
      <WhatsAppPreviewModal
        open={whatsappComposer.open}
        onClose={() => setWhatsappComposer({ open: false, row: null, previewData: null, recipientName: '', recipientPhone: '', recipientType: 'Customer' })}
        previewData={whatsappComposer.previewData}
        recipientName={whatsappComposer.recipientName}
        recipientPhone={whatsappComposer.recipientPhone}
        recipientType={whatsappComposer.recipientType}
        moduleType="renewal"
        sentByUser={getPortalUserName() || 'User'}
        allowRecipientEdit={true}
        showAttachmentFields={false}
        attachmentNote="The renewal letter PDF is attached automatically."
        sendButtonLabel="Send Renewal on WhatsApp"
        onSend={async ({ recipientPhone, normalizedRecipientPhone, message, attachmentOption }) => {
          const phoneNumber = normalizedRecipientPhone || recipientPhone;
          const renewalId = String(whatsappComposer.row?.renewalId || whatsappComposer.row?.renewal_id || whatsappComposer.row?.id || '').trim();
          if (attachmentOption !== 'None' && attachmentOption !== 'Renewal Letter PDF') {
            throw new Error('Renewal WhatsApp template must use Renewal Letter PDF or None.');
          }
          if (attachmentOption === 'None') {
            const response = await axios.post(`${API_BASE}/api/whatsapp/send`, {
              moduleType: 'renewal',
              templateType: 'renewal_reminder',
              templateKey: 'renewal_reminder',
              recipientName: whatsappComposer.recipientName,
              recipientPhone: phoneNumber,
              message,
              moduleName: 'Renewal',
              contextData: whatsappComposer.previewData?.contextData || {}
            });
            window.alert(response.data?.message || 'Renewal WhatsApp sent successfully.');
            return;
          }
          const response = await axios.post(`${API_BASE}/api/renewals/${encodeURIComponent(renewalId)}/send-whatsapp`, {
            phoneNumber,
            message,
            attachmentOption,
          });
          window.alert(response.data?.message || 'Renewal WhatsApp sent successfully.');
        }}
      />
      {toastMessage ? (
        <div style={{
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          zIndex: 7000,
          maxWidth: 'min(420px, calc(100vw - 32px))',
          padding: '12px 14px',
          borderRadius: '12px',
          background: 'rgba(254, 226, 226, 0.98)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.24)',
          boxShadow: '0 12px 30px rgba(15,23,42,0.18)',
          fontSize: '13px',
          fontWeight: 700,
          lineHeight: 1.4
        }}>
          {toastMessage}
        </div>
      ) : null}
      {renderModal()}
    </div>
  );
}
