import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, Download, FileUp, Layers, ShieldAlert, Sparkles, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const steps = [
  'Upload Excel/CSV',
  'Field Mapping',
  'Validation & Duplicate Preview',
  'Review Actions',
  'Final Import Summary'
];

const statusTone = {
  'New Customer': { bg: 'rgba(22,163,74,0.13)', color: '#166534', border: '1px solid rgba(22,163,74,0.28)' },
  'Exact Duplicate': { bg: 'rgba(220,38,38,0.12)', color: '#991b1b', border: '1px solid rgba(220,38,38,0.28)' },
  'Possible Duplicate': { bg: 'rgba(217,119,6,0.12)', color: '#92400e', border: '1px solid rgba(217,119,6,0.32)' },
  'Needs Review': { bg: 'rgba(252,231,243,0.68)', color: 'var(--color-primary-dark)', border: '1px solid rgba(159,23,77,0.28)' },
  'Invalid Row': { bg: 'rgba(100,116,139,0.12)', color: '#334155', border: '1px solid rgba(100,116,139,0.3)' }
};

const actionOptions = [
  { value: 'create_new', label: 'Create as new customer' },
  { value: 'skip', label: 'Skip import' },
  { value: 'update_existing', label: 'Update existing customer' },
  { value: 'merge_with_existing', label: 'Merge with existing customer' },
  { value: 'mark_different', label: 'Mark as different customer' },
  { value: 'needs_review', label: 'Needs review' }
];

