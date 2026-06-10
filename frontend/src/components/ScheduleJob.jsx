import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CalendarDays, MapPin, Wrench, X } from 'lucide-react';
import PdfPreviewModal from './PdfPreviewModal';
import { useColumnResize } from './table/useColumnResize';
import { subscribeDashboardRefresh, triggerDashboardRefresh } from '../utils/dashboardRefresh';
import { formatServiceScheduleTime } from '../utils/serviceScheduleBuilder';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const SCHEDULE_JOB_CACHE_KEY = 'schedule_job_dashboard_cache_v1';
const SCHEDULE_JOB_FOCUS_KEY = 'schedule_job_focus_status';

const statusFilters = ['All', 'Assigned', 'Scheduled', 'Completed'];

const shell = {
  page: {
    width: '100%',
    display: 'grid',
    gap: '10px',
    padding: '8px'
  },
  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    flexWrap: 'wrap'
  },
  titleWrap: { display: 'grid', gap: '2px' },
  title: { margin: 0, fontSize: '30px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' },
  subtitle: { margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 },
  topActions: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  assignBtn: { minHeight: '32px', borderRadius: '8px', border: '1px solid var(--color-primary-dark)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, fontSize: '12px', padding: '0 12px', cursor: 'pointer' },
  section: {
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: '10px',
    background: '#fff',
    overflow: 'hidden'
  },
  sectionHead: {
    padding: '10px 12px 8px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
    color: '#334155',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  sectionBody: { padding: '10px 12px', display: 'grid', gap: '10px' },
  fieldGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  fieldGrid4: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.7fr', gap: '10px' },
  field: { display: 'grid', gap: '4px' },
  label: { margin: 0, fontSize: '11px', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' },
  input: { width: '100%', minHeight: '30px', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '0 8px', fontSize: '12px', color: '#334155', background: '#fff', boxSizing: 'border-box' },
  help: { margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 600 },
  tinyPill: { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', border: '1px solid #F9A8D4', background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 800, fontSize: '11px', padding: '3px 8px' },
  chipRow: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  chip: { border: '1px solid var(--color-border)', background: '#fff', color: '#64748b', borderRadius: '999px', minHeight: '28px', padding: '0 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' },
  chipActive: { borderColor: '#93c5fd', background: 'var(--color-primary)', color: '#fff' },
  tableWrap: { border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc' },
  td: { fontSize: '12px', color: '#1f2937', padding: '8px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  muted: { color: '#94a3b8' },
  techRow: { display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr)', gap: '8px', alignItems: 'end' },
  selectedWrap: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  selectedTag: { display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center', height: '32px', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: '999px', background: '#f8fafc', color: '#334155', fontSize: '11px', fontWeight: 700, lineHeight: '1', padding: '0 12px' },
  removeTag: { border: 'none', background: 'transparent', color: '#64748b', display: 'inline-flex', padding: 0, cursor: 'pointer' },
  bottomStatus: { margin: 0, fontSize: '12px', fontWeight: 700 }
};

const toDateOnly = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDate = (value) => {
  const d = toDateOnly(value);
  if (!d) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const normalizeDateInputValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTimeTo24Hour = (value, fallback = '') => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const normalized24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (normalized24) {
    return `${String(Number(normalized24[1])).padStart(2, '0')}:${normalized24[2]}`;
  }

  const normalized12 = raw.match(/^(\d{1,2})(?::([0-5]\d))?\s*([ap]m)$/i);
  if (normalized12) {
    let hours = Number(normalized12[1]);
    const minutes = normalized12[2] || '00';
    const suffix = normalized12[3].toLowerCase();
    if (!Number.isFinite(hours) || hours < 1 || hours > 12) return fallback;
    if (suffix === 'pm' && hours !== 12) hours += 12;
    if (suffix === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  return fallback;
};

const formatTimeForEdit = (value) => {
  const normalized = parseTimeTo24Hour(value, '');
  return normalized ? formatServiceScheduleTime(normalized) : '';
};

const formatEmployeeName = (employee) => {
  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  return fullName || employee.empCode || 'Technician';
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const isTechnicianRoleOnly = (employee) => normalizeText(employee?.role) === 'technician';
const isContractActive = (invoice) => {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const first = items[0] || {};
  const endRaw = first.contractEndDate || invoice.servicePeriodEnd || '';
  if (!endRaw) return true;
  const end = new Date(endRaw);
  if (Number.isNaN(end.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end >= today;
};

const readScheduleJobCache = () => {
  try {
    const raw = sessionStorage.getItem(SCHEDULE_JOB_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
    };
  } catch (_error) {
    return null;
  }
};

const writeScheduleJobCache = (next = {}) => {
  try {
    sessionStorage.setItem(
      SCHEDULE_JOB_CACHE_KEY,
      JSON.stringify({
        customers: Array.isArray(next.customers) ? next.customers : [],
        invoices: Array.isArray(next.invoices) ? next.invoices : [],
        employees: Array.isArray(next.employees) ? next.employees : [],
        jobs: Array.isArray(next.jobs) ? next.jobs : [],
        updatedAt: Date.now()
      })
    );
  } catch (_error) {
    // Ignore sessionStorage failures.
  }
};

const scheduleColumns = ['select', 'service', 'visit', 'date', 'window', 'site', 'status', 'pdf'];
const scheduleColumnWidths = {
  select: 56,
  service: 220,
  visit: 118,
  date: 168,
  window: 122,
  site: 230,
  status: 128,
  pdf: 90
};
const scheduleColumnBounds = {
  select: { min: 48, max: 72 },
  service: { min: 180, max: 360 },
  visit: { min: 100, max: 180 },
  date: { min: 156, max: 190 },
  window: { min: 110, max: 170 },
  site: { min: 170, max: 320 },
  status: { min: 100, max: 160 },
  pdf: { min: 82, max: 120 }
};

export default function ScheduleJob() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefillLead = location.state?.lead || null;
  const prefillCustomerName = location.state?.customerName || prefillLead?.customerName || '';
  const prefillContractNumber = location.state?.contractNumber || '';
  const [cachedScheduleData] = useState(() => readScheduleJobCache());

  const [customers, setCustomers] = useState(() => cachedScheduleData?.customers || []);
  const [invoices, setInvoices] = useState(() => cachedScheduleData?.invoices || []);
  const [employees, setEmployees] = useState(() => cachedScheduleData?.employees || []);
  const [jobs, setJobs] = useState(() => cachedScheduleData?.jobs || []);
  const [loading, setLoading] = useState(() => !cachedScheduleData);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const loadRequestRef = useRef(null);
  const isMountedRef = useRef(true);

  const [customerId, setCustomerId] = useState('');
  const [contractId, setContractId] = useState('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('All');
  const [selectedScheduleKeys, setSelectedScheduleKeys] = useState([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
  const [premiseRows, setPremiseRows] = useState([]);
  const [selectedPremiseId, setSelectedPremiseId] = useState('');
  const [editableServiceRows, setEditableServiceRows] = useState([]);
  const [pdfPreview, setPdfPreview] = useState({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '' });

  const loadPortalData = useCallback(async ({ silent = false } = {}) => {
    if (loadRequestRef.current) return loadRequestRef.current;

    const request = (async () => {
      if (!silent) {
        setLoading(true);
        setLoadError('');
      }
      try {
        const [customerRes, invoiceRes, employeeRes, jobsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/customers`),
          axios.get(`${API_BASE_URL}/api/invoices`),
          axios.get(`${API_BASE_URL}/api/employees`),
          axios.get(`${API_BASE_URL}/api/jobs`, { params: { includeInactive: true } })
        ]);
        if (!isMountedRef.current) return;
        const nextCustomers = Array.isArray(customerRes.data) ? customerRes.data : [];
        const nextInvoices = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
        const nextEmployees = Array.isArray(employeeRes.data) ? employeeRes.data : [];
        const nextJobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
        setCustomers(nextCustomers);
        setInvoices(nextInvoices);
        setEmployees(nextEmployees);
        setJobs(nextJobs);
        writeScheduleJobCache({
          customers: nextCustomers,
          invoices: nextInvoices,
          employees: nextEmployees,
          jobs: nextJobs
        });
      } catch (error) {
        console.error('Failed to load assign-service data', error);
        if (!isMountedRef.current) return;
        if (!cachedScheduleData) {
          setLoadError('Could not fetch customer/contract/employee data.');
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    })();

    loadRequestRef.current = request;
    request.finally(() => {
      if (loadRequestRef.current === request) {
        loadRequestRef.current = null;
      }
    });
    return request;
  }, [cachedScheduleData]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadPortalData({ silent: Boolean(cachedScheduleData) });
    return () => {
      isMountedRef.current = false;
    };
  }, [cachedScheduleData, loadPortalData]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const refreshKeys = new Set(['jobs_sync_tick']);
    const refresh = () => {
      loadPortalData({ silent: true }).catch((error) => {
        console.error('Failed to refresh assign-service data', error);
      });
    };
    const openCompletedTabIfRequested = () => {
      const focusStatus = String(localStorage.getItem(SCHEDULE_JOB_FOCUS_KEY) || '').trim().toLowerCase();
      if (focusStatus === 'completed') {
        setScheduleStatusFilter('Completed');
        localStorage.removeItem(SCHEDULE_JOB_FOCUS_KEY);
      }
    };
    const unsubscribeDashboardRefresh = subscribeDashboardRefresh(refresh);
    const onStorage = (event) => {
      if (event.key && refreshKeys.has(event.key)) {
        refresh();
        openCompletedTabIfRequested();
      }
      if (event.key === SCHEDULE_JOB_FOCUS_KEY) openCompletedTabIfRequested();
    };
    openCompletedTabIfRequested();
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribeDashboardRefresh();
      window.removeEventListener('storage', onStorage);
    };
  }, [loadPortalData]);

  const customersWithContracts = useMemo(() => {
    const activeInvoices = invoices.filter((invoice) => isContractActive(invoice));
    const ids = new Set(activeInvoices.map((invoice) => String(invoice.customerId || '')).filter(Boolean));
    const names = new Set(activeInvoices.map((invoice) => normalizeText(invoice.customerName)).filter(Boolean));
    const baseCustomers = customers.filter(
      (customer) => ids.has(String(customer._id || '')) || names.has(normalizeText(customer.displayName || customer.name))
    );

    // Prevent duplicate dropdown entries when multiple customer records share the same display name.
    const byName = new Map();
    baseCustomers.forEach((customer) => {
      const nameKey = normalizeText(customer.displayName || customer.name);
      if (!nameKey) return;
      const current = byName.get(nameKey);
      if (!current) {
        byName.set(nameKey, customer);
        return;
      }

      const currentHasDirectInvoice = ids.has(String(current._id || ''));
      const nextHasDirectInvoice = ids.has(String(customer._id || ''));
      if (nextHasDirectInvoice && !currentHasDirectInvoice) {
        byName.set(nameKey, customer);
        return;
      }

      const currentMobile = String(current.mobileNumber || current.workPhone || '').trim();
      const nextMobile = String(customer.mobileNumber || customer.workPhone || '').trim();
      if (!currentMobile && nextMobile) {
        byName.set(nameKey, customer);
      }
    });

    return Array.from(byName.values()).sort((a, b) =>
      String(a.displayName || a.name || '').localeCompare(String(b.displayName || b.name || ''), 'en', {
        sensitivity: 'base',
        numeric: true
      })
    );
  }, [customers, invoices]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c._id) === String(customerId)) || null,
    [customers, customerId]
  );
  const selectedPremise = useMemo(() => {
    if (!selectedPremiseId) return null;
    return premiseRows.find((row) => String(row.premiseId || row.premise_id || '') === String(selectedPremiseId)) || null;
  }, [premiseRows, selectedPremiseId]);
  const premiseAddress = selectedPremise ? {
    address: selectedPremise.address || '',
    areaName: selectedPremise.areaName || selectedPremise.area_name || '',
    city: selectedPremise.city || '',
    state: selectedPremise.state || '',
    pincode: selectedPremise.pincode || '',
    googleMapUrl: selectedPremise.googleMapUrl || selectedPremise.google_map_url || ''
  } : null;

  useEffect(() => {
    if (!customerId) {
      setPremiseRows([]);
      setSelectedPremiseId('');
      return;
    }
    let mounted = true;
    axios.get(`${API_BASE_URL}/api/customers/${customerId}/premises`)
      .then((res) => {
        if (!mounted) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setPremiseRows(rows);
        const defaultPremise = rows.find((row) => row.isDefault || row.is_default) || rows[0];
        setSelectedPremiseId(defaultPremise ? String(defaultPremise.premiseId || defaultPremise.premise_id || '') : '');
      })
      .catch((error) => {
        console.error('Failed to load premises', error);
        if (mounted) {
          setPremiseRows([]);
          setSelectedPremiseId('');
        }
      });
    return () => { mounted = false; };
  }, [customerId]);

  const customerContracts = useMemo(() => {
    if (!selectedCustomer) return [];
    const customerName = normalizeText(selectedCustomer.displayName || selectedCustomer.name);
    return invoices
      .filter((invoice) => (
        isContractActive(invoice) && (
        String(invoice.customerId || '') === String(selectedCustomer._id || '')
        || normalizeText(invoice.customerName) === customerName
        )
      ))
      .map((invoice) => {
        const lines = Array.isArray(invoice.items) ? invoice.items : [];
        const firstLine = lines[0] || {};
        const startDate = firstLine.contractStartDate || invoice.servicePeriodStart || invoice.date || '';
        const endDate = firstLine.contractEndDate || invoice.servicePeriodEnd || '';
        return {
          ...invoice,
          contractNumber: String(invoice.invoiceNumber || invoice._id || 'Contract'),
          startDate,
          endDate
        };
      });
  }, [invoices, selectedCustomer]);

  const selectedContract = useMemo(
    () => customerContracts.find((entry) => String(entry._id) === String(contractId)) || null,
    [customerContracts, contractId]
  );

  const serviceRows = useMemo(() => {
    if (!selectedContract) return [];
    const contractIdText = String(selectedContract._id || '').trim();
    const scheduleJobState = new Map();
    const scheduleJobByKey = new Map();
    (Array.isArray(jobs) ? jobs : []).forEach((job) => {
      const scheduleKey = String(job?.scheduleKey || '').trim();
      if (!scheduleKey) return;
      const sameContract = String(job?.contractId || '').trim() === contractIdText;
      const sameContractNumber = String(job?.contractNumber || '').trim().toLowerCase() === String(selectedContract.contractNumber || '').trim().toLowerCase();
      if (!sameContract && !sameContractNumber) return;

      const status = String(job?.status || '').trim().toLowerCase();
      if (['cancelled', 'canceled', 'deleted', 'archived', 'closed'].includes(status)) return;

      const hasTechnician = Boolean(String(job?.technicianId || '').trim() || String(job?.technicianName || '').trim());
      const current = scheduleJobState.get(scheduleKey) || { hasAssignment: false, hasCompletion: false };
      if (status === 'completed') {
        current.hasCompletion = true;
      } else if (hasTechnician || status === 'assigned' || status === 'in progress') {
        current.hasAssignment = true;
      }
      scheduleJobState.set(scheduleKey, current);

      const existingJob = scheduleJobByKey.get(scheduleKey);
      const existingTs = new Date(existingJob?.createdAt || existingJob?.updatedAt || 0).getTime();
      const nextTs = new Date(job?.createdAt || job?.updatedAt || 0).getTime();
      if (!existingJob || nextTs >= existingTs || status === 'completed') {
        scheduleJobByKey.set(scheduleKey, job);
      }
    });
    const schedules = Array.isArray(selectedContract.serviceSchedules) ? selectedContract.serviceSchedules : [];
    const itemById = new Map(
      (Array.isArray(selectedContract.items) ? selectedContract.items : [])
        .filter((item) => item && item.itemId)
        .map((item) => [String(item.itemId), item])
    );
    return schedules.map((schedule, index) => {
      const item = itemById.get(String(schedule.itemId || '')) || {};
      const key = `${selectedContract._id}-${index}-${schedule.serviceNumber || index + 1}`;
      const statusRaw = String(schedule.status || 'Scheduled');
      const status = statusRaw.toLowerCase().includes('complete')
        ? 'Completed'
        : statusRaw.toLowerCase().includes('assign')
          ? 'Assigned'
          : 'Scheduled';
      const jobState = scheduleJobState.get(key);
      const resolvedStatus = jobState?.hasCompletion
        ? 'Completed'
        : jobState?.hasAssignment
          ? 'Assigned'
          : status;
      const relatedJob = scheduleJobByKey.get(key) || null;
      return {
        key,
        service: schedule.itemName || item.itemName || item.name || 'Service',
        visit: `#${schedule.serviceNumber || index + 1}`,
        date: schedule.serviceDate || '',
        window: schedule.serviceTime || selectedContract.serviceScheduleDefaultTime || '',
        site: [selectedCustomer?.billingArea || selectedCustomer?.area, selectedCustomer?.billingState || selectedCustomer?.state].filter(Boolean).join(', '),
        status: resolvedStatus,
        relatedJobId: String(relatedJob?._id || '').trim(),
        raw: schedule
      };
    });
  }, [selectedContract, selectedCustomer, jobs]);

  useEffect(() => {
    setEditableServiceRows(
      serviceRows.map((row) => ({
        ...row,
        editableDate: normalizeDateInputValue(row.date),
        editableTime: formatTimeForEdit(row.window)
      }))
    );
  }, [serviceRows]);

  const filteredServiceRows = useMemo(
    () => serviceRows.filter((row) => scheduleStatusFilter === 'All' || row.status === scheduleStatusFilter),
    [scheduleStatusFilter, serviceRows]
  );

  const selectableFilteredServiceRows = useMemo(
    () => filteredServiceRows.filter((row) => row.status === 'Scheduled'),
    [filteredServiceRows]
  );

  const technicians = useMemo(
    () => employees.filter((employee) => isTechnicianRoleOnly(employee)),
    [employees]
  );

  useEffect(() => {
    if (!loading && prefillCustomerName && !customerId) {
      const match = customersWithContracts.find((entry) => normalizeText(entry.displayName || entry.name) === normalizeText(prefillCustomerName));
      if (match) setCustomerId(String(match._id));
    }
  }, [loading, prefillCustomerName, customerId, customersWithContracts]);

  useEffect(() => {
    if (!loading && prefillContractNumber && customerContracts.length > 0 && !contractId) {
      const match = customerContracts.find((entry) => normalizeText(entry.contractNumber) === normalizeText(prefillContractNumber));
      if (match) setContractId(String(match._id));
    }
  }, [loading, prefillContractNumber, customerContracts, contractId]);

  useEffect(() => {
    setSelectedScheduleKeys([]);
  }, [contractId, scheduleStatusFilter]);

  const addTechnicianById = (nextId) => {
    const id = String(nextId || '').trim();
    if (!id) return;
    const matched = technicians.find((entry) => String(entry._id || '') === id);
    if (!matched) return;
    if (selectedTechnicians.some((entry) => String(entry._id) === id)) {
      return;
    }
    setSelectedTechnicians((prev) => [...prev, matched]);
  };

  const toggleSchedule = (key) => {
    const nextRow = editableServiceRows.find((entry) => entry.key === key);
    if (nextRow && nextRow.status !== 'Scheduled') return;
    setSelectedScheduleKeys((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  };

  const allFilteredSelected = useMemo(
    () => selectableFilteredServiceRows.length > 0 && selectableFilteredServiceRows.every((row) => selectedScheduleKeys.includes(row.key)),
    [selectableFilteredServiceRows, selectedScheduleKeys]
  );

  const someFilteredSelected = useMemo(
    () => selectableFilteredServiceRows.some((row) => selectedScheduleKeys.includes(row.key)),
    [selectableFilteredServiceRows, selectedScheduleKeys]
  );

  const toggleSelectAllFiltered = () => {
    setSelectedScheduleKeys((prev) => {
      if (selectableFilteredServiceRows.length === 0) return prev;
      const filteredKeys = selectableFilteredServiceRows.map((row) => row.key);
      const everySelected = filteredKeys.every((key) => prev.includes(key));
      if (everySelected) {
        return prev.filter((key) => !filteredKeys.includes(key));
      }
      const merged = new Set(prev);
      filteredKeys.forEach((key) => merged.add(key));
      return Array.from(merged);
    });
  };

  useEffect(() => {
    const selectableKeys = new Set(serviceRows.filter((row) => row.status === 'Scheduled').map((row) => row.key));
    setSelectedScheduleKeys((prev) => prev.filter((key) => selectableKeys.has(key)));
  }, [serviceRows]);

  const selectedRows = useMemo(
    () => editableServiceRows.filter((row) => selectedScheduleKeys.includes(row.key)),
    [editableServiceRows, selectedScheduleKeys]
  );
  const isMobile = viewportWidth <= 900;
  const {
    getColumnWidth,
    resetColumns,
    startResize
  } = useColumnResize({
    storageKey: 'skuas-table-widths-schedule-job',
    columns: scheduleColumns,
    defaultColumnWidths: scheduleColumnWidths,
    columnBounds: scheduleColumnBounds,
    minWidth: 80,
    enabled: true
  });
  const scheduleTableMinWidth = scheduleColumns.reduce((sum, key) => sum + (getColumnWidth(key) || scheduleColumnWidths[key] || 80), 0);
  const pageStyle = isMobile ? { ...shell.page, padding: '0', gap: '10px' } : shell.page;
  const titleStyle = isMobile ? { ...shell.title, fontSize: '24px' } : shell.title;
  const fieldGrid2Style = isMobile ? { ...shell.fieldGrid2, gridTemplateColumns: '1fr' } : shell.fieldGrid2;
  const fieldGrid4Style = isMobile ? { ...shell.fieldGrid4, gridTemplateColumns: '1fr' } : shell.fieldGrid4;
  const tableWrapStyle = { ...shell.tableWrap, overflowX: 'auto', maxWidth: '100%' };
  const tableStyle = { ...shell.table, minWidth: `${Math.max(720, scheduleTableMinWidth)}px`, tableLayout: 'fixed' };
  const headStyle = (key, align = 'left') => {
    const width = getColumnWidth(key) || scheduleColumnWidths[key] || 80;
    return { ...shell.th, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const cellStyle = (key, align = 'left') => {
    const width = getColumnWidth(key) || scheduleColumnWidths[key] || 80;
    return { ...shell.td, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const techRowStyle = isMobile ? { ...shell.techRow, gridTemplateColumns: '1fr' } : shell.techRow;
  const updateEditableRow = (rowKey, patch) => {
    setEditableServiceRows((prev) =>
      prev.map((row) => (row.key === rowKey ? { ...row, ...patch } : row))
    );
  };

  const openJobPdf = (row) => {
    const jobId = String(row?.relatedJobId || row?._id || '').trim();
    if (!jobId) return;
    const pdfUrl = `${API_BASE_URL}/api/service-visits/${encodeURIComponent(jobId)}/job-card-pdf`;
    setPdfPreview({
      open: true,
      title: `Job Card - ${String(row?.visit || row?.service || 'Job').trim()}`,
      pdfUrl,
      downloadFileName: `${String(row?.visit || row?.service || 'job-card').replace(/[^\w.-]+/g, '_')}.pdf`,
      publicShareUrl: pdfUrl
    });
  };

  const assignNow = async () => {
    const resolvedTechnicians = selectedTechnicians;
    const resolvedRows = selectedRows;

    if (!selectedCustomer || !selectedContract) {
      const message = 'Select customer and contract first.';
      setSaveError(message);
      window.alert(message);
      return;
    }
    if (resolvedRows.length === 0) {
      const message = 'Select at least one service schedule.';
      setSaveError(message);
      window.alert(message);
      return;
    }
    if (resolvedTechnicians.length === 0) {
      const message = 'Select at least one technician.';
      setSaveError(message);
      window.alert(message);
      return;
    }

    try {
      setIsSubmitting(true);
      setSaveError('');
      const basePayload = {
        customerId: selectedCustomer._id,
        customerName: selectedCustomer.displayName || selectedCustomer.name || selectedContract.customerName || '',
        mobileNumber: selectedCustomer.mobileNumber || selectedCustomer.workPhone || '',
        customerPremiseId: selectedPremiseId || '',
        premiseLabel: selectedPremise?.premiseLabel || selectedPremise?.premise_label || '',
        premiseAddress: premiseAddress?.address || '',
        premiseAreaName: premiseAddress?.areaName || '',
        premiseCity: premiseAddress?.city || '',
        premiseState: premiseAddress?.state || '',
        premisePincode: premiseAddress?.pincode || '',
        premiseGoogleMapUrl: premiseAddress?.googleMapUrl || '',
        address: premiseAddress?.address || selectedCustomer.billingAddress || selectedCustomer.shippingAddress || '',
        areaName: premiseAddress?.areaName || selectedCustomer.billingArea || selectedCustomer.area || '',
        city: premiseAddress?.city || selectedCustomer.city || selectedCustomer.billingState || selectedCustomer.state || '',
        state: premiseAddress?.state || selectedCustomer.billingState || selectedCustomer.state || '',
        pincode: premiseAddress?.pincode || selectedCustomer.billingPincode || selectedCustomer.pincode || '',
        contractId: selectedContract._id,
        contractNumber: selectedContract.contractNumber,
        priority: 'Normal',
        accessInstructions: '',
        latitude: '',
        longitude: '',
        notes: ''
      };

      const payloads = [];
      resolvedRows.forEach((row) => {
        const scheduledDate = normalizeDateInputValue(row.editableDate || row.date || '');
        const scheduledTime = parseTimeTo24Hour(row.editableTime || row.window || '', row.window || '');
        resolvedTechnicians.forEach((tech) => {
          payloads.push({
            ...basePayload,
            scheduleKey: row.key,
            scheduleVisit: row.visit,
            serviceName: row.service,
            sourceScheduleStatus: row.status,
            scheduledDate,
            scheduledTime,
            serviceInstructions: String(row.raw?.itemDescription || row.raw?.itemName || row.service || ''),
            technicianId: tech._id || '',
            technicianName: formatEmployeeName(tech),
            technicianEmpCode: tech.empCode || '',
            technicianMobile: tech.mobile || '',
            status: 'Scheduled'
          });
        });
      });

      await Promise.all(payloads.map((payload) => axios.post(`${API_BASE_URL}/api/jobs`, payload)));
      const jobsSyncTick = String(Date.now());
      localStorage.setItem('jobs_sync_tick', jobsSyncTick);
      triggerDashboardRefresh();
      window.alert(`Assigned ${payloads.length} service job(s) successfully.`);
      navigate('/operations/assigned-jobs', { state: { jobsSyncTick } });
    } catch (error) {
      console.error('Assign services failed', error);
      const apiMessage = String(error?.response?.data?.error || '').trim();
      setSaveError(apiMessage || 'Failed to assign services. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={pageStyle}>
      <div style={shell.top}>
        <div style={shell.titleWrap}>
          <h2 style={titleStyle}>Assign Pest Service</h2>
          <p style={shell.subtitle}>Dispatch single or multiple services to one or many technicians with clear instructions.</p>
        </div>
        <div style={shell.topActions}>
          <button type="button" style={shell.assignBtn} onClick={assignNow} disabled={isSubmitting}>Assign Now</button>
        </div>
      </div>

      <div style={shell.section}>
        <div style={shell.sectionHead}>
          <h3 style={shell.sectionTitle}><MapPin size={16} /> 1. Customer & Site</h3>
        </div>
        <div style={shell.sectionBody}>
          <div style={fieldGrid2Style}>
            <div style={shell.field}>
              <p style={shell.label}>Select Customer</p>
              <select
                style={shell.input}
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setContractId('');
                  setSelectedPremiseId('');
                }}
              >
                <option value="">Select customer</option>
                {customersWithContracts.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {(customer.displayName || customer.name || 'Customer')}
                  </option>
                ))}
              </select>
              <p style={shell.help}>Customers listed only if they have active contracts.</p>
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Contract</p>
              <select
                style={shell.input}
                value={contractId}
                onChange={(event) => setContractId(event.target.value)}
                disabled={!customerId}
              >
                <option value="">Select active contract</option>
                {customerContracts.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {[
                      (Array.isArray(entry.items) ? entry.items : [])
                        .map((item) => String(item?.itemName || item?.name || '').trim())
                        .filter(Boolean)
                        .join(', ') || 'Service',
                      entry.startDate
                        ? `(${formatDate(entry.startDate)}${entry.endDate ? ` to ${formatDate(entry.endDate)}` : ''})`
                        : ''
                    ].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
              <p style={shell.help}>Pick a contract to load its services/schedules.</p>
            </div>
          </div>

          <div style={fieldGrid4Style}>
            <div style={shell.field}>
              <p style={shell.label}>Premise</p>
              <select
                style={shell.input}
                value={selectedPremiseId}
                onChange={(event) => setSelectedPremiseId(event.target.value)}
                disabled={!customerId || premiseRows.length === 0}
              >
                <option value="">Default customer address</option>
                {premiseRows.map((premise) => (
                  <option key={premise.premiseId || premise.premise_id} value={premise.premiseId || premise.premise_id}>
                    {premise.premiseLabel || premise.premise_label || premise.address}
                  </option>
                ))}
              </select>
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Site Address</p>
              <input
                style={shell.input}
                value={premiseAddress?.address || (selectedCustomer ? (selectedCustomer.billingAddress || selectedCustomer.shippingAddress || '') : (prefillLead?.address || ''))}
                readOnly
              />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Area / Locality</p>
              <input style={shell.input} value={premiseAddress?.areaName || (selectedCustomer ? (selectedCustomer.billingArea || selectedCustomer.area || '') : (prefillLead?.areaName || ''))} readOnly />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>City</p>
              <input style={shell.input} value={premiseAddress?.city || (selectedCustomer ? (selectedCustomer.city || selectedCustomer.billingState || selectedCustomer.state || '') : (prefillLead?.city || ''))} readOnly />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Pin</p>
              <input style={shell.input} value={premiseAddress?.pincode || (selectedCustomer ? (selectedCustomer.billingPincode || selectedCustomer.pincode || '') : (prefillLead?.pincode || prefillLead?.pinCode || ''))} readOnly />
            </div>
          </div>
        </div>
      </div>

      <div style={shell.section}>
        <div style={shell.sectionHead}>
          <h3 style={shell.sectionTitle}><Wrench size={16} /> 2. Service & Assignment</h3>
          <span style={shell.help}>Loaded from selected customer&apos;s contracts</span>
        </div>
        <div style={shell.sectionBody}>
          <div style={{ ...shell.chipRow, justifyContent: 'space-between' }}>
            <div style={shell.chipRow}>
              <strong style={{ fontSize: '13px', color: '#334155' }}>Service Schedules</strong>
              <span style={shell.tinyPill}>{`${selectedScheduleKeys.length} selected`}</span>
            </div>
            <div style={shell.chipRow}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>Filter:</span>
              {statusFilters.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  style={{ ...shell.chip, ...(scheduleStatusFilter === entry ? shell.chipActive : {}) }}
                  onClick={() => setScheduleStatusFilter(entry)}
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <colgroup>{scheduleColumns.map((key) => <col key={key} style={{ width: `${getColumnWidth(key) || scheduleColumnWidths[key] || 80}px` }} />)}</colgroup>
              <thead>
                <tr>
                  <th style={{ ...shell.th, width: `${getColumnWidth('select') || scheduleColumnWidths.select}px` }}>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected;
                      }}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Select all services"
                    />
                  </th>
                  <th style={headStyle('service')}>Service</th>
                  <th style={headStyle('visit', 'center')}>Visit</th>
                    <th style={headStyle('date', 'center')}>Date</th>
                  <th style={headStyle('window', 'center')}>Time</th>
                  <th style={headStyle('site')}>Site</th>
                  <th style={headStyle('status', 'center')}>Status</th>
                  <th style={headStyle('pdf', 'center')}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {filteredServiceRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...shell.td, textAlign: 'center', ...shell.muted }}>
                      {customerId ? 'No service schedules available for this filter.' : 'Select a customer to begin.'}
                    </td>
                  </tr>
                ) : filteredServiceRows.map((row) => (
                  <tr key={row.key}>
                    <td style={cellStyle('select', 'center')}>
                      <input
                        type="checkbox"
                        checked={selectedScheduleKeys.includes(row.key)}
                        onChange={() => toggleSchedule(row.key)}
                        disabled={row.status !== 'Scheduled'}
                        aria-label={row.status !== 'Scheduled' ? `Selection disabled for ${row.status.toLowerCase()} service` : `Select ${row.service}`}
                      />
                    </td>
                    <td style={cellStyle('service')}>{row.service}</td>
                    <td style={cellStyle('visit', 'center')}>{row.visit}</td>
                    <td style={cellStyle('date', 'center')}>
                      <input
                        type="date"
                        value={editableServiceRows.find((entry) => entry.key === row.key)?.editableDate || ''}
                        onChange={(event) => updateEditableRow(row.key, { editableDate: event.target.value })}
                        style={{
                          ...shell.input,
                          minHeight: '32px',
                          textAlign: 'left',
                          padding: '0 24px 0 8px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      />
                    </td>
                    <td style={cellStyle('window', 'center')}>
                      <input
                        type="text"
                        inputMode="text"
                        placeholder="1:00 PM"
                        value={editableServiceRows.find((entry) => entry.key === row.key)?.editableTime || ''}
                        onChange={(event) => updateEditableRow(row.key, { editableTime: event.target.value })}
                        onBlur={(event) => updateEditableRow(row.key, { editableTime: formatTimeForEdit(event.target.value) })}
                        style={{ ...shell.input, minHeight: '32px', textAlign: 'center' }}
                      />
                    </td>
                    <td style={cellStyle('site')}>{row.site || '-'}</td>
                    <td style={cellStyle('status', 'center')}>{row.status}</td>
                    <td style={cellStyle('pdf', 'center')}>
                      <button
                        type="button"
                        style={{
                          minHeight: '28px',
                          minWidth: '64px',
                          borderRadius: '8px',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1e3a8a',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          padding: '0 10px'
                        }}
                        onClick={() => openJobPdf(row)}
                        disabled={!row.relatedJobId}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={techRowStyle}>
            <div style={shell.field}>
              <p style={shell.label}>Assign Technician(s)</p>
              <select
                style={shell.input}
                defaultValue=""
                onChange={(event) => {
                  addTechnicianById(event.target.value);
                  event.target.value = '';
                }}
              >
                <option value="">Select technician</option>
                {technicians.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {formatEmployeeName(entry)}{entry.mobile ? ` (${entry.mobile})` : ''}{entry.empCode ? ` • ${entry.empCode}` : ''}
                  </option>
                ))}
              </select>
              <p style={shell.help}>Select from dropdown to add technician. Data fetches from Employee Master role = Technician only.</p>
            </div>
          </div>

          <div style={shell.selectedWrap}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>Selected Technicians</span>
            {selectedTechnicians.map((entry) => (
              <span key={entry._id} style={shell.selectedTag}>
                {formatEmployeeName(entry)}
                <button
                  type="button"
                  style={shell.removeTag}
                  onClick={() => setSelectedTechnicians((prev) => prev.filter((item) => String(item._id) !== String(entry._id)))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {loadError ? <p style={{ ...shell.bottomStatus, color: '#dc2626' }}>{loadError}</p> : null}
      {saveError ? <p style={{ ...shell.bottomStatus, color: '#dc2626' }}>{saveError}</p> : null}
      {loading ? <p style={{ ...shell.bottomStatus, color: '#64748b' }}>Loading customer/contracts/employees...</p> : null}
      {!loading && !loadError ? <p style={{ ...shell.bottomStatus, color: '#64748b' }}><CalendarDays size={14} style={{ verticalAlign: 'middle' }} /> Assign Service is synced with Customers, Contracts, and Employee Master modules.</p> : null}

      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        pdfUrl={pdfPreview.pdfUrl}
        downloadFileName={pdfPreview.downloadFileName}
        onClose={() => setPdfPreview({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '' })}
        publicShareUrl={pdfPreview.publicShareUrl}
      />
    </section>
  );
}
