import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpDown, MoreHorizontal, Plus, X } from 'lucide-react';
import CustomerImportDedupWizard from './CustomerImportDedupWizard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const allColumns = [
  { key: 'name', label: 'Display Name' },
  { key: 'segment', label: 'Segment' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'contactPersonName', label: 'Contact Person' },
  { key: 'position', label: 'Position' },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'whatsappNumber', label: 'WhatsApp Number' },
  { key: 'altNumber', label: 'Alt Number' },
  { key: 'emailId', label: 'Email Id' },
  { key: 'hasGst', label: 'GST Registered' },
  { key: 'gstNumber', label: 'GST Number' },
  { key: 'billingAttention', label: 'Billing Attention' },
  { key: 'billingStreet1', label: 'Billing Street 1' },
  { key: 'billingStreet2', label: 'Billing Street 2' },
  { key: 'billingAddress', label: 'Billing Address' },
  { key: 'billingArea', label: 'Billing Area' },
  { key: 'billingState', label: 'Billing State' },
  { key: 'billingPincode', label: 'Billing Pincode' },
  { key: 'shippingAttention', label: 'Shipping Attention' },
  { key: 'shippingStreet1', label: 'Shipping Street 1' },
  { key: 'shippingStreet2', label: 'Shipping Street 2' },
  { key: 'shippingAddress', label: 'Shipping Address' },
  { key: 'shippingArea', label: 'Shipping Area' },
  { key: 'shippingState', label: 'Shipping State' },
  { key: 'shippingPincode', label: 'Shipping Pincode' },
  { key: 'areaSqft', label: 'Area in sqft' }
];

const defaultVisibleColumns = ['name', 'segment', 'companyName', 'contactPersonName', 'mobileNumber', 'emailId', 'billingState', 'shippingState'];
const stateOptions = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];
const positionOptions = ['Owner', 'Manager', 'Edit type'];

const emptyForm = {
  segment: 'Residential',
  companyName: '',
  contactPersonName: '',
  displayName: '',
  position: 'Owner',
  positionCustom: '',
  mobileNumber: '',
  whatsappSameAsMobile: false,
  whatsappNumber: '',
  altNumber: '',
  emailId: '',
  hasGst: false,
  gstNumber: '',
  billingAttention: '',
  billingStreet1: '',
  billingStreet2: '',
  billingAddress: '',
  billingArea: '',
  billingState: 'Delhi',
  billingPincode: '',
  billingPhoneCode: '+91',
  billingPhone: '',
  shippingSameAsBilling: false,
  shippingAttention: '',
  shippingStreet1: '',
  shippingStreet2: '',
  shippingAddress: '',
  shippingArea: '',
  shippingState: 'Delhi',
  shippingPincode: '',
  shippingPhoneCode: '+91',
  shippingPhone: '',
  areaSqft: ''
};

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

