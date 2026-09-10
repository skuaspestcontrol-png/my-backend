import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  Filter,
  History,
  MessageSquareText,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  Users,
  XCircle
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { formatWhatsAppPhoneNumber, normalizeWhatsAppPhoneNumber } from '../../utils/phone';
import { getPortalUserName } from '../../utils/portalAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const tabs = ['Campaigns', 'Templates', 'Audience', 'Logs'];

const campaignTypeOptions = [
  'Festival Greeting',
  'Promotional Offer',
  'Service Reminder',
  'Renewal Campaign',
  'Customer Engagement',
  'Custom Campaign'
];

const audienceOptions = [
  'All Customers',
  'Active Customers',
  'Expired Customers',
  'Renewal Due Customers',
  'Outstanding Payment Customers',
  'Customers by Service',
  'Customers by Area',
  'Customers by City',
  'Customers by Contract Status',
  'Customers by Sales Person',
  'Custom Selected Customers'
];

const quickTemplates = {
  'Festival Greeting': 'Wishing you and your family a wonderful {{festival_name}} from {{company_name}}. May this season bring happiness, health, and success.',
  'Promotional Offer': 'Special offer from {{company_name}} for {{offer_name}}. This is a limited-time message for our valued customers in {{city}}.',
  'Service Reminder': 'Hello {{customer_name}}, this is a friendly reminder about your {{service_name}} service. Please let us know your preferred time slot.',
  'Renewal Campaign': 'Dear {{customer_name}}, your renewal for {{service_name}} is coming up on {{renewal_date}}. Reply to confirm and continue uninterrupted service.',
  'Customer Engagement': 'Hello {{customer_name}}, we value your relationship with {{company_name}}. Let us know if you need any support or a service check.',
  'Custom Campaign': 'Hello {{customer_name}}, this is an update from {{company_name}}.'
};

const emptyFilters = {
  search: '',
  customerName: '',
  mobileNumber: '',
  service: '',
  area: '',
  city: '',
  contractStatus: '',
  renewalStatus: '',
  outstandingBalance: '',
  salesPerson: '',
  lastCampaignDate: '',
  state: '',
  contractAudience: '',
  renewalDays: '',
  outstandingAudience: '',
  dormantMonths: '',
  hasService: '',
  doesNotHaveService: '',
  excludeRecentlyContactedDays: '30'
};

const emptyForm = {
  campaignName: '',
  campaignType: 'Festival Greeting',
  audience: 'All Customers',
  templateId: '',
  templateName: '',
  message: '',
  attachmentUrl: '',
  attachmentName: '',
  scheduleAt: '',
  senderStatus: 'Ready',
  notes: '',
  allowDuplicatePhones: false,
  allowOptedOut: false
};

const styles = {
  page: { display: 'grid', gap: 12, width: '100%', minWidth: 0 },
  topRow: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 },
  statCard: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 16,
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    padding: 14,
    minHeight: 92,
    boxShadow: '0 10px 26px rgba(15, 23, 42, 0.05)',
    display: 'grid',
    alignContent: 'space-between'
  },
  statLabel: { margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' },
  statValue: { margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: '#111827' },
  actionBar: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  actionButton: {
    minHeight: 36,
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.24)',
    background: '#fff',
    color: '#111827',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer'
  },
  primaryButton: {
    minHeight: 36,
    borderRadius: 10,
    border: 'none',
    background: 'var(--color-primary)',
    color: '#fff',
    padding: '0 14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer'
  },
  mutedButton: {
    minHeight: 36,
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.26)',
    background: '#fff',
    color: '#475569',
    padding: '0 14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer'
  },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tab: {
    minHeight: 36,
    borderRadius: 999,
    padding: '0 14px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: '#fff',
    color: '#475569',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer'
  },
  tabActive: { background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderColor: 'var(--color-primary-soft)' },
  panel: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 18,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(249,250,252,0.98) 100%)',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.05)',
    overflow: 'hidden'
  },
  panelPad: { padding: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, alignItems: 'start' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  field: { display: 'grid', gap: 5 },
  label: { fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: {
    width: '100%',
    minHeight: 36,
    borderRadius: 10,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    padding: '0 12px',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    minHeight: 110,
    borderRadius: 12,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    padding: '10px 12px',
    boxSizing: 'border-box',
    resize: 'vertical'
  },
  select: {
    width: '100%',
    minHeight: 36,
    borderRadius: 10,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    padding: '0 12px',
    boxSizing: 'border-box'
  },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 26, padding: '0 10px', borderRadius: 999, fontSize: 11, fontWeight: 800 },
  tableWrap: { width: '100%', overflowX: 'auto', overflowY: 'hidden' },
  table: { width: '100%', minWidth: 1020, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  th: {
    textAlign: 'left',
    padding: '10px 10px',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#64748b',
    borderBottom: '1px solid #e5e7eb',
    background: '#f8fafc'
  },
  td: {
    padding: '10px 10px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 12,
    color: '#1f2937',
    verticalAlign: 'middle'
  },
  muted: { color: '#64748b', fontSize: 12, lineHeight: 1.6 },
  helper: {
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.92) 100%)',
    padding: 14
  }
};

const normalizeText = (value) => String(value || '').trim();

const renderTemplate = (template = '', context = {}) => String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
  const value = context[key];
  return value === undefined || value === null ? '' : String(value);
});

