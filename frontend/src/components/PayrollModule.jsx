import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CalendarDays, CircleDollarSign, Download, FileText, Filter, HandCoins, Landmark, Lock, ShieldCheck, UserRoundCheck } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const roleFlags = () => {
  const roleRaw = String(localStorage.getItem('portal_user_role') || 'Admin').trim().toLowerCase();
  const isAdmin = roleRaw === 'admin' || roleRaw === '';
  const isHr = roleRaw.includes('hr');
  const isAccountant = roleRaw.includes('account');
  const canManage = isAdmin || isHr;
  const canMarkPaid = isAdmin || isAccountant;
  const canGenerate = isAdmin || isHr;
  const canViewOwn = !canManage && !canMarkPaid;
  return { roleRaw, canManage, canMarkPaid, canGenerate, canViewOwn };
};

const tabKeys = [
  { key: 'dashboard', label: 'Payroll Dashboard' },
  { key: 'setup', label: 'Salary Structure Setup' },
  { key: 'generate', label: 'Generate Payroll' },
  { key: 'list', label: 'Payroll List' },
  { key: 'advance', label: 'Advance Salary Management' },
  { key: 'holiday', label: 'Holiday Management' },
  { key: 'reports', label: 'Payroll Reports' }
];

const monthOptions = Array.from({ length: 12 }).map((_, index) => ({
  value: index + 1,
  label: new Date(2026, index, 1).toLocaleDateString('en-IN', { month: 'long' })
}));

const thisDate = new Date();
const defaultMonth = thisDate.getMonth() + 1;
const defaultYear = thisDate.getFullYear();

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadgeStyle = (statusRaw) => {
  const status = String(statusRaw || '').toLowerCase();
  if (status === 'paid') return { background: 'rgba(22,163,74,0.16)', color: '#166534', border: '1px solid rgba(22,163,74,0.32)' };
  if (status === 'hold') return { background: 'rgba(234,179,8,0.15)', color: '#92400e', border: '1px solid rgba(217,119,6,0.32)' };
  if (status === 'generated') return { background: 'rgba(159, 23, 77, 0.16)', color: 'var(--color-primary-dark)', border: '1px solid rgba(159, 23, 77, 0.32)' };
  return { background: 'rgba(100,116,139,0.14)', color: '#334155', border: '1px solid rgba(100,116,139,0.22)' };
};