const shell = {
  page: { background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', overflow: 'visible', position: 'relative' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--color-border)', background: '#fff' },
  titleWrap: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: 0, borderRadius: 0, background: 'transparent', border: 'none' },
  title: { margin: 0, fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: '#1f2937' },
  topActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', borderRadius: '10px', padding: '9px 14px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' },
  buttonGhost: { border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', borderRadius: '12px', width: '48px', height: '48px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  toolbar: { padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: '#fff' },
  toolLabel: { fontSize: '12px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  customizeButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid #c7d2fe', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', background: '#fff', maxWidth: '100%', borderRadius: '14px', border: '1px solid var(--color-border)' },
  table: { width: '100%', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  headCell: { textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#6b7280', padding: '12px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase' },
  headCellResizable: { position: 'relative', paddingRight: '16px' },
  headLabelWrap: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headSortButton: { display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'transparent', padding: 0, color: '#6b7280', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' },
  resizeHandle: { position: 'absolute', top: 0, right: 0, width: '10px', height: '100%', cursor: 'col-resize', userSelect: 'none', touchAction: 'none' },
  row: { borderBottom: '1px solid #eef2f7' },
  cell: { padding: '12px 10px', fontSize: '14px', color: '#111827', verticalAlign: 'top', lineHeight: 1.35 },
  cellClamp: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  nameCell: { color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline dotted rgba(159,23,77,0.45)' },
  checkboxWrap: { width: '40px', textAlign: 'center' },
  checkbox: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' },
  menu: { position: 'absolute', right: 0, top: '44px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', minWidth: '190px', boxShadow: '0 14px 32px rgba(15,23,42,0.12)', zIndex: 20, overflow: 'hidden' },
  menuButton: { width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
  popover: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', border: '1px solid var(--color-primary-soft)', borderRadius: '12px', boxShadow: '0 14px 30px rgba(15,23,42,0.12)', width: '250px', zIndex: 40 },
  popoverHeader: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '12px', color: '#334155' },
  popoverBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '270px', overflowY: 'auto' },
  popoverItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto', backdropFilter: 'blur(12px)' },
  modal: { background: 'rgba(255,255,255,0.9)', width: 'min(100%, 1220px)', borderRadius: '24px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', fontSize: '28px', fontWeight: 800, color: '#fff', background: 'var(--color-primary)' },
  modalBody: { padding: '18px 20px', display: 'grid', gridTemplateColumns: '190px minmax(0, 1fr)', columnGap: '14px', rowGap: '10px', alignItems: 'center', overflowY: 'auto', background: 'rgba(255,255,255,0.42)' },
  addressSplit: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginTop: '8px' },
  addressCard: { border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px', background: '#fff' },
  addressTitle: { margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827', lineHeight: 1.2 },
  addressHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  addressCopy: { fontSize: '14px', color: 'var(--color-primary)', fontWeight: 500, cursor: 'pointer', textDecoration: 'none', border: 'none', background: 'transparent', padding: 0, lineHeight: 1.2 },
  addressGrid: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', rowGap: '10px', columnGap: '10px', alignItems: 'center' },
  label: { fontSize: '14px', color: '#111827', fontWeight: 500 },
  input: { border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', outline: 'none', width: '100%', minHeight: '44px' },
  textarea: { border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', outline: 'none', width: '100%', minHeight: '68px', resize: 'vertical' },
  amountRow: { display: 'grid', gridTemplateColumns: '56px 1fr', gap: 0 },
  currencyTag: { border: '1px solid #D1D5DB', borderRight: 'none', borderRadius: '8px 0 0 8px', padding: '6px 8px', fontSize: '12px', color: '#334155', background: '#f8fafc' },
  amountInput: { border: '1px solid #D1D5DB', borderRadius: '0 8px 8px 0', padding: '6px 8px', fontSize: '12px', outline: 'none', width: '100%' },
  inlineChecks: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#111827' },
  modalFooter: { padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  cancelButton: { border: '1px solid #D1D5DB', background: '#fff', color: '#334155', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  saveButton: { border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  historyOverlay: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.52)', zIndex: 3000, display: 'grid', placeItems: 'center', padding: 'clamp(12px, 3vh, 24px)', overflowY: 'auto' },
  historyModal: { width: 'min(100%, 1260px)', maxHeight: '94vh', background: '#fff', borderRadius: '12px', border: '1px solid var(--color-primary-soft)', boxShadow: '0 20px 44px rgba(15,23,42,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  historyHeader: { padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  historyTitle: { margin: 0, fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' },
  historySubTitle: { margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 600 },
  historyClose: { border: '1px solid #d1d5db', background: '#fff', borderRadius: '10px', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#334155' },
  historyBody: { padding: '12px 14px', overflowY: 'auto', display: 'grid', gap: '12px' },
  historyTabs: { display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' },
  historyTabBtn: { border: '1px solid #d1d5db', background: '#fff', color: '#334155', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  historyTabBtnActive: { borderColor: '#93c5fd', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' },
  historyStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  historyStatCard: { border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px', background: '#fff' },
  historyStatLabel: { margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' },
  historyStatValue: { margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' },
  historyGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' },
  historySection: { border: '1px solid var(--color-border)', borderRadius: '10px', background: '#fff', overflow: 'hidden' },
  historySectionHead: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' },
  historySectionTitle: { margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a' },
  historyTableWrap: { overflowX: 'auto' },
  historyTable: { width: '100%', minWidth: '760px', borderCollapse: 'collapse' },
  historyHeadCell: { textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#6b7280', padding: '10px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase' },
  historyRow: { borderBottom: '1px solid #eef2f7' },
  historyCell: { padding: '10px 10px', fontSize: '14px', color: '#111827', verticalAlign: 'top' },
  historyMetaBox: { border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' },
  historyMetaLabel: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' },
  historyMetaValue: { margin: '4px 0 0 0', fontSize: '14px', color: '#0f172a', fontWeight: 600 },
  historyEmpty: { margin: 0, padding: '16px 12px', fontSize: '13px', color: '#64748b' },
  paginationBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 16px', borderTop: '1px solid var(--color-border)', background: '#fff' },
  paginationText: { fontSize: '12px', color: '#475569', fontWeight: 600 },
  paginationActions: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  paginationButton: { border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }
};

const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDisplayDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showDuplicateReport, setShowDuplicateReport] = useState(false);
  const [duplicateSummary, setDuplicateSummary] = useState(null);
  const [duplicateRows, setDuplicateRows] = useState([]);
  const [possibleDuplicateIds, setPossibleDuplicateIds] = useState([]);
  const [showPossibleDuplicatesOnly, setShowPossibleDuplicatesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyCustomerId, setHistoryCustomerId] = useState('');
  const [historyTab, setHistoryTab] = useState('transactions');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [similarCustomers, setSimilarCustomers] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('customers_visible_columns');
    return saved ? JSON.parse(saved) : defaultVisibleColumns;
  });
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('customers_column_widths');
    return saved ? JSON.parse(saved) : {};
  });
  const [nameSortDirection, setNameSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const customizePanelRef = useRef(null);
  const customizeButtonRef = useRef(null);
  const moreMenuRef = useRef(null);
  const moreMenuButtonRef = useRef(null);
  const resizeStateRef = useRef(null);

  const visibleColumnDefs = useMemo(
    () => allColumns.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns]
  );
  const rowsPerPage = 20;
  const toTenDigitNumber = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);
  const normalizeIncomingCustomerPrefill = (prefill = {}) => {
    const next = {
      ...emptyForm,
      ...(prefill && typeof prefill === 'object' ? prefill : {})
    };

    const mobileNumber = toTenDigitNumber(next.mobileNumber || next.workPhone || '');
    const whatsappNumber = toTenDigitNumber(next.whatsappNumber || mobileNumber);
    const altNumber = toTenDigitNumber(next.altNumber || '');
    const hasGst = Boolean(next.hasGst || next.gstRegistered);

    return {
      ...next,
      segment: next.segment === 'Commercial' ? 'Commercial' : 'Residential',
      mobileNumber,
      whatsappNumber,
      altNumber,
      whatsappSameAsMobile: Boolean(next.whatsappSameAsMobile) || (whatsappNumber && whatsappNumber === mobileNumber),
      hasGst,
      gstNumber: hasGst ? String(next.gstNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) : '',
      shippingSameAsBilling: Boolean(next.shippingSameAsBilling)
    };
  };

  const loadCustomers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers`);
      setCustomers(Array.isArray(res.data) ? res.data : []);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to load customers', error);
    }
  };

  const loadDuplicateReport = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers/duplicates/report`);
      setDuplicateSummary(res.data?.summary || null);
      setDuplicateRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
      setPossibleDuplicateIds(Array.isArray(res.data?.possibleDuplicateCustomerIds) ? res.data.possibleDuplicateCustomerIds : []);
    } catch (error) {
      console.error('Failed to load duplicate report', error);
      setDuplicateSummary(null);
      setDuplicateRows([]);
      setPossibleDuplicateIds([]);
    }
  };

  const loadTransactions = async () => {
    try {
      const [invoicesRes, paymentsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/invoices`),
        axios.get(`${API_BASE_URL}/api/payments`)
      ]);
      setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
      return true;
    } catch (error) {
      console.error('Failed to load customer transactions', error);
      setInvoices([]);
      setPayments([]);
      return false;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
      loadTransactions();
      loadDuplicateReport();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const incomingState = location.state;
    if (!incomingState || !incomingState.openNewCustomer) return;

    setEditingId(null);
    setForm(normalizeIncomingCustomerPrefill(incomingState.prefillCustomerFromLead));
    setSaveError('');
    setShowModal(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    localStorage.setItem('customers_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('customers_column_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  const displayNameOptions = useMemo(() => {
    const options = [form.companyName.trim(), form.contactPersonName.trim()].filter(Boolean);
    return Array.from(new Set(options));
  }, [form.companyName, form.contactPersonName]);

  const selectedHistoryCustomer = useMemo(
    () => customers.find((customer) => customer._id === historyCustomerId) || null,
    [customers, historyCustomerId]
  );

  const historyCustomerNames = useMemo(() => {
    if (!selectedHistoryCustomer) return new Set();
    const names = [
      selectedHistoryCustomer.displayName,
      selectedHistoryCustomer.name,
      selectedHistoryCustomer.companyName,
      selectedHistoryCustomer.contactPersonName
    ]
      .map(normalizeText)
      .filter(Boolean);
    return new Set(names);
  }, [selectedHistoryCustomer]);

  const historyInvoices = useMemo(() => {
    if (!selectedHistoryCustomer) return [];
    return invoices.filter((invoice) => {
      if (invoice.customerId && selectedHistoryCustomer._id && invoice.customerId === selectedHistoryCustomer._id) return true;
      const invoiceCustomerName = normalizeText(invoice.customerName);
      return invoiceCustomerName && historyCustomerNames.has(invoiceCustomerName);
    });
  }, [historyCustomerNames, invoices, selectedHistoryCustomer]);

  const historyPayments = useMemo(() => {
    if (!selectedHistoryCustomer) return [];
    const invoiceIds = new Set(historyInvoices.map((invoice) => String(invoice._id || '')));
    const invoiceNumbers = new Set(historyInvoices.map((invoice) => normalizeText(invoice.invoiceNumber)));
    return payments.filter((payment) => {
      if (payment.invoiceId && invoiceIds.has(String(payment.invoiceId))) return true;
      const paymentInvoiceNumber = normalizeText(payment.invoiceNumber);
      if (paymentInvoiceNumber && invoiceNumbers.has(paymentInvoiceNumber)) return true;
      const paymentCustomerName = normalizeText(payment.customerName);
      return paymentCustomerName && historyCustomerNames.has(paymentCustomerName);
    });
  }, [historyCustomerNames, historyInvoices, payments, selectedHistoryCustomer]);

  const historySummary = useMemo(() => {
    const totalInvoiceAmount = historyInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || invoice.total || 0), 0);
    const totalBalanceDue = historyInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0);
    const totalReceived = historyPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const avgInvoiceValue = historyInvoices.length > 0 ? totalInvoiceAmount / historyInvoices.length : 0;
    return {
      totalInvoiceAmount,
      totalBalanceDue,
      totalReceived,
      invoiceCount: historyInvoices.length,
      paymentCount: historyPayments.length,
      avgInvoiceValue
    };
  }, [historyInvoices, historyPayments]);

  const historyInvoicesSorted = useMemo(
    () => [...historyInvoices].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [historyInvoices]
  );

  const historyPaymentsSorted = useMemo(
    () => [...historyPayments].sort((a, b) => new Date(b.paymentDate || b.date || 0).getTime() - new Date(a.paymentDate || a.date || 0).getTime()),
    [historyPayments]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;

      if (
        showCustomize &&
        customizePanelRef.current &&
        !customizePanelRef.current.contains(target) &&
        customizeButtonRef.current &&
        !customizeButtonRef.current.contains(target)
      ) {
        setShowCustomize(false);
      }

      if (
        showMoreMenu &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(target) &&
        moreMenuButtonRef.current &&
        !moreMenuButtonRef.current.contains(target)
      ) {
        setShowMoreMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowCustomize(false);
        setShowMoreMenu(false);
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCustomize, showMoreMenu]);

  const sortedCustomers = useMemo(() => {
    const multiplier = nameSortDirection === 'asc' ? 1 : -1;
    const sourceRows = showPossibleDuplicatesOnly
      ? customers.filter((customer) => possibleDuplicateIds.includes(customer._id))
      : customers;
    return [...sourceRows].sort((a, b) => {
      const aName = String(a.displayName || a.name || '').trim();
      const bName = String(b.displayName || b.name || '').trim();
      return aName.localeCompare(bName, 'en', { sensitivity: 'base', numeric: true }) * multiplier;
    });
  }, [customers, nameSortDirection, possibleDuplicateIds, showPossibleDuplicatesOnly]);

  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / rowsPerPage));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedCustomers.slice(start, start + rowsPerPage);
  }, [currentPage, rowsPerPage, sortedCustomers]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const isAllSelected = paginatedCustomers.length > 0 && paginatedCustomers.every((customer) => selectedIds.includes(customer._id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const currentPageIds = new Set(paginatedCustomers.map((customer) => customer._id));
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.has(id)));
      return;
    }
    setSelectedIds((prev) => {
      const ids = new Set(prev);
      paginatedCustomers.forEach((customer) => ids.add(customer._id));
      return Array.from(ids);
    });
  };

  const toggleSelectOne = (customerId) => {
    setSelectedIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnKey)) {
        if (prev.length === 1) return prev;
        return prev.filter((key) => key !== columnKey);
      }
      return [...prev, columnKey];
    });
  };

  const getColumnStyle = (columnKey) => {
    const width = columnWidths[columnKey];
    if (!width) return {};
    return { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` };
  };

  const startColumnResize = (event, columnKey) => {
    event.preventDefault();
    event.stopPropagation();
    const th = event.currentTarget.closest('th');
    const startWidth = columnWidths[columnKey] || th?.offsetWidth || 160;
    resizeStateRef.current = { columnKey, startX: event.clientX, startWidth };

    const onMouseMove = (moveEvent) => {
      if (!resizeStateRef.current) return;
      const delta = moveEvent.clientX - resizeStateRef.current.startX;
      const nextWidth = Math.max(110, resizeStateRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [columnKey]: nextWidth }));
    };

    const onMouseUp = () => {
      resizeStateRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const copyBillingToShipping = (source) => ({
    shippingAttention: source.billingAttention,
    shippingStreet1: source.billingStreet1,
    shippingStreet2: source.billingStreet2,
    shippingAddress: source.billingAddress,
    shippingArea: source.billingArea,
    shippingState: source.billingState,
    shippingPincode: source.billingPincode,
    shippingPhoneCode: source.billingPhoneCode,
    shippingPhone: source.billingPhone
  });

  const updateBillingField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (prev.shippingSameAsBilling) {
        return { ...next, ...copyBillingToShipping(next) };
      }
      return next;
    });
  };

  const fetchSimilarCustomers = async (draft = form) => {
    const name = String(draft.displayName || draft.contactPersonName || draft.companyName || '').trim();
    const mobile = toTenDigitNumber(draft.mobileNumber || draft.workPhone || '');
    const address = String(draft.billingAddress || draft.billingStreet1 || '').trim();
    if (!name && !mobile && !address) {
      setSimilarCustomers([]);
      return;
    }
    try {
      setSimilarLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/customers/similar-search`, {
        params: {
          name,
          mobile,
          address,
          email: draft.emailId || ''
        }
      });
      const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const filtered = rows.filter((row) => (editingId ? row.customerId !== editingId : true));
      setSimilarCustomers(filtered);
    } catch (error) {
      console.error('Failed to search similar customers', error);
      setSimilarCustomers([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  useEffect(() => {
    if (!showModal) return undefined;
    const timer = setTimeout(() => {
      fetchSimilarCustomers(form);
    }, 320);
    return () => clearTimeout(timer);
  }, [form.displayName, form.contactPersonName, form.companyName, form.mobileNumber, form.billingAddress, form.emailId, showModal]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const mapCustomerToForm = (customer) => {
    const mobile = customer.mobileNumber || customer.workPhone || '';
    const whatsapp = customer.whatsappNumber || '';
    return {
      segment: customer.segment || 'Residential',
      companyName: customer.companyName || '',
      contactPersonName: customer.contactPersonName || customer.name || '',
      displayName: customer.displayName || customer.name || customer.contactPersonName || customer.companyName || '',
      position: positionOptions.includes(customer.position) ? customer.position : 'Edit type',
      positionCustom: positionOptions.includes(customer.position) ? (customer.positionCustom || '') : (customer.position || ''),
      mobileNumber: mobile,
      whatsappSameAsMobile: whatsapp && mobile ? whatsapp === mobile : false,
      whatsappNumber: whatsapp || mobile,
      altNumber: customer.altNumber || '',
      emailId: customer.emailId || customer.email || '',
      hasGst: customer.hasGst ?? customer.gstRegistered ?? false,
      gstNumber: customer.gstNumber || '',
      billingAttention: customer.billingAttention || '',
      billingStreet1: customer.billingStreet1 || '',
      billingStreet2: customer.billingStreet2 || '',
      billingAddress: customer.billingAddress || '',
      billingArea: customer.billingArea || customer.area || '',
      billingState: customer.billingState || customer.state || customer.placeOfSupply || 'Delhi',
      billingPincode: customer.billingPincode || customer.pincode || '',
      billingPhoneCode: customer.billingPhoneCode || '+91',
      billingPhone: customer.billingPhone || '',
      shippingAttention: customer.shippingAttention || '',
      shippingStreet1: customer.shippingStreet1 || '',
      shippingStreet2: customer.shippingStreet2 || '',
      shippingAddress: customer.shippingAddress || '',
      shippingArea: customer.shippingArea || '',
      shippingState: customer.shippingState || 'Delhi',
      shippingPincode: customer.shippingPincode || '',
      shippingPhoneCode: customer.shippingPhoneCode || '+91',
      shippingPhone: customer.shippingPhone || '',
      shippingSameAsBilling:
        (customer.shippingAddress || '') === (customer.billingAddress || '') &&
        (customer.shippingStreet1 || '') === (customer.billingStreet1 || '') &&
        (customer.shippingStreet2 || '') === (customer.billingStreet2 || '') &&
        (customer.shippingArea || '') === (customer.billingArea || customer.area || '') &&
        (customer.shippingState || '') === (customer.billingState || customer.state || customer.placeOfSupply || '') &&
        (customer.shippingPincode || '') === (customer.billingPincode || customer.pincode || '') &&
        !!(customer.billingAddress || customer.shippingAddress),
      areaSqft: String(customer.areaSqft ?? '')
    };
  };

  const openNewForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSimilarCustomers([]);
    setSaveError('');
    setShowModal(true);
  };

  const openEditSelected = () => {
    if (selectedIds.length !== 1) return;
    const selected = customers.find((customer) => customer._id === selectedIds[0]);
    if (!selected) return;
    setEditingId(selected._id);
    setForm(mapCustomerToForm(selected));
    setSimilarCustomers([]);
    setSaveError('');
    setShowModal(true);
    setShowMoreMenu(false);
  };

  const openCustomerHistory = async (customer) => {
    if (!customer?._id) return;
    setSelectedIds([customer._id]);
    setHistoryCustomerId(customer._id);
    setHistoryTab('transactions');
    setHistoryError('');
    setShowHistory(true);
    setHistoryLoading(true);
    const loaded = await loadTransactions();
    if (!loaded) {
      setHistoryError('Could not load customer history.');
    }
    setHistoryLoading(false);
  };

  const closeCustomerHistory = () => {
    setShowHistory(false);
    setHistoryError('');
    setHistoryLoading(false);
  };

  const openInvoiceInInvoiceModule = (invoice) => {
    if (!invoice) return;
    navigate('/sales/invoices', {
      state: {
        openInvoiceId: invoice._id || '',
        openInvoiceNumber: invoice.invoiceNumber || ''
      }
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const contactName = form.contactPersonName.trim();
    const companyName = form.companyName.trim();
    if (!contactName && !companyName) {
      setSaveError('Please enter Contact Person Name or Company Name.');
      return;
    }

    const finalPosition = form.position === 'Edit type' ? form.positionCustom.trim() || 'Edit type' : form.position;
    const mobile = toTenDigitNumber(form.mobileNumber);
    const whatsapp = form.whatsappSameAsMobile ? mobile : toTenDigitNumber(form.whatsappNumber);
    const altNumber = toTenDigitNumber(form.altNumber);

    if (mobile.length !== 10) {
      setSaveError('Mobile Number must be exactly 10 digits.');
      return;
    }
    if (!form.whatsappSameAsMobile && whatsapp && whatsapp.length !== 10) {
      setSaveError('WhatsApp Number must be exactly 10 digits.');
      return;
    }
    if (altNumber && altNumber.length !== 10) {
      setSaveError('Alt Number must be exactly 10 digits.');
      return;
    }
    const gstNumber = String(form.gstNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    if (form.hasGst && !gstinRegex.test(gstNumber)) {
      setSaveError('Enter a valid 15-character GSTIN (e.g., 29ABCDE9999F1Z8).');
      return;
    }

    const highRiskMatch = !editingId && similarCustomers.some((row) => Number(row.confidence || 0) >= 75);
    let duplicateOverrideReason = '';
    if (highRiskMatch) {
      const reason = window.prompt('Similar customer already exists. Enter reason to create new customer anyway, or Cancel to review existing records.', '');
      if (reason === null) return;
      duplicateOverrideReason = String(reason || '').trim();
      if (!duplicateOverrideReason) {
        setSaveError('Reason is required to create new customer when duplicate warning exists.');
        return;
      }
    }

    const payload = {
      displayName: form.displayName.trim() || contactName || companyName,
      name: form.displayName.trim() || contactName || companyName,
      segment: form.segment,
      companyName: companyName || contactName,
      contactPersonName: contactName || companyName,
      position: form.position,
      positionCustom: form.position === 'Edit type' ? form.positionCustom.trim() : '',
      mobileNumber: mobile,
      whatsappNumber: whatsapp,
      altNumber,
      emailId: form.emailId.trim(),
      email: form.emailId.trim(),
      hasGst: form.hasGst,
      gstRegistered: form.hasGst,
      gstNumber: form.hasGst ? gstNumber : '',
      billingAttention: form.billingAttention.trim(),
      billingStreet1: form.billingStreet1.trim(),
      billingStreet2: form.billingStreet2.trim(),
      billingAddress: form.billingAddress.trim() || [form.billingStreet1, form.billingStreet2].filter(Boolean).join(', '),
      billingArea: form.billingArea.trim(),
      billingState: form.billingState,
      billingPincode: form.billingPincode.trim(),
      billingPhoneCode: form.billingPhoneCode,
      billingPhone: form.billingPhone.trim(),
      shippingAttention: form.shippingAttention.trim(),
      shippingStreet1: form.shippingStreet1.trim(),
      shippingStreet2: form.shippingStreet2.trim(),
      shippingAddress: form.shippingAddress.trim() || [form.shippingStreet1, form.shippingStreet2].filter(Boolean).join(', '),
      shippingArea: form.shippingArea.trim(),
      shippingState: form.shippingState,
      shippingPincode: form.shippingPincode.trim(),
      shippingPhoneCode: form.shippingPhoneCode,
      shippingPhone: form.shippingPhone.trim(),
      area: form.billingArea.trim(),
      state: form.billingState,
      pincode: form.billingPincode.trim(),
      areaSqft: Number(form.areaSqft || 0),
      workPhone: mobile,
      placeOfSupply: form.billingState,
      finalPosition,
      duplicateOverrideReason
    };

    try {
      setIsSaving(true);
      setSaveError('');
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/customers/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/customers`, payload);
      }
      setForm(emptyForm);
      setSimilarCustomers([]);
      setEditingId(null);
      setShowModal(false);
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
    } catch (error) {
      console.error('Failed to save customer', error);
      setSaveError('Unable to save customer. Please ensure backend server is running.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map((id) => axios.delete(`${API_BASE_URL}/api/customers/${id}`)));
      setShowMoreMenu(false);
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
    } catch (error) {
      console.error('Failed to delete customers', error);
    }
  };

  const csvEscape = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportData = () => {
    const sourceRows = selectedIds.length > 0
      ? customers.filter((customer) => selectedIds.includes(customer._id))
      : customers;
    if (sourceRows.length === 0) {
      window.alert('No customer data available to export.');
      return;
    }

    const headers = allColumns.map((column) => column.key);
    const csvRows = [
      headers.join(','),
      ...sourceRows.map((customer) =>
        headers.map((key) => csvEscape(handleCellValue(customer, key))).join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowMoreMenu(false);
  };

  const downloadSampleImportCsv = () => {
    const link = document.createElement('a');
    link.href = '/customers-import-sample-dedupe.csv';
    link.download = 'customers-import-sample-dedupe.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowMoreMenu(false);
  };

  const mergeSelectedCustomers = async () => {
    if (selectedIds.length !== 2) {
      window.alert('Select exactly 2 customers to merge.');
      return;
    }
    const targetCustomerId = selectedIds[0];
    const sourceCustomerId = selectedIds[1];
    const reason = window.prompt('Merge reason (required):', 'Duplicate customer cleanup');
    if (!reason || !String(reason).trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/api/customers/merge`, {
        targetCustomerId,
        sourceCustomerId,
        reason,
        actor: localStorage.getItem('portal_user_name') || 'Admin'
      });
      window.alert('Customers merged successfully.');
      await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
      setSelectedIds([]);
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Customer merge failed', error);
      window.alert(error?.response?.data?.error || 'Unable to merge selected customers.');
    }
  };

  const exportDuplicateReport = async (format = 'csv') => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers/duplicates/report`, {
        params: { format },
        responseType: 'blob'
      });
      const extension = format === 'pdf' ? 'pdf' : 'csv';
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customer-duplicate-report.${extension}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export duplicate report', error);
      window.alert('Unable to export duplicate report.');
    }
  };

  const handleCellValue = (customer, key) => {
    if (key === 'name') return customer.displayName || customer.name || '';
    if (key === 'hasGst') return customer.hasGst || customer.gstRegistered ? 'Yes' : 'No';
    if (key === 'position') return customer.positionCustom || customer.position || '';
    if (key === 'emailId') return customer.emailId || customer.email || '';
    if (key === 'mobileNumber') return customer.mobileNumber || customer.workPhone || '';
    if (key === 'billingAttention') return customer.billingAttention || '';
    if (key === 'billingStreet1') return customer.billingStreet1 || '';
    if (key === 'billingStreet2') return customer.billingStreet2 || '';
    if (key === 'billingAddress') return customer.billingAddress || [customer.billingStreet1, customer.billingStreet2].filter(Boolean).join(', ');
    if (key === 'billingArea') return customer.billingArea || customer.area || '';
    if (key === 'billingState') return customer.billingState || customer.state || customer.placeOfSupply || '';
    if (key === 'billingPincode') return customer.billingPincode || customer.pincode || '';
    if (key === 'shippingAttention') return customer.shippingAttention || '';
    if (key === 'shippingStreet1') return customer.shippingStreet1 || '';
    if (key === 'shippingStreet2') return customer.shippingStreet2 || '';
    if (key === 'shippingAddress') return customer.shippingAddress || [customer.shippingStreet1, customer.shippingStreet2].filter(Boolean).join(', ');
    if (key === 'shippingArea') return customer.shippingArea || '';
    if (key === 'shippingState') return customer.shippingState || '';
    if (key === 'shippingPincode') return customer.shippingPincode || '';
    if (key === 'areaSqft') return customer.areaSqft ? String(customer.areaSqft) : '';
    return customer[key] || '';
  };

  const toggleNameSort = () => {
    setNameSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setCurrentPage(1);
  };

  const pageStart = sortedCustomers.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const pageEnd = Math.min(currentPage * rowsPerPage, sortedCustomers.length);
  const isMobile = viewportWidth <= 900;
  const isTablet = viewportWidth > 900 && viewportWidth <= 1200;
  const isTiny = viewportWidth <= 380;
  const topbarStyle = isMobile
    ? { ...shell.topbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '10px 12px' : shell.topbar.padding }
    : shell.topbar;
  const topActionsStyle = isMobile ? { ...shell.topActions, width: '100%', justifyContent: 'space-between' } : shell.topActions;
  const toolbarStyle = isMobile ? { ...shell.toolbar, flexDirection: 'column', alignItems: 'stretch', padding: isTiny ? '8px 12px' : shell.toolbar.padding } : shell.toolbar;
  const mobileTableMinWidth = Math.max(isTiny ? 760 : 900, (visibleColumnDefs.length + 1) * 130);
  const tableStyle = isMobile
    ? { ...shell.table, minWidth: `${mobileTableMinWidth}px`, tableLayout: 'auto' }
    : shell.table;
  const modalOverlayStyle = isMobile ? { ...shell.modalOverlay, padding: '0' } : shell.modalOverlay;
  const modalStyle = isMobile
    ? {
      ...shell.modal,
      width: '100%',
      maxHeight: '100dvh',
      height: '100dvh',
      borderRadius: 0,
      border: 'none'
    }
    : shell.modal;
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, fontSize: isTiny ? '20px' : '22px' } : shell.modalHeader;
  const modalBodyStyle = isMobile
    ? {
      ...shell.modalBody,
      gridTemplateColumns: '1fr',
      padding: '14px',
      paddingBottom: 'calc(130px + env(safe-area-inset-bottom))',
      WebkitOverflowScrolling: 'touch'
    }
    : shell.modalBody;
  const addressSplitStyle = isMobile ? { ...shell.addressSplit, gridTemplateColumns: '1fr' } : shell.addressSplit;
  const addressGridStyle = isMobile ? { ...shell.addressGrid, gridTemplateColumns: '1fr' } : shell.addressGrid;
  const historyModalStyle = isMobile ? { ...shell.historyModal, width: 'min(100%, 96vw)' } : shell.historyModal;
  const historyHeaderStyle = isMobile ? { ...shell.historyHeader, flexDirection: 'column', alignItems: 'stretch' } : shell.historyHeader;
  const historyTitleStyle = isMobile ? { ...shell.historyTitle, fontSize: '22px' } : shell.historyTitle;
  const modalFooterStyle = isMobile
    ? {
      ...shell.modalFooter,
      flexWrap: 'wrap',
      position: 'sticky',
      bottom: 0,
      background: '#fff',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
    }
    : shell.modalFooter;
  const duplicateModalBodyStyle = isTablet || isMobile ? { ...modalBodyStyle, display: 'grid', gap: '10px' } : { ...shell.modalBody, display: 'grid', gap: '10px' };
  const titleStyle = isTiny ? { ...shell.title, fontSize: '24px' } : shell.title;
  const ghostButtonStyle = isTiny ? { ...shell.buttonGhost, width: '44px', height: '44px' } : shell.buttonGhost;
  const primaryButtonStyle = isTiny ? { ...shell.buttonPrimary, padding: '8px 12px', fontSize: '13px' } : shell.buttonPrimary;
  const customizeButtonStyle = isTiny ? { ...shell.customizeButton, padding: '7px 10px', fontSize: '11px' } : shell.customizeButton;
  const historyTitleTinyStyle = isTiny ? { ...historyTitleStyle, fontSize: '20px' } : historyTitleStyle;

  return (
    <section style={shell.page}>
      <div style={topbarStyle}>
        <div style={shell.titleWrap}>
          <h1 style={titleStyle}>Active Customers</h1>
        </div>
        <div style={topActionsStyle}>
          <button type="button" style={primaryButtonStyle} onClick={openNewForm}>
            <Plus size={16} />
            New
          </button>
          <div style={{ position: 'relative' }}>
            <button
              ref={moreMenuButtonRef}
              type="button"
              style={ghostButtonStyle}
              aria-label="More options"
              onClick={() => setShowMoreMenu((prev) => !prev)}
            >
              <MoreHorizontal size={24} />
            </button>
            {showMoreMenu ? (
              <div ref={moreMenuRef} style={shell.menu}>
                <button
                  type="button"
                  style={shell.menuButton}
                  onClick={() => {
                    setShowImportWizard(true);
                    setShowMoreMenu(false);
                  }}
                >
                  Import Data (Dedup Wizard)
                </button>
                <button type="button" style={shell.menuButton} onClick={exportData}>
                  Export Data
                </button>
                <button
                  type="button"
                  style={shell.menuButton}
                  onClick={() => {
                    setShowDuplicateReport(true);
                    setShowMoreMenu(false);
                  }}
                >
                  Duplicate Report
                </button>
                <button type="button" style={shell.menuButton} onClick={downloadSampleImportCsv}>
                  Download Sample Import CSV
                </button>
                <button
                  type="button"
                  style={{ ...shell.menuButton, opacity: selectedIds.length === 1 ? 1 : 0.45 }}
                  onClick={openEditSelected}
                >
                  Edit Selected
                </button>
                <button type="button" style={shell.menuButton} onClick={deleteSelected}>
                  Delete Selected ({selectedIds.length})
                </button>
                <button
                  type="button"
                  style={{ ...shell.menuButton, opacity: selectedIds.length === 2 ? 1 : 0.45 }}
                  onClick={mergeSelectedCustomers}
                >
                  Merge Selected (2)
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div style={toolbarStyle}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={shell.toolLabel}>Customer Master</span>
          <span style={{ border: '1px solid rgba(159, 23, 77, 0.25)', background: 'var(--color-primary-light)', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
            Data Health: {duplicateSummary?.customerDataHealthScore ?? 100}
          </span>
          <span style={{ border: '1px solid rgba(217,119,6,0.28)', background: 'rgba(254,243,199,0.7)', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 800, color: '#92400e' }}>
            Possible Duplicates: {possibleDuplicateIds.length}
          </span>
          <button
            type="button"
            style={{ ...shell.customizeButton, background: showPossibleDuplicatesOnly ? '#fee2e2' : 'var(--color-primary-light)', borderColor: showPossibleDuplicatesOnly ? '#fca5a5' : '#c7d2fe', color: showPossibleDuplicatesOnly ? '#991b1b' : 'var(--color-primary-dark)' }}
            onClick={() => setShowPossibleDuplicatesOnly((prev) => !prev)}
          >
            {showPossibleDuplicatesOnly ? 'Show All Customers' : 'Filter Possible Duplicates'}
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            ref={customizeButtonRef}
            type="button"
            style={customizeButtonStyle}
            onClick={() => setShowCustomize((prev) => !prev)}
          >
            Customize Fields
          </button>
          {showCustomize ? (
            <div ref={customizePanelRef} style={shell.popover}>
              <div style={shell.popoverHeader}>Show/Hide Columns</div>
              <div style={shell.popoverBody}>
                {allColumns.map((column) => (
                  <label key={column.key} style={shell.popoverItem}>
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={shell.tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...shell.headCell, ...shell.checkboxWrap }}>
                <input type="checkbox" style={shell.checkbox} checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              {visibleColumnDefs.map((column) => (
                <th key={column.key} style={{ ...shell.headCell, ...shell.headCellResizable, ...getColumnStyle(column.key) }}>
                  {column.key === 'name' ? (
                    <button type="button" style={{ ...shell.headSortButton, ...shell.headLabelWrap }} onClick={toggleNameSort} title="Sort by customer name">
                      <span>{column.label}</span>
                      <ArrowUpDown size={12} />
                      <span>{nameSortDirection === 'asc' ? 'A-Z' : 'Z-A'}</span>
                    </button>
                  ) : (
                    <span style={shell.headLabelWrap}>{column.label}</span>
                  )}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    title="Drag to resize"
                    style={shell.resizeHandle}
                    onMouseDown={(event) => startColumnResize(event, column.key)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.length === 0 ? (
              <tr style={shell.row}>
                <td style={{ ...shell.cell, textAlign: 'center', color: '#64748b' }} colSpan={visibleColumnDefs.length + 1}>
                  No customers found.
                </td>
              </tr>
            ) : null}
            {paginatedCustomers.map((customer) => (
              <tr key={customer._id || customer.name} style={shell.row}>
                <td style={{ ...shell.cell, ...shell.checkboxWrap }}>
                  <input
                    type="checkbox"
                    style={shell.checkbox}
                    checked={selectedIds.includes(customer._id)}
                    onChange={() => toggleSelectOne(customer._id)}
                  />
                </td>
                {visibleColumnDefs.map((column) => (
                  <td
                    key={`${customer._id || customer.name}-${column.key}`}
                    style={
                      column.key === 'name' || column.key === 'companyName'
                        ? { ...shell.cell, ...shell.nameCell, ...shell.cellClamp, ...getColumnStyle(column.key) }
                        : { ...shell.cell, ...shell.cellClamp, ...getColumnStyle(column.key) }
                    }
                    onClick={
                      column.key === 'name' || column.key === 'companyName'
                        ? () => openCustomerHistory(customer)
                        : undefined
                    }
                    title={String(handleCellValue(customer, column.key) || '')}
                  >
                    {handleCellValue(customer, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={shell.paginationBar}>
        <span style={shell.paginationText}>
          Showing {pageStart}-{pageEnd} of {sortedCustomers.length} customers (20 per page)
        </span>
        <div style={shell.paginationActions}>
          <button
            type="button"
            style={{ ...shell.paginationButton, opacity: currentPage === 1 ? 0.45 : 1 }}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <span style={shell.paginationText}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            style={{ ...shell.paginationButton, opacity: currentPage === totalPages ? 0.45 : 1 }}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {showHistory ? (
        <div style={shell.historyOverlay}>
          <div style={historyModalStyle}>
            <div style={historyHeaderStyle}>
              <div>
                <h3 style={historyTitleTinyStyle}>
                  {selectedHistoryCustomer?.displayName || selectedHistoryCustomer?.name || 'Customer History'}
                </h3>
                <p style={shell.historySubTitle}>
                  {selectedHistoryCustomer?.companyName || selectedHistoryCustomer?.contactPersonName || 'Customer ledger and transactions'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  style={shell.cancelButton}
                  onClick={() => {
                    if (!selectedHistoryCustomer?._id) return;
                    setEditingId(selectedHistoryCustomer._id);
                    setForm(mapCustomerToForm(selectedHistoryCustomer));
                    setSaveError('');
                    setShowHistory(false);
                    setShowModal(true);
                  }}
                >
                  Edit
                </button>
                <button type="button" style={shell.historyClose} onClick={closeCustomerHistory} aria-label="Close history">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={shell.historyBody}>
              <div style={shell.historyTabs}>
                <button
                  type="button"
                  style={historyTab === 'overview' ? { ...shell.historyTabBtn, ...shell.historyTabBtnActive } : shell.historyTabBtn}
                  onClick={() => setHistoryTab('overview')}
                >
                  Overview
                </button>
                <button
                  type="button"
                  style={historyTab === 'transactions' ? { ...shell.historyTabBtn, ...shell.historyTabBtnActive } : shell.historyTabBtn}
                  onClick={() => setHistoryTab('transactions')}
                >
                  Transactions
                </button>
              </div>

              {historyLoading ? (
                <p style={shell.historyEmpty}>Loading customer history...</p>
              ) : historyError ? (
                <p style={{ ...shell.historyEmpty, color: '#dc2626', fontWeight: 700 }}>{historyError}</p>
              ) : historyTab === 'overview' ? (
                <>
                  <div style={shell.historyStats}>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Total Invoices</p>
                      <p style={shell.historyStatValue}>{historySummary.invoiceCount}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Total Invoice Amount</p>
                      <p style={shell.historyStatValue}>{formatINR(historySummary.totalInvoiceAmount)}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Total Received</p>
                      <p style={shell.historyStatValue}>{formatINR(historySummary.totalReceived)}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Balance Due</p>
                      <p style={shell.historyStatValue}>{formatINR(historySummary.totalBalanceDue)}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Payments Count</p>
                      <p style={shell.historyStatValue}>{historySummary.paymentCount}</p>
                    </div>
                    <div style={shell.historyStatCard}>
                      <p style={shell.historyStatLabel}>Avg Invoice Value</p>
                      <p style={shell.historyStatValue}>{formatINR(historySummary.avgInvoiceValue)}</p>
                    </div>
                  </div>

                  <div style={shell.historyMetaBox}>
                    <div>
                      <p style={shell.historyMetaLabel}>Contact Person</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.contactPersonName || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>Mobile Number</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.mobileNumber || selectedHistoryCustomer?.workPhone || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>Email</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.emailId || selectedHistoryCustomer?.email || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>GST Number</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.gstNumber || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>Billing State</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.billingState || selectedHistoryCustomer?.state || '-'}</p>
                    </div>
                    <div>
                      <p style={shell.historyMetaLabel}>Billing Area</p>
                      <p style={shell.historyMetaValue}>{selectedHistoryCustomer?.billingArea || selectedHistoryCustomer?.area || '-'}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div style={shell.historyGrid}>
                  <div style={shell.historySection}>
                    <div style={shell.historySectionHead}>
                      <h4 style={shell.historySectionTitle}>Invoices</h4>
                    </div>
                    {historyInvoicesSorted.length === 0 ? (
                      <p style={shell.historyEmpty}>No invoices found for this customer.</p>
                    ) : (
                      <div style={shell.historyTableWrap}>
                        <table style={shell.historyTable}>
                          <thead>
                            <tr>
                              <th style={shell.historyHeadCell}>Date</th>
                              <th style={shell.historyHeadCell}>Invoice#</th>
                              <th style={shell.historyHeadCell}>Amount</th>
                              <th style={shell.historyHeadCell}>Balance Due</th>
                              <th style={shell.historyHeadCell}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyInvoicesSorted.map((invoice) => (
                              <tr key={invoice._id || `${invoice.invoiceNumber}-${invoice.date}`} style={shell.historyRow}>
                                <td style={shell.historyCell}>{formatDisplayDate(invoice.date)}</td>
                                <td style={{ ...shell.historyCell, color: 'var(--color-primary)', fontWeight: 700 }}>
                                  {invoice.invoiceNumber ? (
                                    <button
                                      type="button"
                                      onClick={() => openInvoiceInInvoiceModule(invoice)}
                                      style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                                    >
                                      {invoice.invoiceNumber}
                                    </button>
                                  ) : '-'}
                                </td>
                                <td style={shell.historyCell}>{formatINR(invoice.amount ?? invoice.total ?? 0)}</td>
                                <td style={shell.historyCell}>{formatINR(invoice.balanceDue ?? 0)}</td>
                                <td style={shell.historyCell}>{String(invoice.status || '-').toUpperCase()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div style={shell.historySection}>
                    <div style={shell.historySectionHead}>
                      <h4 style={shell.historySectionTitle}>Customer Payments</h4>
                    </div>
                    {historyPaymentsSorted.length === 0 ? (
                      <p style={shell.historyEmpty}>No payments found for this customer.</p>
                    ) : (
                      <div style={shell.historyTableWrap}>
                        <table style={shell.historyTable}>
                          <thead>
                            <tr>
                              <th style={shell.historyHeadCell}>Date</th>
                              <th style={shell.historyHeadCell}>Payment#</th>
                              <th style={shell.historyHeadCell}>Invoice#</th>
                              <th style={shell.historyHeadCell}>Payment Mode</th>
                              <th style={shell.historyHeadCell}>Amount</th>
                              <th style={shell.historyHeadCell}>Balance After Payment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyPaymentsSorted.map((payment) => (
                              <tr key={payment._id || `${payment.paymentNumber}-${payment.paymentDate}`} style={shell.historyRow}>
                                <td style={shell.historyCell}>{formatDisplayDate(payment.paymentDate || payment.date)}</td>
                                <td style={{ ...shell.historyCell, color: 'var(--color-primary)', fontWeight: 700 }}>{payment.paymentNumber || '-'}</td>
                                <td style={shell.historyCell}>{payment.invoiceNumber || '-'}</td>
                                <td style={shell.historyCell}>{payment.mode || '-'}</td>
                                <td style={shell.historyCell}>{formatINR(payment.amount || 0)}</td>
                                <td style={shell.historyCell}>{formatINR(payment.balanceAfterPayment || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? createPortal(
        <div style={modalOverlayStyle}>
          <form style={modalStyle} onSubmit={handleSubmit}>
            <div style={modalHeaderStyle}>{editingId ? 'Edit Customer' : 'New Customer'}</div>

            <div style={modalBodyStyle}>
              <label style={shell.label}>Duplicate Check</label>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                {similarLoading ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontWeight: 600 }}>Checking similar customers...</p>
                ) : null}
                {!similarLoading && similarCustomers.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#166534', fontWeight: 700 }}>No similar customer found.</p>
                ) : null}
                {!similarLoading && similarCustomers.length > 0 ? (
                  <div style={{ display: 'grid', gap: '7px' }}>
                    {similarCustomers.slice(0, 5).map((entry) => (
                      <div key={entry.customerId} style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '8px', padding: '8px', background: 'rgba(252,231,243,0.6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{entry.customerName}</div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400e' }}>{entry.confidence}%</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#334155', marginTop: '4px' }}>{entry.mobileNumber || '-'} | {entry.email || '-'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{entry.reason || entry.status}</div>
                        <div style={{ marginTop: '6px' }}>
                          <button
                            type="button"
                            style={{ border: '1px solid #93c5fd', borderRadius: '8px', background: '#fff', color: 'var(--color-primary-dark)', fontSize: '11px', fontWeight: 700, padding: '4px 8px', cursor: 'pointer' }}
                            onClick={() => {
                              const existing = customers.find((customer) => customer._id === entry.customerId);
                              if (existing) openCustomerHistory(existing);
                            }}
                          >
                            Use Existing Customer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <label style={shell.label}>Segment</label>
              <div style={shell.inlineChecks}>
                <label>
                  <input
                    type="radio"
                    name="segment"
                    checked={form.segment === 'Residential'}
                    onChange={() => setForm((prev) => ({ ...prev, segment: 'Residential' }))}
                  />{' '}
                  Residential
                </label>
                <label>
                  <input
                    type="radio"
                    name="segment"
                    checked={form.segment === 'Commercial'}
                    onChange={() => setForm((prev) => ({ ...prev, segment: 'Commercial' }))}
                  />{' '}
                  Commercial
                </label>
              </div>

              <label style={shell.label}>Company Name</label>
              <input
                style={shell.input}
                value={form.companyName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    companyName: event.target.value
                  }))
                }
              />

              <label style={shell.label}>Contact Person Name</label>
              <input
                style={shell.input}
                value={form.contactPersonName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    contactPersonName: event.target.value
                  }))
                }
              />

                <label style={shell.label}>Display Name</label>
                <select
                  style={shell.input}
                  value={displayNameOptions.includes(form.displayName) ? form.displayName : ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                >
                {displayNameOptions.length === 0 ? (
                  <option value="">Select from Company/Contact</option>
                ) : null}
                {displayNameOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>

              <label style={shell.label}>Position</label>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
                <select
                  style={shell.input}
                  value={form.position}
                  onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                >
                  {positionOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <input
                  style={shell.input}
                  placeholder="Edit type"
                  disabled={form.position !== 'Edit type'}
                  value={form.positionCustom}
                  onChange={(event) => setForm((prev) => ({ ...prev, positionCustom: event.target.value }))}
                />
              </div>

              <label style={shell.label}>Mobile Number</label>
              <input
                style={shell.input}
                value={form.mobileNumber}
                inputMode="numeric"
                maxLength={10}
                onChange={(event) =>
                  setForm((prev) => {
                    const mobileNumber = toTenDigitNumber(event.target.value);
                    return {
                      ...prev,
                      mobileNumber,
                      whatsappNumber: prev.whatsappSameAsMobile ? mobileNumber : prev.whatsappNumber
                    };
                  })
                }
              />

              <label style={shell.label}>WhatsApp Number</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                <input
                  style={shell.input}
                  value={form.whatsappSameAsMobile ? form.mobileNumber : form.whatsappNumber}
                  disabled={form.whatsappSameAsMobile}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(event) => setForm((prev) => ({ ...prev, whatsappNumber: toTenDigitNumber(event.target.value) }))}
                />
                <label style={{ fontSize: '11px', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={form.whatsappSameAsMobile}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        whatsappSameAsMobile: event.target.checked,
                        whatsappNumber: event.target.checked ? prev.mobileNumber : prev.whatsappNumber
                      }))
                    }
                  />{' '}
                  Same as mobile
                </label>
              </div>

              <label style={shell.label}>Alt Number</label>
              <input
                style={shell.input}
                value={form.altNumber}
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => setForm((prev) => ({ ...prev, altNumber: toTenDigitNumber(event.target.value) }))}
              />

              <label style={shell.label}>Email Id</label>
              <input
                style={shell.input}
                type="email"
                value={form.emailId}
                onChange={(event) => setForm((prev) => ({ ...prev, emailId: event.target.value }))}
              />

              <label style={shell.label}>GST Number</label>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '8px' }}>
                <label style={{ ...shell.inlineChecks, fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={form.hasGst}
                    onChange={(event) => setForm((prev) => ({ ...prev, hasGst: event.target.checked, gstNumber: event.target.checked ? prev.gstNumber : '' }))}
                  />
                  Yes
                </label>
                <input
                  style={shell.input}
                  placeholder="Enter GSTIN (e.g., 29ABCDE9999F1Z8)"
                  disabled={!form.hasGst}
                  value={form.gstNumber}
                  inputMode="text"
                  maxLength={15}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      gstNumber: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
                    }))
                  }
                />
              </div>

              <label style={shell.label}>Billing Address</label>
              <div style={addressSplitStyle}>
                <div style={shell.addressCard}>
                  <div style={shell.addressHead}>
                    <h4 style={shell.addressTitle}>Billing Address</h4>
                  </div>
                  <div style={addressGridStyle}>
                    <label style={shell.label}>Attention</label>
                    <input style={shell.input} value={form.billingAttention} onChange={(event) => updateBillingField('billingAttention', event.target.value)} />

                    <label style={shell.label}>Address</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <textarea style={shell.textarea} placeholder="Street 1" value={form.billingStreet1} onChange={(event) => updateBillingField('billingStreet1', event.target.value)} />
                      <textarea style={shell.textarea} placeholder="Street 2" value={form.billingStreet2} onChange={(event) => updateBillingField('billingStreet2', event.target.value)} />
                    </div>

                    <label style={shell.label}>Area</label>
                    <input style={shell.input} value={form.billingArea} onChange={(event) => updateBillingField('billingArea', event.target.value)} />

                    <label style={shell.label}>State</label>
                    <select style={shell.input} value={form.billingState} onChange={(event) => updateBillingField('billingState', event.target.value)}>
                      {stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>

                    <label style={shell.label}>Pin Code</label>
                    <input style={shell.input} value={form.billingPincode} onChange={(event) => updateBillingField('billingPincode', event.target.value)} />

                  </div>
                </div>

                <div style={shell.addressCard}>
                  <div style={shell.addressHead}>
                    <h4 style={shell.addressTitle}>Shipping Address</h4>
                    <button
                      type="button"
                      style={shell.addressCopy}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          shippingSameAsBilling: true,
                          ...copyBillingToShipping(prev)
                        }))
                      }
                    >
                      ↓ Copy billing address
                    </button>
                  </div>
                  <div style={addressGridStyle}>
                    <label style={shell.label}>Attention</label>
                    <input style={shell.input} value={form.shippingAttention} onChange={(event) => setForm((prev) => ({ ...prev, shippingAttention: event.target.value }))} />

                    <label style={shell.label}>Address</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <textarea style={shell.textarea} placeholder="Street 1" value={form.shippingStreet1} onChange={(event) => setForm((prev) => ({ ...prev, shippingStreet1: event.target.value }))} />
                      <textarea style={shell.textarea} placeholder="Street 2" value={form.shippingStreet2} onChange={(event) => setForm((prev) => ({ ...prev, shippingStreet2: event.target.value }))} />
                    </div>

                    <label style={shell.label}>Area</label>
                    <input style={shell.input} value={form.shippingArea} onChange={(event) => setForm((prev) => ({ ...prev, shippingArea: event.target.value }))} />

                    <label style={shell.label}>State</label>
                    <select style={shell.input} value={form.shippingState} onChange={(event) => setForm((prev) => ({ ...prev, shippingState: event.target.value }))}>
                      {stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>

                    <label style={shell.label}>Pin Code</label>
                    <input style={shell.input} value={form.shippingPincode} onChange={(event) => setForm((prev) => ({ ...prev, shippingPincode: event.target.value }))} />

                  </div>
                </div>
              </div>

              <label style={shell.label}>Area in sqft</label>
              <input
                style={shell.input}
                type="number"
                value={form.areaSqft}
                onChange={(event) => setForm((prev) => ({ ...prev, areaSqft: event.target.value }))}
              />

            </div>

            <div style={modalFooterStyle}>
              {saveError ? (
                <div style={{ marginRight: 'auto', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                  {saveError}
                </div>
              ) : null}
              <button
                type="button"
                style={shell.cancelButton}
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                  setSaveError('');
                  setSimilarCustomers([]);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
              <button type="submit" style={shell.saveButton} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingId ? 'Update Customer' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      ) : null}

      {showImportWizard ? (
        <CustomerImportDedupWizard
          open={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onComplete={async () => {
            await Promise.all([loadCustomers(), loadTransactions(), loadDuplicateReport()]);
          }}
        />
      ) : null}

      {showDuplicateReport ? createPortal(
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, width: 'min(1180px, 100%)' }}>
            <div style={modalHeaderStyle}>Duplicate Report & Data Health</div>
            <div style={duplicateModalBodyStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', gridColumn: '1 / -1' }}>
                <div style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Active Customers</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{duplicateSummary?.totalActiveCustomers || 0}</p>
                </div>
                <div style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Exact Duplicate Pairs</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#991b1b' }}>{duplicateSummary?.exactDuplicatePairs || 0}</p>
                </div>
                <div style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Possible Duplicate Pairs</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#92400e' }}>{duplicateSummary?.possibleDuplicatePairs || 0}</p>
                </div>
                <div style={{ border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Customer Data Health Score</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>{duplicateSummary?.customerDataHealthScore ?? 100}</p>
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px', background: '#fff' }}>
                <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={shell.headCell}>Customer A</th>
                      <th style={shell.headCell}>Customer B</th>
                      <th style={shell.headCell}>Score</th>
                      <th style={shell.headCell}>Status</th>
                      <th style={shell.headCell}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateRows.length === 0 ? (
                      <tr><td style={shell.cell} colSpan={5}>No duplicate pairs found.</td></tr>
                    ) : duplicateRows.slice(0, 200).map((row) => (
                      <tr key={row.pairId}>
                        <td style={shell.cell}>{row.customerAName} ({row.customerAId})</td>
                        <td style={shell.cell}>{row.customerBName} ({row.customerBId})</td>
                        <td style={shell.cell}>{row.score}%</td>
                        <td style={shell.cell}>{row.status}</td>
                        <td style={shell.cell}>{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button type="button" style={shell.cancelButton} onClick={() => setShowDuplicateReport(false)}>Close</button>
              <button type="button" style={shell.cancelButton} onClick={() => exportDuplicateReport('csv')}>Export CSV</button>
              <button type="button" style={shell.saveButton} onClick={() => exportDuplicateReport('pdf')}>Export PDF</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
