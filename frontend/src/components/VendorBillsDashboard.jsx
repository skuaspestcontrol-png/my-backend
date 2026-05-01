import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const taxOptions = [0, 5, 12, 18];

const createLine = () => ({ itemId: '', itemName: '', description: '', quantity: '1', rate: '0', taxRate: '18' });
const createPaymentSplit = () => ({ mode: 'Bank Transfer', amount: '0' });

const emptyForm = {
  vendorId: '',
  vendorName: '',
  billNumber: '',
  date: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  invoiceType: 'GST',
  items: [createLine()],
  subtotal: '0',
  totalTax: '0',
  amount: '0',
  total: '0',
  paymentMadeEnabled: false,
  paymentSplits: [createPaymentSplit()],
  paymentMadeTotal: '0',
  balanceDue: '0',
  notes: ''
};

const shell = {
  page: { background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', overflow: 'visible', position: 'relative' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--color-border)', background: '#fff' },
  title: { margin: 0, fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: '#1f2937' },
  buttonPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', borderRadius: '10px', padding: '9px 14px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' },
  summaryWrap: { padding: '14px 16px', background: '#fff' },
  summaryCard: { border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px 16px', background: '#fbfbfd' },
  summaryTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px', marginTop: '14px' },
  summaryLabel: { color: '#475569', fontSize: '13px', fontWeight: 500 },
  summaryValue: { color: '#111827', fontSize: '30px', fontWeight: 800 },
  tableWrap: { overflowX: 'auto', overflowY: 'hidden', background: '#fff', borderTop: '1px solid #eef2f7', borderRadius: '14px', border: '1px solid var(--color-border)' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: '900px' },
  th: { textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#6b7280', padding: '12px 10px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase' },
  td: { padding: '12px 10px', fontSize: '14px', color: '#111827', borderBottom: '1px solid #eef2f7' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: 'clamp(12px, 3vh, 24px)' },
  modal: { background: '#fff', width: 'min(100%, 1180px)', borderRadius: '24px', border: '1px solid rgba(159, 23, 77, 0.24)', boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '92vh', height: '92vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid rgba(159, 23, 77, 0.16)', fontSize: '28px', fontWeight: 800, color: '#fff', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { margin: 0, fontSize: 'inherit', fontWeight: 800, color: '#fff' },
  closeBtn: { border: 'none', background: 'transparent', color: '#fff', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  formBody: { padding: '18px 22px', overflowY: 'auto', overflowX: 'hidden', display: 'grid', gridAutoRows: 'max-content', alignContent: 'start', gap: '16px', flex: 1, minHeight: 0 },
  row2: { display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', columnGap: '14px', rowGap: '10px', alignItems: 'center' },
  row4: { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 110px minmax(0, 1fr)', columnGap: '14px', rowGap: '12px', alignItems: 'center' },
  label: { fontSize: '13px', color: '#3f3f46', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' },
  input: { border: '1px solid #D1D5DB', borderRadius: '14px', padding: '10px 14px', fontSize: '15px', outline: 'none', width: '100%', minHeight: '48px', boxSizing: 'border-box' },
  textArea: { border: '1px solid #D1D5DB', borderRadius: '14px', padding: '10px 14px', fontSize: '15px', outline: 'none', width: '100%', minHeight: '84px', resize: 'vertical', boxSizing: 'border-box' },
  itemSection: { border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', background: '#fff' },
  itemHead: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', background: '#f8fafc', fontWeight: 800, fontSize: '12px', color: '#334155' },
  itemTableWrap: { width: '100%', overflowX: 'auto' },
  itemTable: { width: '100%', minWidth: '760px', borderCollapse: 'collapse' },
  itemTh: { padding: '8px 10px', borderBottom: '1px solid var(--color-border)', color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' },
  itemTd: { padding: '8px 10px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#111827', verticalAlign: 'top' },
  addRowBtn: { border: '1px solid #c7d2fe', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: '8px', padding: '7px 11px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  iconButton: { border: '1px solid var(--color-border)', borderRadius: '10px', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#475569', cursor: 'pointer' },
  totalsWrap: { marginTop: '8px', marginLeft: 'auto', width: '340px', border: '1px solid var(--color-border)', borderRadius: '10px', background: '#fafafa' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontSize: '12px', color: '#334155', borderBottom: '1px solid var(--color-border)' },
  paymentBlock: { borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  paymentToggle: { display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#1f2937', fontWeight: 700 },
  splitRow: { display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px' },
  modalFooter: { padding: '12px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fff' },
  cancelButton: { border: '1px solid #d1d5db', background: '#fff', color: '#2563eb', borderRadius: '18px', padding: '10px 18px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' },
  saveButton: { border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '18px', padding: '10px 20px', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }
};

const toNum = (v) => Number(v || 0);
const formatINR = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VendorBillsDashboard() {
  const [vendors, setVendors] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);
  const [bills, setBills] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  const isMobile = viewportWidth <= 900;

  const loadData = async () => {
    try {
      const [vendorsRes, billsRes, itemsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/vendors`),
        axios.get(`${API_BASE_URL}/api/vendor-bills`),
        axios.get(`${API_BASE_URL}/api/items`)
      ]);
      setVendors(Array.isArray(vendorsRes.data) ? vendorsRes.data : []);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
      setItemsCatalog(Array.isArray(itemsRes.data) ? itemsRes.data : []);
    } catch (error) {
      console.error('Failed to load vendor bills data', error);
    }
  };

  useEffect(() => {
    loadData();
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const setFormWithTotals = (next) => {
    const rows = Array.isArray(next.items) ? next.items : [];
    const subtotal = rows.reduce((sum, line) => sum + (toNum(line.quantity) * toNum(line.rate)), 0);
    const totalTax = next.invoiceType === 'NON GST'
      ? 0
      : rows.reduce((sum, line) => sum + ((toNum(line.quantity) * toNum(line.rate) * toNum(line.taxRate)) / 100), 0);
    const total = Number((subtotal + totalTax).toFixed(2));
    const paid = next.paymentMadeEnabled
      ? Number((Array.isArray(next.paymentSplits) ? next.paymentSplits : []).reduce((sum, split) => sum + toNum(split.amount), 0).toFixed(2))
      : 0;
    return {
      ...next,
      subtotal: String(Number(subtotal.toFixed(2))),
      totalTax: String(Number(totalTax.toFixed(2))),
      amount: String(total),
      total: String(total),
      paymentMadeTotal: String(paid),
      balanceDue: String(Number(Math.max(total - paid, 0).toFixed(2)))
    };
  };

  const openNew = () => {
    setEditingId('');
    setForm({ ...emptyForm, billNumber: `BILL-${Date.now()}` });
    setSaveError('');
    setShowModal(true);
  };

  const openEdit = (bill) => {
    setEditingId(String(bill?._id || ''));
    const mapped = {
      ...emptyForm,
      ...bill,
      items: Array.isArray(bill?.items) && bill.items.length > 0 ? bill.items : [createLine()],
      paymentSplits: Array.isArray(bill?.paymentSplits) && bill.paymentSplits.length > 0 ? bill.paymentSplits : [createPaymentSplit()]
    };
    setForm(setFormWithTotals(mapped));
    setSaveError('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setShowModal(false);
  };

  const updateForm = (key, value) => setForm((prev) => setFormWithTotals({ ...prev, [key]: value }));

  const updateLine = (index, patch) => setForm((prev) => {
    const items = [...(Array.isArray(prev.items) ? prev.items : [])];
    items[index] = { ...items[index], ...patch };
    return setFormWithTotals({ ...prev, items });
  });

  const applyCatalogItemToLine = (index, selectedId) => {
    const match = itemsCatalog.find((entry) => String(entry?._id || '') === String(selectedId || '').trim());
    updateLine(index, {
      itemId: String(selectedId || '').trim(),
      itemName: String(match?.name || '').trim(),
      description: String(match?.description || '').trim(),
      rate: String(toNum(match?.rate))
    });
  };

  const removeLine = (index) => setForm((prev) => {
    const items = [...(Array.isArray(prev.items) ? prev.items : [])];
    items.splice(index, 1);
    return setFormWithTotals({ ...prev, items: items.length > 0 ? items : [createLine()] });
  });

  const addLine = () => setForm((prev) => setFormWithTotals({ ...prev, items: [...(Array.isArray(prev.items) ? prev.items : []), createLine()] }));

  const updatePaymentSplit = (index, patch) => setForm((prev) => {
    const paymentSplits = [...(Array.isArray(prev.paymentSplits) ? prev.paymentSplits : [createPaymentSplit()])];
    paymentSplits[index] = { ...paymentSplits[index], ...patch };
    return setFormWithTotals({ ...prev, paymentSplits });
  });

  const addPaymentSplit = () => setForm((prev) => setFormWithTotals({ ...prev, paymentSplits: [...(Array.isArray(prev.paymentSplits) ? prev.paymentSplits : []), createPaymentSplit()] }));

  const saveBill = async (event) => {
    event.preventDefault();
    if (!form.vendorId) return setSaveError('Vendor Name is required.');
    if (!String(form.billNumber || '').trim()) return setSaveError('Bill number is required.');
    if (toNum(form.paymentMadeTotal) > toNum(form.total) + 0.0001) return setSaveError('Amount paid cannot be greater than total amount.');
    setSaveError('');
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        vendorName: vendors.find((v) => String(v._id) === String(form.vendorId))?.companyName || form.vendorName || ''
      };
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/vendor-bills/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/vendor-bills`, payload);
      }
      setShowModal(false);
      await loadData();
    } catch (error) {
      setSaveError(error?.response?.data?.error || 'Unable to save vendor bill');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBill = async (billId) => {
    if (!billId) return;
    if (!window.confirm('Delete this vendor bill?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/vendor-bills/${billId}`);
      await loadData();
    } catch (error) {
      window.alert(error?.response?.data?.error || 'Unable to delete bill');
    }
  };

  const summary = useMemo(() => {
    const openAmount = bills.reduce((sum, row) => sum + toNum(row.balanceDue), 0);
    const paidAmount = bills.reduce((sum, row) => sum + toNum(row.paymentMadeTotal), 0);
    return { openAmount, paidAmount, count: bills.length };
  }, [bills]);

  const modalOverlayStyle = isMobile ? { ...shell.modalOverlay, padding: '16px 10px' } : shell.modalOverlay;
  const modalStyle = isMobile
    ? { ...shell.modal, width: 'min(100%, 92vw)', maxHeight: '92dvh', height: '92dvh', borderRadius: '28px', border: '1px solid rgba(159, 23, 77, 0.24)' }
    : shell.modal;
  const formBodyStyle = isMobile ? { ...shell.formBody, padding: '16px 14px', paddingBottom: 'calc(130px + env(safe-area-inset-bottom))' } : shell.formBody;
  const row2Style = isMobile ? { ...shell.row2, gridTemplateColumns: '1fr' } : shell.row2;
  const row4Style = isMobile ? { ...shell.row4, gridTemplateColumns: '1fr' } : shell.row4;
  const modalHeaderStyle = isMobile ? { ...shell.modalHeader, fontSize: '22px', padding: '14px 16px' } : shell.modalHeader;
  const itemTableWrapStyle = isMobile ? { ...shell.itemTableWrap, overflowX: 'hidden' } : shell.itemTableWrap;
  const itemTableStyle = isMobile ? { ...shell.itemTable, minWidth: '0', width: '100%' } : shell.itemTable;
  const mobileItemGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' };

  return (
    <section style={shell.page}>
      <div style={shell.topbar}>
        <h1 style={shell.title}>Vendor Bills</h1>
        <button type="button" style={shell.buttonPrimary} onClick={openNew}><Plus size={16} />New Bill</button>
      </div>

      <div style={shell.summaryWrap}>
        <div style={shell.summaryCard}>
          <h3 style={shell.summaryTitle}>Vendor Bills Summary</h3>
          <div style={isMobile ? { ...shell.summaryGrid, gridTemplateColumns: '1fr' } : shell.summaryGrid}>
            <div><span style={shell.summaryLabel}>Total Vendor Bills</span><div style={shell.summaryValue}>{summary.count}</div></div>
            <div><span style={shell.summaryLabel}>Total Paid</span><div style={shell.summaryValue}>{formatINR(summary.paidAmount)}</div></div>
            <div><span style={shell.summaryLabel}>Outstanding</span><div style={shell.summaryValue}>{formatINR(summary.openAmount)}</div></div>
          </div>
        </div>
      </div>

      <div style={shell.tableWrap}>
        <table style={shell.table}>
          <thead>
            <tr>
              <th style={shell.th}>Date</th>
              <th style={shell.th}>Bill Number</th>
              <th style={shell.th}>Vendor Name</th>
              <th style={shell.th}>Due Date</th>
              <th style={shell.th}>Amount</th>
              <th style={shell.th}>Balance Due</th>
              <th style={shell.th}>Status</th>
              <th style={shell.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill._id}>
                <td style={shell.td}>{bill.date || '-'}</td>
                <td style={shell.td}>{bill.billNumber || '-'}</td>
                <td style={shell.td}>{bill.vendorName || '-'}</td>
                <td style={shell.td}>{bill.dueDate || '-'}</td>
                <td style={shell.td}>{formatINR(bill.total || bill.amount || 0)}</td>
                <td style={shell.td}>{formatINR(bill.balanceDue || 0)}</td>
                <td style={shell.td}>{String(bill.status || 'OPEN').toUpperCase()}</td>
                <td style={shell.td}>
                  <button type="button" style={shell.iconButton} onClick={() => openEdit(bill)}><Plus size={14} /></button>
                  <button type="button" style={shell.iconButton} onClick={() => deleteBill(bill._id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {bills.length === 0 ? <tr><td style={shell.td} colSpan={8}>No vendor bills found.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {showModal ? createPortal(
        <div style={modalOverlayStyle} onClick={closeModal}>
          <form style={modalStyle} onSubmit={saveBill} onClick={(event) => event.stopPropagation()}>
            <div style={modalHeaderStyle}><h3 style={shell.headerTitle}>{editingId ? 'Edit Vendor Bill' : 'New Vendor Bill'}</h3><button type="button" style={shell.closeBtn} onClick={closeModal}><X size={24} /></button></div>
            <div style={formBodyStyle}>
              <div style={row2Style}>
                <label style={shell.label}>Vendor Name*</label>
                <select style={shell.input} value={form.vendorId} onChange={(e) => updateForm('vendorId', e.target.value)}>
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => <option key={v._id} value={v._id}>{v.companyName}</option>)}
                </select>
              </div>

              <div style={row4Style}>
                <label style={shell.label}>Bill Number*</label>
                <input style={shell.input} value={form.billNumber} onChange={(e) => updateForm('billNumber', e.target.value)} />
                <label style={shell.label}>Date</label>
                <input type="date" style={shell.input} value={form.date} onChange={(e) => updateForm('date', e.target.value)} />
                <label style={shell.label}>Due Date</label>
                <input type="date" style={shell.input} value={form.dueDate} onChange={(e) => updateForm('dueDate', e.target.value)} />
                <label style={shell.label}>Bill Type</label>
                <select style={shell.input} value={form.invoiceType} onChange={(e) => updateForm('invoiceType', e.target.value)}>
                  <option value="GST">GST Bill</option>
                  <option value="NON GST">Non GST Bill</option>
                </select>
              </div>

              <div style={shell.itemSection}>
                <div style={shell.itemHead}>Item Table</div>
                <div style={itemTableWrapStyle}>
                  <table style={itemTableStyle}>
                    <thead>
                      {isMobile ? (
                        <tr>
                          <th style={shell.itemTh}>Item Details</th>
                        </tr>
                      ) : (
                        <tr>
                          <th style={shell.itemTh}>Item Details</th>
                          <th style={shell.itemTh}>Quantity</th>
                          <th style={shell.itemTh}>Rate</th>
                          <th style={shell.itemTh}>Tax</th>
                          <th style={shell.itemTh}>Amount</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {form.items.map((line, index) => {
                        const amount = toNum(line.quantity) * toNum(line.rate);
                        return (
                          <tr key={`line-${index}`}>
                            <td style={shell.itemTd}>
                              <div style={{ display: 'grid', gap: '8px' }}>
                                <select
                                  style={shell.input}
                                  value={line.itemId || ''}
                                  onChange={(e) => applyCatalogItemToLine(index, e.target.value)}
                                >
                                  <option value="">Select item</option>
                                  {itemsCatalog.map((item) => (
                                    <option key={item._id} value={item._id}>{item.name || item._id}</option>
                                  ))}
                                </select>
                                <input style={shell.input} value={line.itemName} placeholder="Item name" onChange={(e) => updateLine(index, { itemName: e.target.value })} />
                                <textarea style={shell.textArea} value={line.description} placeholder="Description" onChange={(e) => updateLine(index, { description: e.target.value })} />
                                {isMobile ? (
                                  <>
                                    <div style={mobileItemGridStyle}>
                                      <input style={shell.input} type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} placeholder="Quantity" />
                                      <input style={shell.input} type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} placeholder="Rate" />
                                    </div>
                                    <div style={mobileItemGridStyle}>
                                      <select style={shell.input} value={line.taxRate} onChange={(e) => updateLine(index, { taxRate: e.target.value })} disabled={form.invoiceType === 'NON GST'}>
                                        {(form.invoiceType === 'NON GST' ? [0] : taxOptions).map((tax) => <option key={tax} value={String(tax)}>{tax}%</option>)}
                                      </select>
                                      <div style={{ ...shell.input, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <strong>{formatINR(amount)}</strong>
                                        <button type="button" style={shell.iconButton} onClick={() => removeLine(index)}><Trash2 size={14} /></button>
                                      </div>
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </td>
                            {!isMobile ? (
                              <>
                                <td style={shell.itemTd}><input style={shell.input} type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} /></td>
                                <td style={shell.itemTd}><input style={shell.input} type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} /></td>
                                <td style={shell.itemTd}><select style={shell.input} value={line.taxRate} onChange={(e) => updateLine(index, { taxRate: e.target.value })} disabled={form.invoiceType === 'NON GST'}>{(form.invoiceType === 'NON GST' ? [0] : taxOptions).map((tax) => <option key={tax} value={String(tax)}>{tax}%</option>)}</select></td>
                                <td style={{ ...shell.itemTd, fontWeight: 700 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>{formatINR(amount)}</span>
                                    <button type="button" style={shell.iconButton} onClick={() => removeLine(index)}><Trash2 size={14} /></button>
                                  </div>
                                </td>
                              </>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div><button type="button" style={shell.addRowBtn} onClick={addLine}>Add New Row</button></div>

              <div style={shell.totalsWrap}>
                <div style={shell.totalRow}><span>Sub Total</span><strong>{formatINR(form.subtotal)}</strong></div>
                <div style={shell.totalRow}><span>Tax</span><strong>{formatINR(form.totalTax)}</strong></div>
                <div style={shell.totalRow}><span>Total</span><strong>{formatINR(form.total)}</strong></div>
                <div style={shell.totalRow}><span>Balance</span><strong>{formatINR(form.balanceDue)}</strong></div>
              </div>

              <div style={shell.paymentBlock}>
                <label style={shell.paymentToggle}><input type="checkbox" checked={Boolean(form.paymentMadeEnabled)} onChange={(e) => updateForm('paymentMadeEnabled', e.target.checked)} /> I have made the payment</label>
                {form.paymentMadeEnabled ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(Array.isArray(form.paymentSplits) ? form.paymentSplits : []).map((split, index) => (
                      <div key={`split-${index}`} style={shell.splitRow}>
                        <input style={shell.input} value={split.mode || ''} onChange={(e) => updatePaymentSplit(index, { mode: e.target.value })} placeholder="Mode" />
                        <input style={shell.input} type="number" min="0" step="0.01" value={split.amount || '0'} onChange={(e) => updatePaymentSplit(index, { amount: e.target.value })} placeholder="Amount" />
                      </div>
                    ))}
                    <div><button type="button" style={shell.addRowBtn} onClick={addPaymentSplit}>Add Split Payment</button></div>
                  </div>
                ) : null}
              </div>

              <div style={row2Style}>
                <label style={shell.label}>Notes</label>
                <textarea style={shell.textArea} value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} />
              </div>
            </div>
            <div style={shell.modalFooter}>
              {saveError ? <div style={{ marginRight: 'auto', fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>{saveError}</div> : null}
              <button type="button" style={shell.cancelButton} onClick={closeModal}>Cancel</button>
              <button type="submit" style={shell.saveButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Bill'}</button>
            </div>
          </form>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
