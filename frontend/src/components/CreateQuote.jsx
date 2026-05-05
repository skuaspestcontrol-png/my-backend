import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const tabs = ['Customer Details', 'Quotation Details', 'Services', 'Recommendation Table', 'Pricing', 'Terms & Preview'];

const makeItem = () => ({
  service_template_id: '',
  service_name: '',
  service_code: '',
  pest_name: '',
  service_title: '',
  about_pest: '',
  what_we_do: '',
  treatment_points: '',
  infestation_level: '',
  infestation_image_url: '',
  frequency: '',
  recommendation: '',
  area_covered: '',
  quantity: 1,
  rate_without_gst: 0,
  gst_percentage: 18,
  gst_amount: 0,
  rate_with_gst: 0,
  total_amount: 0,
  contract_start_date: '',
  contract_end_date: ''
});

const input = { width: '100%', minHeight: 40, borderRadius: 10, border: '1px solid var(--border)', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' };

const today = () => new Date().toISOString().slice(0, 10);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => `₹ ${num(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CreateQuote() {
  const [active, setActive] = useState(0);
  const [leadRows, setLeadRows] = useState([]);
  const [customerRows, setCustomerRows] = useState([]);
  const [services, setServices] = useState([]);
  const [levels, setLevels] = useState([]);
  const [prefixSettings, setPrefixSettings] = useState({});
  const [commonParagraphs, setCommonParagraphs] = useState({});
  const [templateSettings, setTemplateSettings] = useState({});
  const [status, setStatus] = useState('');
  const [savedId, setSavedId] = useState(null);

  const [form, setForm] = useState({
    source_type: 'Manual',
    lead_id: '',
    customer_id: '',
    customer_name: '',
    company_name: '',
    address: '',
    phone: '',
    whatsapp: '',
    email: '',
    gstin: '',
    quotation_date: today(),
    quotation_number: '',
    validity_days: 15,
    prepared_by: '',
    sales_person: '',
    designation: '',
    mobile: '',
    contract_start_date: '',
    contract_end_date: '',
    round_off: 0,
    rate_type: 'With GST',
    status: 'Draft',
    opening_paragraph: '',
    payment_terms: '',
    warranty_note: '',
    disclaimer: '',
    closing_paragraph: '',
    internal_note: ''
  });

  const [items, setItems] = useState([makeItem()]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [leadRes, customerRes, serviceRes, levelRes, prefixRes, commonRes, templateRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/leads`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/customers`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/settings/quotation-services`),
        axios.get(`${API_BASE_URL}/api/settings/infestation-levels`),
        axios.get(`${API_BASE_URL}/api/settings/quotation-prefixes`),
        axios.get(`${API_BASE_URL}/api/settings/quotation-common-paragraphs`),
        axios.get(`${API_BASE_URL}/api/settings/quotation-template`)
      ]);
      if (!mounted) return;
      setLeadRows(Array.isArray(leadRes.data) ? leadRes.data : []);
      setCustomerRows(Array.isArray(customerRes.data) ? customerRes.data : []);
      setServices(Array.isArray(serviceRes.data) ? serviceRes.data.filter((s) => Number(s.is_active || 0) === 1) : []);
      setLevels(Array.isArray(levelRes.data) ? levelRes.data.filter((s) => Number(s.is_active || 0) === 1) : []);
      setPrefixSettings(prefixRes.data || {});
      setCommonParagraphs(commonRes.data || {});
      setTemplateSettings(templateRes.data || {});
      setForm((p) => ({
        ...p,
        prepared_by: p.prepared_by || templateRes.data?.default_sales_person || '',
        sales_person: p.sales_person || templateRes.data?.default_sales_person || '',
        designation: p.designation || templateRes.data?.default_designation || '',
        mobile: p.mobile || templateRes.data?.default_mobile || '',
        opening_paragraph: p.opening_paragraph || commonRes.data?.opening_paragraph || '',
        payment_terms: p.payment_terms || commonRes.data?.payment_terms || '',
        warranty_note: p.warranty_note || commonRes.data?.warranty_paragraph || '',
        disclaimer: p.disclaimer || commonRes.data?.disclaimer_paragraph || '',
        closing_paragraph: p.closing_paragraph || commonRes.data?.closing_paragraph || commonRes.data?.relationship_closing_paragraph || ''
      }));
    };
    load().catch(() => setStatus('Could not load quotation dependencies'));
    return () => {
      mounted = false;
    };
  }, []);

  const updateItem = (idx, patch) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[idx], ...patch };
      const qty = num(row.quantity);
      const rateWithout = num(row.rate_without_gst);
      const gstPct = num(row.gst_percentage);
      const gstAmt = ((qty * rateWithout) * gstPct) / 100;
      const rateWith = rateWithout + ((rateWithout * gstPct) / 100);
      row.gst_amount = Number(gstAmt.toFixed(2));
      row.rate_with_gst = Number(rateWith.toFixed(2));
      row.total_amount = Number((qty * (form.rate_type === 'With GST' ? row.rate_with_gst : rateWithout)).toFixed(2));
      next[idx] = row;
      return next;
    });
  };

  const selectServiceTemplate = (idx, templateId) => {
    const t = services.find((s) => Number(s.id) === Number(templateId));
    if (!t) return;
    const level = levels.find((l) => String(l.level_name || '').toLowerCase() === String(t.default_infestation_level || '').toLowerCase());
    updateItem(idx, {
      service_template_id: t.id,
      service_name: t.service_name,
      service_code: t.service_code,
      pest_name: t.pest_name,
      service_title: t.quotation_title,
      about_pest: t.about_pest,
      what_we_do: t.what_we_do,
      treatment_points: t.treatment_points,
      infestation_level: t.default_infestation_level,
      infestation_image_url: level?.image_url || '',
      frequency: t.default_frequency,
      recommendation: t.default_recommendation,
      gst_percentage: num(t.default_gst_percentage || 18),
      rate_without_gst: num(t.default_rate_without_gst || 0),
      rate_with_gst: num(t.default_rate_with_gst || 0)
    });
  };

  const subtotalWithout = useMemo(() => items.reduce((sum, i) => sum + (num(i.quantity) * num(i.rate_without_gst)), 0), [items]);
  const gstTotal = useMemo(() => items.reduce((sum, i) => sum + num(i.gst_amount), 0), [items]);
  const grandTotal = useMemo(() => Number((subtotalWithout + gstTotal + num(form.round_off)).toFixed(2)), [subtotalWithout, gstTotal, form.round_off]);

  const quotationPreview = useMemo(() => {
    const year = String(prefixSettings.financial_year || new Date().getFullYear());
    const pref = String(prefixSettings.prefix || 'SPC/');
    const next = String(prefixSettings.next_number || 1).padStart(Number(prefixSettings.padding_digits || 4), '0');
    const code = String(items[0]?.service_code || 'GEN');
    return `${pref}${year}/${code}/${next}`;
  }, [prefixSettings, items]);

  const selectLead = (leadId) => {
    const lead = leadRows.find((l) => String(l._id || l.id || '') === String(leadId));
    if (!lead) return;
    setForm((p) => ({
      ...p,
      source_type: 'Lead',
      lead_id: String(lead._id || lead.id || ''),
      customer_name: lead.customerName || '',
      company_name: lead.companyName || '',
      address: lead.address || '',
      phone: lead.mobileNumber || lead.mobile || '',
      whatsapp: lead.whatsappNumber || '',
      email: lead.emailId || lead.email || '',
      gstin: lead.gstin || '',
      quotation_number: ''
    }));
  };

  const selectCustomer = (customerId) => {
    const c = customerRows.find((l) => String(l._id || l.id || '') === String(customerId));
    if (!c) return;
    setForm((p) => ({
      ...p,
      source_type: 'Customer',
      customer_id: String(c._id || c.id || ''),
      customer_name: c.customerName || c.name || '',
      company_name: c.companyName || '',
      address: c.billingAddress || c.address || '',
      phone: c.mobileNumber || c.mobile || '',
      whatsapp: c.whatsappNumber || '',
      email: c.emailId || c.email || '',
      gstin: c.gstNumber || c.gstin || '',
      quotation_number: ''
    }));
  };

  const saveQuotation = async (mode = 'Draft') => {
    try {
      setStatus('Saving quotation...');
      const payload = {
        ...form,
        status: mode,
        quotation_number: form.quotation_number || '',
        subtotal_without_gst: Number(subtotalWithout.toFixed(2)),
        gst_total: Number(gstTotal.toFixed(2)),
        grand_total: grandTotal,
        amount_in_words: `${grandTotal.toLocaleString('en-IN')} Rupees Only`,
        items
      };
      const res = await axios.post(`${API_BASE_URL}/api/quotations`, payload);
      setSavedId(res.data?.id || null);
      setForm((p) => ({ ...p, quotation_number: res.data?.quotation_number || p.quotation_number }));
      setStatus(`Quotation saved${res.data?.quotation_number ? `: ${res.data.quotation_number}` : ''}`);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Failed to save quotation');
    }
  };

  const openPdf = () => {
    if (!savedId) {
      setStatus('Save quotation first to preview/download PDF');
      return;
    }
    window.open(`${API_BASE_URL}/api/quotations/${savedId}/pdf`, '_blank');
  };

  return (
    <section style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text)' }}>Create Quotation</h2>
        <div style={{ fontWeight: 800, color: 'var(--sky-deep)' }}>Preview Number: {form.quotation_number || quotationPreview}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((tab, idx) => (
          <button key={tab} type="button" onClick={() => setActive(idx)} style={{ minHeight: 36, borderRadius: 999, border: idx === active ? '1px solid var(--sky-deep)' : '1px solid var(--border)', background: idx === active ? 'rgba(159,23,77,0.08)' : '#fff', fontWeight: 700 }}>{tab}</button>
        ))}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: '#fff', padding: 12, display: 'grid', gap: 10 }}>
        {active === 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Source</p><select style={input} value={form.source_type} onChange={(e) => setForm((p) => ({ ...p, source_type: e.target.value }))}><option>Manual</option><option>Lead</option><option>Customer</option></select></div>
              <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Search Lead</p><select style={input} value={form.lead_id} onChange={(e) => selectLead(e.target.value)}><option value="">Select lead</option>{leadRows.map((l) => <option key={l._id || l.id} value={l._id || l.id}>{l.customerName || l.mobileNumber || l._id}</option>)}</select></div>
              <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Search Customer</p><select style={input} value={form.customer_id} onChange={(e) => selectCustomer(e.target.value)}><option value="">Select customer</option>{customerRows.map((c) => <option key={c._id || c.id} value={c._id || c.id}>{c.customerName || c.name || c.mobileNumber}</option>)}</select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {['customer_name','company_name','address','phone','whatsapp','email','gstin'].map((key) => (
                <div key={key} style={key === 'address' ? { gridColumn: '1 / span 3' } : {}}><p style={{ margin: '0 0 6px', fontWeight: 700, textTransform: 'capitalize' }}>{key.replaceAll('_', ' ')}</p>{key === 'address' ? <textarea style={{ ...input, minHeight: 58 }} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} /> : <input style={input} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />}</div>
              ))}
            </div>
          </>
        )}

        {active === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Quotation Date</p><input type="date" style={input} value={form.quotation_date || ''} onChange={(e) => setForm((p) => ({ ...p, quotation_date: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Quotation Number</p><input style={input} value={form.quotation_number || ''} placeholder={quotationPreview} onChange={(e) => setForm((p) => ({ ...p, quotation_number: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Validity Days</p><input type="number" style={input} value={form.validity_days || 15} onChange={(e) => setForm((p) => ({ ...p, validity_days: Number(e.target.value) || 1 }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Prepared By</p><input style={input} value={form.prepared_by || ''} onChange={(e) => setForm((p) => ({ ...p, prepared_by: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Sales Person</p><input style={input} value={form.sales_person || ''} onChange={(e) => setForm((p) => ({ ...p, sales_person: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Designation</p><input style={input} value={form.designation || ''} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Mobile</p><input style={input} value={form.mobile || ''} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Rate Type</p><select style={input} value={form.rate_type || 'With GST'} onChange={(e) => setForm((p) => ({ ...p, rate_type: e.target.value }))}><option>With GST</option><option>Without GST</option></select></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Contract Start Date</p><input type="date" style={input} value={form.contract_start_date || ''} onChange={(e) => setForm((p) => ({ ...p, contract_start_date: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Contract End Date</p><input type="date" style={input} value={form.contract_end_date || ''} onChange={(e) => setForm((p) => ({ ...p, contract_end_date: e.target.value }))} /></div>
          </div>
        )}

        {active === 2 && (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item, idx) => (
              <div key={`item-${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><p style={{ margin: 0, fontWeight: 800 }}>Service #{idx + 1}</p>{items.length > 1 ? <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>Remove</button> : null}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Service Template</p><select style={input} value={item.service_template_id || ''} onChange={(e) => selectServiceTemplate(idx, e.target.value)}><option value="">Select service</option>{services.map((s) => <option key={s.id} value={s.id}>{s.service_name}</option>)}</select></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Service Title</p><input style={input} value={item.service_title || ''} onChange={(e) => updateItem(idx, { service_title: e.target.value })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Pest Name</p><input style={input} value={item.pest_name || ''} onChange={(e) => updateItem(idx, { pest_name: e.target.value })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Frequency</p><input style={input} value={item.frequency || ''} onChange={(e) => updateItem(idx, { frequency: e.target.value })} /></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>About Pest</p><textarea style={{ ...input, minHeight: 64 }} value={item.about_pest || ''} onChange={(e) => updateItem(idx, { about_pest: e.target.value })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>What We Do</p><textarea style={{ ...input, minHeight: 64 }} value={item.what_we_do || ''} onChange={(e) => updateItem(idx, { what_we_do: e.target.value })} /></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Infestation Level</p><select style={input} value={item.infestation_level || ''} onChange={(e) => {
                    const l = levels.find((r) => String(r.level_name || '') === String(e.target.value));
                    updateItem(idx, { infestation_level: e.target.value, infestation_image_url: l?.image_url || '' });
                  }}><option value="">Select</option>{levels.map((l) => <option key={l.id} value={l.level_name}>{l.level_name}</option>)}</select></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Area Covered</p><input style={input} value={item.area_covered || ''} onChange={(e) => updateItem(idx, { area_covered: e.target.value })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Qty</p><input type="number" style={input} value={item.quantity || 1} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Rate Without GST</p><input type="number" style={input} value={item.rate_without_gst || 0} onChange={(e) => updateItem(idx, { rate_without_gst: Number(e.target.value) || 0 })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>GST %</p><input type="number" style={input} value={item.gst_percentage || 0} onChange={(e) => updateItem(idx, { gst_percentage: Number(e.target.value) || 0 })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Total Amount</p><input style={input} readOnly value={money(item.total_amount || 0)} /></div>
                </div>

                <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Recommendation</p><textarea style={{ ...input, minHeight: 56 }} value={item.recommendation || ''} onChange={(e) => updateItem(idx, { recommendation: e.target.value })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Contract Start Date</p><input type="date" style={input} value={item.contract_start_date || form.contract_start_date || ''} onChange={(e) => updateItem(idx, { contract_start_date: e.target.value })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Contract End Date</p><input type="date" style={input} value={item.contract_end_date || form.contract_end_date || ''} onChange={(e) => updateItem(idx, { contract_end_date: e.target.value })} /></div>
                </div>
              </div>
            ))}

            <button type="button" onClick={() => setItems((prev) => [...prev, makeItem()])}>+ Add Service</button>
          </div>
        )}

        {active === 3 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Sr No', 'Service', 'Infestation Level', 'Image', 'Recommendation/Suggestion'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={`rec-${idx}`}>
                    <td style={{ padding: 8 }}>{idx + 1}</td>
                    <td style={{ padding: 8 }}>{item.service_name || '-'}</td>
                    <td style={{ padding: 8 }}>{item.infestation_level || '-'}</td>
                    <td style={{ padding: 8 }}>
                      {item.infestation_image_url ? <img src={item.infestation_image_url} alt="infestation" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 8 }} /> : '-'}
                    </td>
                    <td style={{ padding: 8 }}><textarea style={{ ...input, minHeight: 54 }} value={item.recommendation || ''} onChange={(e) => updateItem(idx, { recommendation: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {active === 4 && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Subtotal (Without GST)</p><input style={input} readOnly value={money(subtotalWithout)} /></div>
              <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>GST Total</p><input style={input} readOnly value={money(gstTotal)} /></div>
              <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Round Off</p><input type="number" style={input} value={form.round_off || 0} onChange={(e) => setForm((p) => ({ ...p, round_off: Number(e.target.value) || 0 }))} /></div>
              <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Grand Total</p><input style={input} readOnly value={money(grandTotal)} /></div>
            </div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Amount in Words</p><input style={input} readOnly value={`${grandTotal.toLocaleString('en-IN')} Rupees Only`} /></div>
          </div>
        )}

        {active === 5 && (
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['opening_paragraph', 'Opening Paragraph'],
              ['payment_terms', 'Payment Terms'],
              ['warranty_note', 'Warranty Note'],
              ['disclaimer', 'Disclaimer'],
              ['closing_paragraph', 'Closing Paragraph'],
              ['internal_note', 'Internal Note']
            ].map(([key, label]) => (
              <div key={key}><p style={{ margin: '0 0 6px', fontWeight: 700 }}>{label}</p><textarea style={{ ...input, minHeight: 60 }} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} /></div>
            ))}

            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 800 }}>PDF Style Preview (from Quotation Template settings)</p>
              <p style={{ margin: 0 }}>Company: {templateSettings.company_name || '-'}</p>
              <p style={{ margin: 0 }}>Logo Alignment: {templateSettings.header_alignment || '-'}</p>
              <p style={{ margin: 0 }}>Primary Color: {templateSettings.primary_color || '-'}</p>
              <p style={{ margin: 0 }}>Font: {templateSettings.font_family || '-'}</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, color: status.toLowerCase().includes('failed') || status.toLowerCase().includes('could not') ? '#dc2626' : '#2563eb', fontWeight: 700 }}>{status}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => saveQuotation('Draft')}>Save Draft</button>
          <button type="button" onClick={() => saveQuotation('Final')}>Save Quotation</button>
          <button type="button" onClick={openPdf}>Preview / Download PDF</button>
        </div>
      </div>
    </section>
  );
}
