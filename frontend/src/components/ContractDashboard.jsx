import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { subscribeContractsRefresh, triggerSalesPerformanceRefresh } from '../pages/sales-performance/salesPerformanceApi';
import useColumnResize from './table/useColumnResize';
import {
  AlertCircle,
  BadgeIndianRupee,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  FileText,
  LayoutGrid,
  MapPin,
  Package,
  Plus,
  Receipt,
  RefreshCcw,
  Settings,
  TriangleAlert,
  UserRound,
  Wallet,
  X,
  XCircle
} from 'lucide-react';
import PdfPreviewModal from './PdfPreviewModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const CONTRACT_PAGE_SIZE = 20;

const statusStyles = {
  Active: { background: 'rgba(22,163,74,0.16)', color: '#166534' },
  Upcoming: { background: 'rgba(159,23,77,0.16)', color: 'var(--color-primary-dark)' },
  'Expiring Soon': { background: 'rgba(217,119,6,0.16)', color: '#92400e' },
  Expired: { background: 'rgba(220,38,38,0.16)', color: '#991b1b' },
  Renewed: { background: 'rgba(8,145,178,0.16)', color: '#155e75' }
};

const quickFilterStyles = {
  All: { background: 'rgba(71,85,105,0.12)', color: '#334155' },
  Active: { background: 'rgba(22,163,74,0.16)', color: '#166534' },
  Upcoming: { background: 'rgba(159,23,77,0.16)', color: 'var(--color-primary-dark)' },
  'Expiring Soon': { background: 'rgba(217,119,6,0.16)', color: '#92400e' },
  Expired: { background: 'rgba(220,38,38,0.16)', color: '#991b1b' },
  Renewed: { background: 'rgba(8,145,178,0.16)', color: '#155e75' }
};

const defaultColumnWidths = {
  rowNumber: 42,
  contractNo: 132,
  customer: 180,
  property: 150,
  duration: 150,
  services: 115,
  status: 120,
  total: 120,
  paid: 120,
  due: 115,
  actions: 150
};

const mobileColumnWidths = {
  rowNumber: 44,
  contractNo: 128,
  customer: 140,
  property: 132,
  duration: 124,
  services: 104,
  status: 96,
  total: 104,
  paid: 96,
  due: 96,
  actions: 96
};
const contractColumnResizeBounds = {
  rowNumber: { min: 42, max: 64 },
  contractNo: { min: 100, max: 190 },
  customer: { min: 180, max: 340 },
  property: { min: 140, max: 260 },
  duration: { min: 110, max: 180 },
  services: { min: 160, max: 320 },
  status: { min: 100, max: 160 },
  total: { min: 100, max: 170 },
  paid: { min: 100, max: 170 },
  due: { min: 100, max: 170 },
  actions: { min: 110, max: 170 }
};