const shell = {
  page: { display: 'grid', gap: '14px' },
  hero: {
    background: 'var(--color-primary)',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    borderRadius: '18px',
    padding: '16px'
  },
  title: { margin: 0, color: '#ffffff', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  subtitle: { margin: '6px 0 0 0', color: 'rgba(255,255,255,0.92)', fontWeight: 600, fontSize: '13px' },
  tabStrip: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tab: {
    border: '1px solid rgba(159, 23, 77, 0.24)',
    background: '#fff',
    color: '#0f172a',
    borderRadius: '999px',
    minHeight: '34px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  panel: {
    border: '1px solid rgba(159, 23, 77, 0.18)',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.92)',
    boxShadow: 'var(--shadow-soft)',
    padding: '14px',
    display: 'grid',
    gap: '12px'
  },
  panelTitle: { margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'inline-flex', gap: '8px', alignItems: 'center' },
  sub: { margin: 0, fontSize: '12px', color: '#475569' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' },
  card: { border: '1px solid rgba(159, 23, 77, 0.2)', borderRadius: '12px', padding: '12px', background: '#fff' },
  cardLabel: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  cardValue: { margin: '6px 0 0 0', fontSize: '20px', color: '#0f172a', fontWeight: 800 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  field: { display: 'grid', gap: '5px' },
  label: { margin: 0, fontSize: '11px', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', minHeight: '36px', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '8px 10px', fontSize: '13px', background: '#fff' },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  btn: {
    border: '1px solid rgba(159, 23, 77, 0.32)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '8px',
    minHeight: '34px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnLight: {
    border: '1px solid #D1D5DB',
    background: '#fff',
    color: '#0f172a',
    borderRadius: '8px',
    minHeight: '34px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  tableWrap: { border: '1px solid var(--color-primary-soft)', borderRadius: '10px', overflowX: 'auto', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '980px' },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' },
  td: { padding: '8px 10px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#334155', fontWeight: 600, verticalAlign: 'top' },
  badge: { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 700 },
  footer: { margin: 0, fontSize: '12px', color: '#475569', fontWeight: 700 },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 90, padding: '16px' },
  modal: { width: 'min(620px, 100%)', background: '#fff', borderRadius: '14px', border: '1px solid rgba(159, 23, 77, 0.2)', padding: '14px', display: 'grid', gap: '10px' },
  chartRow: { display: 'grid', gap: '7px' },
  chartBarWrap: { height: '10px', borderRadius: '999px', background: 'var(--color-border)', overflow: 'hidden' },
  chartBar: { height: '100%', background: 'var(--color-primary)' }
};

const salaryFormDefaults = {
  employeeId: '',
  effectiveDate: new Date().toISOString().slice(0, 10),
  salaryType: 'monthly',
  basicSalary: '',
  dailyRate: '',
  hourlyRate: '',
  hra: '',
  conveyance: '',
  mobile: '',
  bonus: '',
  incentive: '',
  otherAllowance: '',
  leaveDeduction: '',
  lateDeduction: '',
  latePerMark: '',
  advanceDeduction: '',
  loanDeduction: '',
  pf: '',
  esi: '',
  otherDeduction: '',
  notes: ''
};

export default function PayrollModule() {
  const role = useMemo(() => roleFlags(), []);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);

  const [employees, setEmployees] = useState([]);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [payrollItems, setPayrollItems] = useState([]);
  const [meta, setMeta] = useState({ config: { weeklyOffDay: 0, lateMarkGraceMinutes: 15, workStartTime: '09:00' } });

  const [filters, setFilters] = useState({ employeeId: '', department: '', paymentStatus: '', payrollStatus: '', search: '' });
  const [salaryForm, setSalaryForm] = useState(salaryFormDefaults);
  const [holidayForm, setHolidayForm] = useState({ date: '', title: '', type: 'paid', notes: '' });
  const [advanceForm, setAdvanceForm] = useState({ employeeId: '', amount: '', monthlyDeduction: '', deductionMode: 'partial', reason: '', issuedDate: new Date().toISOString().slice(0, 10) });
  const [selectedGenerateEmployees, setSelectedGenerateEmployees] = useState([]);
  const [paymentModal, setPaymentModal] = useState({ open: false, item: null, paymentMode: 'Bank transfer', paymentDate: new Date().toISOString().slice(0, 10), transactionRef: '', remarks: '' });
  const [adjustModal, setAdjustModal] = useState({ open: false, item: null, manualAdjustmentAmount: '', manualAdjustmentReason: '', manualOverrideEnabled: false, overrideNetSalary: '', payrollStatus: 'Generated' });
  const [slipViewer, setSlipViewer] = useState({ open: false, url: '', title: '', item: null });
  const [page, setPage] = useState(1);

  const pageSize = 10;
  const headers = useMemo(() => ({
    'x-role': localStorage.getItem('portal_user_role') || 'Admin',
    'x-user-name': localStorage.getItem('portal_user_name') || 'System',
    'x-user-id': localStorage.getItem('portal_user_id') || ''
  }), []);

  const reloadAll = async () => {
    try {
      setBusy(true);
      const [empRes, metaRes, structureRes, holidayRes, advanceRes, dashboardRes, payrollRes] = await Promise.all([
        axios.get(`${API_BASE}/api/employees`),
        axios.get(`${API_BASE}/api/payroll/meta`, { headers }),
        axios.get(`${API_BASE}/api/payroll/salary-structures`, { headers }),
        axios.get(`${API_BASE}/api/payroll/holidays`, { params: { month, year }, headers }),
        axios.get(`${API_BASE}/api/payroll/advances`, { headers }),
        axios.get(`${API_BASE}/api/payroll/dashboard`, { params: { month, year }, headers }),
        axios.get(`${API_BASE}/api/payroll/items`, { params: { month, year }, headers })
      ]);
      setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      setMeta(metaRes.data || {});
      setSalaryStructures(Array.isArray(structureRes.data) ? structureRes.data : []);
      setHolidays(Array.isArray(holidayRes.data) ? holidayRes.data : []);
      setAdvances(Array.isArray(advanceRes.data) ? advanceRes.data : []);
      setDashboard(dashboardRes.data || null);
      setPayrollItems(Array.isArray(payrollRes.data) ? payrollRes.data : []);
      setStatus('');
    } catch (error) {
      console.error('Payroll fetch failed', error);
      setStatus(error?.response?.data?.error || 'Unable to load payroll module right now.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const employeeMap = useMemo(() => new Map(employees.map((entry) => [String(entry._id || ''), entry])), [employees]);
  const departments = useMemo(() => Array.from(new Set(employees.map((entry) => String(entry.role || '').trim()).filter(Boolean))), [employees]);
  const getLatestSalaryStructure = (employeeId) => {
    const list = salaryStructures.filter((entry) => String(entry.employeeId || '') === String(employeeId || ''));
    if (list.length === 0) return null;
    return [...list].sort((a, b) => String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || ''))).pop();
  };

  const loadEmployeeToSalaryForm = (employeeId) => {
    const employee = employeeMap.get(String(employeeId || ''));
    const latest = getLatestSalaryStructure(employeeId);
    if (!employeeId) {
      setSalaryForm(salaryFormDefaults);
      return;
    }
    if (latest) {
      setSalaryForm({
        employeeId: String(employeeId),
        effectiveDate: latest.effectiveDate || new Date().toISOString().slice(0, 10),
        salaryType: latest.salaryType || 'monthly',
        basicSalary: String(latest.basicSalary ?? ''),
        dailyRate: String(latest.dailyRate ?? ''),
        hourlyRate: String(latest.hourlyRate ?? ''),
        hra: String(latest.allowances?.hra ?? ''),
        conveyance: String(latest.allowances?.conveyance ?? ''),
        mobile: String(latest.allowances?.mobile ?? ''),
        bonus: String(latest.allowances?.bonus ?? ''),
        incentive: String(latest.allowances?.incentive ?? ''),
        otherAllowance: String(latest.allowances?.other ?? ''),
        leaveDeduction: String(latest.deductions?.leave ?? ''),
        lateDeduction: String(latest.deductions?.late ?? ''),
        latePerMark: String(latest.deductions?.latePerMark ?? ''),
        advanceDeduction: String(latest.deductions?.advance ?? ''),
        loanDeduction: String(latest.deductions?.loan ?? ''),
        pf: String(latest.deductions?.pf ?? ''),
        esi: String(latest.deductions?.esi ?? ''),
        otherDeduction: String(latest.deductions?.other ?? ''),
        notes: latest.notes || ''
      });
      return;
    }
    setSalaryForm({
      ...salaryFormDefaults,
      employeeId: String(employeeId),
      basicSalary: String(employee?.salaryPerMonth ?? employee?.salary ?? ''),
      notes: 'Loaded from Employee Master'
    });
  };

  const filteredPayrollItems = useMemo(() => {
    const search = String(filters.search || '').trim().toLowerCase();
    return payrollItems.filter((entry) => {
      if (filters.employeeId && String(entry.employeeId || '') !== filters.employeeId) return false;
      if (filters.department && String(entry.department || '').toLowerCase() !== filters.department.toLowerCase()) return false;
      if (filters.paymentStatus && String(entry.paymentStatus || '').toLowerCase() !== filters.paymentStatus.toLowerCase()) return false;
      if (filters.payrollStatus && String(entry.payrollStatus || '').toLowerCase() !== filters.payrollStatus.toLowerCase()) return false;
      if (search) {
        const joined = `${entry.employeeName || ''} ${entry.employeeCode || ''}`.toLowerCase();
        if (!joined.includes(search)) return false;
      }
      if (role.canViewOwn) {
        const loggedEmployeeId = String(localStorage.getItem('portal_user_id') || '').trim();
        if (loggedEmployeeId && String(entry.employeeId || '') !== loggedEmployeeId) return false;
      }
      return true;
    });
  }, [payrollItems, filters, role.canViewOwn]);

  const totalPages = Math.max(1, Math.ceil(filteredPayrollItems.length / pageSize));
  const pagedPayrollItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPayrollItems.slice(start, start + pageSize);
  }, [filteredPayrollItems, page]);
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages]);

  const saveSalaryStructure = async () => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can manage salary structures.');
      if (!salaryForm.employeeId) return window.alert('Select employee.');
      const payload = {
        employeeId: salaryForm.employeeId,
        effectiveDate: salaryForm.effectiveDate,
        salaryType: salaryForm.salaryType,
        basicSalary: Number(salaryForm.basicSalary || 0),
        dailyRate: Number(salaryForm.dailyRate || 0),
        hourlyRate: Number(salaryForm.hourlyRate || 0),
        allowances: {
          hra: Number(salaryForm.hra || 0),
          conveyance: Number(salaryForm.conveyance || 0),
          mobile: Number(salaryForm.mobile || 0),
          bonus: Number(salaryForm.bonus || 0),
          incentive: Number(salaryForm.incentive || 0),
          other: Number(salaryForm.otherAllowance || 0)
        },
        deductions: {
          leave: Number(salaryForm.leaveDeduction || 0),
          late: Number(salaryForm.lateDeduction || 0),
          latePerMark: Number(salaryForm.latePerMark || 0),
          advance: Number(salaryForm.advanceDeduction || 0),
          loan: Number(salaryForm.loanDeduction || 0),
          pf: Number(salaryForm.pf || 0),
          esi: Number(salaryForm.esi || 0),
          other: Number(salaryForm.otherDeduction || 0)
        },
        notes: salaryForm.notes
      };
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/salary-structures`, payload, { headers });
      setStatus('Salary structure saved.');
      setSalaryForm(salaryFormDefaults);
      await reloadAll();
    } catch (error) {
      console.error('Salary save failed', error);
      window.alert(error?.response?.data?.error || 'Failed to save salary structure.');
    } finally {
      setBusy(false);
    }
  };

  const syncEmployeeMasterSalary = async (updateExisting = false) => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can sync Employee Master.');
      setBusy(true);
      const res = await axios.post(`${API_BASE}/api/payroll/salary-structures/sync-employees`, { updateExisting }, { headers });
      setStatus(`${res?.data?.message || 'Sync complete'} (Created: ${res?.data?.createdCount || 0}, Updated: ${res?.data?.updatedCount || 0})`);
      await reloadAll();
    } catch (error) {
      console.error('Employee master sync failed', error);
      window.alert(error?.response?.data?.error || 'Unable to sync Employee Master data.');
    } finally {
      setBusy(false);
    }
  };

  const generatePayroll = async (forceRegenerate = false) => {
    try {
      if (!role.canGenerate) return window.alert('Only Admin/HR can generate payroll.');
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/generate`, {
        month,
        year,
        employeeIds: selectedGenerateEmployees,
        forceRegenerate
      }, { headers });
      setStatus(forceRegenerate ? 'Payroll regenerated successfully.' : 'Payroll generated successfully.');
      await reloadAll();
    } catch (error) {
      console.error('Payroll generate failed', error);
      window.alert(error?.response?.data?.error || 'Unable to generate payroll.');
    } finally {
      setBusy(false);
    }
  };

  const saveHoliday = async () => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can manage holidays.');
      if (!holidayForm.date || !holidayForm.title) return window.alert('Date and holiday title are required.');
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/holidays`, holidayForm, { headers });
      setHolidayForm({ date: '', title: '', type: 'paid', notes: '' });
      setStatus('Holiday saved.');
      await reloadAll();
    } catch (error) {
      console.error('Holiday save failed', error);
      window.alert(error?.response?.data?.error || 'Unable to save holiday.');
    } finally {
      setBusy(false);
    }
  };

  const removeHoliday = async (id) => {
    if (!role.canManage) return;
    if (!window.confirm('Delete this holiday?')) return;
    try {
      setBusy(true);
      await axios.delete(`${API_BASE}/api/payroll/holidays/${id}`, { headers });
      await reloadAll();
    } catch (error) {
      console.error('Holiday delete failed', error);
      window.alert(error?.response?.data?.error || 'Unable to delete holiday.');
    } finally {
      setBusy(false);
    }
  };

  const saveAdvance = async () => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can manage advance salary.');
      if (!advanceForm.employeeId || Number(advanceForm.amount || 0) <= 0) return window.alert('Employee and valid amount are required.');
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/advances`, {
        employeeId: advanceForm.employeeId,
        amount: Number(advanceForm.amount || 0),
        monthlyDeduction: Number(advanceForm.monthlyDeduction || 0),
        deductionMode: advanceForm.deductionMode,
        reason: advanceForm.reason,
        issuedDate: advanceForm.issuedDate
      }, { headers });
      setAdvanceForm({ employeeId: '', amount: '', monthlyDeduction: '', deductionMode: 'partial', reason: '', issuedDate: new Date().toISOString().slice(0, 10) });
      setStatus('Advance saved.');
      await reloadAll();
    } catch (error) {
      console.error('Advance save failed', error);
      window.alert(error?.response?.data?.error || 'Unable to save advance.');
    } finally {
      setBusy(false);
    }
  };

  const removeAdvance = async (id) => {
    if (!role.canManage) return;
    if (!window.confirm('Delete this advance record?')) return;
    try {
      setBusy(true);
      const safeId = encodeURIComponent(String(id || '').trim());
      try {
        await axios.delete(`${API_BASE}/api/payroll/advances/${safeId}`, { headers });
      } catch (primaryError) {
        const code = primaryError?.response?.status;
        if (code === 404 || code === 405 || code === 501) {
          try {
            await axios.post(`${API_BASE}/api/payroll/advances/${safeId}/delete`, {}, { headers });
          } catch (_fallbackError) {
            await axios.post(`${API_BASE}/api/payroll/advances/delete`, { id }, { headers });
          }
        } else {
          throw primaryError;
        }
      }
      setStatus('Advance record deleted.');
      await reloadAll();
    } catch (error) {
      console.error('Advance delete failed', error);
      const isNetwork = error?.message && String(error.message).toLowerCase().includes('network');
      const message = error?.response?.data?.error
        || (isNetwork ? 'Unable to reach backend server. Please restart backend and try again.' : 'Unable to delete advance record.');
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  const openPayment = (item) => {
    setPaymentModal({
      open: true,
      item,
      paymentMode: 'Bank transfer',
      paymentDate: new Date().toISOString().slice(0, 10),
      transactionRef: '',
      remarks: ''
    });
  };

  const markPaid = async () => {
    try {
      if (!role.canMarkPaid) return window.alert('Only Admin/Accountant can mark salary as paid.');
      if (!paymentModal.item) return;
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/items/${paymentModal.item._id}/mark-paid`, {
        paymentMode: paymentModal.paymentMode,
        paymentDate: paymentModal.paymentDate,
        transactionRef: paymentModal.transactionRef,
        remarks: paymentModal.remarks
      }, { headers });
      setPaymentModal((prev) => ({ ...prev, open: false, item: null }));
      setStatus('Salary marked as paid.');
      await reloadAll();
    } catch (error) {
      console.error('Mark paid failed', error);
      window.alert(error?.response?.data?.error || 'Unable to mark as paid.');
    } finally {
      setBusy(false);
    }
  };

  const openAdjust = (item) => {
    setAdjustModal({
      open: true,
      item,
      manualAdjustmentAmount: String(item.manualAdjustmentAmount || 0),
      manualAdjustmentReason: item.manualAdjustmentReason || '',
      manualOverrideEnabled: !!item.manualOverrideEnabled,
      overrideNetSalary: item.overrideNetSalary != null ? String(item.overrideNetSalary) : '',
      payrollStatus: item.payrollStatus || 'Generated'
    });
  };

  const saveAdjustment = async () => {
    try {
      if (!role.canManage && !role.canGenerate) return window.alert('No permission for salary adjustment.');
      if (!adjustModal.item) return;
      setBusy(true);
      await axios.put(`${API_BASE}/api/payroll/items/${adjustModal.item._id}`, {
        manualAdjustmentAmount: Number(adjustModal.manualAdjustmentAmount || 0),
        manualAdjustmentReason: adjustModal.manualAdjustmentReason,
        manualOverrideEnabled: adjustModal.manualOverrideEnabled,
        overrideNetSalary: Number(adjustModal.overrideNetSalary || 0),
        payrollStatus: adjustModal.payrollStatus
      }, { headers });
      setAdjustModal((prev) => ({ ...prev, open: false, item: null }));
      setStatus('Payroll item updated.');
      await reloadAll();
    } catch (error) {
      console.error('Adjustment update failed', error);
      window.alert(error?.response?.data?.error || 'Unable to update payroll item.');
    } finally {
      setBusy(false);
    }
  };

  const unlockPaidSlip = async (item) => {
    if (!role.canManage) return window.alert('Only Admin/HR can unlock paid salary slips.');
    if (!window.confirm('Unlock this paid salary slip?')) return;
    try {
      setBusy(true);
      await axios.put(`${API_BASE}/api/payroll/items/${item._id}`, { unlock: true }, { headers });
      setStatus('Salary slip unlocked.');
      await reloadAll();
    } catch (error) {
      console.error('Unlock failed', error);
      window.alert(error?.response?.data?.error || 'Unable to unlock salary slip.');
    } finally {
      setBusy(false);
    }
  };

  const openSlipViewer = (item) => {
    const userRole = encodeURIComponent(localStorage.getItem('portal_user_role') || 'Admin');
    const userId = encodeURIComponent(localStorage.getItem('portal_user_id') || '');
    const userName = encodeURIComponent(localStorage.getItem('portal_user_name') || 'System');
    const url = `${API_BASE}/api/payroll/items/${item._id}/slip/pdf?role=${userRole}&userId=${userId}&userName=${userName}`;
    setSlipViewer({
      open: true,
      url,
      item,
      title: `${item.employeeName} - ${monthOptions.find((entry) => entry.value === Number(item.month))?.label || item.month} ${item.year}`
    });
  };

  const shareSlip = async (channel) => {
    try {
      if (!slipViewer.item) return;
      const employee = employeeMap.get(String(slipViewer.item.employeeId || ''));
      if (channel === 'email') {
        const toDefault = String(employee?.emailId || employee?.email || '').trim();
        const to = window.prompt('Recipient email', toDefault);
        if (!to) return;
        setBusy(true);
        const res = await axios.post(`${API_BASE}/api/payroll/items/${slipViewer.item._id}/share-email`, { to }, { headers });
        setStatus(res?.data?.message || 'Salary slip email queued.');
      } else {
        const phoneDefault = String(employee?.mobile || '').trim();
        const phoneNumber = window.prompt('Recipient WhatsApp number', phoneDefault);
        if (!phoneNumber) return;
        setBusy(true);
        const res = await axios.post(`${API_BASE}/api/payroll/items/${slipViewer.item._id}/share-whatsapp`, { phoneNumber }, { headers });
        setStatus(res?.data?.message || 'Salary slip sent on WhatsApp.');
      }
    } catch (error) {
      console.error('Salary slip share failed', error);
      window.alert(error?.response?.data?.error || 'Unable to share salary slip.');
    } finally {
      setBusy(false);
    }
  };

  const seedData = async () => {
    try {
      if (!role.canManage) return window.alert('Only Admin/HR can seed sample data.');
      setBusy(true);
      await axios.post(`${API_BASE}/api/payroll/seed-sample`, {}, { headers });
      setStatus('Payroll seed data created.');
      await reloadAll();
    } catch (error) {
      console.error('Seed failed', error);
      window.alert(error?.response?.data?.error || 'Unable to seed payroll data.');
    } finally {
      setBusy(false);
    }
  };

  const exportReport = (type, format = 'json') => {
    const url = `${API_BASE}/api/payroll/reports?type=${encodeURIComponent(type)}&month=${month}&year=${year}&format=${format}`;
    window.open(url, '_blank');
  };

  const renderDashboard = () => (
    <>
      <div style={shell.grid}>
        <div style={shell.card}><p style={shell.cardLabel}>Total Monthly Payroll</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.totalMonthlyPayroll)}</p></div>
        <div style={shell.card}><p style={shell.cardLabel}>Paid Salary Amount</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.paidSalaryAmount)}</p></div>
        <div style={shell.card}><p style={shell.cardLabel}>Pending Salary Amount</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.pendingSalaryAmount)}</p></div>
        <div style={shell.card}><p style={shell.cardLabel}>Employees On Hold</p><p style={shell.cardValue}>{dashboard?.cards?.employeesOnHold || 0}</p></div>
        <div style={shell.card}><p style={shell.cardLabel}>Total Deductions</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.totalDeductions)}</p></div>
        <div style={shell.card}><p style={shell.cardLabel}>Total Allowances</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.totalAllowances)}</p></div>
        <div style={shell.card}><p style={shell.cardLabel}>Advance Salary Balance</p><p style={shell.cardValue}>INR {money(dashboard?.cards?.advanceSalaryBalance)}</p></div>
      </div>
      <div style={shell.row}>
        <div style={shell.card}>
          <p style={{ ...shell.cardLabel, marginBottom: '8px' }}>Month-wise Payroll Chart</p>
          <div style={shell.chartRow}>
            {(dashboard?.monthWiseChart || []).map((entry) => {
              const max = Math.max(...(dashboard?.monthWiseChart || [{ total: 1 }]).map((item) => Number(item.total || 0)), 1);
              const width = `${Math.max(4, (Number(entry.total || 0) / max) * 100)}%`;
              return (
                <div key={entry.key}>
                  <p style={{ margin: 0, fontSize: '11px', color: '#334155', fontWeight: 700 }}>{entry.key} - INR {money(entry.total)}</p>
                  <div style={shell.chartBarWrap}><div style={{ ...shell.chartBar, width }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={shell.card}>
          <p style={{ ...shell.cardLabel, marginBottom: '8px' }}>Department-wise Salary Expense</p>
          <div style={shell.chartRow}>
            {(dashboard?.departmentWiseExpense || []).map((entry) => {
              const max = Math.max(...(dashboard?.departmentWiseExpense || [{ total: 1 }]).map((item) => Number(item.total || 0)), 1);
              const width = `${Math.max(4, (Number(entry.total || 0) / max) * 100)}%`;
              return (
                <div key={entry.department}>
                  <p style={{ margin: 0, fontSize: '11px', color: '#334155', fontWeight: 700 }}>{entry.department} - INR {money(entry.total)}</p>
                  <div style={shell.chartBarWrap}><div style={{ ...shell.chartBar, width }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  const renderSalarySetup = () => (
    <>
      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><Landmark size={16} /> Employee Salary Setup</h3>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Employee</p><select style={shell.input} value={salaryForm.employeeId} onChange={(event) => loadEmployeeToSalaryForm(event.target.value)}><option value="">Select employee</option>{employees.map((entry) => <option key={entry._id} value={entry._id}>{[entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.empCode} ({entry.empCode})</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Effective Date</p><input type="date" style={shell.input} value={salaryForm.effectiveDate} onChange={(event) => setSalaryForm((prev) => ({ ...prev, effectiveDate: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Salary Type</p><select style={shell.input} value={salaryForm.salaryType} onChange={(event) => setSalaryForm((prev) => ({ ...prev, salaryType: event.target.value }))}><option value="monthly">Monthly</option><option value="daily">Daily</option><option value="hourly">Hourly</option></select></div>
          <div style={shell.field}><p style={shell.label}>Basic Salary</p><input type="number" style={shell.input} value={salaryForm.basicSalary} onChange={(event) => setSalaryForm((prev) => ({ ...prev, basicSalary: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Daily Rate</p><input type="number" style={shell.input} value={salaryForm.dailyRate} onChange={(event) => setSalaryForm((prev) => ({ ...prev, dailyRate: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Hourly Rate</p><input type="number" style={shell.input} value={salaryForm.hourlyRate} onChange={(event) => setSalaryForm((prev) => ({ ...prev, hourlyRate: event.target.value }))} /></div>
        </div>
        <p style={{ ...shell.sub, fontWeight: 700 }}>Allowances</p>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>HRA</p><input type="number" style={shell.input} value={salaryForm.hra} onChange={(event) => setSalaryForm((prev) => ({ ...prev, hra: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Conveyance</p><input type="number" style={shell.input} value={salaryForm.conveyance} onChange={(event) => setSalaryForm((prev) => ({ ...prev, conveyance: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Mobile</p><input type="number" style={shell.input} value={salaryForm.mobile} onChange={(event) => setSalaryForm((prev) => ({ ...prev, mobile: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Bonus</p><input type="number" style={shell.input} value={salaryForm.bonus} onChange={(event) => setSalaryForm((prev) => ({ ...prev, bonus: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Incentive</p><input type="number" style={shell.input} value={salaryForm.incentive} onChange={(event) => setSalaryForm((prev) => ({ ...prev, incentive: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Other Allowance</p><input type="number" style={shell.input} value={salaryForm.otherAllowance} onChange={(event) => setSalaryForm((prev) => ({ ...prev, otherAllowance: event.target.value }))} /></div>
        </div>
        <p style={{ ...shell.sub, fontWeight: 700 }}>Deductions</p>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Leave Deduction</p><input type="number" style={shell.input} value={salaryForm.leaveDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, leaveDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Late Deduction</p><input type="number" style={shell.input} value={salaryForm.lateDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, lateDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Late Per Mark</p><input type="number" style={shell.input} value={salaryForm.latePerMark} onChange={(event) => setSalaryForm((prev) => ({ ...prev, latePerMark: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Advance Deduction</p><input type="number" style={shell.input} value={salaryForm.advanceDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, advanceDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Loan Deduction</p><input type="number" style={shell.input} value={salaryForm.loanDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, loanDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>PF</p><input type="number" style={shell.input} value={salaryForm.pf} onChange={(event) => setSalaryForm((prev) => ({ ...prev, pf: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>ESI</p><input type="number" style={shell.input} value={salaryForm.esi} onChange={(event) => setSalaryForm((prev) => ({ ...prev, esi: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Other Deduction</p><input type="number" style={shell.input} value={salaryForm.otherDeduction} onChange={(event) => setSalaryForm((prev) => ({ ...prev, otherDeduction: event.target.value }))} /></div>
        </div>
        <div style={shell.field}><p style={shell.label}>Notes</p><textarea style={{ ...shell.input, minHeight: '72px' }} value={salaryForm.notes} onChange={(event) => setSalaryForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
        <div style={shell.actionRow}>
          <button type="button" style={shell.btn} onClick={saveSalaryStructure} disabled={!role.canManage || busy}>Save Salary Structure</button>
          <button type="button" style={shell.btnLight} onClick={() => syncEmployeeMasterSalary(false)} disabled={!role.canManage || busy}>Sync Employee Master</button>
          <button type="button" style={shell.btnLight} onClick={() => syncEmployeeMasterSalary(true)} disabled={!role.canManage || busy}>Sync + Update Existing</button>
          <button type="button" style={shell.btnLight} onClick={() => setSalaryForm(salaryFormDefaults)}>Reset</button>
        </div>
      </div>
      <div style={shell.tableWrap}>
        <table style={shell.table}>
          <thead><tr><th style={shell.th}>Employee</th><th style={shell.th}>Effective Date</th><th style={shell.th}>Type</th><th style={shell.th}>Basic</th><th style={shell.th}>Allowances</th><th style={shell.th}>Deductions</th></tr></thead>
          <tbody>
            {salaryStructures.map((entry) => (
              <tr key={entry._id}>
                <td style={shell.td}>{employeeMap.get(String(entry.employeeId || '')) ? `${[employeeMap.get(String(entry.employeeId || '')).firstName, employeeMap.get(String(entry.employeeId || '')).lastName].filter(Boolean).join(' ')} (${employeeMap.get(String(entry.employeeId || '')).empCode || '-'})` : entry.employeeId}</td>
                <td style={shell.td}>{entry.effectiveDate}</td>
                <td style={shell.td}>{entry.salaryType}</td>
                <td style={shell.td}>INR {money(entry.basicSalary)}</td>
                <td style={shell.td}>INR {money(Object.values(entry.allowances || {}).reduce((sum, value) => sum + Number(value || 0), 0))}</td>
                <td style={shell.td}>INR {money(Object.values(entry.deductions || {}).reduce((sum, value) => sum + Number(value || 0), 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderGenerate = () => (
    <div style={shell.panel}>
      <h3 style={shell.panelTitle}><UserRoundCheck size={16} /> Payroll Run</h3>
      <p style={shell.sub}>Generate payroll for all employees or selected employee list. Duplicate paid records are blocked; draft/hold can be regenerated.</p>
      <div style={shell.row}>
        <div style={shell.field}>
          <p style={shell.label}>Select Employees (Optional)</p>
          <select
            multiple
            size={8}
            style={{ ...shell.input, minHeight: '160px' }}
            value={selectedGenerateEmployees}
            onChange={(event) => {
              const values = Array.from(event.target.selectedOptions).map((option) => option.value);
              setSelectedGenerateEmployees(values);
            }}
          >
            {employees.map((entry) => (
              <option key={entry._id} value={entry._id}>
                {[entry.firstName, entry.lastName].filter(Boolean).join(' ').trim() || entry.empCode} ({entry.empCode || '-'}) - {entry.role || '-'}
              </option>
            ))}
          </select>
        </div>
        <div style={shell.card}>
          <p style={shell.cardLabel}>Generation Summary</p>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#334155', lineHeight: 1.7 }}>
            Month/Year: <strong>{monthOptions.find((entry) => entry.value === Number(month))?.label} {year}</strong><br />
            Scope: <strong>{selectedGenerateEmployees.length > 0 ? `${selectedGenerateEmployees.length} employees selected` : 'All employees'}</strong><br />
            Weekly Off Day: <strong>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(meta?.config?.weeklyOffDay || 0)]}</strong><br />
            Late Grace: <strong>{meta?.config?.lateMarkGraceMinutes || 15} min</strong>
          </p>
          <div style={{ ...shell.actionRow, marginTop: '10px' }}>
            <button type="button" style={shell.btn} onClick={() => generatePayroll(false)} disabled={!role.canGenerate || busy}>Generate Payroll</button>
            <button type="button" style={shell.btnLight} onClick={() => generatePayroll(true)} disabled={!role.canGenerate || busy}>Regenerate (Before Payment)</button>
            <button type="button" style={shell.btnLight} onClick={seedData} disabled={!role.canManage || busy}>Seed Sample Data</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPayrollList = () => (
    <>
      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><Filter size={16} /> Filters & Search</h3>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Employee</p><select style={shell.input} value={filters.employeeId} onChange={(event) => setFilters((prev) => ({ ...prev, employeeId: event.target.value }))}><option value="">All</option>{employees.map((entry) => <option key={entry._id} value={entry._id}>{[entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.empCode}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Department</p><select style={shell.input} value={filters.department} onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}><option value="">All</option>{departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Payment Status</p><select style={shell.input} value={filters.paymentStatus} onChange={(event) => setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))}><option value="">All</option><option value="Pending">Pending</option><option value="Paid">Paid</option><option value="Hold">Hold</option></select></div>
          <div style={shell.field}><p style={shell.label}>Payroll Status</p><select style={shell.input} value={filters.payrollStatus} onChange={(event) => setFilters((prev) => ({ ...prev, payrollStatus: event.target.value }))}><option value="">All</option><option value="Draft">Draft</option><option value="Generated">Generated</option><option value="Paid">Paid</option><option value="Hold">Hold</option></select></div>
          <div style={shell.field}><p style={shell.label}>Search Name / ID</p><input style={shell.input} value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Search employee" /></div>
        </div>
      </div>
      <div style={shell.tableWrap}>
        <table style={shell.table}>
          <thead>
            <tr>
              <th style={shell.th}>Employee</th>
              <th style={shell.th}>Month</th>
              <th style={shell.th}>Contact</th>
              <th style={shell.th}>Bank Details</th>
              <th style={shell.th}>Attendance</th>
              <th style={shell.th}>Gross</th>
              <th style={shell.th}>Deductions</th>
              <th style={shell.th}>Net</th>
              <th style={shell.th}>Payroll Status</th>
              <th style={shell.th}>Payment</th>
              <th style={shell.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedPayrollItems.map((entry) => (
              <tr key={entry._id}>
                <td style={shell.td}>
                  <div>{entry.employeeName}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{entry.employeeCode} • {entry.department || '-'}</div>
                </td>
                <td style={shell.td}>{monthOptions.find((item) => Number(item.value) === Number(entry.month))?.label || entry.month} {entry.year}</td>
                <td style={shell.td}>
                  {entry?.employeeDetails?.mobile || employeeMap.get(String(entry.employeeId || ''))?.mobile || '-'}<br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {entry?.employeeDetails?.email || employeeMap.get(String(entry.employeeId || ''))?.emailId || employeeMap.get(String(entry.employeeId || ''))?.email || '-'}
                  </span>
                </td>
                <td style={shell.td}>
                  {entry?.employeeDetails?.bankName || employeeMap.get(String(entry.employeeId || ''))?.bankName || '-'}<br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {entry?.employeeDetails?.bankNo || employeeMap.get(String(entry.employeeId || ''))?.bankNo || '-'}
                    {(entry?.employeeDetails?.ifsc || employeeMap.get(String(entry.employeeId || ''))?.ifsc)
                      ? ` • IFSC: ${entry?.employeeDetails?.ifsc || employeeMap.get(String(entry.employeeId || ''))?.ifsc}`
                      : ''}
                  </span>
                </td>
                <td style={shell.td}>
                  WD {entry?.attendanceSummary?.totalWorkingDays || 0}<br />
                  P {entry?.attendanceSummary?.presentDays || 0} • PL {entry?.attendanceSummary?.paidLeaveDays || 0} • UL {entry?.attendanceSummary?.unpaidLeaveDays || 0}
                </td>
                <td style={shell.td}>INR {money(entry.grossSalary)}</td>
                <td style={shell.td}>INR {money(entry?.deductions?.total)}</td>
                <td style={shell.td}><strong>INR {money(entry.netSalary)}</strong></td>
                <td style={shell.td}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.payrollStatus) }}>{entry.payrollStatus}</span></td>
                <td style={shell.td}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.paymentStatus) }}>{entry.paymentStatus}</span></td>
                <td style={shell.td}>
                  <div style={shell.actionRow}>
                    <button type="button" style={shell.btnLight} onClick={() => openSlipViewer(entry)}>Slip</button>
                    {entry.payrollStatus !== 'Paid' ? <button type="button" style={shell.btnLight} onClick={() => openAdjust(entry)} disabled={busy || (!role.canManage && !role.canGenerate)}>Adjust</button> : null}
                    {entry.paymentStatus !== 'Paid' ? <button type="button" style={shell.btn} onClick={() => openPayment(entry)} disabled={busy || !role.canMarkPaid}>Mark Paid</button> : null}
                    {entry.paymentStatus === 'Paid' ? <button type="button" style={shell.btnLight} onClick={() => unlockPaidSlip(entry)} disabled={!role.canManage}><Lock size={12} /> Unlock</button> : null}
                  </div>
                </td>
              </tr>
            ))}
            {pagedPayrollItems.length === 0 ? (
              <tr><td colSpan={11} style={{ ...shell.td, textAlign: 'center', color: '#64748b' }}>No payroll rows found for selected filter.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div style={{ ...shell.actionRow, justifyContent: 'space-between' }}>
        <p style={shell.footer}>Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredPayrollItems.length)} of {filteredPayrollItems.length}</p>
        <div style={shell.actionRow}>
          <button type="button" style={shell.btnLight} disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</button>
          <p style={shell.footer}>Page {page} of {totalPages}</p>
          <button type="button" style={shell.btnLight} disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Next</button>
        </div>
      </div>
    </>
  );

  const renderAdvance = () => (
    <>
      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><HandCoins size={16} /> Advance Salary / Loan</h3>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Employee</p><select style={shell.input} value={advanceForm.employeeId} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, employeeId: event.target.value }))}><option value="">Select</option>{employees.map((entry) => <option key={entry._id} value={entry._id}>{[entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.empCode}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Advance Amount</p><input type="number" style={shell.input} value={advanceForm.amount} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, amount: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Monthly Deduction</p><input type="number" style={shell.input} value={advanceForm.monthlyDeduction} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, monthlyDeduction: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Mode</p><select style={shell.input} value={advanceForm.deductionMode} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, deductionMode: event.target.value }))}><option value="partial">Partial</option><option value="full">Full</option></select></div>
          <div style={shell.field}><p style={shell.label}>Issued Date</p><input type="date" style={shell.input} value={advanceForm.issuedDate} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, issuedDate: event.target.value }))} /></div>
        </div>
        <div style={shell.field}><p style={shell.label}>Reason</p><input style={shell.input} value={advanceForm.reason} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, reason: event.target.value }))} /></div>
        <div style={shell.actionRow}><button type="button" style={shell.btn} onClick={saveAdvance} disabled={busy || !role.canManage}>Save Advance</button></div>
      </div>
      <div style={shell.tableWrap}>
        <table style={shell.table}>
          <thead><tr><th style={shell.th}>Employee</th><th style={shell.th}>Issued Date</th><th style={shell.th}>Amount</th><th style={shell.th}>Recovered</th><th style={shell.th}>Balance</th><th style={shell.th}>Monthly Deduction</th><th style={shell.th}>Status</th><th style={shell.th}>Action</th></tr></thead>
          <tbody>
            {advances.map((entry) => (
              <tr key={entry._id}>
                <td style={shell.td}>{employeeMap.get(String(entry.employeeId || '')) ? ([employeeMap.get(String(entry.employeeId || '')).firstName, employeeMap.get(String(entry.employeeId || '')).lastName].filter(Boolean).join(' ') || employeeMap.get(String(entry.employeeId || '')).empCode) : entry.employeeId}</td>
                <td style={shell.td}>{entry.issuedDate}</td>
                <td style={shell.td}>INR {money(entry.amount)}</td>
                <td style={shell.td}>INR {money(entry.recoveredAmount)}</td>
                <td style={shell.td}><strong>INR {money(entry.balanceAmount)}</strong></td>
                <td style={shell.td}>INR {money(entry.monthlyDeduction)}</td>
                <td style={shell.td}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.status) }}>{entry.status}</span></td>
                <td style={shell.td}>
                  <button type="button" style={shell.btnLight} onClick={() => removeAdvance(entry._id)} disabled={!role.canManage || busy}>Delete</button>
                </td>
              </tr>
            ))}
            {advances.length === 0 ? <tr><td colSpan={8} style={{ ...shell.td, textAlign: 'center', color: '#64748b' }}>No advance records.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderHoliday = () => (
    <>
      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><CalendarDays size={16} /> Holiday Management</h3>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Date</p><input type="date" style={shell.input} value={holidayForm.date} onChange={(event) => setHolidayForm((prev) => ({ ...prev, date: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Holiday Name</p><input style={shell.input} value={holidayForm.title} onChange={(event) => setHolidayForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
          <div style={shell.field}><p style={shell.label}>Type</p><select style={shell.input} value={holidayForm.type} onChange={(event) => setHolidayForm((prev) => ({ ...prev, type: event.target.value }))}><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></div>
          <div style={shell.field}><p style={shell.label}>Notes</p><input style={shell.input} value={holidayForm.notes} onChange={(event) => setHolidayForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
        </div>
        <div style={shell.actionRow}>
          <button type="button" style={shell.btn} onClick={saveHoliday} disabled={!role.canManage || busy}>Save Holiday</button>
          <button type="button" style={shell.btnLight} disabled={!role.canManage || busy} onClick={async () => {
            try {
              setBusy(true);
              await axios.post(`${API_BASE}/api/payroll/meta`, { ...meta.config }, { headers });
              setStatus('Payroll settings saved.');
            } catch (error) {
              window.alert(error?.response?.data?.error || 'Unable to save payroll settings.');
            } finally {
              setBusy(false);
            }
          }}>Save Weekly Off Settings</button>
        </div>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Weekly Off Day</p><select style={shell.input} value={meta?.config?.weeklyOffDay ?? 0} onChange={(event) => setMeta((prev) => ({ ...prev, config: { ...(prev.config || {}), weeklyOffDay: Number(event.target.value) } }))}><option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option></select></div>
          <div style={shell.field}><p style={shell.label}>Late Grace (Minutes)</p><input type="number" style={shell.input} value={meta?.config?.lateMarkGraceMinutes ?? 15} onChange={(event) => setMeta((prev) => ({ ...prev, config: { ...(prev.config || {}), lateMarkGraceMinutes: Number(event.target.value || 0) } }))} /></div>
          <div style={shell.field}><p style={shell.label}>Shift Start Time</p><input style={shell.input} value={meta?.config?.workStartTime ?? '09:00'} onChange={(event) => setMeta((prev) => ({ ...prev, config: { ...(prev.config || {}), workStartTime: event.target.value } }))} /></div>
        </div>
      </div>
      <div style={shell.tableWrap}>
        <table style={shell.table}>
          <thead><tr><th style={shell.th}>Date</th><th style={shell.th}>Holiday</th><th style={shell.th}>Type</th><th style={shell.th}>Notes</th><th style={shell.th}>Action</th></tr></thead>
          <tbody>
            {holidays.map((entry) => (
              <tr key={entry._id}>
                <td style={shell.td}>{entry.date}</td>
                <td style={shell.td}>{entry.title}</td>
                <td style={shell.td}><span style={{ ...shell.badge, ...statusBadgeStyle(entry.type) }}>{entry.type}</span></td>
                <td style={shell.td}>{entry.notes || '-'}</td>
                <td style={shell.td}><button type="button" style={shell.btnLight} onClick={() => removeHoliday(entry._id)} disabled={!role.canManage || busy}>Delete</button></td>
              </tr>
            ))}
            {holidays.length === 0 ? <tr><td colSpan={5} style={{ ...shell.td, textAlign: 'center', color: '#64748b' }}>No holidays for selected month.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderReports = () => (
    <div style={shell.panel}>
      <h3 style={shell.panelTitle}><FileText size={16} /> Reports</h3>
      <p style={shell.sub}>Export reports in Excel/CSV and view report payload in browser tab. Use month/year filters above for scoped report output.</p>
      <div style={shell.actionRow}>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('monthly', 'json')}>Monthly Payroll Report</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('employee-wise', 'json')}>Employee-wise Salary Report</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('deduction', 'json')}>Deduction Report</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('advance', 'json')}>Advance Salary Report</button>
      </div>
      <div style={shell.actionRow}>
        <button type="button" style={shell.btn} onClick={() => exportReport('monthly', 'excel')}><Download size={14} /> Export Monthly (Excel)</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('monthly', 'excel')}>Download Monthly CSV</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('deduction', 'excel')}>Download Deduction CSV</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('advance', 'excel')}>Download Advance CSV</button>
        <button type="button" style={shell.btnLight} onClick={() => exportReport('monthly', 'pdf')}>Download Monthly PDF</button>
      </div>
    </div>
  );

  return (
    <section style={shell.page}>
      <div style={shell.hero}>
        <h2 style={shell.title}>Payroll Module</h2>
        <p style={shell.subtitle}>
          Professional payroll operations with salary setup, attendance-based calculation, payroll run, payment lock, salary slip PDF, advances, holidays, and reports.
        </p>
      </div>

      <div style={shell.panel}>
        <div style={shell.row}>
          <div style={shell.field}><p style={shell.label}>Month</p><select style={shell.input} value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></div>
          <div style={shell.field}><p style={shell.label}>Year</p><input type="number" style={shell.input} value={year} onChange={(event) => setYear(Number(event.target.value || defaultYear))} /></div>
          <div style={shell.field}><p style={shell.label}>Role Access</p><div style={{ ...shell.input, display: 'flex', alignItems: 'center', fontWeight: 700, color: '#0f172a' }}>{role.canManage ? 'Admin/HR (Full Control)' : role.canMarkPaid ? 'Accountant (Payment Control)' : 'Employee/Technician (Own Slip View)'}</div></div>
          <div style={{ ...shell.field, justifyContent: 'end' }}>
            <p style={shell.label}>Actions</p>
            <div style={shell.actionRow}>
              <button type="button" style={shell.btn} onClick={reloadAll} disabled={busy}>{busy ? 'Refreshing...' : 'Refresh'}</button>
            </div>
          </div>
        </div>
        <div style={shell.tabStrip}>
          {tabKeys.map((entry) => (
            <button
              key={entry.key}
              type="button"
              style={{ ...shell.tab, ...(activeTab === entry.key ? { background: 'var(--color-primary)', color: '#fff', border: '1px solid rgba(159, 23, 77, 0.38)' } : null) }}
              onClick={() => setActiveTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div style={shell.panel}>
        <h3 style={shell.panelTitle}>
          {activeTab === 'dashboard' ? <CircleDollarSign size={16} /> : null}
          {activeTab === 'setup' ? <Landmark size={16} /> : null}
          {activeTab === 'generate' ? <ShieldCheck size={16} /> : null}
          {activeTab === 'list' ? <Filter size={16} /> : null}
          {activeTab === 'advance' ? <HandCoins size={16} /> : null}
          {activeTab === 'holiday' ? <CalendarDays size={16} /> : null}
          {activeTab === 'reports' ? <FileText size={16} /> : null}
          {tabKeys.find((entry) => entry.key === activeTab)?.label}
        </h3>
        <p style={shell.sub}>
          Business rules enforced: paid leave/holiday not deducted, unpaid leave deducted, half-day deducts half day, no duplicate paid payroll generation, and post-payment slip lock until admin unlock.
        </p>
        {activeTab === 'dashboard' ? renderDashboard() : null}
        {activeTab === 'setup' ? renderSalarySetup() : null}
        {activeTab === 'generate' ? renderGenerate() : null}
        {activeTab === 'list' ? renderPayrollList() : null}
        {activeTab === 'advance' ? renderAdvance() : null}
        {activeTab === 'holiday' ? renderHoliday() : null}
        {activeTab === 'reports' ? renderReports() : null}
      </div>

      {status ? <p style={shell.footer}>{status}</p> : null}

      {paymentModal.open ? (
        <div style={shell.modalBg}>
          <div style={shell.modal}>
            <h3 style={shell.panelTitle}><CircleDollarSign size={16} /> Mark Salary as Paid</h3>
            <p style={shell.sub}>{paymentModal.item?.employeeName} - Net INR {money(paymentModal.item?.netSalary)}</p>
            <div style={shell.row}>
              <div style={shell.field}><p style={shell.label}>Payment Mode</p><select style={shell.input} value={paymentModal.paymentMode} onChange={(event) => setPaymentModal((prev) => ({ ...prev, paymentMode: event.target.value }))}><option>Cash</option><option>Bank transfer</option><option>UPI</option><option>Cheque</option></select></div>
              <div style={shell.field}><p style={shell.label}>Payment Date</p><input type="date" style={shell.input} value={paymentModal.paymentDate} onChange={(event) => setPaymentModal((prev) => ({ ...prev, paymentDate: event.target.value }))} /></div>
              <div style={shell.field}><p style={shell.label}>Transaction / Ref No.</p><input style={shell.input} value={paymentModal.transactionRef} onChange={(event) => setPaymentModal((prev) => ({ ...prev, transactionRef: event.target.value }))} /></div>
            </div>
            <div style={shell.field}><p style={shell.label}>Remarks</p><textarea style={{ ...shell.input, minHeight: '70px' }} value={paymentModal.remarks} onChange={(event) => setPaymentModal((prev) => ({ ...prev, remarks: event.target.value }))} /></div>
            <div style={shell.actionRow}>
              <button type="button" style={shell.btn} onClick={markPaid} disabled={busy}>Confirm Payment</button>
              <button type="button" style={shell.btnLight} onClick={() => setPaymentModal((prev) => ({ ...prev, open: false, item: null }))}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustModal.open ? (
        <div style={shell.modalBg}>
          <div style={shell.modal}>
            <h3 style={shell.panelTitle}><ShieldCheck size={16} /> Manual Salary Override</h3>
            <p style={shell.sub}>Admin/HR can adjust salary with reason for audit log.</p>
            <div style={shell.row}>
              <div style={shell.field}><p style={shell.label}>Payroll Status</p><select style={shell.input} value={adjustModal.payrollStatus} onChange={(event) => setAdjustModal((prev) => ({ ...prev, payrollStatus: event.target.value }))}><option value="Draft">Draft</option><option value="Generated">Generated</option><option value="Hold">Hold</option></select></div>
              <div style={shell.field}><p style={shell.label}>Manual Adjustment Amount (+/-)</p><input type="number" style={shell.input} value={adjustModal.manualAdjustmentAmount} onChange={(event) => setAdjustModal((prev) => ({ ...prev, manualAdjustmentAmount: event.target.value }))} /></div>
              <div style={shell.field}><p style={shell.label}>Override Net Salary</p><input type="number" style={shell.input} value={adjustModal.overrideNetSalary} onChange={(event) => setAdjustModal((prev) => ({ ...prev, overrideNetSalary: event.target.value }))} /></div>
              <div style={shell.field}><p style={shell.label}>Override Mode</p><select style={shell.input} value={adjustModal.manualOverrideEnabled ? 'yes' : 'no'} onChange={(event) => setAdjustModal((prev) => ({ ...prev, manualOverrideEnabled: event.target.value === 'yes' }))}><option value="no">Adjustment Mode</option><option value="yes">Absolute Override Net</option></select></div>
            </div>
            <div style={shell.field}><p style={shell.label}>Reason</p><textarea style={{ ...shell.input, minHeight: '72px' }} value={adjustModal.manualAdjustmentReason} onChange={(event) => setAdjustModal((prev) => ({ ...prev, manualAdjustmentReason: event.target.value }))} /></div>
            <div style={shell.actionRow}>
              <button type="button" style={shell.btn} onClick={saveAdjustment} disabled={busy}>Save Adjustment</button>
              <button type="button" style={shell.btnLight} onClick={() => setAdjustModal((prev) => ({ ...prev, open: false, item: null }))}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {slipViewer.open ? (
        <div style={shell.modalBg}>
          <div style={{ ...shell.modal, width: 'min(980px, 100%)' }}>
            <h3 style={shell.panelTitle}><FileText size={16} /> Salary Slip - {slipViewer.title}</h3>
            <div style={shell.actionRow}>
              <button type="button" style={shell.btnLight} onClick={() => window.open(`${slipViewer.url}&download=1`, '_blank')}><Download size={14} /> Download PDF</button>
              <button type="button" style={shell.btnLight} onClick={() => window.open(slipViewer.url, '_blank')}>Open in New Tab</button>
              <button type="button" style={shell.btnLight} onClick={() => shareSlip('email')}>Share Email</button>
              <button type="button" style={shell.btnLight} onClick={() => shareSlip('whatsapp')}>Share WhatsApp</button>
              <button type="button" style={shell.btnLight} onClick={() => setSlipViewer({ open: false, url: '', title: '', item: null })}>Close</button>
            </div>
            <iframe title="Salary Slip" src={slipViewer.url} style={{ width: '100%', height: '72vh', border: '1px solid #D1D5DB', borderRadius: '10px', background: '#fff' }} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
