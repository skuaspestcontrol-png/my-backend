import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation, useSearchParams } from 'react-router-dom';
import { normalizeIndianMobileNumber } from '../utils/phone';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const QUOTATION_RECOMMENDATION_DEFAULT_KEY = 'quotation_default_recommendation';

const tabs = ['Customer Details', 'Quotation Details', 'Services', 'Recommendation Table', 'Pricing', 'Terms & Preview'];

const getStoredRecommendationDefault = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(QUOTATION_RECOMMENDATION_DEFAULT_KEY) || '';
};

const saveStoredRecommendationDefault = (value) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QUOTATION_RECOMMENDATION_DEFAULT_KEY, value || '');
};

const makeItem = (recommendationDefault = getStoredRecommendationDefault()) => ({
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
  recommendation: recommendationDefault,
  area_covered: '',
  quantity: 1,
  rate_without_gst: 0,
  gst_percentage: 18,
  gst_amount: 0,
  rate_with_gst: 0,
  total_amount: 0
});

const input = { width: '100%', minHeight: 40, borderRadius: 11, border: '1px solid var(--border)', padding: '0 12px', fontSize: 14, boxSizing: 'border-box' };
const label = { margin: '0 0 6px', fontWeight: 600, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--muted)' };
const buttonBase = {
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  cursor: 'pointer'
};
const btnPrimary = { ...buttonBase, border: '1px solid var(--sky-deep)', background: 'var(--sky-deep)', color: '#fff' };
const btnGhost = { ...buttonBase, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)' };
const btnDanger = { ...buttonBase, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c' };
const panel = { border: '1px solid var(--border)', borderRadius: 14, background: '#fff', padding: 12, display: 'grid', gap: 10, boxShadow: 'var(--shadow-sm)' };

const today = () => new Date().toISOString().slice(0, 10);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parsePercent = (value, fallback = 18) => {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const getItemServiceName = (item = {}) => (
  item.serviceName
  || item.service_name
  || item.serviceType
  || item.service_type
  || item.name
  || item.itemName
  || ''
).trim();

const getItemField = (item = {}, ...keys) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const money = (v) => `₹ ${num(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CreateQuote() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id') || '';
  const isEditMode = Boolean(editId);
  const leadPrefill = location.state?.lead || null;
  const [active, setActive] = useState(0);
  const [leadRows, setLeadRows] = useState([]);
  const [customerRows, setCustomerRows] = useState([]);
  const [employeeRows, setEmployeeRows] = useState([]);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [levels, setLevels] = useState([]);
  const [prefixSettings, setPrefixSettings] = useState({});
  const [commonParagraphs, setCommonParagraphs] = useState({});
  const [premiseRows, setPremiseRows] = useState([]);
  const [status, setStatus] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [recommendationDefault, setRecommendationDefault] = useState(getStoredRecommendationDefault);
  const [termsEditable, setTermsEditable] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth));

  const [form, setForm] = useState({
    source_type: 'Manual',
    lead_id: '',
    customer_id: '',
    customer_name: '',
    company_name: '',
    address: '',
    customer_premise_id: '',
    premise_label: '',
    premise_address: '',
    premise_area_name: '',
    premise_city: '',
    premise_state: '',
    premise_pincode: '',
    premise_google_map_url: '',
    phone: '',
    whatsapp: '',
    email: '',
    gstNumber: '',
    quotation_date: today(),
    quotation_number: '',
    validity_days: 15,
    prepared_by: '',
    sales_person_employee_id: '',
    sales_person: '',
    designation: '',
    mobile: '',
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
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!leadPrefill || isEditMode) return;
    const customerName = String(leadPrefill.customerName || '').trim();
    const companyName = String(leadPrefill.companyName || leadPrefill.customerName || '').trim();
    const address = String(leadPrefill.address || '').trim();
    const mobileNumber = normalizeIndianMobileNumber(leadPrefill.mobileNumber || leadPrefill.mobile || '');
    const whatsappNumber = normalizeIndianMobileNumber(leadPrefill.whatsappNumber || mobileNumber || '');
    const emailId = String(leadPrefill.emailId || leadPrefill.email || '').trim();
    const gstNumber = String(leadPrefill.gstNumber || leadPrefill.gstin || '').trim();
    const leadId = String(leadPrefill._id || leadPrefill.id || '').trim();
    const assignedTo = String(leadPrefill.assignedTo || '').trim();
    setForm((prev) => ({
      ...prev,
      source_type: 'Lead',
      lead_id: leadId,
      customer_id: '',
      customer_name: customerName || prev.customer_name,
      company_name: companyName || prev.company_name,
      address: address || prev.address,
      premise_city: String(leadPrefill.city || '').trim() || prev.premise_city,
      premise_state: String(leadPrefill.state || '').trim() || prev.premise_state,
      premise_pincode: String(leadPrefill.pincode || leadPrefill.pinCode || leadPrefill.postalCode || leadPrefill.postal_code || leadPrefill.zip || '').trim() || prev.premise_pincode,
      phone: mobileNumber || prev.phone,
      whatsapp: whatsappNumber || prev.whatsapp,
      email: emailId || prev.email,
      gstNumber: gstNumber || prev.gstNumber,
      prepared_by: assignedTo && assignedTo !== 'Unassigned' ? assignedTo : prev.prepared_by,
      sales_person: assignedTo && assignedTo !== 'Unassigned' ? assignedTo : prev.sales_person
    }));
  }, [leadPrefill, isEditMode]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [leadRes, customerRes, employeeRes, itemRes, levelRes, prefixRes, commonRes, templateRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/leads`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/customers`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/employees`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/items`),
        axios.get(`${API_BASE_URL}/api/settings/infestation-levels`),
        axios.get(`${API_BASE_URL}/api/settings/quotation-prefixes`),
        axios.get(`${API_BASE_URL}/api/settings/quotation-common-paragraphs`),
        axios.get(`${API_BASE_URL}/api/settings/quotation-template`)
      ]);
      if (!mounted) return;
      setLeadRows(Array.isArray(leadRes.data) ? leadRes.data : []);
      setCustomerRows(Array.isArray(customerRes.data) ? customerRes.data : []);
      setEmployeeRows(Array.isArray(employeeRes.data) ? employeeRes.data : []);
      setServiceCatalog(Array.isArray(itemRes.data)
        ? itemRes.data.filter((item) => item.sellable !== false && String(item.itemType || item.item_type || 'service').toLowerCase() === 'service')
        : []);
      setLevels(Array.isArray(levelRes.data) ? levelRes.data.filter((s) => Number(s.is_active || 0) === 1) : []);
      setPrefixSettings(prefixRes.data || {});
      setCommonParagraphs(commonRes.data || {});
      setForm((p) => ({
        ...p,
        prepared_by: p.prepared_by || templateRes.data?.default_sales_person || '',
        sales_person: p.sales_person || templateRes.data?.default_sales_person || '',
        designation: p.designation || templateRes.data?.default_designation || '',
        mobile: p.mobile || templateRes.data?.default_mobile || '',
        opening_paragraph: isEditMode ? p.opening_paragraph : (p.opening_paragraph || commonRes.data?.opening_paragraph || ''),
        payment_terms: isEditMode ? p.payment_terms : (p.payment_terms || commonRes.data?.payment_terms || ''),
        closing_paragraph: isEditMode ? p.closing_paragraph : (p.closing_paragraph || commonRes.data?.closing_paragraph || commonRes.data?.relationship_closing_paragraph || '')
      }));
    };
    load().catch(() => setStatus('Could not load quotation dependencies'));
    return () => {
      mounted = false;
    };
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) return;
    let mounted = true;
    const loadQuotation = async () => {
      try {
        setStatus('Loading quotation...');
        const res = await axios.get(`${API_BASE_URL}/api/quotations/${editId}`);
        if (!mounted) return;
        const data = res.data || {};
        setSavedId(data.id || Number(editId));
        setForm((prev) => ({
          ...prev,
          ...data,
          quotation_date: data.quotation_date ? String(data.quotation_date).slice(0, 10) : prev.quotation_date
        }));
        setItems(Array.isArray(data.items) && data.items.length ? data.items : [makeItem()]);
        setStatus('Quotation loaded');
      } catch (error) {
        setStatus(error?.response?.data?.error || 'Failed to load quotation');
      }
    };
    loadQuotation();
    return () => {
      mounted = false;
    };
  }, [editId, isEditMode]);

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

  const updateRecommendation = (idx, value) => {
    updateItem(idx, { recommendation: value });
    setRecommendationDefault(value);
    saveStoredRecommendationDefault(value);
  };

  const selectServiceTemplate = (idx, itemId) => {
    const selected = serviceCatalog.find((entry) => String(entry._id || '') === String(itemId || ''));
    if (!selected) return;
    const defaultLevel = getItemField(selected, 'default_infestation_level', 'infestationLevel');
    const level = levels.find((l) => String(l.level_name || '').toLowerCase() === String(defaultLevel).toLowerCase());
    const taxRate = parsePercent(getItemField(selected, 'intraTaxRate', 'taxRate', 'gstRate') || '18%');
    const rate = num(selected.sellingPrice ?? selected.rate ?? 0);
    const description = getItemField(selected, 'serviceDescription', 'salesDescription', 'description');
    const aboutPest = getItemField(selected, 'aboutPest', 'about_pest') || description;
    const whatWeDo = getItemField(selected, 'whatWeDo', 'what_we_do', 'treatmentMethod') || description;
    const defaultRecommendation = recommendationDefault || getItemField(selected, 'recommendation') || description;
    const serviceName = getItemServiceName(selected);
    updateItem(idx, {
      service_template_id: selected._id,
      service_name: serviceName,
      service_code: getItemField(selected, 'hsnSac', 'sac', '_id'),
      pest_name: getItemField(selected, 'pestsCovered', 'pests_covered'),
      service_title: getItemField(selected, 'serviceTitle', 'service_title') || serviceName,
      about_pest: aboutPest,
      what_we_do: whatWeDo,
      treatment_points: whatWeDo,
      infestation_level: defaultLevel,
      infestation_image_url: level?.image_url || '',
      frequency: getItemField(selected, 'frequency'),
      recommendation: defaultRecommendation,
      gst_percentage: taxRate,
      rate_without_gst: rate,
      rate_with_gst: Number((rate + ((rate * taxRate) / 100)).toFixed(2))
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
    const template = String(prefixSettings.format_template || '{{prefix}}{{year}}/{{service_code}}/{{number}}');
    return template
      .replaceAll('{{prefix}}', pref)
      .replaceAll('{{year}}', year)
      .replaceAll('{{service_code}}', Number(prefixSettings.enable_service_code ?? 1) === 1 ? code : '')
      .replaceAll('{{number}}', next)
      .replace(/\/+/g, '/');
  }, [prefixSettings, items]);

  const employeeName = (employee = {}) => (
    employee.fullName
    || employee.name
    || [employee.firstName, employee.lastName].filter(Boolean).join(' ')
    || employee.empCode
    || ''
  ).trim();

  const employeeDesignation = (employee = {}) => (
    employee.designation
    || employee.roleName
    || employee.role
    || ''
  ).trim();

  const salesPersonRows = useMemo(
    () => employeeRows.filter((employee) => {
      const role = String(employee.role || '').trim().toLowerCase();
      return role === 'sales';
    }),
    [employeeRows]
  );

  const selectSalesPerson = (employeeId) => {
    const employee = employeeRows.find((entry) => String(entry._id || entry.id || entry.external_id || '') === String(employeeId || ''));
    if (!employee) {
      setForm((p) => ({ ...p, sales_person_employee_id: employeeId }));
      return;
    }
    setForm((p) => ({
      ...p,
      sales_person_employee_id: String(employee._id || employee.id || employee.external_id || ''),
      sales_person: employeeName(employee),
      designation: employeeDesignation(employee),
      mobile: employee.mobile || employee.phone || p.mobile || ''
    }));
  };

  const selectLead = (leadId) => {
    const lead = leadRows.find((l) => String(l._id || l.id || '') === String(leadId));
    if (!lead) return;
    setForm((p) => ({
      ...p,
      source_type: 'Lead',
      lead_id: String(lead._id || lead.id || ''),
      customer_id: '',
      customer_premise_id: '',
      premise_label: '',
      premise_address: '',
      premise_area_name: '',
      premise_city: '',
      premise_state: '',
      premise_pincode: '',
      premise_google_map_url: '',
      customer_name: lead.customerName || '',
      company_name: lead.companyName || '',
      address: lead.address || '',
      premise_city: lead.city || '',
      premise_pincode: lead.pincode || lead.pinCode || lead.postalCode || lead.postal_code || lead.zip || '',
      phone: lead.mobileNumber || lead.mobile || '',
      whatsapp: lead.whatsappNumber || '',
      email: lead.emailId || lead.email || '',
      gstNumber: lead.gstNumber || lead.gstin || '',
      quotation_number: ''
    }));
    setPremiseRows([]);
  };

  const applyPremise = (premise) => {
    if (!premise) return;
    const premiseId = premise.premiseId || premise.premise_id || '';
    const address = [
      premise.address,
      premise.areaName || premise.area_name,
      [premise.city, premise.state].filter(Boolean).join(', '),
      [premise.country || 'India', premise.pincode].filter(Boolean).join(' ')
    ].filter(Boolean).join('\n');
    setForm((p) => ({
      ...p,
      customer_premise_id: premiseId,
      premise_label: premise.premiseLabel || premise.premise_label || '',
      premise_address: address,
      premise_area_name: premise.areaName || premise.area_name || '',
      premise_city: premise.city || '',
      premise_state: premise.state || '',
      premise_pincode: premise.pincode || '',
      premise_google_map_url: premise.googleMapUrl || premise.google_map_url || '',
      address,
      gstNumber: premise.gstNumber || premise.gst_number || p.gstNumber || p.gstin || ''
    }));
  };

  const selectCustomer = async (customerId) => {
    const c = customerRows.find((l) => String(l._id || l.id || '') === String(customerId));
    if (!c) return;
    setForm((p) => ({
      ...p,
      source_type: 'Customer',
      lead_id: '',
      customer_id: String(c._id || c.id || ''),
      customer_name: c.customerName || c.name || '',
      company_name: c.companyName || '',
      address: c.billingAddress || c.address || '',
      premise_city: c.billingCity || c.city || '',
      premise_pincode: c.billingPincode || c.pincode || '',
      phone: c.mobileNumber || c.mobile || '',
      whatsapp: c.whatsappNumber || '',
      email: c.emailId || c.email || '',
      gstNumber: c.gstNumber || c.gstin || '',
      quotation_number: ''
    }));
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers/${c._id || c.id}/premises`);
      const premises = Array.isArray(res.data) ? res.data : [];
      setPremiseRows(premises);
      applyPremise(premises.find((row) => row.isDefault || row.is_default) || premises[0]);
    } catch (error) {
      console.error('Failed to load customer premises', error);
      setPremiseRows([]);
    }
  };

  const handleSourceTypeChange = (sourceType) => {
    setForm((p) => ({
      ...p,
      source_type: sourceType,
      lead_id: sourceType === 'Lead' ? p.lead_id : '',
      customer_id: sourceType === 'Customer' ? p.customer_id : '',
      customer_premise_id: sourceType === 'Customer' ? p.customer_premise_id : '',
      premise_label: sourceType === 'Customer' ? p.premise_label : '',
      premise_address: sourceType === 'Customer' ? p.premise_address : '',
      premise_area_name: sourceType === 'Customer' ? p.premise_area_name : '',
      premise_city: sourceType === 'Customer' ? p.premise_city : '',
      premise_state: sourceType === 'Customer' ? p.premise_state : '',
      premise_pincode: sourceType === 'Customer' ? p.premise_pincode : '',
      premise_google_map_url: sourceType === 'Customer' ? p.premise_google_map_url : ''
    }));
    if (sourceType !== 'Customer') setPremiseRows([]);
  };

  const saveQuotation = async (mode = 'Draft') => {
    try {
      setStatus('Saving quotation...');
      const { contract_start_date: _contractStartDate, contract_end_date: _contractEndDate, ...quotationPayload } = form;
      const payloadItems = items.map(({ contract_start_date: _itemContractStartDate, contract_end_date: _itemContractEndDate, ...item }) => item);
      const payload = {
        ...quotationPayload,
        status: mode,
        quotation_number: form.quotation_number || '',
        subtotal_without_gst: Number(subtotalWithout.toFixed(2)),
        gst_total: Number(gstTotal.toFixed(2)),
        grand_total: grandTotal,
        amount_in_words: `${grandTotal.toLocaleString('en-IN')} Rupees Only`,
        items: payloadItems
      };
      const method = isEditMode ? 'put' : 'post';
      const url = isEditMode ? `${API_BASE_URL}/api/quotations/${editId}` : `${API_BASE_URL}/api/quotations`;
      const res = await axios[method](url, payload);
      const returnedId = res.data?.id || (isEditMode ? Number(editId) : null);
      setSavedId(returnedId);
      setForm((p) => ({
        ...p,
        ...res.data,
        quotation_number: res.data?.quotation_number || p.quotation_number,
        quotation_date: res.data?.quotation_date ? String(res.data.quotation_date).slice(0, 10) : p.quotation_date,
        opening_paragraph: res.data?.opening_paragraph ?? p.opening_paragraph,
        payment_terms: res.data?.payment_terms ?? p.payment_terms,
        closing_paragraph: res.data?.closing_paragraph ?? p.closing_paragraph
      }));
      if (Array.isArray(res.data?.items) && res.data.items.length) setItems(res.data.items);
      setStatus(`Quotation ${isEditMode ? 'updated' : 'saved'}${res.data?.quotation_number ? `: ${res.data.quotation_number}` : ''}`);
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

  const isMobile = viewportWidth <= 760;
  const isTiny = viewportWidth <= 430;
  const pageStyle = { padding: isMobile ? 10 : 16, display: 'grid', gap: 12, maxWidth: '100%', overflowX: 'hidden' };
  const headerStyle = { display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' };
  const titleStyle = { margin: 0, fontSize: isMobile ? 22 : 24, color: 'var(--text)' };
  const tabsStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' };
  const tabStyle = (idx) => ({
    ...btnGhost,
    minHeight: 36,
    borderRadius: 999,
    border: idx === active ? '1px solid #D1D5DB' : '1px solid var(--border)',
    background: idx === active ? '#F3F4F6' : '#fff',
    padding: isTiny ? '0 12px' : btnGhost.padding,
    maxWidth: '100%'
  });
  const customerGridStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 };
  const addressFieldStyle = isMobile ? {} : { gridColumn: '1 / span 3' };
  const quoteGridStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 10 };
  const addressGridStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(190px, 0.65fr)', gap: 10, alignItems: 'stretch' };
  const cityPinGridStyle = { display: 'grid', gridTemplateRows: isMobile ? 'auto' : '1fr 1fr', gap: 10 };
  const serviceTopGridStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 8 };
  const serviceTextGridStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 };
  const serviceAmountGridStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(6, 1fr)', gap: 8 };
  const pricingGridStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 10 };
  const footerActionsStyle = { display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' };
  const footerButtonStyle = isMobile ? { minWidth: '100%' } : {};
  const termsTextAreaStyle = {
    ...input,
    minHeight: 70,
    padding: '10px 12px',
    lineHeight: 1.45,
    background: termsEditable ? '#fff' : '#f8fafc',
    color: termsEditable ? 'var(--text)' : '#1f2937',
    cursor: termsEditable ? 'text' : 'default',
    resize: termsEditable ? 'vertical' : 'none'
  };
  const isLeadSource = form.source_type === 'Lead';
  const isCustomerSource = form.source_type === 'Customer';
  const inactiveLookupStyle = { ...input, background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' };

  return (
    <section style={pageStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>{isEditMode ? 'Edit Quotation' : 'Create Quotation'}</h2>
        <div style={{ fontWeight: 800, color: 'var(--sky-deep)' }}>Preview Number: {form.quotation_number || quotationPreview}</div>
      </div>

      <div style={tabsStyle}>
        {tabs.map((tab, idx) => (
          <button key={tab} type="button" onClick={() => setActive(idx)} style={tabStyle(idx)}>{tab}</button>
        ))}
      </div>

      <div style={panel}>
        {active === 0 && (
          <>
            <div style={customerGridStyle}>
              <div><p style={label}>Source</p><select style={input} value={form.source_type} onChange={(e) => handleSourceTypeChange(e.target.value)}><option>Manual</option><option>Lead</option><option>Customer</option></select></div>
              <div><p style={label}>Search Lead</p><select style={isLeadSource ? input : inactiveLookupStyle} value={isLeadSource ? form.lead_id : ''} disabled={!isLeadSource} onChange={(e) => selectLead(e.target.value)}><option value="">Select lead</option>{leadRows.map((l) => <option key={l._id || l.id} value={l._id || l.id}>{l.customerName || l.mobileNumber || l._id}</option>)}</select></div>
              <div><p style={label}>Search Customer</p><select style={isCustomerSource ? input : inactiveLookupStyle} value={isCustomerSource ? form.customer_id : ''} disabled={!isCustomerSource} onChange={(e) => selectCustomer(e.target.value)}><option value="">Select customer</option>{customerRows.map((c) => <option key={c._id || c.id} value={c._id || c.id}>{c.customerName || c.name || c.mobileNumber}</option>)}</select></div>
            </div>
            {premiseRows.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <p style={label}>Premise / Address</p>
                <select style={input} value={form.customer_premise_id} onChange={(e) => applyPremise(premiseRows.find((row) => String(row.premiseId || row.premise_id || '') === e.target.value))}>
                  {premiseRows.map((premise) => (
                    <option key={premise.premiseId || premise.premise_id} value={premise.premiseId || premise.premise_id}>
                      {premise.premiseLabel || premise.premise_label || premise.address}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div style={customerGridStyle}>
              {['customer_name','company_name'].map((key) => (
                <div key={key}><p style={{ ...label, textTransform: 'capitalize' }}>{key.replaceAll('_', ' ')}</p><input style={input} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} /></div>
              ))}
            </div>
            <div style={addressGridStyle}>
              <div>
                <p style={label}>Address</p>
                <textarea
                  style={{ ...input, minHeight: isMobile ? 74 : 112, paddingTop: 10, resize: 'vertical' }}
                  value={form.address || ''}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
              <div style={cityPinGridStyle}>
                <div><p style={label}>City</p><input style={input} value={form.premise_city || ''} onChange={(e) => setForm((p) => ({ ...p, premise_city: e.target.value }))} /></div>
                <div><p style={label}>Pincode</p><input style={input} value={form.premise_pincode || ''} onChange={(e) => setForm((p) => ({ ...p, premise_pincode: e.target.value }))} /></div>
              </div>
            </div>
            <div style={customerGridStyle}>
              {['phone','email','gstNumber'].map((key) => (
                <div key={key}><p style={{ ...label, textTransform: 'capitalize' }}>{key}</p><input style={input} value={form[key] || ''} inputMode={key === 'phone' ? 'numeric' : undefined} onChange={(e) => setForm((p) => ({ ...p, [key]: key === 'phone' ? normalizeIndianMobileNumber(e.target.value) : e.target.value }))} /></div>
              ))}
            </div>
          </>
        )}

        {active === 1 && (
          <div style={quoteGridStyle}>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Quotation Date</p><input type="date" style={input} value={form.quotation_date || ''} onChange={(e) => setForm((p) => ({ ...p, quotation_date: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Quotation Number</p><input style={input} value={form.quotation_number || ''} placeholder={quotationPreview} onChange={(e) => setForm((p) => ({ ...p, quotation_number: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Validity Days</p><input type="number" style={input} value={form.validity_days || 15} onChange={(e) => setForm((p) => ({ ...p, validity_days: Number(e.target.value) || 1 }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Rate Type</p><select style={input} value={form.rate_type || 'With GST'} onChange={(e) => setForm((p) => ({ ...p, rate_type: e.target.value }))}><option>With GST</option><option>Without GST</option></select></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Sales Person</p><select style={input} value={form.sales_person_employee_id || ''} onChange={(e) => selectSalesPerson(e.target.value)}><option value="">Select sales person</option>{salesPersonRows.map((employee) => <option key={employee._id || employee.id || employee.empCode || employeeName(employee)} value={employee._id || employee.id || employee.external_id || ''}>{employeeName(employee) || employee.mobile || employee.empCode}</option>)}</select></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Sales Person Name</p><input style={input} value={form.sales_person || ''} onChange={(e) => setForm((p) => ({ ...p, sales_person: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Designation</p><input style={input} value={form.designation || ''} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} /></div>
            <div><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Mobile</p><input style={input} inputMode="numeric" value={form.mobile || ''} onChange={(e) => setForm((p) => ({ ...p, mobile: normalizeIndianMobileNumber(e.target.value) }))} /></div>
          </div>
        )}

        {active === 2 && (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item, idx) => (
              <div key={`item-${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><p style={{ margin: 0, fontWeight: 800 }}>Service #{idx + 1}</p>{items.length > 1 ? <button type="button" style={{ ...btnDanger, minHeight: 32, padding: '0 10px' }} onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>Remove</button> : null}</div>
                <div style={serviceTopGridStyle}>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Service Name</p><select style={input} value={item.service_template_id || ''} onChange={(e) => selectServiceTemplate(idx, e.target.value)}><option value="">Select item</option>{serviceCatalog.map((entry) => <option key={entry._id} value={entry._id}>{getItemServiceName(entry) || entry._id}</option>)}</select></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Service Title</p><input style={input} value={item.service_title || ''} onChange={(e) => updateItem(idx, { service_title: e.target.value })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Pest Name</p><input style={input} value={item.pest_name || ''} onChange={(e) => updateItem(idx, { pest_name: e.target.value })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Frequency</p><input style={input} value={item.frequency || ''} onChange={(e) => updateItem(idx, { frequency: e.target.value })} /></div>
                </div>

                <div style={serviceTextGridStyle}>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>About Pest</p><textarea style={{ ...input, minHeight: 64 }} value={item.about_pest || ''} onChange={(e) => updateItem(idx, { about_pest: e.target.value })} /></div>
                  <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>What We Do</p><textarea style={{ ...input, minHeight: 64 }} value={item.what_we_do || ''} onChange={(e) => updateItem(idx, { what_we_do: e.target.value })} /></div>
                </div>

                <div style={serviceAmountGridStyle}>
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

                <div><p style={{ margin: '0 0 5px', fontWeight: 700 }}>Recommendation</p><textarea style={{ ...input, minHeight: 56 }} value={item.recommendation || ''} onChange={(e) => updateRecommendation(idx, e.target.value)} /></div>
              </div>
            ))}

            <button type="button" style={btnGhost} onClick={() => setItems((prev) => [...prev, makeItem(recommendationDefault)])}>+ Add Service</button>
          </div>
        )}

        {active === 3 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
            <table style={{ width: '100%', minWidth: isMobile ? 680 : '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)', width: 70 }}>Sr No</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)', width: 180 }}>Service</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)', width: 150 }}>Infestation Level</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>Recommendation/Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={`rec-${idx}`}>
                    <td style={{ padding: 8 }}>{idx + 1}</td>
                    <td style={{ padding: 8 }}>{item.service_name || '-'}</td>
                    <td style={{ padding: 8 }}>{item.infestation_level || '-'}</td>
                    <td style={{ padding: 8 }}><textarea style={{ ...input, minHeight: 72, resize: 'vertical' }} value={item.recommendation || ''} onChange={(e) => updateRecommendation(idx, e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {active === 4 && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={pricingGridStyle}>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                style={termsEditable ? btnPrimary : btnGhost}
                onClick={() => setTermsEditable((prev) => !prev)}
              >
                {termsEditable ? 'Lock Terms' : 'Edit Terms'}
              </button>
            </div>
            {[
              ['opening_paragraph', 'Opening Paragraph'],
              ['payment_terms', 'Payment Terms'],
              ['closing_paragraph', 'Closing Paragraph']
            ].map(([key, label]) => (
              <div key={key}>
                <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{label}</p>
                <textarea
                  style={termsTextAreaStyle}
                  value={form[key] || ''}
                  readOnly={!termsEditable}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, color: status.toLowerCase().includes('failed') || status.toLowerCase().includes('could not') ? '#dc2626' : '#2563eb', fontWeight: 700 }}>{status}</p>
        <div style={footerActionsStyle}>
          <button type="button" style={{ ...btnGhost, ...footerButtonStyle }} onClick={() => saveQuotation('Draft')}>Save Draft</button>
          <button type="button" style={{ ...btnPrimary, ...footerButtonStyle }} onClick={() => saveQuotation('Final')}>Save Quotation</button>
          <button type="button" style={{ ...btnGhost, ...footerButtonStyle }} onClick={openPdf}>Preview / Download PDF</button>
        </div>
      </div>
    </section>
  );
}
