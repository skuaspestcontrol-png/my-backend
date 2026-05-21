import React, { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, GitMerge, MapPinned, SearchCheck, UploadCloud, X } from 'lucide-react';
import { useColumnResize } from './table/useColumnResize';

const normalizeApiBase = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return parsed.origin === 'http://localhost' && !/^https?:\/\//i.test(raw) ? '' : parsed.origin.replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '').replace(/\/sales\/customers$/i, '');
  }
};

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL);

const fields = [
  ['customerName', 'Customer Name'],
  ['companyName', 'Company Name'],
  ['contactPersonName', 'Contact Person'],
  ['mobileNumber', 'Mobile'],
  ['whatsappNumber', 'WhatsApp'],
  ['email', 'Email'],
  ['gstNumber', 'GST'],
  ['billingAddress', 'Billing Address'],
  ['shippingAddress', 'Shipping Address'],
  ['billingArea', 'Area'],
  ['billingState', 'State'],
  ['billingPincode', 'Pincode'],
  ['salesPerson', 'Sales Person'],
  ['serviceType', 'Service Type'],
  ['shippingSameAsBilling', 'Shipping Same As Billing'],
  ['altNumber', 'Alt Mobile']
];

const steps = [
  ['Upload', UploadCloud],
  ['Map', MapPinned],
  ['Detect', SearchCheck],
  ['Merge', GitMerge],
  ['Summary', CheckCircle2]
];

const exportScopes = [
  ['all', 'All Customers'],
  ['active', 'Active Customers'],
  ['duplicates', 'Duplicate Customers'],
  ['multiple_premises', 'Customers with Multiple Premises'],
  ['area_wise', 'Area Wise'],
  ['sales_person_wise', 'Sales Person Wise'],
  ['service_wise', 'Service Wise']
];

const previewColumns = ['col1', 'col2', 'col3', 'col4', 'col5', 'col6', 'col7', 'col8'];
const previewDefaultWidths = {
  col1: 180,
  col2: 180,
  col3: 180,
  col4: 180,
  col5: 180,
  col6: 180,
  col7: 180,
  col8: 180
};
const importColumns = ['row', 'imported', 'existing', 'preview', 'action'];
const importDefaultWidths = {
  row: 90,
  imported: 280,
  existing: 220,
  preview: 240,
  action: 160
};
const logColumns = ['row', 'result', 'message'];
const logDefaultWidths = {
  row: 90,
  result: 160,
  message: 360
};