const parseDateOnly = (value) => {
  const raw = normalizeText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const dateKey = (value) => {
  const parsed = parseDateOnly(value);
  if (!parsed) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDisplayName = (customer = {}) => normalizeText(
  customer.displayName
  || customer.name
  || customer.contactPersonName
  || customer.companyName
  || customer.customerName
  || 'Customer'
);

const buildServiceName = (customer = {}) => normalizeText(
  customer.serviceType
  || customer.serviceName
  || customer.service
  || customer.subject
  || customer.primaryService
  || customer.pestIssue
);

const buildAreaName = (customer = {}) => normalizeText(
  customer.billingArea
  || customer.areaName
  || customer.area
  || customer.shippingArea
);

const buildCityName = (customer = {}) => normalizeText(
  customer.billingCity
  || customer.city
  || customer.shippingCity
);

const buildSalesPerson = (customer = {}) => normalizeText(
  customer.salesPersonName
  || customer.assignedSalesPersonName
  || customer.assignedTo
  || customer.salesPerson
);

const buildContractStatus = (customer = {}) => normalizeText(
  customer.contractStatus
  || customer.contract_status
  || customer.status
  || customer.accountStatus
);

const buildRenewalStatus = (customer = {}) => normalizeText(
  customer.renewalStatus
  || customer.renewal_status
  || customer.renewalState
  || customer.renewalStage
);

const buildRenewalDate = (customer = {}) => normalizeText(
  customer.renewalDate
  || customer.nextRenewalDate
  || customer.expiryDate
  || customer.contractEndDate
  || customer.renewalDueDate
);

const buildOutstandingBalance = (customer = {}) => Number(
  customer.outstandingBalance
  || customer.balanceDue
  || customer.receivables
  || customer.pendingAmount
  || customer.dueAmount
  || 0
);

const buildWhatsAppPhone = (customer = {}) => normalizeWhatsAppPhoneNumber(
  customer.whatsappNumber
  || customer.mobileNumber
  || customer.workPhone
  || customer.phone
  || customer.mobile
  || ''
);

const buildCampaignContext = (customer = {}, campaign = {}) => {
  const companyName = normalizeText(campaign.companyName || campaign.company_name || 'SKUAS Pest Control');
  return {
    customer_name: buildDisplayName(customer),
    customer_phone: buildWhatsAppPhone(customer),
    company_name: companyName,
    campaign_name: normalizeText(campaign.campaignName || campaign.name),
    festival_name: normalizeText(campaign.festivalName || campaign.campaignName || campaign.campaignType),
    offer_name: normalizeText(campaign.offerName || campaign.campaignName || campaign.campaignType),
    service_name: buildServiceName(customer),
    area: buildAreaName(customer),
    city: buildCityName(customer),
    contract_status: buildContractStatus(customer),
    renewal_status: buildRenewalStatus(customer),
    renewal_date: buildRenewalDate(customer),
    balance_due: buildOutstandingBalance(customer).toLocaleString('en-IN'),
    sales_person: buildSalesPerson(customer),
    today_date: new Date().toLocaleDateString('en-IN')
  };
};

const getAudienceBucket = (customer = {}) => {
  const contractStatus = buildContractStatus(customer).toLowerCase();
  const renewalStatus = buildRenewalStatus(customer).toLowerCase();
  const renewalDate = buildRenewalDate(customer);
  const outstanding = buildOutstandingBalance(customer);
  const renewalDateObj = parseDateOnly(renewalDate);
  const renewalDays = renewalDateObj ? Math.ceil((renewalDateObj.getTime() - Date.now()) / 86400000) : null;

  if (/expired|inactive|lapsed|closed/.test(contractStatus)) return 'Expired Customers';
  if (/pending|follow|due|upcoming|overdue|confirm/.test(renewalStatus)) return 'Renewal Due Customers';
  if (renewalDays !== null && renewalDays <= 45) return 'Renewal Due Customers';
  if (outstanding > 0) return 'Outstanding Payment Customers';
  if (/active|ongoing|running|current/.test(contractStatus)) return 'Active Customers';
  return 'Active Customers';
};

const isMarketingOptedOut = (customer = {}) => {
  const direct = customer.whatsappMarketingOptOut || customer.marketingOptOut || customer.doNotSendWhatsAppMarketing;
  if (typeof direct === 'boolean') return direct;
  const label = normalizeText(customer.whatsappMarketing || customer.marketingStatus || '').toLowerCase();
  return label === 'opted out' || label === 'blocked';
};

const customerSearchText = (customer = {}) => [
  buildDisplayName(customer),
  buildWhatsAppPhone(customer),
  buildServiceName(customer),
  buildAreaName(customer),
  buildCityName(customer),
  buildContractStatus(customer),
  buildRenewalStatus(customer),
  buildSalesPerson(customer),
  normalizeText(customer.lastWhatsAppCampaignDate || customer.lastCampaignDate || '')
].join(' ').toLowerCase();

const getCampaignLabel = (row) => {
  const status = normalizeText(row.status).toLowerCase();
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'sent') return 'Sent';
  if (status === 'failed') return 'Failed';
  if (status === 'partial') return 'Partial';
  return 'Draft';
};

const buildNextScheduleValue = () => {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
};

export default function WhatsAppMarketing() {
  const [activeTab, setActiveTab] = useState('Campaigns');
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [whatsappLogs, setWhatsappLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [form, setForm] = useState(emptyForm);
  const [sendProgress, setSendProgress] = useState({ busy: false, total: 0, sent: 0, failed: 0, skipped: 0 });
  const [refreshToken, setRefreshToken] = useState(0);
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [audienceOptions, setAudienceOptions] = useState({ services: [], areas: [], cities: [], states: [], salesPersons: [] });
  const [audiencePresets, setAudiencePresets] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customerRes, templateRes, campaignRes, logsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/customers`),
        axios.get(`${API_BASE_URL}/api/whatsapp/templates`),
        axios.get(`${API_BASE_URL}/api/whatsapp-marketing/campaigns`),
        axios.get(`${API_BASE_URL}/api/whatsapp/logs`)
      ]);
      const [optionsRes, presetsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/whatsapp-marketing/audience/options`),
        axios.get(`${API_BASE_URL}/api/whatsapp-marketing/audience-presets`)
      ]);

      setCustomers(customerRes.status === 'fulfilled' && Array.isArray(customerRes.value.data) ? customerRes.value.data : []);
      setTemplates(templateRes.status === 'fulfilled' && Array.isArray(templateRes.value.data) ? templateRes.value.data : []);
      const campaignPayload = campaignRes.status === 'fulfilled' ? campaignRes.value.data : {};
      setCampaigns(Array.isArray(campaignPayload?.campaigns) ? campaignPayload.campaigns : []);
      setWhatsappLogs(logsRes.status === 'fulfilled' && Array.isArray(logsRes.value.data) ? logsRes.value.data : []);
      if (optionsRes.status === 'fulfilled') setAudienceOptions(optionsRes.value.data || {});
      if (presetsRes.status === 'fulfilled') setAudiencePresets(Array.isArray(presetsRes.value.data) ? presetsRes.value.data : []);
      setMessage('');
    } catch (error) {
      setMessage(error?.response?.data?.error || 'Unable to load WhatsApp marketing data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshToken]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/whatsapp-marketing/audience/preview`, { filters });
        setAudiencePreview(response.data || null);
      } catch (_error) {
        setAudiencePreview(null);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const enrichedCustomers = useMemo(() => {
    const latestLogByPhone = new Map();
    whatsappLogs
      .filter((row) => String(row.moduleName || '').trim() === 'whatsapp-marketing')
      .forEach((row) => {
        const key = normalizeWhatsAppPhoneNumber(row.recipientPhone || '');
        if (!key) return;
        const current = latestLogByPhone.get(key);
        const currentTime = current ? new Date(current.sentAt || 0).getTime() : 0;
        const nextTime = new Date(row.sentAt || 0).getTime();
        if (!current || nextTime >= currentTime) {
          latestLogByPhone.set(key, row);
        }
      });

    return (Array.isArray(customers) ? customers : []).map((customer) => {
      const phone = buildWhatsAppPhone(customer);
      const latestLog = phone ? latestLogByPhone.get(phone) : null;
      const lastCampaignDate = latestLog?.sentAt || customer.lastWhatsAppCampaignDate || customer.lastCampaignDate || '';
      const outstandingBalance = buildOutstandingBalance(customer);
      const optedOut = isMarketingOptedOut(customer);
      const renewalDate = buildRenewalDate(customer);
      const renewalDateObj = parseDateOnly(renewalDate);
      const renewalDays = renewalDateObj ? Math.ceil((renewalDateObj.getTime() - Date.now()) / 86400000) : null;
      const bucket = getAudienceBucket(customer);
      return {
        ...customer,
        _marketingId: String(customer._id || customer.id || phone || buildDisplayName(customer)),
        marketingDisplayName: buildDisplayName(customer),
        marketingPhone: phone,
        marketingService: buildServiceName(customer),
        marketingArea: buildAreaName(customer),
        marketingCity: buildCityName(customer),
        marketingSalesPerson: buildSalesPerson(customer),
        marketingContractStatus: buildContractStatus(customer),
        marketingRenewalStatus: buildRenewalStatus(customer),
        marketingRenewalDate: renewalDate,
        marketingOutstandingBalance: outstandingBalance,
        marketingOptedOut: optedOut,
        marketingBucket: bucket,
        marketingLastCampaignDate: lastCampaignDate,
        marketingRenewalDays: renewalDays,
        marketingLastCampaignLabel: latestLog?.sentAt ? 'Previously contacted' : 'Never'
      };
    });
  }, [customers, whatsappLogs, refreshToken]);

  const filteredCustomers = useMemo(() => {
    const search = normalizeText(filters.search).toLowerCase();
    const nameQuery = normalizeText(filters.customerName).toLowerCase();
    const mobileQuery = normalizeText(filters.mobileNumber).toLowerCase();
    const serviceQuery = normalizeText(filters.service).toLowerCase();
    const areaQuery = normalizeText(filters.area).toLowerCase();
    const cityQuery = normalizeText(filters.city).toLowerCase();
    const contractQuery = normalizeText(filters.contractStatus).toLowerCase();
    const renewalQuery = normalizeText(filters.renewalStatus).toLowerCase();
    const salesQuery = normalizeText(filters.salesPerson).toLowerCase();
    const balanceQuery = normalizeText(filters.outstandingBalance).toLowerCase();
    const lastCampaignQuery = normalizeText(filters.lastCampaignDate).toLowerCase();

    return enrichedCustomers.filter((customer) => {
      if (search && !customerSearchText(customer).includes(search)) return false;
      if (nameQuery && !buildDisplayName(customer).toLowerCase().includes(nameQuery)) return false;
      if (mobileQuery && !formatWhatsAppPhoneNumber(customer.marketingPhone || '').toLowerCase().includes(mobileQuery)) return false;
      if (serviceQuery && !customer.marketingService.toLowerCase().includes(serviceQuery)) return false;
      if (areaQuery && !customer.marketingArea.toLowerCase().includes(areaQuery)) return false;
      if (cityQuery && !customer.marketingCity.toLowerCase().includes(cityQuery)) return false;
      if (contractQuery && !customer.marketingContractStatus.toLowerCase().includes(contractQuery)) return false;
      if (renewalQuery && !customer.marketingRenewalStatus.toLowerCase().includes(renewalQuery)) return false;
      if (salesQuery && !customer.marketingSalesPerson.toLowerCase().includes(salesQuery)) return false;
      if (balanceQuery) {
        const balanceText = String(customer.marketingOutstandingBalance || 0).toLowerCase();
        if (!balanceText.includes(balanceQuery)) return false;
      }
      if (lastCampaignQuery && !dateKey(customer.marketingLastCampaignDate).includes(lastCampaignQuery)) return false;

      switch (form.audience) {
        case 'Active Customers':
          return customer.marketingBucket === 'Active Customers' && !customer.marketingOptedOut;
        case 'Expired Customers':
          return customer.marketingBucket === 'Expired Customers' && !customer.marketingOptedOut;
        case 'Renewal Due Customers':
          return customer.marketingBucket === 'Renewal Due Customers' && !customer.marketingOptedOut;
        case 'Outstanding Payment Customers':
          return customer.marketingOutstandingBalance > 0 && !customer.marketingOptedOut;
        case 'Customers by Service':
          return Boolean(customer.marketingService) && !customer.marketingOptedOut;
        case 'Customers by Area':
          return Boolean(customer.marketingArea) && !customer.marketingOptedOut;
        case 'Customers by City':
          return Boolean(customer.marketingCity) && !customer.marketingOptedOut;
        case 'Customers by Contract Status':
          return Boolean(customer.marketingContractStatus) && !customer.marketingOptedOut;
        case 'Customers by Sales Person':
          return Boolean(customer.marketingSalesPerson) && !customer.marketingOptedOut;
        case 'Custom Selected Customers':
          return true;
        case 'All Customers':
        default:
          return true;
      }
    });
  }, [enrichedCustomers, filters, form.audience]);

  const selectedVisibleCustomers = useMemo(() => {
    if (selectedIds.length === 0) return filteredCustomers;
    const idSet = new Set(selectedIds.map(String));
    return filteredCustomers.filter((customer) => idSet.has(String(customer._marketingId)));
  }, [filteredCustomers, selectedIds]);

  const dedupedRecipients = useMemo(() => {
    const allowDuplicates = Boolean(form.allowDuplicatePhones);
    const allowOptedOut = Boolean(form.allowOptedOut);
    const source = selectedIds.length > 0 ? selectedVisibleCustomers : filteredCustomers;
    const uniqueMap = new Map();
    const recipients = [];
    let duplicatesRemoved = 0;
    let optedOutCount = 0;

    source.forEach((customer) => {
      const phone = buildWhatsAppPhone(customer);
      if (!phone) return;
      if (customer.marketingOptedOut && !allowOptedOut) {
        optedOutCount += 1;
        return;
      }
      if (!allowDuplicates && uniqueMap.has(phone)) {
        duplicatesRemoved += 1;
        return;
      }
      const record = {
        id: customer._marketingId,
        customerId: String(customer._id || customer.id || '').trim(),
        name: customer.marketingDisplayName,
        phone,
        optedOut: Boolean(customer.marketingOptedOut),
        service: customer.marketingService,
        area: customer.marketingArea,
        city: customer.marketingCity,
        salesPerson: customer.marketingSalesPerson,
        contractStatus: customer.marketingContractStatus,
        renewalStatus: customer.marketingRenewalStatus,
        renewalDate: customer.marketingRenewalDate,
        outstandingBalance: customer.marketingOutstandingBalance,
        lastCampaignDate: customer.marketingLastCampaignDate,
        context: buildCampaignContext(customer, form)
      };
      uniqueMap.set(phone, record);
      recipients.push(record);
    });

    return {
      recipients,
      uniqueCount: recipients.length,
      selectedCount: source.length,
      duplicatesRemoved,
      optedOutCount
    };
  }, [filteredCustomers, form.allowDuplicatePhones, form.allowOptedOut, selectedIds, selectedVisibleCustomers, form]);

  const stats = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const scheduled = campaigns.filter((row) => row.status === 'scheduled').length;
    const sent = campaigns.reduce((sum, row) => sum + Number(row.sentCount || 0), 0);
    const failed = campaigns.reduce((sum, row) => sum + Number(row.failedCount || 0), 0);
    const recipients = campaigns.reduce((sum, row) => sum + Number(row.recipientCount || 0), 0);
    const optedOut = campaigns.reduce((sum, row) => sum + Number(row.optedOutCount || 0), 0);
    return { totalCampaigns, scheduled, sent, failed, recipients, optedOut };
  }, [campaigns]);

  const allSelectedVisible = filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedIds.includes(customer._marketingId));

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const resetForCampaign = (type) => {
    const currentSchedule = type === 'Schedule Campaign' ? buildNextScheduleValue() : '';
    setForm((prev) => ({
      ...emptyForm,
      campaignType:
        type === 'Create Promotion'
          ? 'Promotional Offer'
          : type === 'Send Festival Greeting'
            ? 'Festival Greeting'
            : type === 'Schedule Campaign'
              ? prev.campaignType || 'Custom Campaign'
              : 'Custom Campaign',
      audience: type === 'Create Promotion' ? 'All Customers' : 'Active Customers',
      campaignName:
        type === 'Create Campaign'
          ? ''
          : type === 'Create Promotion'
            ? `Promotion - ${new Date().toLocaleDateString('en-IN')}`
            : type === 'Send Festival Greeting'
              ? `Festival Greeting - ${new Date().toLocaleDateString('en-IN')}`
              : '',
      message:
        type === 'Send Festival Greeting'
          ? quickTemplates['Festival Greeting']
          : type === 'Create Promotion'
            ? quickTemplates['Promotional Offer']
            : '',
      scheduleAt: currentSchedule,
      senderStatus: type === 'Schedule Campaign' ? 'Scheduled' : 'Ready'
    }));
    setSelectedIds([]);
    setMessage('');
    setActiveTab('Campaigns');
  };

  const selectTemplate = (template) => {
    setForm((prev) => ({
      ...prev,
      templateId: template.id || template.templateType || '',
      templateName: template.templateName || template.templateType || '',
      message: template.messageBody || prev.message
    }));
    setActiveTab('Campaigns');
  };

  const patchCustomerOptOut = async (customer, nextValue) => {
    const customerId = String(customer._id || customer.id || '').trim();
    if (!customerId) return;
    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${encodeURIComponent(customerId)}`, {
        whatsappMarketingOptOut: nextValue,
        marketingOptOut: nextValue,
        whatsappMarketing: nextValue ? 'Opted Out' : 'Allowed'
      });
      setMessage(nextValue ? 'Customer opted out of WhatsApp marketing.' : 'Customer marked as allowed for WhatsApp marketing.');
      setRefreshToken((value) => value + 1);
    } catch (error) {
      setMessage(error?.response?.data?.error || 'Could not update marketing opt-out.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (customerId) => {
    setSelectedIds((prev) => {
      const id = String(customerId);
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      return [...prev, id];
    });
  };

  const toggleSelectVisible = () => {
    if (allSelectedVisible) {
      setSelectedIds((prev) => prev.filter((id) => !filteredCustomers.some((customer) => String(customer._marketingId) === String(id))));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredCustomers.map((customer) => customer._marketingId)])));
  };

  const sendCampaign = async ({ scheduleOnly = false } = {}) => {
    if (!form.campaignName.trim()) {
      setMessage('Please enter a campaign name.');
      return;
    }
    if (!form.message.trim() && !form.templateId) {
      setMessage('Please enter a message or pick a template.');
      return;
    }
    if (scheduleOnly && !form.scheduleAt) {
      setMessage('Please choose a schedule date and time.');
      return;
    }

    const recipients = dedupedRecipients.recipients;
    if (!scheduleOnly && recipients.length === 0 && !audiencePreview?.stats?.finalRecipients) {
      setMessage('No recipients matched your current audience.');
      return;
    }

    if (!scheduleOnly) {
      const proceed = window.confirm(
        `Queue this campaign for ${audiencePreview?.stats?.finalRecipients || recipients.length} unique WhatsApp number${(audiencePreview?.stats?.finalRecipients || recipients.length) === 1 ? '' : 's'}?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    setMessage('');
    try {
      const backendFilters = { ...filters };
      if (form.audience === 'Active Customers') backendFilters.contractAudience = 'active';
      if (form.audience === 'Expired Customers') backendFilters.contractAudience = 'expired';
      if (form.audience === 'Renewal Due Customers') backendFilters.renewalDays = backendFilters.renewalDays || 30;
      if (form.audience === 'Outstanding Payment Customers') backendFilters.outstandingAudience = 'outstanding';
      if (selectedIds.length > 0) backendFilters.customerIds = selectedIds;
      const campaignPayload = {
        campaignName: form.campaignName,
        campaignType: form.campaignType,
        audienceLabel: form.audience,
        templateId: form.templateId,
        templateName: form.templateName,
        message: form.message,
        attachmentUrl: form.attachmentUrl,
        attachmentName: form.attachmentName,
        scheduleAt: form.scheduleAt,
        senderStatus: form.senderStatus,
        notes: form.notes,
        allowDuplicatePhones: form.allowDuplicatePhones,
        allowOptedOut: form.allowOptedOut,
        status: scheduleOnly ? 'scheduled' : 'running',
        recipientCount: dedupedRecipients.selectedCount,
        uniqueRecipientCount: recipients.length,
        duplicateCount: dedupedRecipients.duplicatesRemoved,
        sentCount: 0,
        failedCount: 0,
        optedOutCount: dedupedRecipients.optedOutCount,
        createdBy: getPortalUserName() || 'User',
        selectedCustomerIds: selectedIds,
        filters: backendFilters,
        recipients: [],
        createdBy: getPortalUserName() || 'User'
      };

      await axios.post(`${API_BASE_URL}/api/whatsapp-marketing/campaigns`, campaignPayload);
      await loadData();
      setSelectedIds([]);
      setForm(emptyForm);
      setMessage(scheduleOnly ? 'Campaign scheduled. The server will run it automatically.' : 'Campaign queued. The server is processing recipients in safe batches.');
    } catch (error) {
      setMessage(error?.response?.data?.error || 'Could not save campaign.');
    } finally {
      setSaving(false);
      setSendProgress({ busy: false, total: 0, sent: 0, failed: 0, skipped: 0 });
    }
  };

  const previewTemplate = useMemo(() => {
    if (form.templateId) {
      return templates.find((template) => String(template.id || template.templateType || '') === String(form.templateId)) || null;
    }
    return null;
  }, [form.templateId, templates]);

  const visibleLogs = useMemo(() => {
    return whatsappLogs.filter((row) => String(row.moduleName || '').trim() === 'whatsapp-marketing').slice(0, 30);
  }, [whatsappLogs]);

  const canUseManualSelection = form.audience === 'Custom Selected Customers';

  return (
    <div style={styles.page}>
      <PageHeader
        title="WhatsApp Marketing"
        subtitle="Run controlled WhatsApp campaigns for festival greetings, offers, reminders, and renewals without leaving the CRM."
        action={(
          <div style={styles.actionBar}>
            <Link to="/settings/whatsapp" style={{ ...styles.actionButton, textDecoration: 'none' }}>
              <Sparkles size={14} />
              WhatsApp Settings
            </Link>
            <Link to="/whatsapp/logs" style={{ ...styles.actionButton, textDecoration: 'none' }}>
              <History size={14} />
              WhatsApp Logs
            </Link>
          </div>
        )}
      />

      {message ? (
        <div style={styles.helper}>
          <strong style={{ color: '#111827' }}>Status:</strong> <span style={styles.muted}>{message}</span>
        </div>
      ) : null}

      <div style={styles.topRow}>
        <div style={styles.statCard}><p style={styles.statLabel}>Total Campaigns</p><p style={styles.statValue}>{stats.totalCampaigns}</p></div>
        <div style={styles.statCard}><p style={styles.statLabel}>Scheduled</p><p style={styles.statValue}>{stats.scheduled}</p></div>
        <div style={styles.statCard}><p style={styles.statLabel}>Sent</p><p style={styles.statValue}>{stats.sent}</p></div>
        <div style={styles.statCard}><p style={styles.statLabel}>Failed</p><p style={styles.statValue}>{stats.failed}</p></div>
        <div style={styles.statCard}><p style={styles.statLabel}>Recipients</p><p style={styles.statValue}>{stats.recipients}</p></div>
        <div style={styles.statCard}><p style={styles.statLabel}>Opted Out</p><p style={styles.statValue}>{stats.optedOut}</p></div>
      </div>

      <div style={styles.actionBar}>
        <button type="button" style={styles.primaryButton} onClick={() => resetForCampaign('Create Campaign')}><Plus size={14} />Create Campaign</button>
        <button type="button" style={styles.actionButton} onClick={() => resetForCampaign('Send Festival Greeting')}><Sparkles size={14} />Send Festival Greeting</button>
        <button type="button" style={styles.actionButton} onClick={() => resetForCampaign('Create Promotion')}><Tag size={14} />Create Promotion</button>
        <button type="button" style={styles.actionButton} onClick={() => resetForCampaign('Schedule Campaign')}><CalendarClock size={14} />Schedule Campaign</button>
      </div>

      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button key={tab} type="button" style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : null) }} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Campaigns' ? (
        <div style={styles.grid2}>
          <div style={styles.panel}>
            <div style={styles.panelPad}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={styles.fieldGrid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Campaign Name</span>
                    <input value={form.campaignName} onChange={(event) => updateForm({ campaignName: event.target.value })} style={styles.input} placeholder="Diwali 2026 Greeting" />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Campaign Type</span>
                    <select value={form.campaignType} onChange={(event) => updateForm({ campaignType: event.target.value, message: form.message || quickTemplates[event.target.value] || '' })} style={styles.select}>
                      {campaignTypeOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Audience</span>
                    <select value={form.audience} onChange={(event) => updateForm({ audience: event.target.value })} style={styles.select}>
                      {audienceOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Template</span>
                    <select value={form.templateId} onChange={(event) => {
                      const selected = templates.find((template) => String(template.id || template.templateType || '') === String(event.target.value));
                      updateForm({
                        templateId: event.target.value,
                        templateName: selected?.templateName || selected?.templateType || '',
                        message: selected?.messageBody || form.message
                      });
                    }} style={styles.select}>
                      <option value="">Use message only</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.templateName || template.templateType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Attachment URL</span>
                    <input value={form.attachmentUrl} onChange={(event) => updateForm({ attachmentUrl: event.target.value })} style={styles.input} placeholder="https://..." />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Attachment Name</span>
                    <input value={form.attachmentName} onChange={(event) => updateForm({ attachmentName: event.target.value })} style={styles.input} placeholder="offer.pdf" />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Schedule</span>
                    <input type="datetime-local" value={form.scheduleAt} onChange={(event) => updateForm({ scheduleAt: event.target.value, senderStatus: event.target.value ? 'Scheduled' : 'Ready' })} style={styles.input} />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Sender Status</span>
                    <select value={form.senderStatus} onChange={(event) => updateForm({ senderStatus: event.target.value })} style={styles.select}>
                      <option>Ready</option>
                      <option>Scheduled</option>
                      <option>Paused</option>
                    </select>
                  </label>
                </div>

                <label style={styles.field}>
                  <span style={styles.label}>Message</span>
                  <textarea value={form.message} onChange={(event) => updateForm({ message: event.target.value })} style={styles.textarea} placeholder="Write your campaign message here using {{customer_name}}, {{service_name}}, {{city}}, and similar placeholders." />
                </label>

                <div style={styles.fieldGrid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Notes</span>
                    <textarea value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} style={{ ...styles.textarea, minHeight: 80 }} placeholder="Internal note for the campaign." />
                  </label>

                  <div style={{ ...styles.helper, display: 'grid', gap: 10 }}>
                    <div style={styles.checkboxRow}>
                      <input type="checkbox" checked={form.allowDuplicatePhones} onChange={(event) => updateForm({ allowDuplicatePhones: event.target.checked })} />
                      <span style={styles.muted}>Allow duplicate numbers</span>
                    </div>
                    <div style={styles.checkboxRow}>
                      <input type="checkbox" checked={form.allowOptedOut} onChange={(event) => updateForm({ allowOptedOut: event.target.checked })} />
                      <span style={styles.muted}>Allow opted-out customers</span>
                    </div>
                    <div style={styles.checkboxRow}>
                      <CheckCircle2 size={14} color="#15803d" />
                      <span style={styles.muted}>Unique recipients: {dedupedRecipients.uniqueCount}</span>
                    </div>
                    <div style={styles.checkboxRow}>
                      <XCircle size={14} color="#b91c1c" />
                      <span style={styles.muted}>Duplicates removed: {dedupedRecipients.duplicatesRemoved}</span>
                    </div>
                    <div style={styles.checkboxRow}>
                      <ShieldAlert size={14} color="#92400e" />
                      <span style={styles.muted}>Opted out excluded: {dedupedRecipients.optedOutCount}</span>
                    </div>
                  </div>
                </div>

                <div style={styles.actionBar}>
                  <button type="button" disabled={saving || sendProgress.busy} style={styles.primaryButton} onClick={() => sendCampaign({ scheduleOnly: false })}>
                    <Send size={14} />
                    {sendProgress.busy ? `Sending ${sendProgress.sent}/${sendProgress.total}` : `Send Campaign (${dedupedRecipients.uniqueCount})`}
                  </button>
                  <button type="button" disabled={saving} style={styles.mutedButton} onClick={() => sendCampaign({ scheduleOnly: true })}>
                    <CalendarClock size={14} />
                    Schedule Campaign
                  </button>
                  <button type="button" disabled={saving} style={styles.mutedButton} onClick={() => { setForm(emptyForm); setSelectedIds([]); }}>
                    <Trash2 size={14} />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={styles.panel}>
              <div style={styles.panelPad}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>Recipient Preview</div>
                    <p style={styles.muted}>The campaign will be sent only after the count, dedupe, and opt-out checks are visible here.</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#111827' }}>{dedupedRecipients.uniqueCount}</div>
                    <div style={styles.muted}>Unique WhatsApp numbers</div>
                  </div>
                </div>
                <div style={styles.grid3}>
                  <div style={styles.helper}><div style={styles.statLabel}>Selected</div><div style={styles.statValue}>{dedupedRecipients.selectedCount}</div></div>
                  <div style={styles.helper}><div style={styles.statLabel}>Allowed</div><div style={styles.statValue}>{dedupedRecipients.uniqueCount}</div></div>
                  <div style={styles.helper}><div style={styles.statLabel}>Skipped</div><div style={styles.statValue}>{dedupedRecipients.duplicatesRemoved + dedupedRecipients.optedOutCount}</div></div>
                </div>
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <div style={styles.checkboxRow}>
                    <MessageSquareText size={14} />
                    <span style={styles.muted}>{previewTemplate ? previewTemplate.templateName : 'No template selected'}</span>
                  </div>
                  <div style={styles.checkboxRow}>
                    <Sparkles size={14} />
                    <span style={styles.muted}>{form.campaignType}</span>
                  </div>
                  <div style={styles.checkboxRow}>
                    <CalendarClock size={14} />
                    <span style={styles.muted}>{form.scheduleAt ? `Scheduled for ${form.scheduleAt}` : 'Send immediately'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelPad}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#111827', marginBottom: 10 }}>Preview Message</div>
                <div style={styles.helper}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Rendered sample</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#111827', fontSize: 14 }}>
                    {renderTemplate(form.message || quickTemplates[form.campaignType] || '', buildCampaignContext(filteredCustomers[0] || {}, form))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'Templates' ? (
        <div style={styles.panel}>
          <div style={styles.panelPad}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>WhatsApp Templates</div>
                <p style={styles.muted}>Reuse the same template library already used by the centralized WhatsApp module.</p>
              </div>
              <button type="button" style={styles.mutedButton} onClick={() => setActiveTab('Campaigns')}>
                <Plus size={14} />
                Use in Campaign
              </button>
            </div>

            <div style={{ ...styles.tableWrap, marginTop: 12 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Attachment</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Message</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td style={styles.td}>{template.templateName || template.templateType || '-'}</td>
                      <td style={styles.td}>{template.templateType || '-'}</td>
                      <td style={styles.td}>{template.attachmentOption || 'None'}</td>
                      <td style={styles.td}>{template.isActive ? 'Active' : 'Inactive'}</td>
                      <td style={{ ...styles.td, whiteSpace: 'pre-wrap' }}>{template.messageBody || '-'}</td>
                      <td style={styles.td}>
                        <button type="button" style={styles.actionButton} onClick={() => selectTemplate(template)}>Use</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'Audience' ? (
        <div style={styles.grid2}>
          <div style={styles.panel}>
            <div style={styles.panelPad}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>Audience Filters</div>
                  <p style={styles.muted}>Combine filters to narrow the list, then tick the records you want to send to.</p>
                </div>
                <div style={styles.actionBar}>
                  <button type="button" style={styles.actionButton} onClick={toggleSelectVisible}>
                    <Users size={14} />
                    {allSelectedVisible ? 'Clear Visible' : 'Select Visible'}
                  </button>
                  <button type="button" style={styles.mutedButton} onClick={() => { setSelectedIds([]); }}>
                    Clear Selection
                  </button>
                </div>
              </div>

              <div style={{ ...styles.helper, display: 'grid', gap: 10, marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#111827' }}>Smart CRM Segmentation</div>
                <div style={{ ...styles.fieldGrid, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <label style={styles.field}><span style={styles.label}>Renewal Window</span><select value={filters.renewalStatus === 'expired' ? 'expired' : filters.renewalDays} onChange={(event) => setFilters((prev) => ({ ...prev, renewalDays: event.target.value === 'expired' ? '' : event.target.value, renewalStatus: event.target.value === 'expired' ? 'expired' : '' }))} style={styles.select}><option value="">Any renewal date</option><option value="7">Next 7 days</option><option value="15">Next 15 days</option><option value="30">Next 30 days</option><option value="60">Next 60 days</option><option value="expired">Already expired</option></select></label>
                  <label style={styles.field}><span style={styles.label}>Contract Audience</span><select value={filters.contractAudience} onChange={(event) => setFilters((prev) => ({ ...prev, contractAudience: event.target.value }))} style={styles.select}><option value="">Any contract status</option><option value="active">Active contracts</option><option value="expired">Expired contracts</option><option value="expiring">Expiring soon</option><option value="renewed">Renewed contracts</option><option value="without_active">Without active contract</option></select></label>
                  <label style={styles.field}><span style={styles.label}>Outstanding</span><select value={filters.outstandingAudience} onChange={(event) => setFilters((prev) => ({ ...prev, outstandingAudience: event.target.value }))} style={styles.select}><option value="">Any balance</option><option value="outstanding">Outstanding customers</option><option value="overdue">Overdue customers</option></select></label>
                  <label style={styles.field}><span style={styles.label}>Dormant Activity</span><select value={filters.dormantMonths} onChange={(event) => setFilters((prev) => ({ ...prev, dormantMonths: event.target.value }))} style={styles.select}><option value="">Any activity</option><option value="3">No activity in 3 months</option><option value="6">No activity in 6 months</option><option value="12">No activity in 12 months</option><option value="18">No activity in 18 months</option><option value="24">No activity in 24 months</option></select></label>
                  <label style={styles.field}><span style={styles.label}>Has Service</span><select value={filters.hasService} onChange={(event) => setFilters((prev) => ({ ...prev, hasService: event.target.value }))} style={styles.select}><option value="">Any service</option>{audienceOptions.services.map((value) => <option key={`has-${value}`} value={value}>{value}</option>)}</select></label>
                  <label style={styles.field}><span style={styles.label}>Does Not Have</span><select value={filters.doesNotHaveService} onChange={(event) => setFilters((prev) => ({ ...prev, doesNotHaveService: event.target.value }))} style={styles.select}><option value="">No exclusion</option>{audienceOptions.services.map((value) => <option key={`not-${value}`} value={value}>{value}</option>)}</select></label>
                  <label style={styles.field}><span style={styles.label}>Area</span><select value={filters.area} onChange={(event) => setFilters((prev) => ({ ...prev, area: event.target.value }))} style={styles.select}><option value="">All areas</option>{audienceOptions.areas.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label style={styles.field}><span style={styles.label}>City</span><select value={filters.city} onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))} style={styles.select}><option value="">All cities</option>{audienceOptions.cities.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label style={styles.field}><span style={styles.label}>Sales Person</span><select value={filters.salesPerson} onChange={(event) => setFilters((prev) => ({ ...prev, salesPerson: event.target.value }))} style={styles.select}><option value="">All sales persons</option>{audienceOptions.salesPersons.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label style={styles.field}><span style={styles.label}>Exclude Contacted</span><select value={filters.excludeRecentlyContactedDays} onChange={(event) => setFilters((prev) => ({ ...prev, excludeRecentlyContactedDays: event.target.value }))} style={styles.select}><option value="0">Do not exclude</option><option value="7">Last 7 days</option><option value="15">Last 15 days</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option></select></label>
                </div>
                <div style={styles.checkboxRow}><ShieldAlert size={14} color="#92400e" /><span style={styles.muted}>Opted-out customers are always excluded. Payment audiences should use transactional or service-reminder templates.</span></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
                {Object.entries(filters).filter(([key]) => !['state', 'contractAudience', 'renewalDays', 'renewalStatus', 'outstandingAudience', 'dormantMonths', 'hasService', 'doesNotHaveService', 'excludeRecentlyContactedDays'].includes(key)).map(([key, value]) => (
                  <label key={key} style={styles.field}>
                    <span style={styles.label}>{key.replace(/([A-Z])/g, ' $1')}</span>
                    <input
                      value={value}
                      onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}
                      style={styles.input}
                      placeholder={`Filter by ${key}`}
                    />
                  </label>
                ))}
              </div>
              <div style={{ ...styles.helper, display: 'grid', gap: 8, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><strong>Server Audience Preview</strong><span style={styles.muted}>Updated from CRM data</span></div>
                <div style={{ ...styles.grid3, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                  {[
                    ['Matched', audiencePreview?.stats?.matched || 0], ['Missing phone', audiencePreview?.stats?.missingPhone || 0], ['Invalid phone', audiencePreview?.stats?.invalidPhone || 0], ['Opted out', audiencePreview?.stats?.optedOut || 0], ['Recent contact', audiencePreview?.stats?.recentlyContacted || 0], ['Final', audiencePreview?.stats?.finalRecipients || 0]
                  ].map(([label, value]) => <div key={label}><div style={styles.statLabel}>{label}</div><div style={{ ...styles.statValue, fontSize: 18 }}>{value}</div></div>)}
                </div>
                <div style={styles.actionBar}>
                  <button type="button" style={styles.mutedButton} onClick={async () => { const name = window.prompt('Audience preset name'); if (!name) return; await axios.post(`${API_BASE_URL}/api/whatsapp-marketing/audience-presets`, { name, filters }); await loadData(); setMessage('Audience rules saved.'); }}>Save Audience</button>
                  {audiencePresets.length ? <select style={{ ...styles.select, width: 220 }} defaultValue="" onChange={(event) => { const preset = audiencePresets.find((row) => row.id === event.target.value); if (preset) setFilters({ ...emptyFilters, ...preset.filters }); }}><option value="">Load saved audience</option>{audiencePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select> : null}
                </div>
              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 54 }}>Select</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Phone</th>
                    <th style={styles.th}>Service</th>
                    <th style={styles.th}>Area</th>
                    <th style={styles.th}>City</th>
                    <th style={styles.th}>Contract</th>
                    <th style={styles.th}>Renewal</th>
                    <th style={styles.th}>Balance</th>
                    <th style={styles.th}>Opt-out</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer._marketingId}>
                      <td style={styles.td}>
                        <input type="checkbox" checked={selectedIds.includes(customer._marketingId)} onChange={() => toggleSelected(customer._marketingId)} />
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 800, color: '#111827' }}>{customer.marketingDisplayName}</div>
                        <div style={styles.muted}>{customer.marketingLastCampaignLabel}</div>
                      </td>
                      <td style={styles.td}>{formatWhatsAppPhoneNumber(customer.marketingPhone || '') || '-'}</td>
                      <td style={styles.td}>{customer.marketingService || '-'}</td>
                      <td style={styles.td}>{customer.marketingArea || '-'}</td>
                      <td style={styles.td}>{customer.marketingCity || '-'}</td>
                      <td style={styles.td}>{customer.marketingContractStatus || '-'}</td>
                      <td style={styles.td}>{customer.marketingRenewalStatus || customer.marketingRenewalDate || '-'}</td>
                      <td style={styles.td}>{customer.marketingOutstandingBalance > 0 ? `₹${customer.marketingOutstandingBalance.toLocaleString('en-IN')}` : '-'}</td>
                      <td style={styles.td}>
                        <button
                          type="button"
                          style={{ ...styles.actionButton, minHeight: 30 }}
                          disabled={saving}
                          onClick={() => patchCustomerOptOut(customer, !customer.marketingOptedOut)}
                        >
                          {customer.marketingOptedOut ? 'Opted Out' : 'Allowed'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={styles.panel}>
              <div style={styles.panelPad}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>Selection Summary</div>
                <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                  <div style={styles.helper}><div style={styles.statLabel}>Filtered Customers</div><div style={styles.statValue}>{filteredCustomers.length}</div></div>
                  <div style={styles.helper}><div style={styles.statLabel}>Selected Rows</div><div style={styles.statValue}>{selectedIds.length || filteredCustomers.length}</div></div>
                  <div style={styles.helper}><div style={styles.statLabel}>Unique Numbers</div><div style={styles.statValue}>{dedupedRecipients.uniqueCount}</div></div>
                  <div style={styles.helper}><div style={styles.statLabel}>Duplicates Removed</div><div style={styles.statValue}>{dedupedRecipients.duplicatesRemoved}</div></div>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelPad}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>How It Works</div>
                <div style={styles.muted}>
                  <p>1. Choose a base audience and layer filters on top.</p>
                  <p>2. Select rows manually if you want a custom set.</p>
                  <p>3. Opted-out customers are skipped unless you explicitly allow them.</p>
                  <p>4. Duplicates are removed by normalized WhatsApp number before sending.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'Logs' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={styles.panel}>
            <div style={styles.panelPad}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>Campaign Logs</div>
                  <p style={styles.muted}>Saved campaign history from the marketing module.</p>
                </div>
                <button type="button" style={styles.mutedButton} onClick={loadData}>Refresh</button>
              </div>

              <div style={{ ...styles.tableWrap, marginTop: 12 }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Campaign</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Audience</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Recipients</th>
                      <th style={styles.th}>Sent</th>
                      <th style={styles.th}>Failed</th>
                      <th style={styles.th}>Scheduled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((row) => (
                      <tr key={row.id}>
                        <td style={styles.td}><Link to={`/sales/whatsapp-marketing/campaigns/${encodeURIComponent(row.id)}`} style={{ color: 'var(--color-primary-dark)', fontWeight: 800 }}>{row.campaignName || '-'}</Link></td>
                        <td style={styles.td}>{row.campaignType || '-'}</td>
                        <td style={styles.td}>{row.audienceLabel || '-'}</td>
                        <td style={styles.td}><span style={{ ...styles.badge, background: '#f8fafc', color: '#334155' }}>{getCampaignLabel(row)}</span></td>
                        <td style={styles.td}>{row.recipientCount || 0} / {row.uniqueRecipientCount || 0}</td>
                        <td style={styles.td}>{row.sentCount || 0}</td>
                        <td style={styles.td}>{row.failedCount || 0}</td>
                        <td style={styles.td}>{row.scheduleAt || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelPad}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>Delivery Logs</div>
              <p style={styles.muted}>These are the underlying WhatsApp sends created through the centralized sender.</p>
              <div style={{ ...styles.tableWrap, marginTop: 12 }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Time</th>
                      <th style={styles.th}>Recipient</th>
                      <th style={styles.th}>Phone</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLogs.map((row) => (
                      <tr key={row.id}>
                        <td style={styles.td}>{row.sentAt ? new Date(row.sentAt).toLocaleString('en-IN') : '-'}</td>
                        <td style={styles.td}>{row.recipientName || '-'}</td>
                        <td style={styles.td}>{formatWhatsAppPhoneNumber(row.recipientPhone || '') || '-'}</td>
                        <td style={styles.td}>{row.status || '-'}</td>
                        <td style={{ ...styles.td, whiteSpace: 'pre-wrap' }}>{row.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div style={styles.helper}>Loading WhatsApp marketing data...</div>
      ) : null}
    </div>
  );
}
