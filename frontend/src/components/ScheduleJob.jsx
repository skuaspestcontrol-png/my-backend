import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CalendarDays, ClipboardList, MapPin, UserCog, Wrench, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
  textArea: { width: '100%', minHeight: '58px', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '8px', fontSize: '12px', color: '#334155', background: '#fff', boxSizing: 'border-box', resize: 'vertical' },
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
  selectedTag: { display: 'inline-flex', gap: '6px', alignItems: 'center', border: '1px solid #D1D5DB', borderRadius: '999px', background: '#f8fafc', color: '#334155', fontSize: '11px', fontWeight: 700, padding: '3px 8px' },
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
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

export default function ScheduleJob() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefillLead = location.state?.lead || null;
  const prefillCustomerName = location.state?.customerName || prefillLead?.customerName || '';
  const prefillContractNumber = location.state?.contractNumber || '';

  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  const [customerId, setCustomerId] = useState('');
  const [contractId, setContractId] = useState('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('All');
  const [selectedScheduleKeys, setSelectedScheduleKeys] = useState([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
  const [details, setDetails] = useState({
    priority: 'Normal',
    workStartDate: '',
    workStartTime: '',
    accessInstructions: '',
    latitude: '',
    longitude: '',
    notes: ''
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [customerRes, invoiceRes, employeeRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/customers`),
          axios.get(`${API_BASE_URL}/api/invoices`),
          axios.get(`${API_BASE_URL}/api/employees`)
        ]);
        if (!mounted) return;
        setCustomers(Array.isArray(customerRes.data) ? customerRes.data : []);
        setInvoices(Array.isArray(invoiceRes.data) ? invoiceRes.data : []);
        setEmployees(Array.isArray(employeeRes.data) ? employeeRes.data : []);
      } catch (error) {
        console.error('Failed to load assign-service data', error);
        if (!mounted) return;
        setLoadError('Could not fetch customer/contract/employee data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
      return {
        key,
        service: schedule.itemName || item.itemName || item.name || 'Service',
        visit: `#${schedule.serviceNumber || index + 1}`,
        date: schedule.serviceDate || '',
        window: schedule.serviceTime || selectedContract.serviceScheduleDefaultTime || '',
        site: [selectedCustomer?.billingArea || selectedCustomer?.area, selectedCustomer?.billingState || selectedCustomer?.state].filter(Boolean).join(', '),
        status,
        raw: schedule
      };
    });
  }, [selectedContract, selectedCustomer]);

  const filteredServiceRows = useMemo(
    () => serviceRows.filter((row) => scheduleStatusFilter === 'All' || row.status === scheduleStatusFilter),
    [scheduleStatusFilter, serviceRows]
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
    setSelectedScheduleKeys((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  };

  const allFilteredSelected = useMemo(
    () => filteredServiceRows.length > 0 && filteredServiceRows.every((row) => selectedScheduleKeys.includes(row.key)),
    [filteredServiceRows, selectedScheduleKeys]
  );

  const someFilteredSelected = useMemo(
    () => filteredServiceRows.some((row) => selectedScheduleKeys.includes(row.key)),
    [filteredServiceRows, selectedScheduleKeys]
  );

  const toggleSelectAllFiltered = () => {
    setSelectedScheduleKeys((prev) => {
      if (filteredServiceRows.length === 0) return prev;
      const filteredKeys = filteredServiceRows.map((row) => row.key);
      const everySelected = filteredKeys.every((key) => prev.includes(key));
      if (everySelected) {
        return prev.filter((key) => !filteredKeys.includes(key));
      }
      const merged = new Set(prev);
      filteredKeys.forEach((key) => merged.add(key));
      return Array.from(merged);
    });
  };

  const selectedRows = useMemo(
    () => serviceRows.filter((row) => selectedScheduleKeys.includes(row.key)),
    [selectedScheduleKeys, serviceRows]
  );
  const isMobile = viewportWidth <= 900;
  const pageStyle = isMobile ? { ...shell.page, padding: '0', gap: '10px' } : shell.page;
  const titleStyle = isMobile ? { ...shell.title, fontSize: '24px' } : shell.title;
  const fieldGrid2Style = isMobile ? { ...shell.fieldGrid2, gridTemplateColumns: '1fr' } : shell.fieldGrid2;
  const fieldGrid4Style = isMobile ? { ...shell.fieldGrid4, gridTemplateColumns: '1fr' } : shell.fieldGrid4;
  const tableWrapStyle = { ...shell.tableWrap, overflowX: 'auto', maxWidth: '100%' };
  const techRowStyle = isMobile ? { ...shell.techRow, gridTemplateColumns: '1fr' } : shell.techRow;

  const assignNow = async () => {
    const resolvedTechnicians = selectedTechnicians;
    const resolvedRows = selectedRows.length > 0 ? selectedRows : filteredServiceRows;

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
        address: selectedCustomer.billingAddress || selectedCustomer.shippingAddress || '',
        areaName: selectedCustomer.billingArea || selectedCustomer.area || '',
        city: selectedCustomer.city || selectedCustomer.billingState || selectedCustomer.state || '',
        state: selectedCustomer.billingState || selectedCustomer.state || '',
        pincode: selectedCustomer.billingPincode || selectedCustomer.pincode || '',
        contractId: selectedContract._id,
        contractNumber: selectedContract.contractNumber,
        priority: details.priority,
        accessInstructions: details.accessInstructions,
        latitude: details.latitude,
        longitude: details.longitude,
        notes: details.notes
      };

      const payloads = [];
      resolvedRows.forEach((row) => {
        resolvedTechnicians.forEach((tech) => {
          payloads.push({
            ...basePayload,
            scheduleKey: row.key,
            scheduleVisit: row.visit,
            serviceName: row.service,
            sourceScheduleStatus: row.status,
            scheduledDate: details.workStartDate || row.date || '',
            scheduledTime: details.workStartTime || row.window || '',
            serviceInstructions: details.notes || String(row.raw?.itemDescription || row.raw?.itemName || row.service || ''),
            technicianId: tech._id || '',
            technicianName: formatEmployeeName(tech),
            technicianEmpCode: tech.empCode || '',
            technicianMobile: tech.mobile || '',
            status: 'Scheduled'
          });
        });
      });

      await Promise.all(payloads.map((payload) => axios.post(`${API_BASE_URL}/api/jobs`, payload)));
      window.alert(`Assigned ${payloads.length} service job(s) successfully.`);
      navigate('/operations/assigned-jobs');
    } catch (error) {
      console.error('Assign services failed', error);
      setSaveError('Failed to assign services. Please try again.');
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
                }}
              >
                <option value="">Search customer by name or phone</option>
                {customersWithContracts.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {(customer.displayName || customer.name || 'Customer')}
                    {customer.mobileNumber ? ` (${customer.mobileNumber})` : ''}
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
                <option value="">Search contract number or period</option>
                {customerContracts.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.contractNumber} {entry.startDate ? `(${formatDate(entry.startDate)}${entry.endDate ? ` to ${formatDate(entry.endDate)}` : ''})` : ''}
                  </option>
                ))}
              </select>
              <p style={shell.help}>Pick a contract to load its services/schedules.</p>
            </div>
          </div>

          <div style={fieldGrid4Style}>
            <div style={shell.field}>
              <p style={shell.label}>Site Address</p>
              <input
                style={shell.input}
                value={selectedCustomer ? (selectedCustomer.billingAddress || selectedCustomer.shippingAddress || '') : (prefillLead?.address || '')}
                readOnly
              />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Area / Locality</p>
              <input style={shell.input} value={selectedCustomer ? (selectedCustomer.billingArea || selectedCustomer.area || '') : (prefillLead?.areaName || '')} readOnly />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>City</p>
              <input style={shell.input} value={selectedCustomer ? (selectedCustomer.city || selectedCustomer.billingState || selectedCustomer.state || '') : (prefillLead?.city || '')} readOnly />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Pin</p>
              <input style={shell.input} value={selectedCustomer ? (selectedCustomer.billingPincode || selectedCustomer.pincode || '') : (prefillLead?.pincode || prefillLead?.pinCode || '')} readOnly />
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
            <table style={shell.table}>
              <thead>
                <tr>
                  <th style={{ ...shell.th, width: '48px' }}>
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
                  <th style={shell.th}>Service</th>
                  <th style={shell.th}>Visit</th>
                  <th style={shell.th}>Date</th>
                  <th style={shell.th}>Window</th>
                  <th style={shell.th}>Site</th>
                  <th style={shell.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredServiceRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...shell.td, textAlign: 'center', ...shell.muted }}>
                      {customerId ? 'No service schedules available for this filter.' : 'Select a customer to begin.'}
                    </td>
                  </tr>
                ) : filteredServiceRows.map((row) => (
                  <tr key={row.key}>
                    <td style={shell.td}>
                      <input type="checkbox" checked={selectedScheduleKeys.includes(row.key)} onChange={() => toggleSchedule(row.key)} />
                    </td>
                    <td style={shell.td}>{row.service}</td>
                    <td style={shell.td}>{row.visit}</td>
                    <td style={shell.td}>{formatDate(row.date)}</td>
                    <td style={shell.td}>{row.window || '-'}</td>
                    <td style={shell.td}>{row.site || '-'}</td>
                    <td style={shell.td}>{row.status}</td>
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

      <div style={shell.section}>
        <div style={shell.sectionHead}>
          <h3 style={shell.sectionTitle}><ClipboardList size={16} /> 3. Service Details</h3>
        </div>
        <div style={shell.sectionBody}>
          <div style={fieldGrid2Style}>
            <div style={shell.field}>
              <p style={shell.label}>Priority</p>
              <select style={shell.input} value={details.priority} onChange={(event) => setDetails((prev) => ({ ...prev, priority: event.target.value }))}>
                <option>Normal</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </div>
            <div style={fieldGrid2Style}>
              <div style={shell.field}>
                <p style={shell.label}>Work Start Date</p>
                <input type="date" style={shell.input} value={details.workStartDate} onChange={(event) => setDetails((prev) => ({ ...prev, workStartDate: event.target.value }))} />
              </div>
              <div style={shell.field}>
                <p style={shell.label}>Work Start Time</p>
                <input type="time" style={shell.input} value={details.workStartTime} onChange={(event) => setDetails((prev) => ({ ...prev, workStartTime: event.target.value }))} />
              </div>
            </div>
          </div>

          <div style={fieldGrid4Style}>
            <div style={shell.field}>
              <p style={shell.label}>Access Instructions (Property)</p>
              <input style={shell.input} value={details.accessInstructions} placeholder="Gate/lock codes, security desk notes" onChange={(event) => setDetails((prev) => ({ ...prev, accessInstructions: event.target.value }))} />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Latitude</p>
              <input style={shell.input} value={details.latitude} placeholder="e.g. 19.0760" onChange={(event) => setDetails((prev) => ({ ...prev, latitude: event.target.value }))} />
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Longitude</p>
              <input style={shell.input} value={details.longitude} placeholder="e.g. 72.8777" onChange={(event) => setDetails((prev) => ({ ...prev, longitude: event.target.value }))} />
            </div>
            <div />
          </div>

          <div style={shell.field}>
            <p style={shell.label}>Instructions / Notes</p>
            <textarea style={shell.textArea} value={details.notes} placeholder="Any additional directions for technicians" onChange={(event) => setDetails((prev) => ({ ...prev, notes: event.target.value }))} />
          </div>
        </div>
      </div>

      {loadError ? <p style={{ ...shell.bottomStatus, color: '#dc2626' }}>{loadError}</p> : null}
      {saveError ? <p style={{ ...shell.bottomStatus, color: '#dc2626' }}>{saveError}</p> : null}
      {loading ? <p style={{ ...shell.bottomStatus, color: '#64748b' }}>Loading customer/contracts/employees...</p> : null}
      {!loading && !loadError ? <p style={{ ...shell.bottomStatus, color: '#64748b' }}><CalendarDays size={14} style={{ verticalAlign: 'middle' }} /> Assign Service is synced with Customers, Contracts, and Employee Master modules.</p> : null}
    </section>
  );
}