const modalShell = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2,6,23,0.58)',
    backdropFilter: 'blur(8px)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 4000,
    padding: '16px'
  },
  modal: {
    width: 'min(1320px, 100%)',
    maxHeight: '92vh',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid rgba(159, 23, 77, 0.22)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    display: 'grid',
    gridTemplateRows: 'auto auto 1fr auto'
  },
  header: {
    padding: '16px 18px',
    borderBottom: '1px solid rgba(159, 23, 77, 0.16)',
    background: 'var(--color-primary)',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px'
  },
  body: { padding: '14px', overflowY: 'auto', display: 'grid', gap: '10px' },
  footer: { padding: '12px 14px', borderTop: '1px solid rgba(159, 23, 77, 0.16)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  stepBar: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px', padding: '10px 14px', borderBottom: '1px solid rgba(159, 23, 77, 0.14)', background: '#fff' },
  stepChip: { borderRadius: '10px', border: '1px solid var(--color-primary-soft)', background: '#f8fafc', color: '#334155', fontSize: '11px', fontWeight: 800, padding: '8px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' },
  panel: { border: '1px solid rgba(159, 23, 77, 0.2)', borderRadius: '14px', background: '#fff', padding: '12px', display: 'grid', gap: '10px' },
  sectionTitle: { margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '7px' },
  sub: { margin: 0, fontSize: '12px', color: '#475569' },
  btn: { border: '1px solid rgba(159, 23, 77, 0.34)', borderRadius: '9px', minHeight: '35px', padding: '0 11px', fontSize: '12px', fontWeight: 700, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' },
  btnLight: { border: '1px solid #D1D5DB', borderRadius: '9px', minHeight: '35px', padding: '0 11px', fontSize: '12px', fontWeight: 700, background: '#fff', color: '#0f172a', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  card: { borderRadius: '11px', border: '1px solid rgba(159, 23, 77, 0.2)', background: 'rgba(248,250,252,0.9)', padding: '10px' },
  cardLabel: { margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  cardValue: { margin: '6px 0 0 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' },
  tableWrap: { border: '1px solid var(--color-primary-soft)', borderRadius: '10px', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '1080px' },
  th: { textAlign: 'left', padding: '8px 9px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' },
  td: { padding: '8px 9px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#334155', fontWeight: 600, verticalAlign: 'top' },
  badge: { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 },
  input: { width: '100%', minHeight: '35px', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '8px 10px', fontSize: '13px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' }
};

const initialMapping = {
  customerName: '',
  mobileNumber: '',
  address: '',
  serviceType: '',
  email: '',
  companyName: '',
  billingArea: '',
  billingState: '',
  billingPincode: ''
};

export default function CustomerImportDedupWizard({ open, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [batch, setBatch] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState(initialMapping);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);

  const canNext = useMemo(() => {
    if (step === 1) return !!fileContent;
    if (step === 2) return !!batch;
    if (step === 3) return rows.length > 0;
    if (step === 4) return rows.length > 0;
    return true;
  }, [batch, fileContent, rows.length, step]);

  if (!open) return null;

  const resetWizard = () => {
    setStep(1);
    setBusy(false);
    setStatus('');
    setFileName('');
    setFileContent('');
    setBatch(null);
    setHeaders([]);
    setMapping(initialMapping);
    setRows([]);
    setSummary(null);
  };

  const handleClose = () => {
    resetWizard();
    onClose?.();
  };

  const loadPreview = async (batchId) => {
    const res = await axios.get(`${API_BASE}/api/customers/import/batches/${batchId}/preview`);
    setBatch(res.data?.batch || null);
    setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
    setSummary(res.data?.batch?.stats || null);
  };

  const processUpload = async () => {
    try {
      setBusy(true);
      const res = await axios.post(`${API_BASE}/api/customers/import/upload`, {
        fileName,
        content: fileContent,
        mapping
      });
      const nextBatch = res.data?.batch || null;
      setBatch(nextBatch);
      setHeaders(Array.isArray(nextBatch?.headers) ? nextBatch.headers : []);
      setMapping(nextBatch?.mapping || initialMapping);
      setRows(Array.isArray(res.data?.previewRows) ? res.data.previewRows : []);
      setSummary(nextBatch?.stats || null);
      setStatus('Import file uploaded and analyzed successfully.');
      setStep(2);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to upload import file.');
    } finally {
      setBusy(false);
    }
  };

  const applyMapping = async () => {
    if (!batch?._id) return;
    try {
      setBusy(true);
      await axios.post(`${API_BASE}/api/customers/import/batches/${batch._id}/remap`, { mapping });
      await loadPreview(batch._id);
      setStatus('Field mapping applied.');
      setStep(3);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to apply field mapping.');
    } finally {
      setBusy(false);
    }
  };

  const setRowAction = async (rowId, action, targetCustomerId = '', reason = '') => {
    try {
      await axios.post(`${API_BASE}/api/customers/import/rows/${rowId}/action`, { action, targetCustomerId, reason });
      setRows((prev) => prev.map((row) => (
        row._id === rowId ? { ...row, selectedAction: action, selectedTargetCustomerId: targetCustomerId || row.selectedTargetCustomerId } : row
      )));
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to update row action.');
    }
  };

  const applyBulk = async (mode) => {
    const candidates = rows.filter((row) => {
      if (mode === 'new') return row.status === 'New Customer';
      if (mode === 'exact') return row.status === 'Exact Duplicate';
      if (mode === 'possible') return row.status === 'Possible Duplicate' || row.status === 'Needs Review';
      return false;
    });

    const action = mode === 'new' ? 'create_new' : mode === 'exact' ? 'skip' : 'merge_with_existing';

    try {
      setBusy(true);
      await Promise.all(candidates.map((row) => axios.post(`${API_BASE}/api/customers/import/rows/${row._id}/action`, {
        action,
        targetCustomerId: row.matchedCustomerId,
        reason: 'Bulk action applied'
      })));
      await loadPreview(batch._id);
      setStatus('Bulk action applied.');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to apply bulk action.');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!batch?._id) return;
    try {
      setBusy(true);
      const res = await axios.post(`${API_BASE}/api/customers/import/batches/${batch._id}/confirm`, { actor: localStorage.getItem('portal_user_name') || 'Admin' });
      setSummary(res.data?.batch?.stats || null);
      setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
      setStatus('Import completed successfully.');
      setStep(5);
      onComplete?.();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Unable to finalize import.');
    } finally {
      setBusy(false);
    }
  };

  const exportDuplicateReport = async (format = 'csv') => {
    try {
      const res = await axios.get(`${API_BASE}/api/customers/duplicates/report`, { params: { format }, responseType: 'blob' });
      const extension = format === 'pdf' ? 'pdf' : 'csv';
      const url = URL.createObjectURL(res.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `customer_duplicate_report.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (_error) {
      setStatus('Unable to export duplicate report.');
    }
  };

  const total = summary?.totalRows || rows.length;

  return (
    <div style={modalShell.overlay}>
      <div style={modalShell.modal}>
        <div style={modalShell.header}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Customer Import Deduplication Wizard</div>
            <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9 }}>SKUAS Pest Control CRM - Sales {'>'} Customers {'>'} Active Customers</div>
          </div>
          <button type="button" style={{ ...modalShell.btnLight, borderColor: 'rgba(255,255,255,0.44)', background: 'rgba(255,255,255,0.12)', color: '#fff' }} onClick={handleClose}>
            <X size={14} /> Close
          </button>
        </div>

        <div style={modalShell.stepBar}>
          {steps.map((label, idx) => (
            <div key={label} style={{ ...modalShell.stepChip, ...(step === idx + 1 ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'rgba(159, 23, 77, 0.52)' } : null) }}>
              Step {idx + 1}: {label}
            </div>
          ))}
        </div>

        <div style={modalShell.body}>
          {status ? (
            <div style={{ ...modalShell.panel, borderColor: 'rgba(159, 23, 77, 0.32)', color: 'var(--color-primary-deep)', fontWeight: 700 }}>{status}</div>
          ) : null}

          {step === 1 ? (
            <div style={modalShell.panel}>
              <h3 style={modalShell.sectionTitle}><FileUp size={16} /> Upload Excel/CSV/JSON</h3>
              <p style={modalShell.sub}>Import data into temporary batch and analyze duplicates before saving customers.</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="file"
                  accept=".csv,.json,.txt"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    setFileName(file.name);
                    setFileContent(text);
                    setStatus(`Loaded file: ${file.name}`);
                  }}
                />
                <button type="button" style={modalShell.btn} onClick={processUpload} disabled={busy || !fileContent}>Analyze Import</button>
                <button type="button" style={modalShell.btnLight} onClick={() => window.open(`${API_BASE}/api/customers/import/sample`, '_blank')}>Download Sample Format</button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div style={modalShell.panel}>
              <h3 style={modalShell.sectionTitle}><Layers size={16} /> Field Mapping</h3>
              <p style={modalShell.sub}>Map your input headers to required customer fields before validation and duplicate detection.</p>
              <div style={modalShell.grid}>
                {Object.keys(initialMapping).map((key) => (
                  <div key={key}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>{key}</div>
                    <select style={modalShell.input} value={mapping[key] || ''} onChange={(event) => setMapping((prev) => ({ ...prev, [key]: event.target.value }))}>
                      <option value="">Not mapped</option>
                      {headers.map((header) => <option key={`${key}-${header}`} value={header}>{header}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={modalShell.actions}>
                <button type="button" style={modalShell.btn} onClick={applyMapping} disabled={busy}>Apply Mapping</button>
              </div>
            </div>
          ) : null}

          {step === 3 || step === 4 || step === 5 ? (
            <>
              <div style={modalShell.grid}>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Total Imported Rows</p><p style={modalShell.cardValue}>{total || 0}</p></div>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>New Customers</p><p style={modalShell.cardValue}>{summary?.newCustomers || 0}</p></div>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Exact Duplicates</p><p style={modalShell.cardValue}>{summary?.exactDuplicates || 0}</p></div>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Possible Duplicates</p><p style={modalShell.cardValue}>{summary?.possibleDuplicates || 0}</p></div>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Needs Review</p><p style={modalShell.cardValue}>{summary?.needsReview || 0}</p></div>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Invalid Rows</p><p style={modalShell.cardValue}>{summary?.invalidRows || 0}</p></div>
              </div>

              {step === 4 ? (
                <div style={modalShell.panel}>
                  <h3 style={modalShell.sectionTitle}><Sparkles size={16} /> Admin Bulk Actions</h3>
                  <div style={modalShell.actions}>
                    <button type="button" style={modalShell.btnLight} onClick={() => applyBulk('new')} disabled={busy}>Import all new customers</button>
                    <button type="button" style={modalShell.btnLight} onClick={() => applyBulk('exact')} disabled={busy}>Skip all exact duplicates</button>
                    <button type="button" style={modalShell.btnLight} onClick={() => applyBulk('possible')} disabled={busy}>Merge selected possible duplicates</button>
                    <button type="button" style={modalShell.btnLight} onClick={() => exportDuplicateReport('csv')}><Download size={14} /> Export duplicate report</button>
                  </div>
                </div>
              ) : null}

              <div style={modalShell.tableWrap}>
                <table style={modalShell.table}>
                  <thead>
                    <tr>
                      <th style={modalShell.th}>Row</th>
                      <th style={modalShell.th}>Imported Data</th>
                      <th style={modalShell.th}>Status</th>
                      <th style={modalShell.th}>Matching Existing Customer</th>
                      <th style={modalShell.th}>Match Reason</th>
                      <th style={modalShell.th}>Confidence</th>
                      <th style={modalShell.th}>Suggested Action</th>
                      <th style={modalShell.th}>Admin Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 300).map((row) => (
                      <tr key={row._id}>
                        <td style={modalShell.td}>#{row.rowNumber}</td>
                        <td style={modalShell.td}>
                          <div>{row.clean?.customerName || '-'}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{row.clean?.mobileNumber || '-'} | {row.clean?.email || '-'}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{row.clean?.address || '-'}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{row.clean?.serviceType || '-'}</div>
                        </td>
                        <td style={modalShell.td}>
                          <span style={{ ...modalShell.badge, ...(statusTone[row.status] || statusTone['Needs Review']) }}>{row.status}</span>
                        </td>
                        <td style={modalShell.td}>{row.matchedCustomerName || '-'}</td>
                        <td style={modalShell.td}>{row.matchReason || '-'}</td>
                        <td style={modalShell.td}>{row.confidence || 0}%</td>
                        <td style={modalShell.td}>{row.suggestedAction || '-'}</td>
                        <td style={modalShell.td}>
                          {step === 3 || step === 4 ? (
                            <div style={{ display: 'grid', gap: '6px' }}>
                              <select
                                style={modalShell.input}
                                value={row.selectedAction || row.suggestedAction || 'needs_review'}
                                onChange={(event) => setRowAction(row._id, event.target.value, row.matchedCustomerId)}
                              >
                                {actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                              {(row.possibleMatches && row.possibleMatches.length > 0) || row.matchedCustomerId ? (
                                <select
                                  style={modalShell.input}
                                  value={row.selectedTargetCustomerId || row.matchedCustomerId || ''}
                                  onChange={(event) => setRowAction(row._id, row.selectedAction || row.suggestedAction, event.target.value)}
                                >
                                  <option value="">Select target customer</option>
                                  {(row.possibleMatches || []).map((match) => (
                                    <option key={`${row._id}-${match.customerId}`} value={match.customerId}>{match.customerName} ({match.score}%)</option>
                                  ))}
                                </select>
                              ) : null}
                            </div>
                          ) : (
                            <span>{row.finalMessage || '-'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {step === 5 ? (
            <div style={modalShell.panel}>
              <h3 style={modalShell.sectionTitle}><CheckCircle2 size={16} /> Final Import Summary</h3>
              <div style={modalShell.grid}>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Imported As New</p><p style={modalShell.cardValue}>{summary?.importedAsNew || 0}</p></div>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Updated Existing</p><p style={modalShell.cardValue}>{summary?.updatedExisting || 0}</p></div>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Merged Records</p><p style={modalShell.cardValue}>{summary?.mergedRecords || 0}</p></div>
                <div style={modalShell.card}><p style={modalShell.cardLabel}>Skipped Rows</p><p style={modalShell.cardValue}>{summary?.skippedRows || 0}</p></div>
              </div>
            </div>
          ) : null}
        </div>

        <div style={modalShell.footer}>
          <div style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>
            {step <= 4 ? 'Always review exact/possible duplicates before final import.' : 'Import completed. You can close the wizard now.'}
          </div>
          <div style={modalShell.actions}>
            {step > 1 ? <button type="button" style={modalShell.btnLight} onClick={() => setStep((prev) => Math.max(1, prev - 1))}>Back</button> : null}
            {step < 4 ? <button type="button" style={modalShell.btn} onClick={() => setStep((prev) => prev + 1)} disabled={!canNext}>Next</button> : null}
            {step === 4 ? <button type="button" style={modalShell.btn} onClick={confirmImport} disabled={busy}>Finalize Import</button> : null}
            {step === 5 ? <button type="button" style={modalShell.btn} onClick={handleClose}>Done</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