const shell = {
  overlay: { position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(15,23,42,0.54)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: '12px' },
  modal: { width: 'min(1180px, 100%)', height: 'min(92vh, 860px)', background: '#fff', borderRadius: '16px', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', boxShadow: '0 24px 60px rgba(15,23,42,0.24)' },
  header: { padding: '14px 16px', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  title: { margin: 0, fontSize: '20px', fontWeight: 850, letterSpacing: 0 },
  sub: { margin: '3px 0 0', fontSize: '12px', opacity: 0.9, fontWeight: 600 },
  close: { border: '1px solid rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: '9px', height: '34px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800, cursor: 'pointer' },
  steps: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff' },
  step: { minHeight: '40px', border: '1px solid #dbe2ea', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: 850, color: '#475569', background: '#f8fafc' },
  body: { overflow: 'auto', padding: '12px', background: '#f8fafc', display: 'grid', gap: '10px' },
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', display: 'grid', gap: '10px' },
  h3: { margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '7px' },
  note: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600 },
  drop: { border: '1.5px dashed rgba(159,23,77,0.38)', borderRadius: '14px', background: 'rgba(252,231,243,0.36)', padding: '22px 14px', display: 'grid', placeItems: 'center', gap: '8px', textAlign: 'center' },
  btn: { border: '1px solid rgba(159,23,77,0.32)', background: 'var(--color-primary)', color: '#fff', borderRadius: '9px', height: '34px', padding: '0 12px', fontSize: '12px', fontWeight: 850, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  lightBtn: { border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: '9px', height: '34px', padding: '0 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  dangerBtn: { border: '1px solid rgba(220,38,38,0.28)', background: '#fff1f2', color: '#991b1b', borderRadius: '9px', height: '32px', padding: '0 10px', fontSize: '11px', fontWeight: 850, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '9px' },
  label: { margin: 0, color: '#64748b', fontSize: '10px', fontWeight: 850, textTransform: 'uppercase' },
  value: { margin: '4px 0 0', color: '#0f172a', fontSize: '20px', fontWeight: 900 },
  select: { width: '100%', minHeight: '32px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '5px 8px', fontSize: '12px', color: '#111827', background: '#fff' },
  input: { width: '100%', minHeight: '32px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '5px 8px', fontSize: '12px', color: '#111827', background: '#fff' },
  tableWrap: { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '880px' },
  th: { textAlign: 'left', padding: '9px', fontSize: '10px', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', fontWeight: 900 },
  td: { padding: '9px', fontSize: '12px', color: '#334155', borderBottom: '1px solid #eef2f7', verticalAlign: 'top', fontWeight: 650 },
  resizeHandle: { position: 'absolute', top: 0, right: 0, width: '10px', height: '100%', cursor: 'col-resize', userSelect: 'none', touchAction: 'none' },
  footer: { borderTop: '1px solid #e5e7eb', padding: '10px 12px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' },
  actions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  compare: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' },
  pill: { display: 'inline-flex', borderRadius: '999px', padding: '3px 8px', fontSize: '10px', fontWeight: 900, background: '#ecfdf5', color: '#166534' }
};

const formatSize = (size) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

export default function CustomerImportDedupWizard({ open, onClose, onComplete }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [batch, setBatch] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rowPreview, setRowPreview] = useState([]);
  const [mapping, setMapping] = useState({});
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState('');
  const [exportScope, setExportScope] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportFilter, setExportFilter] = useState('');

  const selectedRow = useMemo(() => rows.find((row) => row._id === selectedRowId) || rows.find((row) => row.matchedCustomerId) || rows[0] || null, [rows, selectedRowId]);
  const canContinue = step === 1 ? !!batch : step === 2 ? !!batch : step === 3 ? rows.length > 0 : true;
  const visibleImportRows = rows;
  const previewTableColumns = headers.slice(0, 8).map((header, index) => ({ key: `col${index + 1}`, label: header }));
  const {
    getColumnWidth: getPreviewColumnWidth,
    startResize: startPreviewResize,
    resetColumns: resetPreviewColumns
  } = useColumnResize({
    storageKey: 'skuas-table-widths-import-preview',
    columns: previewColumns,
    defaultColumnWidths: previewDefaultWidths,
    minWidth: 120,
    enabled: true
  });
  const {
    getColumnWidth: getImportColumnWidth,
    startResize: startImportResize,
    resetColumns: resetImportColumns
  } = useColumnResize({
    storageKey: 'skuas-table-widths-import-rows',
    columns: importColumns,
    defaultColumnWidths: importDefaultWidths,
    minWidth: 90,
    enabled: true
  });
  const {
    getColumnWidth: getLogColumnWidth,
    startResize: startLogResize,
    resetColumns: resetLogColumns
  } = useColumnResize({
    storageKey: 'skuas-table-widths-import-logs',
    columns: logColumns,
    defaultColumnWidths: logDefaultWidths,
    minWidth: 90,
    enabled: true
  });
  const previewTableStyle = { ...shell.table, minWidth: `${Math.max(880, previewColumns.reduce((sum, key) => sum + (getPreviewColumnWidth(key) || previewDefaultWidths[key] || 120), 0))}px`, tableLayout: 'fixed' };
  const importTableStyle = { ...shell.table, minWidth: `${Math.max(880, importColumns.reduce((sum, key) => sum + (getImportColumnWidth(key) || importDefaultWidths[key] || 90), 0))}px`, tableLayout: 'fixed' };
  const logTableStyle = { ...shell.table, minWidth: `${Math.max(520, logColumns.reduce((sum, key) => sum + (getLogColumnWidth(key) || logDefaultWidths[key] || 90), 0))}px`, tableLayout: 'fixed' };
  const previewHeadStyle = (key, align = 'left') => {
    const width = getPreviewColumnWidth(key) || previewDefaultWidths[key] || 120;
    return { ...shell.th, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const previewCellStyle = (key, align = 'left') => {
    const width = getPreviewColumnWidth(key) || previewDefaultWidths[key] || 120;
    return { ...shell.td, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const importHeadStyle = (key, align = 'left') => {
    const width = getImportColumnWidth(key) || importDefaultWidths[key] || 90;
    return { ...shell.th, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const importCellStyle = (key, align = 'left') => {
    const width = getImportColumnWidth(key) || importDefaultWidths[key] || 90;
    return { ...shell.td, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const logHeadStyle = (key, align = 'left') => {
    const width = getLogColumnWidth(key) || logDefaultWidths[key] || 90;
    return { ...shell.th, position: 'relative', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };
  const logCellStyle = (key, align = 'left') => {
    const width = getLogColumnWidth(key) || logDefaultWidths[key] || 90;
    return { ...shell.td, width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, textAlign: align };
  };

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setBusy(false);
    setStatus('');
    setBatch(null);
    setHeaders([]);
    setRowPreview([]);
    setMapping({});
    setRows([]);
    setSummary(null);
    setSelectedRowId('');
  };

  const close = () => {
    reset();
    onClose?.();
  };

  const uploadFile = async (file) => {
    if (!file) return;
    try {
      setBusy(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('fileSize', String(file.size));
      const res = await axios.post(`${API_BASE}/api/customers/import/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBatch(res.data.batch);
      setHeaders(res.data.headers || []);
      setRowPreview(res.data.rowPreview || []);
      setMapping(res.data.batch?.mapping || {});
      setStatus(`${file.name} loaded. ${res.data.totalRows || 0} rows detected.`);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to upload file.');
    } finally {
      setBusy(false);
    }
  };

  const saveMapping = async () => {
    try {
      setBusy(true);
      const res = await axios.post(`${API_BASE}/api/customers/import/map`, { batchId: batch._id, mapping, templateName: 'Default Customer Import' });
      setBatch(res.data.batch);
      setStatus('Mapping saved.');
      setStep(3);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to save mapping.');
    } finally {
      setBusy(false);
    }
  };

  const detectDuplicates = async () => {
    try {
      setBusy(true);
      const res = await axios.post(`${API_BASE}/api/customers/import/detect-duplicates`, { batchId: batch._id, mapping });
      setBatch(res.data.batch);
      setRows(res.data.rows || []);
      setSummary(res.data.summary || res.data.batch?.stats || null);
      setSelectedRowId((res.data.rows || [])[0]?._id || '');
      setStatus('Smart duplicate detection completed.');
      setStep(4);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to detect duplicates.');
    } finally {
      setBusy(false);
    }
  };

  const setRowAction = async (row, action) => {
    try {
      const res = await axios.post(`${API_BASE}/api/customers/import/merge`, {
        rowId: row._id,
        action,
        targetCustomerId: row.selectedTargetCustomerId || row.matchedCustomerId,
        reason: 'Smart import action'
      });
      setRows((prev) => prev.map((entry) => (entry._id === row._id ? { ...entry, ...res.data } : entry)));
      setStatus(`Action updated for row #${res.data.rowNumber}.`);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to update row action.');
    }
  };

  const bulkAction = async (action) => {
    const targets = rows.filter((row) => action === 'skip' ? row.matchedCustomerId : row.status !== 'Invalid Row');
    setBusy(true);
    try {
      const updated = await Promise.all(targets.map((row) => axios.post(`${API_BASE}/api/customers/import/merge`, {
        rowId: row._id,
        action,
        targetCustomerId: row.selectedTargetCustomerId || row.matchedCustomerId,
        reason: 'Bulk smart import action'
      })));
      const byId = new Map(updated.map((res) => [res.data._id, res.data]));
      setRows((prev) => prev.map((row) => byId.get(row._id) || row));
      setStatus('Bulk action applied.');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to apply bulk action.');
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!batch?._id) {
      setStatus('No import batch is ready to finalize.');
      return;
    }
    try {
      setBusy(true);
      setStatus(`Finalizing ${rows.length || batch.totalRows || 0} import row(s). Please wait...`);
      const res = await axios.post(`${API_BASE}/api/customers/import/finalize`, { batchId: batch._id, actor: localStorage.getItem('portal_user_name') || 'Admin' });
      setBatch(res.data.batch);
      setRows(res.data.rows || []);
      setSummary(res.data.batch?.stats || null);
      setStatus('Import finalized.');
      setStep(5);
      onComplete?.();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to finalize import.');
    } finally {
      setBusy(false);
    }
  };

  const exportCustomers = () => {
    const params = new URLSearchParams({ scope: exportScope, format: exportFormat });
    if (exportScope === 'area_wise') params.set('area', exportFilter);
    if (exportScope === 'sales_person_wise') params.set('salesPerson', exportFilter);
    if (exportScope === 'service_wise') params.set('serviceType', exportFilter);
    window.open(`${API_BASE}/api/customers/export?${params.toString()}`, '_blank');
  };

  const renderStat = (label, value) => (
    <div style={shell.card}>
      <p style={shell.label}>{label}</p>
      <p style={shell.value}>{value || 0}</p>
    </div>
  );

  const renderPerson = (title, data = {}) => (
    <div style={shell.card}>
      <p style={shell.label}>{title}</p>
      <div style={{ marginTop: '7px', display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 750, color: '#0f172a' }}>
        <div>{data.name || '-'}</div>
        <div style={{ color: '#64748b' }}>{data.mobile || '-'} | {data.email || '-'}</div>
        <div style={{ color: '#64748b' }}>{data.gst || data.gstNumber || '-'}</div>
        <div style={{ color: '#64748b' }}>{data.address || '-'}</div>
      </div>
    </div>
  );

  const stepIcon = steps[step - 1]?.[1] || UploadCloud;
  const StepIcon = stepIcon;

  return (
    <div style={shell.overlay}>
      <div style={shell.modal}>
        <div style={shell.header}>
          <div>
            <h2 style={shell.title}>Smart Customer Import / Export</h2>
            <p style={shell.sub}>Deduplicate, merge, and add customer premises without duplicate customer spam.</p>
          </div>
          <button type="button" style={shell.close} onClick={close}><X size={15} /> Close</button>
        </div>

        <div style={shell.steps}>
          {steps.map(([label, Icon], idx) => (
            <div key={label} style={{ ...shell.step, ...(idx + 1 === step ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : null) }}>
              <Icon size={14} /> {label}
            </div>
          ))}
        </div>

        <div style={shell.body}>
          {status ? <div style={{ ...shell.panel, color: 'var(--color-primary-deep)', fontWeight: 800 }}>{status}</div> : null}

          {step === 1 ? (
            <>
              <div style={shell.panel}>
                <h3 style={shell.h3}><StepIcon size={16} /> Upload Excel/CSV</h3>
                <div
                  style={shell.drop}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    uploadFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  <FileSpreadsheet size={34} color="var(--color-primary)" />
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>Drop customer file here</div>
                  <p style={shell.note}>Supports .xlsx, .xls, and .csv</p>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(event) => uploadFile(event.target.files?.[0])} />
                  <button type="button" style={shell.btn} onClick={() => fileRef.current?.click()} disabled={busy}>Browse File</button>
                </div>
              </div>
              {batch ? (
                <div style={shell.grid}>
                  {renderStat('Total Rows', batch.totalRows)}
                  {renderStat('File Size', formatSize(batch.fileSize))}
                  {renderStat('Columns', headers.length)}
                </div>
              ) : null}
              {headers.length ? (
                <div style={shell.panel}>
                  <h3 style={shell.h3}>Column Preview</h3>
                  <div style={shell.actions}>{headers.slice(0, 18).map((header) => <span key={header} style={shell.pill}>{header}</span>)}</div>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <div style={shell.panel}>
              <h3 style={shell.h3}><MapPinned size={16} /> Auto Field Mapping</h3>
              <p style={shell.note}>Review the detected fields. Dropdowns are compact for fast cleanup on desktop and mobile.</p>
              <div style={shell.grid}>
                {fields.map(([key, label]) => (
                  <label key={key} style={{ display: 'grid', gap: '4px' }}>
                    <span style={shell.label}>{label}</span>
                    <select style={shell.select} value={mapping[key] || ''} onChange={(event) => setMapping((prev) => ({ ...prev, [key]: event.target.value }))}>
                      <option value="">Not mapped</option>
                      {headers.map((header) => <option key={`${key}-${header}`} value={header}>{header}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div style={shell.actions}>
                <button type="button" style={shell.lightBtn} onClick={saveMapping} disabled={busy}>Save Mapping Template</button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div style={shell.panel}>
              <h3 style={shell.h3}><SearchCheck size={16} /> Smart Duplicate Detection</h3>
              <p style={shell.note}>High priority: mobile, WhatsApp, email, GST. Secondary: customer/company name and address similarity.</p>
              {rowPreview.length ? (
                <div style={shell.tableWrap}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 8px' }}>
                    <button type="button" style={shell.lightBtn} onClick={resetPreviewColumns}>Reset Columns</button>
                  </div>
                  <table style={previewTableStyle}>
                    <colgroup>{previewTableColumns.map((column) => <col key={column.key} style={{ width: `${getPreviewColumnWidth(column.key) || previewDefaultWidths[column.key] || 120}px` }} />)}</colgroup>
                    <thead>
                      <tr>
                        {previewTableColumns.map((column, index) => (
                          <th key={column.key} style={previewHeadStyle(column.key)}>
                            {column.label}
                            <span style={shell.resizeHandle} onPointerDown={(event) => startPreviewResize(column.key, event)} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowPreview.map((row, idx) => (
                        <tr key={idx}>{previewTableColumns.map((column) => <td key={column.key} style={previewCellStyle(column.key)}>{row[column.label] || row[column.key] || '-'}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <button type="button" style={shell.btn} onClick={detectDuplicates} disabled={busy}>Run Duplicate Detection</button>
            </div>
          ) : null}

          {step === 4 ? (
            <>
              <div style={shell.grid}>
                {renderStat('Total Imported', summary?.totalRows || rows.length)}
                {renderStat('New Customers', summary?.newCustomers)}
                {renderStat('Duplicate Customers', (summary?.exactDuplicates || 0) + (summary?.possibleDuplicates || 0))}
                {renderStat('New Premises Added', summary?.newPremisesAdded)}
              </div>
              <div style={shell.panel}>
                <h3 style={shell.h3}><GitMerge size={16} /> Customer Merge Preview</h3>
                <div style={shell.compare}>
                  {renderPerson('Existing CRM Customer', {
                    name: selectedRow?.matchedCustomerName,
                    mobile: selectedRow?.possibleMatches?.[0]?.phone,
                    email: selectedRow?.possibleMatches?.[0]?.email,
                    address: selectedRow?.possibleMatches?.[0]?.address
                  })}
                  {renderPerson('Imported Customer', {
                    name: selectedRow?.clean?.customerName,
                    mobile: selectedRow?.clean?.mobileNumber,
                    email: selectedRow?.clean?.email,
                    gst: selectedRow?.clean?.gstNumber,
                    address: selectedRow?.clean?.shippingAddress || selectedRow?.clean?.billingAddress
                  })}
                </div>
                <div style={shell.actions}>
                  {selectedRow ? <button type="button" style={shell.btn} onClick={() => setRowAction(selectedRow, 'merge_with_existing')}>Merge</button> : null}
                  {selectedRow ? <button type="button" style={shell.lightBtn} onClick={() => setRowAction(selectedRow, 'add_address')}>Add New Premise</button> : null}
                  {selectedRow ? <button type="button" style={shell.lightBtn} onClick={() => setRowAction(selectedRow, 'update_existing')}>Merge Best Data</button> : null}
                  {selectedRow ? <button type="button" style={shell.dangerBtn} onClick={() => setRowAction(selectedRow, 'skip')}>Delete Imported Duplicate</button> : null}
                </div>
              </div>
              <div style={shell.panel}>
                <div style={shell.actions}>
                  <button type="button" style={shell.lightBtn} onClick={() => bulkAction('merge_with_existing')} disabled={busy}>Bulk Merge</button>
                  <button type="button" style={shell.lightBtn} onClick={() => bulkAction('skip')} disabled={busy}>Bulk Delete Duplicates</button>
                  <button type="button" style={shell.lightBtn} onClick={() => bulkAction('update_existing')} disabled={busy}>Bulk Update Missing Fields</button>
                  <button type="button" style={shell.btn} onClick={finalize} disabled={busy}>{busy ? 'Finalizing...' : `Finalize ${rows.length || batch?.totalRows || 0} Rows`}</button>
                </div>
                <p style={shell.note}>Showing all {visibleImportRows.length} analyzed import rows.</p>
                <div style={shell.tableWrap}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 8px' }}>
                    <button type="button" style={shell.lightBtn} onClick={resetImportColumns}>Reset Columns</button>
                  </div>
                  <table style={importTableStyle}>
                    <colgroup>{importColumns.map((key) => <col key={key} style={{ width: `${getImportColumnWidth(key) || importDefaultWidths[key] || 90}px` }} />)}</colgroup>
                    <thead>
                      <tr>
                        <th style={importHeadStyle('row', 'center')}>Row<span style={shell.resizeHandle} onPointerDown={(event) => startImportResize('row', event)} /></th>
                        <th style={importHeadStyle('imported')}>Imported<span style={shell.resizeHandle} onPointerDown={(event) => startImportResize('imported', event)} /></th>
                        <th style={importHeadStyle('existing')}>Existing Match<span style={shell.resizeHandle} onPointerDown={(event) => startImportResize('existing', event)} /></th>
                        <th style={importHeadStyle('preview')}>Preview<span style={shell.resizeHandle} onPointerDown={(event) => startImportResize('preview', event)} /></th>
                        <th style={importHeadStyle('action', 'center')}>Action<span style={shell.resizeHandle} onPointerDown={(event) => startImportResize('action', event)} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleImportRows.map((row) => (
                        <tr key={row._id} onClick={() => setSelectedRowId(row._id)} style={{ background: selectedRowId === row._id ? 'rgba(252,231,243,0.5)' : '#fff', cursor: 'pointer' }}>
                          <td style={importCellStyle('row', 'center')}>#{row.rowNumber}</td>
                          <td style={importCellStyle('imported')}>{row.clean?.customerName || '-'}<br /><span style={{ color: '#64748b' }}>{row.clean?.mobileNumber || '-'} | {row.clean?.email || '-'}</span></td>
                          <td style={importCellStyle('existing')}>{row.matchedCustomerName || 'New customer'}<br /><span style={{ color: '#64748b' }}>{row.confidence || 0}% match</span></td>
                          <td style={importCellStyle('preview')}>{row.previewActionLabel || 'New Customer → Create Customer'}</td>
                          <td style={importCellStyle('action', 'center')}>{row.selectedAction || row.suggestedAction || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <div style={shell.grid}>
                {renderStat('Total Imported', summary?.totalRows || rows.length)}
                {renderStat('New Customers', summary?.importedAsNew)}
                {renderStat('Merged Customers', summary?.mergedRecords)}
                {renderStat('Skipped Customers', summary?.skippedRows)}
                {renderStat('New Premises Added', summary?.newPremisesAdded)}
                {renderStat('Updated Customers', summary?.updatedExisting)}
                {renderStat('Failed Rows', summary?.failedRows)}
              </div>
              <div style={shell.panel}>
                <h3 style={shell.h3}><Download size={16} /> Export Customers</h3>
                <div style={shell.grid}>
                  <select style={shell.select} value={exportScope} onChange={(event) => setExportScope(event.target.value)}>
                    {exportScopes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select style={shell.select} value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                  </select>
                  {['area_wise', 'sales_person_wise', 'service_wise'].includes(exportScope) ? (
                    <input style={shell.input} value={exportFilter} onChange={(event) => setExportFilter(event.target.value)} placeholder="Filter value" />
                  ) : null}
                  <button type="button" style={shell.btn} onClick={exportCustomers}><Download size={14} /> Export</button>
                </div>
              </div>
              <div style={shell.panel}>
                <h3 style={shell.h3}>Import Logs</h3>
                <p style={shell.note}>Showing all {visibleImportRows.length} finalized import rows.</p>
                <div style={shell.tableWrap}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 8px' }}>
                    <button type="button" style={shell.lightBtn} onClick={resetLogColumns}>Reset Columns</button>
                  </div>
                  <table style={logTableStyle}>
                    <colgroup>{logColumns.map((key) => <col key={key} style={{ width: `${getLogColumnWidth(key) || logDefaultWidths[key] || 90}px` }} />)}</colgroup>
                    <thead>
                      <tr>
                        <th style={logHeadStyle('row', 'center')}>Row<span style={shell.resizeHandle} onPointerDown={(event) => startLogResize('row', event)} /></th>
                        <th style={logHeadStyle('result')}>Result<span style={shell.resizeHandle} onPointerDown={(event) => startLogResize('result', event)} /></th>
                        <th style={logHeadStyle('message')}>Message<span style={shell.resizeHandle} onPointerDown={(event) => startLogResize('message', event)} /></th>
                      </tr>
                    </thead>
                    <tbody>{visibleImportRows.map((row) => <tr key={row._id}><td style={logCellStyle('row', 'center')}>#{row.rowNumber}</td><td style={logCellStyle('result')}>{row.finalResult || '-'}</td><td style={logCellStyle('message')}>{row.finalMessage || '-'}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div style={shell.footer}>
          <span style={shell.note}>Smart import protects customer records and stores multiple addresses as premises.</span>
          <div style={shell.actions}>
            <button type="button" style={shell.lightBtn} onClick={step === 1 ? close : () => setStep((prev) => Math.max(1, prev - 1))}>{step === 1 ? 'Cancel' : 'Back'}</button>
            {step < 4 ? <button type="button" style={shell.btn} onClick={step === 2 ? saveMapping : () => setStep((prev) => prev + 1)} disabled={!canContinue || busy}>Continue <ArrowRight size={14} /></button> : null}
            {step === 4 ? <button type="button" style={shell.btn} onClick={finalize} disabled={busy}>{busy ? 'Finalizing...' : 'Finalize Import'}</button> : null}
            {step === 5 ? <button type="button" style={shell.btn} onClick={close}>Done</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