const shell = {
  page: {
    display: 'grid',
    gap: '10px',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: 0,
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    overflow: 'visible'
  },
  head: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: '10px', minWidth: 0 },
  titleWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '34px',
    height: '34px',
    padding: '0 10px',
    borderRadius: '8px',
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary-soft)',
    boxSizing: 'border-box'
  },
  title: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  subtitle: { margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 600 },
  headActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0, maxWidth: '100%' },
  beta: { border: '1px solid rgba(159,23,77,0.2)', background: 'rgba(252,231,243,0.6)', color: 'var(--color-primary)', borderRadius: '999px', padding: '7px 12px', fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap' },
  newBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: 'none',
    borderRadius: '9px',
    padding: '0 14px',
    minHeight: '34px',
    height: '34px',
    background: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
    boxSizing: 'border-box',
    lineHeight: 1
  },
  card: { background: 'var(--surface-elevated, #fff)', border: '1px solid var(--color-border)', borderRadius: '14px', overflow: 'hidden', backgroundClip: 'padding-box', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' },
  cardTop: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#fff', borderTopLeftRadius: '14px', borderTopRightRadius: '14px', backgroundClip: 'padding-box', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' },
  cardTitle: { margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1f2937' },
  shownPill: { border: '1px solid var(--color-border)', background: '#f8fafc', color: '#334155', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', fontWeight: 800 },
  quickWrap: { padding: '8px 12px 0', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' },
  quickLabel: { fontSize: '12px', fontWeight: 800, color: '#64748b' },
  chip: {
    border: '1px solid transparent',
    borderRadius: '999px',
    padding: '0 10px',
    minHeight: '34px',
    height: '34px',
    fontSize: '11px',
    fontWeight: 700,
    display: 'inline-flex',
    gap: '5px',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxSizing: 'border-box',
    minWidth: 0,
    lineHeight: 1
  },
  customizeButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-primary-soft)', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '9px', width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', padding: 0, fontSize: '11px', fontWeight: 800, cursor: 'pointer', maxWidth: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)', transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease' },
  customizeMenu: { position: 'fixed', width: '292px', maxHeight: '420px', overflow: 'hidden', background: '#fff', border: '1px solid var(--brand-border-color)', borderRadius: '12px', boxShadow: '0 18px 38px rgba(15,23,42,0.18)', zIndex: 5500 },
  customizeHeader: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '12px', color: '#334155' },
  customizeBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '270px', overflowY: 'auto' },
  customizeRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' },
  filtersBox: { margin: '8px 12px 10px', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '8px', display: 'grid', gap: '8px', background: 'var(--surface-elevated, #fff)', width: 'calc(100% - 24px)', maxWidth: 'calc(100% - 24px)', minWidth: 0, boxSizing: 'border-box' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  filterField: { display: 'grid', gap: '4px' },
  filterLabel: { fontSize: '11px', color: '#64748b', fontWeight: 800 },
  input: { width: '100%', minHeight: '30px', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '0 8px', fontSize: '12px', color: '#334155', background: '#fff', boxSizing: 'border-box' },
  clearBtn: { alignSelf: 'end', minHeight: '30px', borderRadius: '8px', border: '1px solid #F9A8D4', background: '#fff', color: 'var(--color-primary-dark)', fontWeight: 800, padding: '0 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', maxWidth: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap' },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', borderTop: '1px solid var(--color-border)', background: '#fff', backgroundClip: 'padding-box', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' },
  table: { width: '100%', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  th: { textAlign: 'left', verticalAlign: 'middle', fontSize: '9px', fontWeight: 800, color: '#6b7280', padding: '8px 12px 8px 6px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative' },
  td: { textAlign: 'left', verticalAlign: 'middle', padding: '8px 6px', borderBottom: '1px solid #eef2f7', fontSize: '10px', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: '#fff' },
  selectedRow: { background: 'transparent' },
  selectedCell: { background: '#fff' },
  selectedText: { color: '#111827' },
  subText: { marginTop: '1px', fontSize: '9px', color: '#64748b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusPill: { borderRadius: '999px', padding: '3px 7px', fontSize: '9px', fontWeight: 800, display: 'inline-block' },
  typePill: { borderRadius: '8px', padding: '3px 7px', fontSize: '9px', fontWeight: 800, background: 'rgba(34,197,94,0.2)', color: '#15803d' },
  amountGreen: { color: '#16a34a', fontWeight: 800 },
  amountRed: { color: '#dc2626', fontWeight: 800 },
  actionBtn: { border: '1px solid rgba(17,17,17,0.16)', background: '#fff', color: '#1f2937', borderRadius: '10px', minWidth: '86px', minHeight: '32px', padding: '0 8px 0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, lineHeight: 1, transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease' },
  actionIconBox: { width: '16px', height: '16px', borderRadius: '5px', border: '1px solid #d1d5db', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexShrink: 0 },
  actionMenu: { position: 'fixed', width: '170px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 8px 18px rgba(15,23,42,0.1)', zIndex: 5000, overflow: 'hidden' },
  actionMenuItem: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', color: '#1f2937', cursor: 'pointer', padding: '6px 10px', fontSize: '11px', fontWeight: 600, lineHeight: 1.1, minHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  actionMenuDanger: { color: '#dc2626' },
  footer: { padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px', background: '#fff', backgroundClip: 'padding-box', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' },
  footText: { fontSize: '12px', color: '#475569', fontWeight: 700 },
  pager: { display: 'inline-flex', gap: '6px', alignItems: 'center' },
  pageBtn: { minWidth: '34px', width: '34px', minHeight: '32px', height: '32px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#475569', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  pageBtnActive: { border: '1px solid rgba(22,163,74,0.35)', background: 'rgba(22,163,74,0.16)', color: '#15803d', fontWeight: 800 },
  workspace: { background: 'var(--surface-elevated, #fff)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '12px 14px', display: 'grid', gap: '10px' },
  workspaceTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  workspaceNote: { margin: 0, color: '#64748b', fontSize: '13px', fontWeight: 600 },
  workspaceActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  subtleBtn: { minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#334155', fontWeight: 700, padding: '0 12px', cursor: 'pointer' },
  printBtn: { minHeight: '34px', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.35)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, padding: '0 12px', cursor: 'pointer' },
  tabs: { display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' },
  tab: { border: '1px solid transparent', borderRadius: '10px', background: '#fff', color: '#64748b', fontSize: '13px', fontWeight: 700, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', cursor: 'pointer' },
  tabActive: { borderColor: '#F9A8D4', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' },
  loading: { padding: '20px 16px', color: '#64748b', fontSize: '14px', fontWeight: 600 },
  empty: { padding: '24px 16px', textAlign: 'center', color: '#64748b', fontWeight: 700 },
  actionCell: { display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  miniBtn: { border: '1px solid #F9A8D4', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', minHeight: '28px', padding: '0 8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }
  ,
  customerLinkBtn: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    WebkitAppearance: 'none',
    appearance: 'none',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    overflow: 'visible',
    textOverflow: 'clip',
    whiteSpace: 'normal',
    lineHeight: 1.25,
    wordBreak: 'break-word'
  },
  mobileList: { display: 'grid', gap: '8px', padding: '10px' },
  mobileCard: { border: '1px solid var(--color-border)', borderRadius: '12px', padding: '10px', background: '#fff', display: 'grid', gap: '8px' },
  mobileCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' },
  mobileContractNo: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#111827' },
  mobileCustomer: { margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827' },
  mobileMetaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  mobileMetaLabel: { fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' },
  mobileMetaValue: { fontSize: '12px', color: '#1f2937', fontWeight: 700 },
  mobileActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modalCard: { width: 'min(860px, 100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: '14px', border: '1px solid var(--color-primary-soft)', boxShadow: '0 22px 54px rgba(15,23,42,0.2)' },
  modalHead: { padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  modalTitle: { margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  modalSub: { margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 600 },
  modalClose: { border: '1px solid #D1D5DB', background: '#fff', color: '#475569', borderRadius: '8px', minWidth: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  modalBody: { padding: '12px 14px', display: 'grid', gap: '10px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' },
  summaryCard: { border: '1px solid rgba(148,163,184,0.18)', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '12px', padding: '10px 12px', textAlign: 'left', boxShadow: '0 8px 20px rgba(15,23,42,0.05)' },
  summaryLabel: { fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '5px', letterSpacing: '0.04em' },
  summaryValue: { marginTop: '4px', fontSize: '18px', fontWeight: 800, color: '#0f172a' },
  profitSection: { border: '1px solid var(--color-border)', borderRadius: '14px', padding: '12px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', display: 'grid', gap: '10px', boxShadow: '0 10px 24px rgba(15,23,42,0.05)' },
  profitSectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
  profitSectionTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' },
  profitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' },
  profitCard: { border: '1px solid rgba(148,163,184,0.18)', borderRadius: '12px', padding: '10px 12px', background: '#fff' },
  profitCardProfit: { borderColor: 'rgba(22,163,74,0.22)', background: 'rgba(22,163,74,0.08)' },
  profitCardLoss: { borderColor: 'rgba(220,38,38,0.22)', background: 'rgba(220,38,38,0.08)' },
  profitCardAmber: { borderColor: 'rgba(217,119,6,0.22)', background: 'rgba(217,119,6,0.08)' },
  profitLabel: { margin: 0, fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  profitValue: { marginTop: '4px', fontSize: '18px', fontWeight: 800, color: '#0f172a' },
  profitBreakdownGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' },
  profitBreakdownCard: { border: '1px solid rgba(148,163,184,0.16)', borderRadius: '12px', padding: '8px 10px', background: '#fff', boxShadow: '0 6px 16px rgba(15,23,42,0.04)' },
  profitBreakdownLabel: { margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  profitBreakdownValue: { marginTop: '4px', fontSize: '15px', fontWeight: 800, color: '#0f172a' },
  modalToggleBtn: { border: '1px solid #F9A8D4', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', minHeight: '30px', padding: '0 10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'fit-content' },
  detailSection: { border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' },
  detailHead: { padding: '8px 10px', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 800, color: 'var(--text)' , textTransform: 'uppercase' },
  detailTable: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
  detailTh: { fontSize: '10px', fontWeight: 800, color: '#64748b', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', textTransform: 'uppercase' },
  detailTd: { fontSize: '12px', color: 'var(--text)', padding: '8px 10px', borderBottom: '1px solid #f1f5f9', background: '#fff' },
  detailBtn: { border: '1px solid #F9A8D4', background: '#fff', color: 'var(--color-primary-dark)', borderRadius: '7px', minHeight: '26px', padding: '0 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' },
  suggestionBox: { border: '1px dashed rgba(159,23,77,0.26)', borderRadius: '12px', background: 'linear-gradient(180deg, #fff 0%, #fdf2f8 100%)', padding: '8px 10px', fontSize: '12px', color: '#334155', textAlign: 'left' }
};

const normalizeName = (value) => String(value || '').trim().toLowerCase();
const normalize = (value) => String(value || '').toLowerCase().trim();
const getSearchText = (item) => {
  return [
    item.name,
    item.displayName,
    item.customerName,
    item.companyName,
    item.contactPersonName,
    item.title,
    item.mobileNumber,
    item.mobile,
    item.whatsappNumber,
    item.email,
    item.emailId,
    item.billingArea,
    item.area,
    item.areaName,
    item.city,
    item.state,
    item.pincode,
    item.billingAddress,
    item.shippingAddress,
    item.customer,
    item.contractNo,
    item.contractCode,
    item.property
  ]
    .map(normalize)
    .join(' ');
};

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

const formatDate = (value) => {
  if (!value) return '-';
  const dt = parseDateOnly(value);
  if (!dt) return '-';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatINR = (num) => `₹${Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatWholeAmount = (num) => Number(num || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const deriveContractCode = (contractNo) => {
  const raw = String(contractNo || '').trim();
  if (!raw) return '-';
  const swapped = raw.replace(/\/(?:C?INV)\/\d+$/i, '/C');
  if (swapped !== raw) return swapped;
  const bits = raw.split('/').filter(Boolean);
  if (bits.length <= 1) return raw;
  return `${bits.slice(0, -1).join('/')}/C`;
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

const addPdfCacheBust = (url, stamp = Date.now()) => {
  const base = String(url || '').trim();
  if (!base) return '';
  try {
    const parsed = new URL(base, window.location.origin);
    parsed.searchParams.set('_v', String(stamp));
    return parsed.toString();
  } catch {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}_v=${encodeURIComponent(String(stamp))}`;
  }
};

const openInvoicePdf = (invoiceId) => {
  if (!invoiceId) return '';
  return addPdfCacheBust(`${API_BASE}/api/invoices/${invoiceId}/pdf`);
};

const openContractJobCardPdf = (invoiceId) => {
  if (!invoiceId) return '';
  return addPdfCacheBust(`${API_BASE}/api/contracts/${invoiceId}/job-card-summary-pdf`);
};

  const findCustomerForInvoice = (invoice) =>
    customers.find((customer) =>
      (invoice.customerId && String(customer._id) === String(invoice.customerId)) ||
      String(customer.displayName || customer.name || '').trim().toLowerCase() === String(invoice.customerName || '').trim().toLowerCase()
    ) || null;

  const sendInvoiceEmail = async (invoice) => {
    const customer = findCustomerForInvoice(invoice);
    const invoiceNumber = String(invoice.invoiceNumber || '').trim() || 'Invoice';
    const recipient = window.prompt('Enter recipient email', String(customer?.emailId || customer?.email || '').trim());
    if (!recipient) return;
    try {
      const response = await axios.post(`${API_BASE}/api/invoices/${invoice._id}/send-email`, {
        to: recipient,
        templateType: 'invoice_send'
      });
      window.alert(response.data?.message || 'Invoice email sent successfully.');
    } catch (error) {
      console.error('Failed to send invoice email', error);
      window.alert(error?.response?.data?.error || `Could not send ${invoiceNumber} email.`);
    }
  };

export default function ContractDashboard() {
  const navigate = useNavigate();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [quickFilter, setQuickFilter] = useState('All');
  const [filters, setFilters] = useState({ status: 'All Status', type: 'All Type', from: '', to: '', search: '' });
  const [activeTab, setActiveTab] = useState('Overview');
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [serviceSchedules, setServiceSchedules] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [actionMenu, setActionMenu] = useState(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [customizeMenuPosition, setCustomizeMenuPosition] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState({
    contractNo: true,
    customer: true,
    property: true,
    duration: true,
    services: true,
    status: true,
    total: true,
    paid: true,
    due: true
  });
  const [customerSummary, setCustomerSummary] = useState({ open: false, row: null, showHistory: false });
  const [customerProfitSummary, setCustomerProfitSummary] = useState(null);
  const [customerProfitLoading, setCustomerProfitLoading] = useState(false);
  const [customerProfitError, setCustomerProfitError] = useState('');
  const [pdfPreview, setPdfPreview] = useState({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', invoiceId: '' });
  const [page, setPage] = useState(1);
  const customizeButtonRef = useRef(null);
  const {
    getColumnWidth: getResizableColumnWidth,
    startResize: startColumnResize,
    resetColumns: resetContractColumns
  } = useColumnResize({
    storageKey: 'contracts_column_widths',
    columns: ['rowNumber', 'contractNo', 'customer', 'property', 'duration', 'services', 'status', 'total', 'paid', 'due', 'actions'],
    defaultColumnWidths,
    columnBounds: contractColumnResizeBounds,
    minWidth: 80,
    enabled: viewportWidth > 768
  });

  const updateCustomizeMenuPosition = () => {
    const rect = customizeButtonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const menuWidth = Math.min(292, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const availableBelow = window.innerHeight - rect.bottom - 10;
    const availableAbove = rect.top - 10;
    const opensAbove = availableBelow < 420 && availableAbove > availableBelow;
    const availableSpace = opensAbove ? availableAbove : availableBelow;
    const maxHeight = Math.min(420, Math.max(180, availableSpace));
    const top = opensAbove
      ? Math.max(8, rect.top - maxHeight - 8)
      : Math.min(rect.bottom + 8, window.innerHeight - maxHeight - 8);

    setCustomizeMenuPosition({
      top,
      left,
      width: menuWidth,
      maxHeight
    });
  };

  const loadLivePayments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/payment-received`);
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      try {
        const legacy = await axios.get(`${API_BASE}/api/payments`);
        return Array.isArray(legacy.data) ? legacy.data : [];
      } catch (_fallbackError) {
        return [];
      }
    }
  };

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadContractsData = async (options = {}) => {
    if (!options.silent) setLoading(true);
    setLoadError('');
    try {
      const [invoiceRes, customerRes, schedulesRes, paymentsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/invoices`),
        axios.get(`${API_BASE}/api/customers`),
        axios.get(`${API_BASE}/api/service-schedules`),
        loadLivePayments()
      ]);

      const nextInvoices = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
      const nextCustomers = Array.isArray(customerRes.data) ? customerRes.data : [];
      const nextSchedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];
      const nextPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
      setInvoices(nextInvoices);
      setCustomers(nextCustomers);
      setServiceSchedules(nextSchedules);
      setPayments(nextPayments);
    } catch (error) {
      console.error('Failed to load contracts dashboard data', error);
      if (!options.silent) {
        setLoadError('Unable to fetch contracts right now. Please refresh once.');
        setInvoices([]);
        setCustomers([]);
        setServiceSchedules([]);
        setPayments([]);
      }
    } finally {
      if (!options.silent) setLoading(false);
    }
  };

  const loadContractProfitSummary = async (invoiceId) => {
    if (!invoiceId) return false;
    try {
      setCustomerProfitLoading(true);
      setCustomerProfitError('');
      const res = await axios.get(`${API_BASE}/api/contracts/${invoiceId}/profit-loss`);
      setCustomerProfitSummary(res.data || null);
      return true;
    } catch (error) {
      console.error('Failed to load contract profit summary', error);
      setCustomerProfitSummary(null);
      setCustomerProfitError(error?.response?.data?.error || 'Could not load profit and cost summary.');
      return false;
    } finally {
      setCustomerProfitLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [invoiceRes, customerRes, schedulesRes, paymentsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/invoices`),
          axios.get(`${API_BASE}/api/customers`),
          axios.get(`${API_BASE}/api/service-schedules`),
          loadLivePayments()
        ]);

        if (!mounted) return;

        const nextInvoices = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
        const nextCustomers = Array.isArray(customerRes.data) ? customerRes.data : [];
        const nextSchedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];
        const nextPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
        setInvoices(nextInvoices);
        setCustomers(nextCustomers);
        setServiceSchedules(nextSchedules);
        setPayments(nextPayments);
      } catch (error) {
        console.error('Failed to load contracts dashboard data', error);
        if (!mounted) return;
        setLoadError('Unable to fetch contracts right now. Please refresh once.');
        setInvoices([]);
        setCustomers([]);
        setServiceSchedules([]);
        setPayments([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useAutoRefresh(() => loadContractsData({ silent: true }), { enabled: !customerSummary.open });

  useEffect(() => {
    const refreshOpenPdf = () => {
      setPdfPreview((prev) => {
        if (!prev.open || !prev.invoiceId || !prev.pdfUrl) return prev;
        const invoiceId = String(prev.invoiceId || '').trim();
        if (!invoiceId) return prev;
        const nextUrl = String(prev.pdfUrl || '').includes('/job-card-summary-pdf')
          ? addPdfCacheBust(`${API_BASE}/api/contracts/${invoiceId}/job-card-summary-pdf`)
          : addPdfCacheBust(`${API_BASE}/api/invoices/${invoiceId}/pdf`);
        return {
          ...prev,
          pdfUrl: nextUrl,
          publicShareUrl: nextUrl
        };
      });
    };

    return subscribeContractsRefresh(refreshOpenPdf);
  }, []);

  useEffect(() => {
    const onDocClick = (event) => {
      const target = event.target;
      const insideActionTrigger = target && typeof target.closest === 'function'
        ? target.closest('[data-contract-row-action="true"]')
        : null;
      const insideActionMenu = target && typeof target.closest === 'function'
        ? target.closest('[data-contract-action-menu="true"]')
        : null;
      const insideCustomize = target && typeof target.closest === 'function'
        ? target.closest('[data-contract-customize="true"]')
        : null;
      if (actionMenu && !insideActionTrigger && !insideActionMenu) setActionMenu(null);
      if (showCustomize && !insideCustomize) setShowCustomize(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [actionMenu, showCustomize]);

  useEffect(() => {
    if (!showCustomize) {
      setCustomizeMenuPosition(null);
      return undefined;
    }

    updateCustomizeMenuPosition();
    window.addEventListener('resize', updateCustomizeMenuPosition);
    window.addEventListener('scroll', updateCustomizeMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateCustomizeMenuPosition);
      window.removeEventListener('scroll', updateCustomizeMenuPosition, true);
    };
  }, [showCustomize]);

  useEffect(() => {
    const clearMenu = () => setActionMenu(null);
    window.addEventListener('resize', clearMenu);
    window.addEventListener('scroll', clearMenu, true);
    return () => {
      window.removeEventListener('resize', clearMenu);
      window.removeEventListener('scroll', clearMenu, true);
    };
  }, []);

  const customerIndex = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    customers.forEach((customer) => {
      if (customer?._id) byId.set(String(customer._id), customer);
      const display = normalizeName(customer?.displayName || customer?.name);
      if (display && !byName.has(display)) byName.set(display, customer);
    });
    return { byId, byName };
  }, [customers]);

  const scheduleIndex = useMemo(() => {
    const byInvoiceId = new Map();
    const byInvoiceNumber = new Map();
    const today = parseDateOnly(new Date());

    serviceSchedules.forEach((schedule) => {
      const invoiceId = String(schedule?.invoiceId || '').trim();
      const invoiceNumber = String(schedule?.invoiceNumber || '').trim().toLowerCase();
      const status = String(schedule?.status || '').trim().toLowerCase();
      const serviceDate = parseDateOnly(schedule?.serviceDate);
      if (!serviceDate) return;

      const applyTo = (target) => {
        const current = target || { total: 0, completed: 0, nextServiceDate: '', nextServiceTime: '' };
        current.total += 1;
        if (status.includes('complete')) current.completed += 1;

        const isClosed = status.includes('complete') || status.includes('cancel');
        if (!isClosed && serviceDate >= today) {
          const nextKnown = parseDateOnly(current.nextServiceDate);
          if (!nextKnown || serviceDate < nextKnown) {
            current.nextServiceDate = toInputDate(serviceDate);
            current.nextServiceTime = String(schedule?.serviceTime || '').trim();
          }
        }
        return current;
      };

      if (invoiceId) byInvoiceId.set(invoiceId, applyTo(byInvoiceId.get(invoiceId)));
      if (invoiceNumber) byInvoiceNumber.set(invoiceNumber, applyTo(byInvoiceNumber.get(invoiceNumber)));
    });

    return { byInvoiceId, byInvoiceNumber };
  }, [serviceSchedules]);

  const allContracts = useMemo(() => {
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
      const due = Math.max(0, Number(invoice.balanceDue ?? 0));
      const paid = Math.max(0, total - due);

      const normalizedInvoiceType = String(invoice.invoiceType || '').trim().toUpperCase();
      const type = normalizedInvoiceType === 'NON GST' ? 'Non GST' : (Number(invoice.totalTax || 0) > 0 ? 'GST' : 'Non GST');
      const startInputDate = toInputDate(startDate);
      const endInputDate = toInputDate(endDate || startDate);

      const contractNo = String(invoice.invoiceNumber || '').trim() || `CONTRACT-${index + 1}`;
      const serviceMeta = scheduleIndex.byInvoiceId.get(String(invoice._id || ''))
        || scheduleIndex.byInvoiceNumber.get(contractNo.toLowerCase())
        || { total: lines.length, completed: 0, nextServiceDate: '', nextServiceTime: '' };

      return {
        id: String(invoice._id || contractNo || index),
        invoiceId: invoice._id,
        contractNo,
        contractCode: deriveContractCode(contractNo),
        customer: String(invoice.customerName || customer?.displayName || customer?.name || 'Customer'),
        mobile: String(customer?.mobileNumber || customer?.workPhone || '').trim(),
        property: String(customer?.billingArea || customer?.shippingArea || customer?.billingAddress || customer?.shippingAddress || invoice.customerName || '-').trim(),
        city: String(customer?.billingState || customer?.shippingState || '-').trim(),
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
  }, [customerIndex.byId, customerIndex.byName, invoices, scheduleIndex.byInvoiceId, scheduleIndex.byInvoiceNumber]);

  useEffect(() => {
    if (!selectedContractId && allContracts.length > 0) {
      setSelectedContractId(allContracts[0].id);
      return;
    }
    if (selectedContractId && !allContracts.some((entry) => entry.id === selectedContractId)) {
      setSelectedContractId(allContracts[0]?.id || '');
    }
  }, [allContracts, selectedContractId]);

  const typeOptions = useMemo(() => {
    const uniqueTypes = Array.from(new Set(allContracts.map((row) => row.type).filter(Boolean)));
    return ['All Type', ...uniqueTypes];
  }, [allContracts]);

  const filteredContracts = useMemo(() => {
    return allContracts.filter((row) => {
      if (quickFilter !== 'All' && row.status !== quickFilter) return false;
      if (filters.status !== 'All Status' && row.status !== filters.status) return false;
      if (filters.type !== 'All Type' && row.type !== filters.type) return false;
      if (filters.from && row.startDate && row.startDate < filters.from) return false;
      if (filters.to && row.startDate && row.startDate > filters.to) return false;

      const search = normalize(filters.search);
      if (search && !getSearchText(row).includes(search)) return false;
      return true;
    });
  }, [allContracts, filters, quickFilter]);

  const sortedContracts = useMemo(() => filteredContracts, [filteredContracts]);
  const totalPages = Math.max(1, Math.ceil(sortedContracts.length / CONTRACT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedContracts = useMemo(() => {
    const start = (safePage - 1) * CONTRACT_PAGE_SIZE;
    return sortedContracts.slice(start, start + CONTRACT_PAGE_SIZE);
  }, [safePage, sortedContracts]);
  const firstRecord = sortedContracts.length ? ((safePage - 1) * CONTRACT_PAGE_SIZE) + 1 : 0;
  const lastRecord = Math.min(safePage * CONTRACT_PAGE_SIZE, sortedContracts.length);

  useEffect(() => {
    setPage(1);
  }, [filters, quickFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const customerSummaryData = useMemo(() => {
    if (!customerSummary?.row) return null;
    const baseName = normalizeName(customerSummary.row.customer);
    const relatedInvoices = invoices.filter((invoice) => {
      const invoiceName = normalizeName(invoice?.customerName);
      if (invoiceName && invoiceName === baseName) return true;
      return customerSummary.row.invoiceId && String(invoice?._id) === String(customerSummary.row.invoiceId);
    });

    const invoiceIdSet = new Set(relatedInvoices.map((entry) => String(entry?._id || '')).filter(Boolean));
    const invoiceExternalIdSet = new Set(relatedInvoices.map((entry) => normalizeName(entry?.external_id || entry?.externalId)).filter(Boolean));
    const invoiceNoSet = new Set(relatedInvoices.map((entry) => normalizeName(entry?.invoiceNumber)).filter(Boolean));

    const relatedPayments = payments.filter((payment) => {
      const payInvoiceId = normalizeName(
        payment?.invoiceId ||
        payment?.linked_invoice_external_id ||
        payment?.linkedInvoiceExternalId ||
        payment?.invoice_external_id ||
        payment?.invoiceExternalId
      );
      const payInvoiceNo = normalizeName(payment?.invoiceNumber || payment?.invoice_no || payment?.invoiceNo);
      const payCustomer = normalizeName(payment?.customerName || payment?.customer_name);
      if (payInvoiceId && (invoiceIdSet.has(payInvoiceId) || invoiceExternalIdSet.has(payInvoiceId))) return true;
      if (payInvoiceNo && invoiceNoSet.has(payInvoiceNo)) return true;
      return payCustomer && payCustomer === baseName;
    });

    const totalInvoiced = relatedInvoices.reduce((sum, entry) => sum + Number(entry?.total || entry?.amount || 0), 0);
    const totalPaid = relatedPayments.reduce((sum, entry) => sum + Number(entry?.amount || 0), 0);
    const balanceDue = Math.max(0, relatedInvoices.reduce((sum, entry) => sum + Number(entry?.balanceDue || 0), 0));
    const transactionCount = relatedPayments.length;
    const complaintsCount = 0;

    return {
      relatedInvoices,
      relatedPayments,
      totalInvoiced,
      totalPaid,
      balanceDue,
      transactionCount,
      complaintsCount
    };
  }, [customerSummary?.row, invoices, payments]);

  const openPdfPreview = (title, pdfUrl, fileName, invoiceId = '') => {
    if (!pdfUrl) return;
    setPdfPreview({
      open: true,
      title,
      pdfUrl,
      downloadFileName: `${String(fileName || title || 'document').replace(/[^\w.-]+/g, '_')}.pdf`,
      publicShareUrl: pdfUrl,
      invoiceId: String(invoiceId || '').trim()
    });
  };

  const summaryCounts = useMemo(() => {
    const counts = { All: allContracts.length, Active: 0, Upcoming: 0, 'Expiring Soon': 0, Expired: 0, Renewed: 0 };
    allContracts.forEach((row) => {
      if (counts[row.status] !== undefined) counts[row.status] += 1;
    });
    return counts;
  }, [allContracts]);

  const selectedContract = useMemo(
    () => allContracts.find((row) => row.id === selectedContractId) || sortedContracts[0] || allContracts[0] || null,
    [allContracts, selectedContractId, sortedContracts]
  );

  const tabs = [
    { label: 'Overview', icon: LayoutGrid },
    { label: 'Schedules', icon: CalendarRange },
    { label: 'Payments', icon: BadgeIndianRupee },
    { label: 'Invoices', icon: Receipt },
    { label: 'Material Usage', icon: Package },
    { label: 'Site Media', icon: MapPin }
  ];

  const quickFilters = [
    { label: 'All', icon: Filter },
    { label: 'Active', icon: CheckCircle2 },
    { label: 'Upcoming', icon: CalendarDays },
    { label: 'Expiring Soon', icon: TriangleAlert },
    { label: 'Expired', icon: XCircle },
    { label: 'Renewed', icon: RefreshCcw }
  ];
  const customColumns = [
    { key: 'contractNo', label: 'Contract #' },
    { key: 'customer', label: 'Customer' },
    { key: 'property', label: 'Property' },
    { key: 'duration', label: 'Duration' },
    { key: 'services', label: 'Services' },
    { key: 'status', label: 'Status' },
    { key: 'total', label: 'Total' },
    { key: 'paid', label: 'Paid' },
    { key: 'due', label: 'Due' }
  ];
  const isMobile = viewportWidth <= 768;
  const getColumnWidth = (columnKey) => {
    const desktopWidth = getResizableColumnWidth(columnKey) || defaultColumnWidths[columnKey] || 120;
    const width = isMobile
      ? Math.max(Number(mobileColumnWidths[columnKey] || 0), Number(defaultColumnWidths[columnKey] || 0))
      : Number(desktopWidth) || Number(defaultColumnWidths[columnKey] || 0);
    const baseWidth = Math.max(columnKey === 'rowNumber' ? 42 : 80, width);
    if (!isMobile && columnKey === 'services') return Math.min(baseWidth, 92);
    if (!isMobile && columnKey === 'status') return Math.min(baseWidth, 96);
    return baseWidth;
  };
  const renderResizableHeader = (columnKey, label, extraStyle = {}) => (
    <th style={{ ...shell.th, width: `${getColumnWidth(columnKey)}px`, minWidth: `${getColumnWidth(columnKey)}px`, ...extraStyle }}>
      {label}
      
    </th>
  );
  const contractColumnList = [
    `${getColumnWidth('rowNumber')}px`,
    visibleColumns.contractNo ? `${getColumnWidth('contractNo')}px` : null,
    visibleColumns.customer ? `${getColumnWidth('customer')}px` : null,
    visibleColumns.property ? `${getColumnWidth('property')}px` : null,
    visibleColumns.duration ? `${getColumnWidth('duration')}px` : null,
    visibleColumns.services ? `${getColumnWidth('services')}px` : null,
    visibleColumns.status ? `${getColumnWidth('status')}px` : null,
    visibleColumns.total ? `${getColumnWidth('total')}px` : null,
    visibleColumns.paid ? `${getColumnWidth('paid')}px` : null,
    visibleColumns.due ? `${getColumnWidth('due')}px` : null,
    `${getColumnWidth('actions')}px`
  ].filter(Boolean);
  const contractTableMinWidth = contractColumnList.reduce((sum, width) => sum + Number.parseInt(width, 10), 0);
  const contractColumnPercent = (columnKey) => `${((getColumnWidth(columnKey) / contractTableMinWidth) * 100).toFixed(4)}%`;
  const compactMobile = viewportWidth <= 430;
  const quickWrapStyle = isMobile
    ? {
      ...shell.quickWrap,
      alignItems: 'stretch',
      padding: '8px 10px 0',
      gap: '7px'
    }
    : shell.quickWrap;
  const quickLabelStyle = compactMobile ? { ...shell.quickLabel, flex: '1 0 100%' } : shell.quickLabel;
  const chipStyle = compactMobile
    ? {
      ...shell.chip,
      flex: '1 1 calc(50% - 7px)',
      maxWidth: 'calc(50% - 4px)',
      minHeight: '34px',
      height: '34px',
      padding: '0 8px',
      fontSize: '10px'
    }
    : shell.chip;
  const customizeWrapStyle = compactMobile
    ? { position: 'relative', flex: '1 0 100%', marginLeft: 0, display: 'flex', justifyContent: 'flex-end' }
    : { position: 'relative', marginLeft: 'auto' };
  const customizeButtonStyle = compactMobile
    ? { ...shell.customizeButton, width: '32px', height: '32px' }
    : shell.customizeButton;
  const filterGridStyle = isMobile ? { ...shell.filterGrid, gridTemplateColumns: '1fr' } : shell.filterGrid;
  const clearButtonStyle = isMobile ? { ...shell.clearBtn, width: '100%' } : shell.clearBtn;
  const mobileDateInputStyle = isMobile
    ? { ...shell.input, minWidth: 0, maxWidth: '100%', display: 'block', WebkitAppearance: 'none', appearance: 'none' }
    : shell.input;
  const tableWrapStyle = isMobile
    ? {
      ...shell.tableWrap,
      overflowX: 'hidden',
      overflowY: 'hidden',
      WebkitOverflowScrolling: 'touch',
      overscrollBehaviorX: 'auto',
      touchAction: 'auto'
    }
    : { ...shell.tableWrap, overflowX: 'hidden', touchAction: 'auto' };
  const tableStyle = isMobile
    ? {
      ...shell.table,
      width: `${contractTableMinWidth}px`,
      minWidth: `${contractTableMinWidth}px`,
      '--mobile-table-columns': contractColumnList.join(' '),
      '--mobile-table-min-width': `${contractTableMinWidth}px`
    }
    : {
      ...shell.table,
      width: '100%',
      minWidth: '100%',
      '--mobile-table-columns': contractColumnList.join(' '),
      '--mobile-table-min-width': '100%'
    };
  const mobileStackCellStyle = isMobile
    ? { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '2px' }
    : {};
  const footerStyle = isMobile ? { ...shell.footer, flexDirection: 'column', alignItems: 'stretch', padding: '8px 10px' } : shell.footer;
  const pagerStyle = isMobile ? { ...shell.pager, justifyContent: 'center' } : shell.pager;
  const cardTopStyle = isMobile ? { ...shell.cardTop, flexDirection: 'column', alignItems: 'stretch' } : shell.cardTop;
  const headActionsStyle = isMobile ? { ...shell.headActions, justifyContent: 'stretch', width: '100%' } : shell.headActions;
  const newButtonStyle = isMobile ? { ...shell.newBtn, width: 'fit-content', minHeight: '32px', height: '32px', padding: '0 10px' } : shell.newBtn;

  const openCustomerSummary = (row) => {
    setCustomerSummary({ open: true, row, showHistory: false });
    setCustomerProfitSummary(null);
    setCustomerProfitError('');
    setCustomerProfitLoading(false);
    if (row?.invoiceId) {
      loadContractProfitSummary(row.invoiceId);
    }
  };

  const closeCustomerSummary = () => {
    setCustomerSummary({ open: false, row: null, showHistory: false });
    setCustomerProfitSummary(null);
    setCustomerProfitError('');
    setCustomerProfitLoading(false);
  };

  const deleteContract = async (row) => {
    if (!row?.invoiceId) return;
    const ok = window.confirm(`Delete contract ${row.contractNo}?`);
    if (!ok) return;
    try {
      await axios.delete(`${API_BASE}/api/invoices/${row.invoiceId}`);
      setInvoices((prev) => prev.filter((invoice) => String(invoice._id) !== String(row.invoiceId)));
      setActionMenu(null);
      triggerSalesPerformanceRefresh();
    } catch (error) {
      console.error('Failed to delete contract', error);
      window.alert('Unable to delete contract right now.');
    }
  };

  const handleTabClick = (tabLabel) => {
    setActiveTab(tabLabel);
    if (!selectedContract) return;

    if (tabLabel === 'Payments') {
      navigate('/sales/payment-received', { state: { openContractNumber: selectedContract.contractNo } });
      return;
    }
    if (tabLabel === 'Invoices') {
      navigate('/sales/invoices', { state: { openInvoiceNumber: selectedContract.contractNo } });
      return;
    }
    if (tabLabel === 'Schedules') {
      navigate('/schedule-job', { state: { customerName: selectedContract.customer, contractNumber: selectedContract.contractNo } });
    }
  };

  const renderBody = () => {
    if (loading) {
      return <div style={shell.loading}>Loading contracts...</div>;
    }
    if (loadError) {
      return <div style={shell.empty}>{loadError}</div>;
    }
    if (sortedContracts.length === 0) {
      return <div style={shell.empty}>No contracts match your current filters.</div>;
    }
    return (
      <table style={tableStyle} className="crm-compact-table">
        <colgroup>
          <col style={{ width: isMobile ? `${getColumnWidth('rowNumber')}px` : contractColumnPercent('rowNumber') }} />
          {visibleColumns.contractNo ? <col style={{ width: isMobile ? `${getColumnWidth('contractNo')}px` : contractColumnPercent('contractNo') }} /> : null}
          {visibleColumns.customer ? <col style={{ width: isMobile ? `${getColumnWidth('customer')}px` : contractColumnPercent('customer') }} /> : null}
          {visibleColumns.property ? <col style={{ width: isMobile ? `${getColumnWidth('property')}px` : contractColumnPercent('property') }} /> : null}
          {visibleColumns.duration ? <col style={{ width: isMobile ? `${getColumnWidth('duration')}px` : contractColumnPercent('duration') }} /> : null}
          {visibleColumns.services ? <col style={{ width: isMobile ? `${getColumnWidth('services')}px` : contractColumnPercent('services') }} /> : null}
          {visibleColumns.status ? <col style={{ width: isMobile ? `${getColumnWidth('status')}px` : contractColumnPercent('status') }} /> : null}
          {visibleColumns.total ? <col style={{ width: isMobile ? `${getColumnWidth('total')}px` : contractColumnPercent('total') }} /> : null}
          {visibleColumns.paid ? <col style={{ width: isMobile ? `${getColumnWidth('paid')}px` : contractColumnPercent('paid') }} /> : null}
          {visibleColumns.due ? <col style={{ width: isMobile ? `${getColumnWidth('due')}px` : contractColumnPercent('due') }} /> : null}
          <col style={{ width: isMobile ? `${getColumnWidth('actions')}px` : contractColumnPercent('actions') }} />
        </colgroup>
        <thead>
          <tr>
            {renderResizableHeader('rowNumber', '#')}
            {visibleColumns.contractNo ? (
              renderResizableHeader('contractNo', 'Contract #')
            ) : null}
            {visibleColumns.customer ? (
              renderResizableHeader('customer', 'Customer', { textAlign: 'left' })
            ) : null}
            {visibleColumns.property ? renderResizableHeader('property', 'Property') : null}
            {visibleColumns.duration ? renderResizableHeader('duration', 'Duration') : null}
            {visibleColumns.services ? renderResizableHeader('services', 'Services', { textAlign: 'center', paddingLeft: '0', paddingRight: '0' }) : null}
            {visibleColumns.status ? renderResizableHeader('status', 'Status') : null}
            {visibleColumns.total ? renderResizableHeader('total', 'Total') : null}
            {visibleColumns.paid ? renderResizableHeader('paid', 'Paid') : null}
            {visibleColumns.due ? renderResizableHeader('due', 'Due') : null}
            {renderResizableHeader('actions', 'Actions')}
          </tr>
        </thead>
        <tbody>
          {paginatedContracts.map((row, index) => {
            const selected = row.id === selectedContract?.id;
            const statusTone = statusStyles[row.status] || statusStyles.Active;
            const rowNumber = ((safePage - 1) * CONTRACT_PAGE_SIZE) + index + 1;
            return (
              <tr key={row.id} onClick={() => setSelectedContractId(row.id)} style={selected ? shell.selectedRow : undefined}>
                <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>{rowNumber}</td>
                {visibleColumns.contractNo ? <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.contractNo}</div>
                </td> : null}
                {visibleColumns.customer ? <td className="contract-customer-cell" style={{ ...shell.td, ...mobileStackCellStyle, textAlign: 'left', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: '2px', width: '100%' }}>
                    <div
                      className="contract-customer-name"
                      role={row.status === 'Active' ? 'button' : undefined}
                      tabIndex={row.status === 'Active' ? 0 : undefined}
                      onClick={row.status === 'Active' ? (event) => {
                        event.stopPropagation();
                        openCustomerSummary(row);
                      } : undefined}
                      onKeyDown={row.status === 'Active' ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          openCustomerSummary(row);
                        }
                      } : undefined}
                    >
                      {row.customer}
                    </div>
                    <div className="contract-customer-mobile">{row.mobile || '-'}</div>
                  </div>
                </td> : null}
                {visibleColumns.property ? <td style={{ ...shell.td, ...mobileStackCellStyle, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.property || '-'}</div>
                  <div style={{ ...shell.subText }}>{row.city || '-'}</div>
                </td> : null}
                {visibleColumns.duration ? <td style={{ ...shell.td, ...mobileStackCellStyle, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>{formatDate(row.startDate)}</div>
                  <div style={{ ...shell.subText }}>{`to ${formatDate(row.endDate)}`}</div>
                </td> : null}
                {visibleColumns.services ? <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                    <span style={{ ...shell.shownPill, display: 'inline-flex', minWidth: '48px', justifyContent: 'center', textAlign: 'center', background: '#eef2f7', color: '#334155', borderColor: 'var(--color-border)' }}>{row.services}</span>
                  </div>
                </td> : null}
                {visibleColumns.status ? <td style={{ ...shell.td, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>
                  <span style={{ ...shell.statusPill, ...statusTone }}>{row.status.toUpperCase()}</span>
                </td> : null}
                {visibleColumns.total ? <td style={{ ...shell.td, fontWeight: 800, ...(selected ? { ...shell.selectedCell, ...shell.selectedText } : {}) }}>{formatWholeAmount(row.total)}</td> : null}
                {visibleColumns.paid ? <td style={{ ...shell.td, ...(selected ? shell.selectedCell : {}), ...(row.paid > 0 ? shell.amountGreen : (selected ? shell.selectedText : {})) }}>{formatWholeAmount(row.paid)}</td> : null}
                {visibleColumns.due ? <td style={{ ...shell.td, ...(selected ? shell.selectedCell : {}), ...(row.due > 0 ? shell.amountRed : (selected ? shell.selectedText : {})) }}>{formatWholeAmount(row.due)}</td> : null}
                <td style={{ ...shell.td, ...(selected ? shell.selectedCell : {}) }}>
                  <div style={{ position: 'relative', display: 'inline-flex' }} data-contract-row-action="true">
                    <button
                      type="button"
                      className="crm-action-chip"
                      style={shell.actionBtn}
                      onClick={(event) => {
                        event.stopPropagation();
                        const menuWidth = 170;
                        const menuHeight = 190;
                        const menuGap = 4;
                        const rect = event.currentTarget.getBoundingClientRect();
                        const viewportPadding = menuGap;
                        const left = Math.max(
                          viewportPadding,
                          Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
                        );
                        const belowTop = rect.bottom + menuGap;
                        const aboveTop = rect.top - menuHeight - menuGap;
                        const maxTop = window.innerHeight - menuHeight - viewportPadding;
                        const hasRoomBelow = belowTop + menuHeight <= window.innerHeight - viewportPadding;
                        const top = Math.max(
                          viewportPadding,
                          Math.min(maxTop, hasRoomBelow ? belowTop : aboveTop)
                        );
                        setActionMenu((prev) => (prev?.rowId === row.id ? null : { rowId: row.id, row, top, left }));
                      }}
                    >
                      <span>Action</span>
                      <span className="crm-action-chip-icon" style={shell.actionIconBox}>
                        <ChevronDown size={11} />
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div style={shell.page}>
      <div style={shell.card}>
        <div style={cardTopStyle}>
          <div style={shell.titleWrap}>
            <h1 style={shell.cardTitle}>All Contracts</h1>
          </div>
          <div style={headActionsStyle}>
            <button
              type="button"
              style={newButtonStyle}
              onClick={() => navigate('/sales/invoices', { state: { openNewInvoice: true } })}
            >
              <Plus size={16} />
              New Contract
            </button>
          </div>
        </div>

        <div style={quickWrapStyle}>
          <span style={quickLabelStyle}>Quick Filters:</span>
          {quickFilters.map((entry) => {
            const Icon = entry.icon;
            const active = quickFilter === entry.label;
            const tone = quickFilterStyles[entry.label] || quickFilterStyles.All;
            return (
              <button
                key={entry.label}
                type="button"
                onClick={() => setQuickFilter(entry.label)}
                style={{ ...chipStyle, ...tone, boxShadow: active ? '0 8px 18px rgba(131, 24, 67, 0.15)' : 'none', borderColor: active ? 'rgba(131, 24, 67, 0.25)' : 'transparent' }}
              >
                <Icon size={12} />
                <span>{entry.label}</span>
                <span style={{ background: 'rgba(255,255,255,0.65)', borderRadius: '999px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>{summaryCounts[entry.label] || 0}</span>
              </button>
            );
          })}
          {!isMobile ? (
            <div style={customizeWrapStyle} data-contract-customize="true">
              <button
                ref={customizeButtonRef}
                type="button"
                style={customizeButtonStyle}
                aria-label="Customize fields"
                title="Customize fields"
                onClick={() => {
                  updateCustomizeMenuPosition();
                  setShowCustomize((prev) => !prev);
                }}
              >
                <Settings size={14} />
              </button>
              {showCustomize && customizeMenuPosition ? createPortal((
                <div
                  data-contract-customize="true"
                  style={{
                    ...shell.customizeMenu,
                    top: `${customizeMenuPosition.top}px`,
                    left: `${customizeMenuPosition.left}px`,
                    width: `${customizeMenuPosition.width}px`,
                    maxHeight: `${customizeMenuPosition.maxHeight}px`
                  }}
                >
                  <div style={shell.customizeHeader}>Show/Hide Columns</div>
                  <div style={{ ...shell.customizeBody, maxHeight: `${Math.max(160, customizeMenuPosition.maxHeight - 42)}px` }}>
                    <button
                      type="button"
                      style={{ ...shell.menuButton, border: '1px solid var(--color-border)', borderRadius: '8px', justifyContent: 'center' }}
                      onClick={() => {
                        setVisibleColumns({
                          contractNo: true,
                          customer: true,
                          property: true,
                          duration: true,
                          services: true,
                          status: true,
                          total: true,
                          paid: true,
                          due: true
                        });
                        resetContractColumns();
                      }}
                    >
                      Reset Default Columns
                    </button>
                    {customColumns.map((col) => (
                      <label key={col.key} style={shell.customizeRow}>
                        <input
                          type="checkbox"
                          style={{ width: '14px', height: '14px', accentColor: 'var(--color-primary)', flexShrink: 0 }}
                          checked={Boolean(visibleColumns[col.key])}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setVisibleColumns((prev) => ({ ...prev, [col.key]: checked }));
                          }}
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ), document.body) : null}
            </div>
          ) : null}
        </div>

        <div style={shell.filtersBox}>
          <div style={filterGridStyle}>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Status</label>
              <select style={shell.input} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option>All Status</option>
                <option>Active</option>
                <option>Upcoming</option>
                <option>Expiring Soon</option>
                <option>Expired</option>
                <option>Renewed</option>
              </select>
            </div>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Type</label>
              <select style={shell.input} value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}>
                {typeOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Start Date From</label>
              <input type="date" style={mobileDateInputStyle} value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} />
            </div>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Start Date To</label>
              <input type="date" style={mobileDateInputStyle} value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} />
            </div>
            <div style={shell.filterField}>
              <label style={shell.filterLabel}>Search</label>
              <input
                style={shell.input}
                placeholder="Customer, contract #, city..."
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
            <div style={{ ...shell.filterField, alignItems: 'flex-end' }}>
              <button
                type="button"
                style={clearButtonStyle}
                onClick={() => {
                  setQuickFilter('All');
                  setFilters({ status: 'All Status', type: 'All Type', from: '', to: '', search: '' });
                }}
              >
                <RefreshCcw size={13} /> Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div style={tableWrapStyle} className="crm-table-shell crm-table-shell--clipped">{renderBody()}</div>

        <div style={footerStyle}>
          <div style={shell.footText}>{firstRecord}-{lastRecord} of {sortedContracts.length} records</div>
          <div style={pagerStyle}>
            <button
              type="button"
              style={shell.pageBtn}
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              style={shell.pageBtn}
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

      {actionMenu ? createPortal(
        <div
          className="crm-action-menu-panel"
          data-contract-action-menu="true"
          style={{
            ...shell.actionMenu,
            left: `${actionMenu.left}px`,
            top: `${actionMenu.top}px`
          }}
        >
          <button
            type="button"
            className="crm-action-menu-item"
            style={shell.actionMenuItem}
            onClick={() => {
              navigate('/sales/invoices', { state: { openInvoiceNumber: actionMenu.row.contractNo, fromContract: true } });
              setActionMenu(null);
            }}
          >
            View Contract
          </button>
          <button
            type="button"
            className="crm-action-menu-item"
            style={shell.actionMenuItem}
            onClick={() => {
              navigate('/sales/invoices', { state: { openInvoiceNumber: actionMenu.row.contractNo, fromContract: true, editContract: true } });
              setActionMenu(null);
            }}
          >
            Edit Contract
          </button>
          <button
            type="button"
            className="crm-action-menu-item"
            style={shell.actionMenuItem}
            onClick={() => {
              openPdfPreview(
                `Invoice - ${String(actionMenu.row.contractNo || actionMenu.row.invoiceNumber || actionMenu.row.invoiceId || 'Invoice').trim()}`,
                openInvoicePdf(actionMenu.row.invoiceId),
                actionMenu.row.contractNo || actionMenu.row.invoiceNumber || actionMenu.row.invoiceId,
                actionMenu.row.invoiceId
              );
              setActionMenu(null);
            }}
          >
            Print Invoice
          </button>
          <button
            type="button"
            className="crm-action-menu-item"
            style={shell.actionMenuItem}
            onClick={() => {
              openPdfPreview(
                `Contract Service History - ${String(actionMenu.row.contractNo || actionMenu.row.invoiceNumber || actionMenu.row.invoiceId || 'Contract').trim()}`,
                openContractJobCardPdf(actionMenu.row.invoiceId),
                `${actionMenu.row.contractNo || actionMenu.row.invoiceNumber || actionMenu.row.invoiceId || 'contract'}_job_card_summary`
              );
              setActionMenu(null);
            }}
          >
            Print Job Card
          </button>
          <button
            type="button"
            className="crm-action-menu-item"
            style={{ ...shell.actionMenuItem, ...shell.actionMenuDanger }}
            onClick={() => deleteContract(actionMenu.row)}
          >
            Delete
          </button>
        </div>,
        document.body
      ) : null}

      {customerSummary.open && customerSummary.row ? createPortal(
        <div
          style={shell.modalOverlay}
          onClick={closeCustomerSummary}
        >
          <div
            style={shell.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={shell.modalHead}>
              <div>
                <h3 style={shell.modalTitle}><UserRound size={18} /> Customer Summary</h3>
                <p style={shell.modalSub}>{`${customerSummary.row.customer} • ${customerSummary.row.mobile || 'No mobile'}`}</p>
              </div>
              <button
                type="button"
                style={shell.modalClose}
                onClick={closeCustomerSummary}
              >
                <X size={16} />
              </button>
            </div>

            <div style={shell.modalBody}>
              <div style={shell.summaryGrid}>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><FileText size={12} /> Invoices</div>
                  <div style={shell.summaryValue}>{customerSummaryData?.relatedInvoices?.length || 0}</div>
                </div>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><Wallet size={12} /> Transactions</div>
                  <div style={shell.summaryValue}>{customerSummaryData?.transactionCount || 0}</div>
                </div>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><BadgeIndianRupee size={12} /> Paid</div>
                  <div style={shell.summaryValue}>{formatINR(customerSummaryData?.totalPaid || 0)}</div>
                </div>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><BadgeIndianRupee size={12} /> Due</div>
                  <div style={shell.summaryValue}>{formatINR(customerSummaryData?.balanceDue || 0)}</div>
                </div>
                <div style={shell.summaryCard}>
                  <div style={shell.summaryLabel}><AlertCircle size={12} /> Complaints</div>
                  <div style={shell.summaryValue}>{customerProfitSummary?.totals?.complaintVisits ?? customerSummaryData?.complaintsCount ?? 0}</div>
                </div>
              </div>

              {customerProfitLoading ? (
                <p style={shell.historyEmpty}>Loading profit and cost summary...</p>
              ) : customerProfitError ? (
                <p style={{ ...shell.historyEmpty, color: '#dc2626', fontWeight: 700 }}>{customerProfitError}</p>
              ) : customerProfitSummary ? (
                <div style={shell.profitSection}>
                  <div style={shell.profitSectionHead}>
                    <h4 style={shell.profitSectionTitle}>Profit & Cost</h4>
                    <span style={{ ...shell.summaryLabel, textTransform: 'none' }}>
                      {customerProfitSummary.profit?.status || 'Profit / Loss'}
                    </span>
                  </div>
                  <div style={shell.profitGrid}>
                    <div style={{ ...shell.profitCard, ...(customerProfitSummary.profit?.amount >= 0 ? shell.profitCardProfit : shell.profitCardLoss) }}>
                      <div style={shell.profitLabel}>Profit / Loss</div>
                      <div style={shell.profitValue}>{formatINR(customerProfitSummary.profit?.amount || 0)}</div>
                    </div>
                    <div style={shell.profitCard}>
                      <div style={shell.profitLabel}>Revenue Excl. GST</div>
                      <div style={shell.profitValue}>{formatINR(customerProfitSummary.revenue?.base || 0)}</div>
                    </div>
                    <div style={shell.profitCard}>
                      <div style={shell.profitLabel}>Total Cost</div>
                      <div style={shell.profitValue}>{formatINR(customerProfitSummary.costs?.total || 0)}</div>
                    </div>
                    <div style={{ ...shell.profitCard, ...(Number(customerProfitSummary.profit?.marginPercent || 0) < Number(customerProfitSummary.profit?.lowMarginWarningPercent || 0) ? shell.profitCardAmber : {}) }}>
                      <div style={shell.profitLabel}>Margin %</div>
                      <div style={shell.profitValue}>{Number(customerProfitSummary.profit?.marginPercent || 0).toFixed(2)}%</div>
                    </div>
                  </div>
                  <div style={shell.profitBreakdownGrid}>
                    {[
                      ['Chemical', customerProfitSummary.costs?.breakdown?.chemical || 0],
                      ['Manpower', customerProfitSummary.costs?.breakdown?.manpower || 0],
                      ['Conveyance', customerProfitSummary.costs?.breakdown?.conveyance || 0],
                      ['Materials', customerProfitSummary.costs?.breakdown?.material || 0],
                      ['Complaint', customerProfitSummary.costs?.breakdown?.complaint || 0],
                      ['Other', customerProfitSummary.costs?.breakdown?.other || 0]
                    ].map(([labelText, amount]) => (
                      <div key={labelText} style={shell.profitBreakdownCard}>
                        <div style={shell.profitBreakdownLabel}>{labelText}</div>
                        <div style={shell.profitBreakdownValue}>{formatINR(amount || 0)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                style={shell.modalToggleBtn}
                onClick={() => setCustomerSummary((prev) => ({ ...prev, showHistory: !prev.showHistory }))}
              >
                {customerSummary.showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {customerSummary.showHistory ? 'Hide History' : 'Show History'}
              </button>

              {customerSummary.showHistory ? (
                <>
                  <div style={shell.detailSection}>
                    <div style={shell.detailHead}>Invoice History</div>
                    <table style={shell.detailTable}>
                      <thead>
                        <tr>
                          <th style={shell.detailTh}>Invoice #</th>
                          <th style={shell.detailTh}>Date</th>
                          <th style={shell.detailTh}>Total</th>
                          <th style={shell.detailTh}>Due</th>
                          <th style={shell.detailTh}>View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(customerSummaryData?.relatedInvoices || []).slice(0, 8).map((invoice) => (
                          <tr key={String(invoice?._id || invoice?.invoiceNumber)}>
                            <td style={shell.detailTd}>{invoice?.invoiceNumber || '-'}</td>
                            <td style={shell.detailTd}>{formatDate(invoice?.date)}</td>
                            <td style={shell.detailTd}>{formatINR(invoice?.total || invoice?.amount || 0)}</td>
                            <td style={shell.detailTd}>{formatINR(invoice?.balanceDue || 0)}</td>
                            <td style={shell.detailTd}>
                              <button
                                type="button"
                                style={shell.detailBtn}
                                onClick={() => openPdfPreview(
                                  `Invoice - ${String(invoice?.invoiceNumber || invoice?._id || 'Invoice').trim()}`,
                                  openInvoicePdf(invoice?._id),
                                  invoice?.invoiceNumber || invoice?._id,
                                  invoice?._id
                                )}
                              >
                                PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(customerSummaryData?.relatedInvoices || []).length === 0 ? (
                          <tr>
                            <td style={shell.detailTd} colSpan={5}>No invoices found.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div style={shell.detailSection}>
                    <div style={shell.detailHead}>Payment Transactions</div>
                    <table style={shell.detailTable}>
                      <thead>
                        <tr>
                          <th style={shell.detailTh}>Receipt #</th>
                          <th style={shell.detailTh}>Date</th>
                          <th style={shell.detailTh}>Invoice</th>
                          <th style={shell.detailTh}>Mode</th>
                          <th style={shell.detailTh}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(customerSummaryData?.relatedPayments || []).slice(0, 8).map((payment) => (
                          <tr key={String(payment?._id || payment?.paymentNumber)}>
                            <td style={shell.detailTd}>{payment?.paymentNumber || '-'}</td>
                            <td style={shell.detailTd}>{formatDate(payment?.paymentDate)}</td>
                            <td style={shell.detailTd}>{payment?.invoiceNumber || '-'}</td>
                            <td style={shell.detailTd}>{payment?.mode || '-'}</td>
                            <td style={shell.detailTd}>{formatINR(payment?.amount || 0)}</td>
                          </tr>
                        ))}
                        {(customerSummaryData?.relatedPayments || []).length === 0 ? (
                          <tr>
                            <td style={shell.detailTd} colSpan={5}>No payment transactions found.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              <div style={shell.suggestionBox}>
                Suggestion: call this customer if due amount is pending for more than 7 days, and schedule next service follow-up before contract end date.
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        pdfUrl={pdfPreview.pdfUrl}
        downloadFileName={pdfPreview.downloadFileName}
        onClose={() => setPdfPreview({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', invoiceId: '' })}
        onShareEmail={async () => {
          const invoice = invoices.find((entry) => String(entry._id) === String(pdfPreview.invoiceId));
          if (invoice) await sendInvoiceEmail(invoice);
        }}
        publicShareUrl={pdfPreview.publicShareUrl}
      />
    </div>
  );
}
