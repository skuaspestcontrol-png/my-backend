import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { Edit, Eye, EyeOff, Plus, Trash2, UploadCloud, UserCheck, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const roles = ['Sales', 'Sales Person', 'Technician', 'Operations'];
const genderOptions = ['Male', 'Female'];
const maritalOptions = ['Married', 'Unmarried'];
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const defaultForm = {
  empCode: '',
  dateOfJoining: '',
  firstName: '',
  lastName: '',
  gender: 'Male',
  fatherName: '',
  motherName: '',
  employeePhotoUrl: '',
  dateOfBirth: '',
  role: 'Technician',
  roleName: '',
  maritalStatus: 'Unmarried',
  bloodGroup: '',
  emergencyPersonName: '',
  emergencyContactNumber: '',
  mobile: '',
  email: '',
  permanentAddress: '',
  presentAddress: '',
  city: '',
  pincode: '',
  degree: '',
  aadharCardNumber: '',
  aadharCardFileUrl: '',
  panCardNumber: '',
  panCardFileUrl: '',
  salaryPerMonth: '',
  annualSalary: '',
  appAccessEnabled: false,
  webPortalAccessEnabled: false,
  portalPassword: '',
  bankNo: '',
  bankName: '',
  ifsc: '',
  additionalDocumentsUrl: ''
};

const shell = {
  page: {
    padding: '12px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    backdropFilter: 'none'
  },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
  title: { margin: 0, fontSize: '30px', letterSpacing: '-0.02em', color: '#0f172a', fontWeight: 800 },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid rgba(159, 23, 77, 0.34)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '12px',
    minHeight: '44px',
    padding: '0 16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  },
  tableWrap: { background: '#fff', borderRadius: '18px', border: '1px solid var(--border)', overflowX: 'auto' },
  table: { width: '100%', minWidth: '980px', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#475569', padding: '12px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase' },
  td: { padding: '11px 10px', borderBottom: '1px solid #eef2f7', fontSize: '13px', color: '#0f172a', verticalAlign: 'top' },
  rowActionBtn: {
    width: '34px',
    height: '34px',
    minHeight: '34px',
    padding: 0,
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    background: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 0,
    cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2,6,23,0.44)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 3000,
    padding: 'clamp(12px, 3vh, 24px)',
    overflowY: 'auto',
    backdropFilter: 'blur(10px)'
  },
  modal: {
    width: 'min(1260px, 100%)',
    maxHeight: '92vh',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    borderRadius: '24px',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    margin: 'auto'
  },
  modalHeader: {
    background: 'var(--color-primary)',
    color: '#fff',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    fontWeight: 800,
    letterSpacing: '0.02em'
  },
  modalBody: { padding: '20px', overflowY: 'auto', display: 'grid', gap: '16px' },
  section: { border: '1px solid rgba(159, 23, 77, 0.16)', borderRadius: '16px', background: '#fff', padding: '16px' },
  sectionTitle: { margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 14px' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px 14px' },
  field: { display: 'grid', gap: '6px' },
  fieldSpan2: { gridColumn: 'span 2' },
  fieldSpan3: { gridColumn: 'span 3' },
  label: { fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#334155', lineHeight: 1.2 },
  input: { width: '100%', minHeight: '44px', borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.24)', background: '#fff', padding: '10px 12px', fontSize: '13px', color: '#0f172a' },
  textArea: { width: '100%', minHeight: '86px', borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.24)', background: '#fff', padding: '10px 12px', fontSize: '13px', color: '#0f172a', resize: 'vertical' },
  checkRow: { display: 'flex', alignItems: 'center', gap: '18px 24px', rowGap: '14px', flexWrap: 'wrap', paddingTop: '4px', marginBottom: '12px' },
  checkItem: { display: 'inline-flex', alignItems: 'center', gap: '9px', fontSize: '13px', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 },
  uploadBtn: {
    minHeight: '38px',
    borderRadius: '9px',
    border: '1px solid rgba(16,185,129,0.48)',
    background: 'rgba(16,185,129,0.08)',
    color: '#15803d',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '12px',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  helper: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 700 },
  footer: { padding: '12px 16px', borderTop: '1px solid rgba(159, 23, 77, 0.16)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: 'rgba(159, 23, 77, 0.04)' },
  footerActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  cancelBtn: { minHeight: '40px', borderRadius: '10px', border: '1px solid #D1D5DB', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 700, padding: '0 14px' },
  saveBtn: { minHeight: '40px', borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.32)', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 800, padding: '0 16px' }
};

const toAnnual = (value) => {
  const monthly = Number(value || 0);
  if (!Number.isFinite(monthly)) return 0;
  return monthly * 12;
};

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const toTenDigitNumber = (value) => String(value || '').replace(/\D+/g, '').slice(0, 10);
const toAbsoluteUploadUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const origin = API_BASE || 'https://crm.skuaspestcontrol.com';
  return `${origin.replace(/\/+$/, '')}/${raw.replace(/^\/+/, '')}`;
};
const getFileNameFromPath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const clean = raw.split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] || '');
};

