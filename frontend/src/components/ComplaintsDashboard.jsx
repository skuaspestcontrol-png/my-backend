import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertCircle, List, Plus, Save, Send, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

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

const emptyComplaint = {
  customerId: '',
  customerName: '',
  mobileNumber: '',
  property: '',
  contractId: '',
  contractNumber: '',
  type: '',
  priority: 'Normal',
  status: 'Open',
  subject: '',
  description: '',
  reportedBy: '',
  reportedVia: '',
  dueDate: '',
  technicians: []
};

const formatEmployeeName = (entry) => {
  const full = [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim();
  return full || entry.empCode || 'Technician';
};

export default function ComplaintsDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeInvoices, setActiveInvoices] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyComplaint);
  const [statusFilter, setStatusFilter] = useState('All');
  const [customerFilter, setCustomerFilter] = useState('');
  const [technicianSearch, setTechnicianSearch] = useState('');

  const loadData = async () => {
    const [complaintsRes, invoicesRes, customersRes, employeesRes] = await Promise.all([
      axios.get(`${API_BASE}/api/complaints`),
      axios.get(`${API_BASE}/api/invoices`),
      axios.get(`${API_BASE}/api/customers`),
      axios.get(`${API_BASE}/api/employees`)
    ]);

    const invoiceRows = Array.isArray(invoicesRes.data) ? invoicesRes.data : [];
    const activeInvoiceRows = invoiceRows.filter(isContractActive);
    const customerRows = Array.isArray(customersRes.data) ? customersRes.data : [];
    const activeCustomerIds = new Set(activeInvoiceRows.map((entry) => String(entry.customerId || '')).filter(Boolean));
    const activeCustomerNames = new Set(activeInvoiceRows.map((entry) => String(entry.customerName || '').trim().toLowerCase()).filter(Boolean));
    const activeCustomers = customerRows.filter((entry) => (
      activeCustomerIds.has(String(entry._id || '')) || activeCustomerNames.has(String(entry.displayName || entry.name || '').trim().toLowerCase())
    ));

    setCustomers(activeCustomers);
    setActiveInvoices(activeInvoiceRows);
    setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
    setComplaints(Array.isArray(complaintsRes.data) ? complaintsRes.data : []);
  };

  useEffect(() => {
    loadData().catch((error) => console.error('complaints load failed', error));
  }, []);

  const technicianOptions = useMemo(() => employees.filter((entry) => String(entry.role || '').trim().toLowerCase() === 'technician'), [employees]);

  const complaintCustomers = useMemo(() => {
    const byKey = new Map();
    activeInvoices.forEach((invoice) => {
      const idPart = String(invoice.customerId || '').trim();
      const namePart = String(invoice.customerName || '').trim();
      const key = idPart || `name:${namePart.toLowerCase()}`;
      if (!key) return;
      if (!byKey.has(key)) {
        const masterMatch = customers.find((entry) => (
          (idPart && String(entry._id || '') === idPart)
          || (namePart && String(entry.displayName || entry.name || '').trim().toLowerCase() === namePart.toLowerCase())
        ));
        byKey.set(key, {
          key,
          customerId: idPart || String(masterMatch?._id || ''),
          customerName: namePart || String(masterMatch?.displayName || masterMatch?.name || 'Customer'),
          mobileNumber: String(masterMatch?.mobileNumber || masterMatch?.workPhone || invoice.mobileNumber || ''),
          property: String(masterMatch?.billingAddress || masterMatch?.shippingAddress || masterMatch?.address || masterMatch?.billingArea || masterMatch?.area || '').trim()
        });
      }
    });
    return Array.from(byKey.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [activeInvoices, customers]);

  const selectedCustomer = useMemo(
    () => complaintCustomers.find((entry) => entry.key === form.customerId) || null,
    [complaintCustomers, form.customerId]
  );

  const customerContracts = useMemo(() => {
    if (!selectedCustomer) return [];
    const customerName = String(selectedCustomer.customerName || '').trim().toLowerCase();
    return activeInvoices.filter((entry) => (
      String(entry.customerId || '') === String(selectedCustomer.customerId || '')
      || String(entry.customerName || '').trim().toLowerCase() === customerName
    ));
  }, [activeInvoices, selectedCustomer]);

  const propertiesForCustomer = useMemo(() => {
    if (!selectedCustomer) return [];
    const contractSites = customerContracts.map((entry) => (
      String(entry.serviceAddress || entry.propertyAddress || entry.billingAddress || entry.customerAddress || '').trim()
    )).filter(Boolean);
    const options = [selectedCustomer.property, ...contractSites].map((entry) => String(entry || '').trim()).filter(Boolean);
    return Array.from(new Set(options));
  }, [selectedCustomer, customerContracts]);

  const summary = useMemo(() => ({
    Open: complaints.filter((entry) => String(entry.status || '').toLowerCase() === 'open').length,
    'In Progress': complaints.filter((entry) => String(entry.status || '').toLowerCase() === 'in progress').length,
    Resolved: complaints.filter((entry) => String(entry.status || '').toLowerCase() === 'resolved').length,
    Urgent: complaints.filter((entry) => String(entry.priority || '').toLowerCase() === 'urgent').length
  }), [complaints]);

  const filteredComplaints = useMemo(() => complaints.filter((entry) => {
    if (statusFilter !== 'All' && String(entry.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (customerFilter && !`${entry.customerName || ''} ${entry.mobileNumber || ''}`.toLowerCase().includes(customerFilter.toLowerCase())) return false;
    return true;
  }), [complaints, customerFilter, statusFilter]);

  const filteredTechnicians = useMemo(() => technicianOptions.filter((entry) => {
    if (!technicianSearch) return true;
    const hay = `${formatEmployeeName(entry)} ${entry.mobile || ''} ${entry.empCode || ''}`.toLowerCase();
    return hay.includes(technicianSearch.toLowerCase());
  }), [technicianOptions, technicianSearch]);

  const toggleTechnician = (id) => {
    setForm((prev) => {
      const key = String(id || '');
      const exists = prev.technicians.includes(key);
      return { ...prev, technicians: exists ? prev.technicians.filter((entry) => entry !== key) : [...prev.technicians, key] };
    });
  };

  const createComplaint = async (saveAsDraft = false) => {
    const payload = {
      ...form,
      status: saveAsDraft ? 'Draft' : form.status,
      technicianNames: technicianOptions
        .filter((entry) => form.technicians.includes(String(entry._id || '')))
        .map((entry) => formatEmployeeName(entry))
    };
    await axios.post(`${API_BASE}/api/complaints`, payload);
    setShowNew(false);
    setForm(emptyComplaint);
    setTechnicianSearch('');
    await loadData();
  };

  return (
    <section style={{ display: 'grid', gap: 12, padding: 0, border: 'none', borderRadius: 0, background: 'transparent' }}>
      {!showNew ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a' }}>Manage Complaints</h2>
              <p style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: 14 }}>View and manage all customer complaints</p>
            </div>
            <button type="button" onClick={() => setShowNew(true)} style={{ border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', borderRadius: 8, minHeight: 36, padding: '0 14px', fontWeight: 800 }}><Plus size={14} /> New Complaint</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
            {Object.entries(summary).map(([k, v]) => {
              const tone = k === 'Open'
                ? { background: '#FCEAD0', color: '#EA580C' }
                : k === 'In Progress'
                  ? { background: '#DBEAFE', color: '#2563EB' }
                  : k === 'Resolved'
                    ? { background: '#DCFCE7', color: '#166534' }
                    : { background: '#FCE7F3', color: '#B91C1C' };
              return (
                <div key={k} style={{ ...tone, border: '1px solid rgba(15,23,42,0.05)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 30, fontWeight: 800, textAlign: 'center' }}>{v}</div>
                  <div style={{ fontWeight: 700, textAlign: 'center', fontSize: 13 }}>{k.toUpperCase()}</div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
              {['All', 'Open', 'In Progress', 'Resolved'].map((entry) => (
                <button key={entry} type="button" onClick={() => setStatusFilter(entry)} style={{ border: '1px solid #d1d5db', background: statusFilter === entry ? 'var(--color-primary)' : '#fff', color: statusFilter === entry ? '#fff' : '#334155', borderRadius: 999, minHeight: 30, padding: '0 10px', fontWeight: 800 }}>{entry}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} placeholder="Search customer or mobile" style={{ minHeight: 34, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 8px' }} />
              <button type="button" onClick={() => { setStatusFilter('All'); setCustomerFilter(''); }} style={{ minHeight: 34, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 800 }}>Clear</button>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Complaint', 'Customer', 'Type', 'Priority', 'Status', 'Created', 'Actions'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '11px 10px', fontSize: 12, color: '#64748b', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', fontWeight: 800, letterSpacing: '0.02em' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredComplaints.map((entry) => (
                  <tr key={entry._id}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', fontSize: 13, fontWeight: 700 }}>{entry.ticketNumber || '-'}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>{entry.customerName || '-'}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>{entry.type || '-'}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}><span style={{ borderRadius: 999, padding: '4px 9px', background: '#DBEAFE', color: '#2563EB', fontWeight: 700, fontSize: 12 }}>{entry.priority || '-'}</span></td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}><span style={{ borderRadius: 999, padding: '4px 9px', background: '#F3E8FF', color: '#7C3AED', fontWeight: 700, fontSize: 12 }}>{entry.status || '-'}</span></td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}><button type="button" style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, minHeight: 30, padding: '0 9px' }}><List size={14} /></button></td>
                  </tr>
                ))}
                {filteredComplaints.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#64748b', fontWeight: 700 }}>No complaints found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#374151' }}>New Complaint</h2>
              <p style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: 15 }}>Register a new customer complaint and assign technicians</p>
            </div>
            <div style={{ display: 'inline-flex', gap: 10 }}>
              <button type="button" onClick={() => setShowNew(false)} style={{ border: '1px solid var(--color-primary-soft)', background: '#fff', color: 'var(--color-primary)', borderRadius: 8, minHeight: 44, padding: '0 14px', fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}><List size={15} /> View All Complaints</button>
              <button type="button" onClick={() => createComplaint(false)} style={{ border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', borderRadius: 8, minHeight: 44, padding: '0 14px', fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Save size={15} /> Save Complaint</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14, display: 'grid', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#374151', fontWeight: 800 }}>Customer & Property</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>SELECT CUSTOMER *</p>
                    <select value={form.customerId} onChange={(event) => {
                      const customer = complaintCustomers.find((entry) => entry.key === event.target.value);
                      setForm((prev) => ({
                        ...prev,
                        customerId: event.target.value,
                        customerName: customer?.customerName || '',
                        mobileNumber: customer?.mobileNumber || '',
                        property: '',
                        contractId: '',
                        contractNumber: ''
                      }));
                    }} style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }}>
                      <option value="">Search by name or phone...</option>
                      {complaintCustomers.map((entry) => <option key={entry.key} value={entry.key}>{entry.customerName}{entry.mobileNumber ? ` (${entry.mobileNumber})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>SELECT PROPERTY</p>
                    <select value={form.property} onChange={(event) => setForm((prev) => ({ ...prev, property: event.target.value }))} style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }}>
                      <option value="">-- Select Property --</option>
                      {propertiesForCustomer.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>LINK TO CONTRACT (OPTIONAL)</p>
                    <select value={form.contractId} onChange={(event) => {
                      const target = customerContracts.find((entry) => String(entry._id) === String(event.target.value));
                      setForm((prev) => ({ ...prev, contractId: event.target.value, contractNumber: target?.invoiceNumber || '' }));
                    }} style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }}>
                      <option value="">-- No Contract --</option>
                      {customerContracts.map((entry) => <option key={entry._id} value={entry._id}>{entry.invoiceNumber || entry._id}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14, display: 'grid', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#374151', fontWeight: 800 }}>Complaint Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>COMPLAINT TYPE</p>
                    <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }}>
                      <option value="">-- Select Type --</option>
                      <option>Service Issue</option>
                      <option>Delay</option>
                      <option>Billing</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>PRIORITY</p>
                    <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }}>
                      <option>Normal</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>SUBJECT / TITLE *</p>
                  <input value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} placeholder="Brief description of the complaint" style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }} />
                </div>
                <div>
                  <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>DETAILED DESCRIPTION</p>
                  <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Provide detailed information about the complaint..." style={{ width: '100%', minHeight: 120, borderRadius: 8, border: '1px solid #d1d5db', padding: 10, fontSize: 14 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>REPORTED BY</p>
                    <input value={form.reportedBy} onChange={(event) => setForm((prev) => ({ ...prev, reportedBy: event.target.value }))} placeholder="Person who reported" style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>REPORTED VIA</p>
                    <select value={form.reportedVia} onChange={(event) => setForm((prev) => ({ ...prev, reportedVia: event.target.value }))} style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }}>
                      <option value="">-- Select --</option>
                      <option>Phone</option>
                      <option>WhatsApp</option>
                      <option>Email</option>
                      <option>In Person</option>
                    </select>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#6b7280', fontWeight: 800 }}>DUE DATE</p>
                    <input type="date" value={form.dueDate} onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))} style={{ width: '100%', minHeight: 42, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#374151', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Users size={18} /> Assign Technicians</h3>
                <p style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: 14 }}>Select one or more technicians to handle this complaint</p>
                <input value={technicianSearch} onChange={(event) => setTechnicianSearch(event.target.value)} placeholder="Search technicians..." style={{ width: '100%', minHeight: 40, borderRadius: 8, border: '1px solid #d1d5db', padding: '0 10px', fontSize: 14 }} />
                <div style={{ display: 'grid', gap: 8, maxHeight: 230, overflowY: 'auto' }}>
                  {filteredTechnicians.map((entry) => {
                    const checked = form.technicians.includes(String(entry._id));
                    return (
                      <label key={entry._id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gridTemplateColumns: '26px 1fr', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTechnician(entry._id)} />
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#374151' }}>{formatEmployeeName(entry)}</div>
                          <div style={{ color: '#6b7280', fontWeight: 700 }}>{entry.mobile || '-'}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 700 }}>Selected:</span>
                  <span style={{ borderRadius: 999, background: 'var(--color-primary-soft)', color: 'var(--color-primary-dark)', padding: '4px 10px', fontWeight: 800 }}>{form.technicians.length} technicians</span>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#374151', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlertCircle size={18} /> Quick Actions</h3>
                <button type="button" onClick={() => createComplaint(true)} style={{ minHeight: 42, borderRadius: 8, border: '1px solid var(--color-primary-soft)', background: '#fff', color: 'var(--color-primary)', fontWeight: 800, fontSize: 14, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}><Save size={15} /> Save as Draft</button>
                <button type="button" onClick={() => createComplaint(false)} style={{ minHeight: 42, borderRadius: 8, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, fontSize: 14, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}><Send size={15} /> Save & Assign</button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