const employeeDisplayName = (employee) => [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.empCode || 'Unnamed';
const isPortalEligibleRole = (roleValue) => {
  const role = String(roleValue || '').trim().toLowerCase();
  return role.includes('technician') || role.includes('sales');
};

const buildEmployeeCode = (settings, employees) => {
  const prefix = String(settings?.employeeCodePrefix || 'EMP-');
  const padding = Math.max(1, Number(settings?.employeeCodePadding || 4));
  const configuredNext = Math.max(1, Number(settings?.employeeCodeNextNumber || 1001));
  const maxExisting = (Array.isArray(employees) ? employees : []).reduce((acc, emp) => {
    const raw = String(emp?.empCode || '').trim();
    if (!raw.startsWith(prefix)) return acc;
    const match = raw.slice(prefix.length).match(/(\d+)$/);
    if (!match) return acc;
    const seq = Number(match[1]);
    return Number.isFinite(seq) ? Math.max(acc, seq) : acc;
  }, 0);
  const next = Math.max(configuredNext, maxExisting + 1);
  return `${prefix}${String(next).padStart(padding, '0')}`;
};

const normalizeEmployee = (employee = {}) => {
  const salary = Number(employee.salaryPerMonth ?? employee.salary ?? 0);
  return {
    ...defaultForm,
    ...employee,
    empCode: employee.empCode || '',
    dateOfJoining: employee.dateOfJoining || employee.joiningDate || '',
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    gender: employee.gender || 'Male',
    fatherName: employee.fatherName || '',
    motherName: employee.motherName || '',
    employeePhotoUrl: employee.employeePhotoUrl || employee.profile_photo || '',
    dateOfBirth: employee.dateOfBirth || '',
    role: employee.role || 'Technician',
    roleName: employee.roleName || '',
    maritalStatus: employee.maritalStatus || employee.martialStatus || 'Unmarried',
    bloodGroup: employee.bloodGroup || '',
    emergencyPersonName: employee.emergencyPersonName || '',
    emergencyContactNumber: employee.emergencyContactNumber || '',
    mobile: employee.mobile || '',
    email: employee.email || employee.emailId || '',
    permanentAddress: employee.permanentAddress || '',
    presentAddress: employee.presentAddress || '',
    city: employee.city || '',
    pincode: employee.pincode || '',
    degree: employee.degree || '',
    aadharCardNumber: employee.aadharCardNumber || '',
    aadharCardFileUrl: employee.aadharCardFileUrl || '',
    panCardNumber: employee.panCardNumber || '',
    panCardFileUrl: employee.panCardFileUrl || '',
    salaryPerMonth: salary ? String(salary) : '',
    annualSalary: String(toAnnual(salary)),
    appAccessEnabled: Boolean(employee.appAccessEnabled),
    webPortalAccessEnabled: Boolean(employee.webPortalAccessEnabled || employee.portalAccess === 'Yes' || employee.portalAccess === true),
    portalPassword: employee.portalPassword || '',
    bankNo: employee.bankNo || '',
    bankName: employee.bankName || '',
    ifsc: employee.ifsc || '',
    additionalDocumentsUrl: employee.additionalDocumentsUrl || ''
  };
};

export default function EmployeeMaster() {
  const [employees, setEmployees] = useState([]);
  const [settings, setSettings] = useState({ employeeCodePrefix: 'EMP-', employeeCodeNextNumber: 1001, employeeCodePadding: 4 });
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [sameAsPermanentAddress, setSameAsPermanentAddress] = useState(false);
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  const annualSalary = useMemo(() => toAnnual(form.salaryPerMonth), [form.salaryPerMonth]);
  const isCompactModal = viewportWidth <= 980;
  const grid2Style = isCompactModal ? { ...shell.grid2, gridTemplateColumns: '1fr' } : shell.grid2;
  const grid3Style = isCompactModal ? { ...shell.grid3, gridTemplateColumns: '1fr' } : shell.grid3;
  const dateInputStyle = {
    ...shell.input,
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
    appearance: 'none'
  };

  const loadData = async () => {
    const [employeeRes, settingsRes] = await Promise.all([
      axios.get(`${API_BASE}/api/employees`),
      axios.get(`${API_BASE}/api/settings`)
    ]);
    setEmployees(Array.isArray(employeeRes.data) ? employeeRes.data : []);
    setSettings(settingsRes.data || {});
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('Failed to load employee data', error);
      setStatus('Failed to load employee records.');
    });
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setForm((prev) => ({ ...prev, annualSalary: String(annualSalary) }));
  }, [annualSalary]);

  const updateField = (key, value) => {
    if (key === 'mobile' || key === 'emergencyContactNumber') {
      setForm((prev) => ({ ...prev, [key]: toTenDigitNumber(value) }));
      return;
    }
    setForm((prev) => {
      if (key === 'role') {
        const nextRole = String(value || '');
        if (isPortalEligibleRole(nextRole)) {
          return {
            ...prev,
            role: nextRole,
            appAccessEnabled: true,
            webPortalAccessEnabled: true
          };
        }
        return { ...prev, role: nextRole };
      }
      if (key === 'permanentAddress' && sameAsPermanentAddress) {
        return { ...prev, permanentAddress: value, presentAddress: value };
      }
      return { ...prev, [key]: value };
    });
  };

  const uploadEmployeeDocument = async (file, documentType = 'documents') => {
    const fd = new FormData();
    fd.append('document', file);
    fd.append('documentType', documentType);
    if (form.empCode) fd.append('empCode', String(form.empCode).trim());
    const res = await axios.post(`${API_BASE}/api/employees/upload-document`, fd);
    return String(res.data?.fileUrl || '').trim();
  };

  const handleUpload = async (event, fieldKey, label, documentType = 'documents') => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus(`Uploading ${label}...`);
      const fileUrl = await uploadEmployeeDocument(file, documentType);
      updateField(fieldKey, fileUrl);
      setStatus(`${label} uploaded.`);
    } catch (error) {
      console.error(`Upload failed for ${label}`, error);
      setStatus(`Failed to upload ${label}.`);
    } finally {
      if (event.target) event.target.value = '';
    }
  };
  const removeUploadedFile = async (fieldKey, label) => {
    const fileUrl = String(form[fieldKey] || '').trim();
    if (!fileUrl) {
      updateField(fieldKey, '');
      return;
    }
    try {
      setStatus(`Removing ${label}...`);
      await axios.post(`${API_BASE}/api/uploads/delete`, { fileUrl });
      updateField(fieldKey, '');
      if (fieldKey === 'employeePhotoUrl') setProfilePhotoFile(null);
      setStatus(`${label} removed.`);
    } catch (error) {
      console.error(`Failed to remove ${label}`, error);
      setStatus(`Failed to remove ${label}.`);
    }
  };

  const openAddEmployee = () => {
    setEditingId('');
    setForm((prev) => ({
      ...defaultForm,
      ...prev,
      empCode: buildEmployeeCode(settings, employees),
      annualSalary: '0'
    }));
    setStatus('');
    setSameAsPermanentAddress(false);
    setShowPortalPassword(false);
    setProfilePhotoFile(null);
    setShowModal(true);
  };

  const openEditEmployee = (employee) => {
    setEditingId(employee._id || '');
    const normalizedEmployee = normalizeEmployee(employee);
    setForm(normalizedEmployee);
    setSameAsPermanentAddress(
      String(normalizedEmployee.presentAddress || '').trim().length > 0
      && String(normalizedEmployee.presentAddress || '').trim() === String(normalizedEmployee.permanentAddress || '').trim()
    );
    setStatus('');
    setShowPortalPassword(false);
    setProfilePhotoFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId('');
    setForm(defaultForm);
    setStatus('');
    setSameAsPermanentAddress(false);
    setShowPortalPassword(false);
    setProfilePhotoFile(null);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!form.firstName.trim() || !form.mobile.trim()) {
      setStatus('First name and mobile number are required.');
      return;
    }
    if (toTenDigitNumber(form.mobile).length !== 10) {
      setStatus('Mobile number must be exactly 10 digits.');
      return;
    }
    if (form.emergencyContactNumber && toTenDigitNumber(form.emergencyContactNumber).length !== 10) {
      setStatus('Emergency contact number must be exactly 10 digits.');
      return;
    }

    const portalEligibleRole = isPortalEligibleRole(form.role);
    const anyPortalAccess = portalEligibleRole || form.appAccessEnabled || form.webPortalAccessEnabled;
    if (anyPortalAccess) {
      if (!String(form.portalPassword || '').trim()) {
        setStatus('Password is required when App/Web portal access is enabled.');
        return;
      }
    }

    const payload = {
      ...form,
      empCode: String(form.empCode || '').trim(),
      firstName: String(form.firstName || '').trim(),
      lastName: String(form.lastName || '').trim(),
      gender: String(form.gender || 'Male').trim(),
      fatherName: String(form.fatherName || '').trim(),
      motherName: String(form.motherName || '').trim(),
      employeePhotoUrl: String(form.employeePhotoUrl || '').trim(),
      dateOfBirth: String(form.dateOfBirth || '').trim(),
      dateOfJoining: String(form.dateOfJoining || '').trim(),
      role: String(form.role || 'Technician').trim(),
      roleName: String(form.roleName || '').trim(),
      maritalStatus: String(form.maritalStatus || 'Unmarried').trim(),
      bloodGroup: String(form.bloodGroup || '').trim(),
      emergencyPersonName: String(form.emergencyPersonName || '').trim(),
      emergencyContactNumber: toTenDigitNumber(form.emergencyContactNumber || ''),
      mobile: toTenDigitNumber(form.mobile || ''),
      email: String(form.email || '').trim(),
      emailId: String(form.email || '').trim(),
      permanentAddress: String(form.permanentAddress || '').trim(),
      presentAddress: String(form.presentAddress || '').trim(),
      city: String(form.city || '').trim(),
      pincode: String(form.pincode || '').trim(),
      degree: String(form.degree || '').trim(),
      aadharCardNumber: String(form.aadharCardNumber || '').trim(),
      aadharCardFileUrl: String(form.aadharCardFileUrl || '').trim(),
      panCardNumber: String(form.panCardNumber || '').trim(),
      panCardFileUrl: String(form.panCardFileUrl || '').trim(),
      salaryPerMonth: Number(form.salaryPerMonth || 0),
      salary: Number(form.salaryPerMonth || 0),
      annualSalary: Number(toAnnual(form.salaryPerMonth || 0)),
      appAccessEnabled: portalEligibleRole ? true : Boolean(form.appAccessEnabled),
      webPortalAccessEnabled: portalEligibleRole ? true : Boolean(form.webPortalAccessEnabled),
      portalAccess: (portalEligibleRole ? true : Boolean(form.webPortalAccessEnabled)) ? 'Yes' : 'No',
      portalPassword: String(form.portalPassword || '').trim(),
      bankNo: String(form.bankNo || '').trim(),
      bankName: String(form.bankName || '').trim(),
      ifsc: String(form.ifsc || '').trim().toUpperCase(),
      additionalDocumentsUrl: String(form.additionalDocumentsUrl || '').trim()
    };

    try {
      setIsSaving(true);
      setStatus(editingId ? 'Updating employee...' : 'Saving employee...');

      let requestData = payload;
      let headers = {};

      if (profilePhotoFile) {
        const fd = new FormData();
        Object.keys(payload).forEach(key => {
          fd.append(key, payload[key]);
        });
        fd.append('profilePhoto', profilePhotoFile);
        requestData = fd;
        headers = { 'Content-Type': 'multipart/form-data' };
      }

      if (editingId) {
        await axios.put(`${API_BASE}/api/employees/${editingId}`, requestData, { headers });
      } else {
        await axios.post(`${API_BASE}/api/employees`, requestData, { headers });
      }
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save employee', error);
      setStatus('Failed to save employee.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEmployee = async (id) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await axios.delete(`${API_BASE}/api/employees/${id}`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete employee', error);
      setStatus('Failed to delete employee.');
    }
  };

  return (
    <section style={shell.page}>
      <div style={shell.topbar}>
        <h2 style={shell.title}>Employee Master</h2>
        <button type="button" style={shell.addBtn} onClick={openAddEmployee}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <div style={shell.tableWrap}>
        <table style={shell.table}>
          <thead>
            <tr>
              <th style={shell.th}>Employee Code</th>
              <th style={shell.th}>Name</th>
              <th style={shell.th}>Role</th>
              <th style={shell.th}>Mobile</th>
              <th style={shell.th}>Email</th>
              <th style={shell.th}>Salary/Month</th>
              <th style={shell.th}>Portal Access</th>
              <th style={shell.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td style={shell.td} colSpan={8}>No employees found.</td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr key={employee._id || employee.empCode}>
                  <td style={{ ...shell.td, color: 'var(--color-primary-dark)', fontWeight: 800 }}>{employee.empCode || '-'}</td>
                  <td style={shell.td}>{employeeDisplayName(employee)}</td>
                  <td style={shell.td}>{employee.role || '-'}</td>
                  <td style={shell.td}>{employee.mobile || '-'}</td>
                  <td style={shell.td}>{employee.email || employee.emailId || '-'}</td>
                  <td style={shell.td}>{formatCurrency(employee.salaryPerMonth || employee.salary || 0)}</td>
                  <td style={shell.td}>{employee.webPortalAccessEnabled || employee.portalAccess === 'Yes' || employee.portalAccess === true ? 'Enabled' : 'Disabled'}</td>
                  <td style={shell.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button type="button" onClick={() => openEditEmployee(employee)} style={{ ...shell.rowActionBtn, color: 'var(--color-primary-dark)' }}><Edit size={19} strokeWidth={2.25} /></button>
                      <button type="button" onClick={() => deleteEmployee(employee._id)} style={{ ...shell.rowActionBtn, color: '#dc2626' }}><Trash2 size={19} strokeWidth={2.25} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal ? createPortal(
        <div style={shell.modalOverlay}>
          <form style={shell.modal} onSubmit={handleSave}>
            <div style={shell.modalHeader}>
              <span>{editingId ? 'Edit Employee' : 'Add Employee'} - {form.empCode || 'Auto'}</span>
              <button type="button" onClick={closeModal} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={shell.modalBody}>
              <div style={shell.section}>
                <h3 style={shell.sectionTitle}>Employee Basics</h3>
                <div style={grid2Style}>
                  <div style={shell.field}>
                    <label style={shell.label}>Date of Joining</label>
                    <input type="date" style={dateInputStyle} value={form.dateOfJoining} onChange={(event) => updateField('dateOfJoining', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Employee Code (Auto)</label>
                    <input style={shell.input} value={form.empCode} onChange={(event) => updateField('empCode', event.target.value)} />
                  </div>
                </div>
                <p style={{ ...shell.helper, marginTop: '8px' }}>Employee code is auto-generated from Settings prefix for new records.</p>
                <div style={{ ...grid3Style, marginTop: '12px' }}>
                  <div style={shell.field}>
                    <label style={shell.label}>First Name *</label>
                    <input style={shell.input} required value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Last Name</label>
                    <input style={shell.input} value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Gender</label>
                    <select style={shell.input} value={form.gender} onChange={(event) => updateField('gender', event.target.value)}>
                      {genderOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Father's Name</label>
                    <input style={shell.input} value={form.fatherName} onChange={(event) => updateField('fatherName', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Mother Name</label>
                    <input style={shell.input} value={form.motherName} onChange={(event) => updateField('motherName', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Date of Birth</label>
                    <input type="date" style={dateInputStyle} value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Employee Role</label>
                    <select style={shell.input} value={form.role} onChange={(event) => updateField('role', event.target.value)}>
                      {roles.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Role Name (Manual)</label>
                    <input style={shell.input} value={form.roleName} onChange={(event) => updateField('roleName', event.target.value)} placeholder="Type designation" />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Mobile Number *</label>
                    <input style={shell.input} inputMode="numeric" maxLength={10} required value={form.mobile} onChange={(event) => updateField('mobile', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Martial Status</label>
                    <select style={shell.input} value={form.maritalStatus} onChange={(event) => updateField('maritalStatus', event.target.value)}>
                      {maritalOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Blood Group</label>
                    <select style={shell.input} value={form.bloodGroup} onChange={(event) => updateField('bloodGroup', event.target.value)}>
                      <option value="">Select</option>
                      {bloodGroups.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Degree</label>
                    <input style={shell.input} value={form.degree} onChange={(event) => updateField('degree', event.target.value)} />
                  </div>
                </div>
                <div style={{ ...shell.field, marginTop: '12px' }}>
                  <label style={shell.label}>Profile Photo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <label style={shell.uploadBtn}>
                      <UploadCloud size={14} /> Select Photo
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            setProfilePhotoFile(file);
                          }
                          event.target.value = '';
                        }}
                      />
                    </label>
                    <p style={shell.helper}>
                      {profilePhotoFile ? profilePhotoFile.name : form.employeePhotoUrl ? 'Current photo exists' : 'No photo selected'}
                    </p>
                    {profilePhotoFile ? (
                      <button type="button" onClick={() => setProfilePhotoFile(null)} style={{ ...shell.rowActionBtn, color: '#dc2626' }} title="Clear selected photo"><Trash2 size={16} /></button>
                    ) : null}
                  </div>
                  {(profilePhotoFile || form.employeePhotoUrl) ? (
                    <>
                      <img
                        src={profilePhotoFile ? URL.createObjectURL(profilePhotoFile) : toAbsoluteUploadUrl(form.employeePhotoUrl)}
                        alt="Employee preview"
                        style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #d1d5db', marginTop: '8px' }}
                      />
                      {form.employeePhotoUrl ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <a href={toAbsoluteUploadUrl(form.employeePhotoUrl)} target="_blank" rel="noreferrer" style={shell.helper}>Preview</a>
                          <a href={toAbsoluteUploadUrl(form.employeePhotoUrl)} download style={shell.helper}>Download</a>
                          <span style={shell.helper}>{getFileNameFromPath(form.employeePhotoUrl)}</span>
                          <button type="button" onClick={() => removeUploadedFile('employeePhotoUrl', 'profile photo')} style={{ ...shell.rowActionBtn, color: '#dc2626' }} title="Delete photo"><Trash2 size={16} /></button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              <div style={shell.section}>
                <h3 style={shell.sectionTitle}>Contact & Address</h3>
                <div style={grid3Style}>
                  <div style={shell.field}>
                    <label style={shell.label}>Emergency Person Name</label>
                    <input style={shell.input} value={form.emergencyPersonName} onChange={(event) => updateField('emergencyPersonName', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Emergency Contact Number</label>
                    <input style={shell.input} inputMode="numeric" maxLength={10} value={form.emergencyContactNumber} onChange={(event) => updateField('emergencyContactNumber', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Email ID</label>
                    <input type="email" style={shell.input} value={form.email} onChange={(event) => updateField('email', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>City</label>
                    <input style={shell.input} value={form.city} onChange={(event) => updateField('city', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>PIN Code</label>
                    <input style={shell.input} value={form.pincode} onChange={(event) => updateField('pincode', event.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label style={shell.checkItem}>
                    <input
                      type="checkbox"
                      checked={sameAsPermanentAddress}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSameAsPermanentAddress(checked);
                        if (checked) {
                          setForm((prev) => ({ ...prev, presentAddress: prev.permanentAddress }));
                        }
                      }}
                    />
                    Present Address same as above Permanent Address
                  </label>
                </div>
                <div style={{ ...grid2Style, marginTop: '10px' }}>
                  <div style={isCompactModal ? shell.field : { ...shell.field, ...shell.fieldSpan2 }}>
                    <label style={shell.label}>Permanent Address</label>
                    <textarea style={shell.textArea} value={form.permanentAddress} onChange={(event) => updateField('permanentAddress', event.target.value)} />
                  </div>
                  <div style={isCompactModal ? shell.field : { ...shell.field, ...shell.fieldSpan2 }}>
                    <label style={shell.label}>Present Address</label>
                    <textarea style={shell.textArea} value={form.presentAddress} onChange={(event) => updateField('presentAddress', event.target.value)} disabled={sameAsPermanentAddress} />
                  </div>
                </div>
              </div>

              <div style={shell.section}>
                <h3 style={shell.sectionTitle}>ID & Salary</h3>
                <div style={grid3Style}>
                  <div style={shell.field}>
                    <label style={shell.label}>Aadhar Card Number</label>
                    <input style={shell.input} value={form.aadharCardNumber} onChange={(event) => updateField('aadharCardNumber', event.target.value)} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={shell.uploadBtn}>
                        <UploadCloud size={14} /> Upload Aadhar
                        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(event) => handleUpload(event, 'aadharCardFileUrl', 'Aadhar', 'aadhaar')} />
                      </label>
                      <p style={shell.helper}>{form.aadharCardFileUrl ? 'Uploaded' : 'Not uploaded'}</p>
                    </div>
                    {form.aadharCardFileUrl ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                        <a href={toAbsoluteUploadUrl(form.aadharCardFileUrl)} target="_blank" rel="noreferrer" style={shell.helper}>Preview</a>
                        <a href={toAbsoluteUploadUrl(form.aadharCardFileUrl)} download style={shell.helper}>Download</a>
                        <span style={shell.helper}>{getFileNameFromPath(form.aadharCardFileUrl)}</span>
                        <button type="button" onClick={() => removeUploadedFile('aadharCardFileUrl', 'Aadhar file')} style={{ ...shell.rowActionBtn, color: '#dc2626' }} title="Delete Aadhar"><Trash2 size={16} /></button>
                      </div>
                    ) : null}
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>PAN Card Number</label>
                    <input style={shell.input} value={form.panCardNumber} onChange={(event) => updateField('panCardNumber', event.target.value.toUpperCase())} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={shell.uploadBtn}>
                        <UploadCloud size={14} /> Upload PAN
                        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(event) => handleUpload(event, 'panCardFileUrl', 'PAN', 'pan')} />
                      </label>
                      <p style={shell.helper}>{form.panCardFileUrl ? 'Uploaded' : 'Not uploaded'}</p>
                    </div>
                    {form.panCardFileUrl ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                        <a href={toAbsoluteUploadUrl(form.panCardFileUrl)} target="_blank" rel="noreferrer" style={shell.helper}>Preview</a>
                        <a href={toAbsoluteUploadUrl(form.panCardFileUrl)} download style={shell.helper}>Download</a>
                        <span style={shell.helper}>{getFileNameFromPath(form.panCardFileUrl)}</span>
                        <button type="button" onClick={() => removeUploadedFile('panCardFileUrl', 'PAN file')} style={{ ...shell.rowActionBtn, color: '#dc2626' }} title="Delete PAN"><Trash2 size={16} /></button>
                      </div>
                    ) : null}
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Salary Per Month</label>
                    <input type="number" step="0.01" style={shell.input} value={form.salaryPerMonth} onChange={(event) => updateField('salaryPerMonth', event.target.value)} />
                    <p style={shell.helper}>Annually Auto Calculate: {formatCurrency(annualSalary)}</p>
                  </div>
                </div>
              </div>

              <div style={shell.section}>
                <h3 style={shell.sectionTitle}>Portal Access</h3>
                {isPortalEligibleRole(form.role) ? (
                  <p style={{ ...shell.helper, marginBottom: '10px' }}>
                    For Technician/Sales Person, App Access and Web Portal Access are enabled automatically. Login uses this employee mobile number and portal password.
                  </p>
                ) : null}
                <div style={shell.checkRow}>
                  <label style={shell.checkItem}>
                    <input type="checkbox" checked={form.appAccessEnabled} onChange={(event) => updateField('appAccessEnabled', event.target.checked)} />
                    App Access Enabled
                  </label>
                  <label style={shell.checkItem}>
                    <input type="checkbox" checked={form.webPortalAccessEnabled} onChange={(event) => updateField('webPortalAccessEnabled', event.target.checked)} />
                    Web Portal Access
                  </label>
                </div>
                <div style={grid2Style}>
                  <div style={shell.field}>
                    <label style={shell.label}>Login Mobile Number (same as Employee Mobile Number)</label>
                    <input style={shell.input} value={form.mobile} readOnly placeholder="Auto from employee mobile number" />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Portal Password</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type={showPortalPassword ? 'text' : 'password'}
                        style={shell.input}
                        value={form.portalPassword}
                        onChange={(event) => updateField('portalPassword', event.target.value)}
                        placeholder="Enter password for portal login"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPortalPassword((prev) => !prev)}
                        style={{ ...shell.rowActionBtn, width: '44px', height: '44px', minHeight: '44px' }}
                        aria-label={showPortalPassword ? 'Hide password' : 'Show password'}
                        title={showPortalPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPortalPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={shell.section}>
                <h3 style={shell.sectionTitle}>Bank Details</h3>
                <div style={grid3Style}>
                  <div style={shell.field}>
                    <label style={shell.label}>Bank Number</label>
                    <input style={shell.input} value={form.bankNo} onChange={(event) => updateField('bankNo', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>Bank Name</label>
                    <input style={shell.input} value={form.bankName} onChange={(event) => updateField('bankName', event.target.value)} />
                  </div>
                  <div style={shell.field}>
                    <label style={shell.label}>IFSC Code</label>
                    <input style={shell.input} value={form.ifsc} onChange={(event) => updateField('ifsc', event.target.value.toUpperCase())} />
                  </div>
                </div>
                <div style={{ ...shell.field, marginTop: '12px' }}>
                  <label style={shell.label}>Upload Documents</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={shell.uploadBtn}>
                      <UploadCloud size={14} /> Upload File
                      <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(event) => handleUpload(event, 'additionalDocumentsUrl', 'Additional document', 'documents')} />
                    </label>
                    <p style={shell.helper}>{form.additionalDocumentsUrl ? 'Uploaded' : 'Not uploaded'}</p>
                  </div>
                  {form.additionalDocumentsUrl ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      <a href={toAbsoluteUploadUrl(form.additionalDocumentsUrl)} target="_blank" rel="noreferrer" style={shell.helper}>Preview</a>
                      <a href={toAbsoluteUploadUrl(form.additionalDocumentsUrl)} download style={shell.helper}>Download</a>
                      <span style={shell.helper}>{getFileNameFromPath(form.additionalDocumentsUrl)}</span>
                      <button type="button" onClick={() => removeUploadedFile('additionalDocumentsUrl', 'document')} style={{ ...shell.rowActionBtn, color: '#dc2626' }} title="Delete document"><Trash2 size={16} /></button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={shell.footer}>
              <span style={{ ...shell.helper, color: status.toLowerCase().includes('failed') ? '#dc2626' : 'var(--color-primary-dark)' }}>{status || 'Fill employee details and submit.'}</span>
              <div style={shell.footerActions}>
                <button type="button" style={shell.cancelBtn} onClick={closeModal}>Cancel</button>
                <button type="submit" style={shell.saveBtn} disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingId ? 'Update Employee' : 'Submit'}
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
