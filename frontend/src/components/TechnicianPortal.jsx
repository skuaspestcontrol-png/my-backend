import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { ArrowLeft, Camera, ClipboardList, FileCheck2, MapPin, UserCog } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const parseDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDisplayDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return value || '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDisplayTime = (value) => {
  if (!value) return '--:--';
  const [hour, minute] = String(value).split(':');
  if (!hour || !minute) return value;
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

const createCompletionCardNumber = () => `JC-${Date.now().toString().slice(-8)}`;

const formatAddress = (job) => {
  const pincode = String(job?.pincode || job?.pinCode || '').trim();
  return [job?.address, job?.areaName, job?.city, job?.state, pincode]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join(', ');
};

const isActiveJob = (job) => {
  const status = String(job?.status || '').trim().toLowerCase();
  if (job?.isDeleted || job?.deletedAt) return false;
  return !['completed', 'deleted', 'cancelled', 'canceled', 'archived', 'closed'].includes(status);
};

const buildVisibleJobs = (jobs, serviceSchedules, invoices, customers) => {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeSchedules = Array.isArray(serviceSchedules) ? serviceSchedules : [];
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const activeScheduleKeys = new Set(
    safeSchedules
      .map((schedule) => String(schedule?.scheduleKey || '').trim())
      .filter(Boolean)
  );
  const activeContractIds = new Set(
    safeInvoices.map((invoice) => String(invoice?._id || '').trim()).filter(Boolean)
  );
  const activeCustomerIds = new Set(
    safeCustomers.map((customer) => String(customer?._id || '').trim()).filter(Boolean)
  );

  const latestByKey = new Map();
  safeJobs.forEach((job) => {
    if (!isActiveJob(job)) return;

    const scheduleKey = String(job?.scheduleKey || '').trim();
    const contractId = String(job?.contractId || '').trim();
    const customerId = String(job?.customerId || '').trim();
    // Show only contract/schedule-linked jobs in Assigned Jobs.
    // Legacy ad-hoc rows without linkage are treated as stale/orphaned.
    if (!scheduleKey && !contractId) return;
    if (contractId && !activeContractIds.has(contractId)) return;
    if (customerId && !activeCustomerIds.has(customerId)) return;
    if (scheduleKey && activeScheduleKeys.size > 0 && !activeScheduleKeys.has(scheduleKey)) return;

    const dedupeKey = scheduleKey
      ? `${scheduleKey}::${String(job?.technicianId || '').trim()}`
      : String(job?._id || '').trim();
    if (!dedupeKey) return;

    const existing = latestByKey.get(dedupeKey);
    const existingTs = new Date(existing?.createdAt || 0).getTime();
    const nextTs = new Date(job?.createdAt || 0).getTime();
    if (!existing || nextTs >= existingTs) {
      latestByKey.set(dedupeKey, job);
    }
  });

  return Array.from(latestByKey.values()).sort((a, b) => {
    const aDate = String(a?.scheduledDate || '');
    const bDate = String(b?.scheduledDate || '');
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    const aTime = String(a?.scheduledTime || '');
    const bTime = String(b?.scheduledTime || '');
    return aTime.localeCompare(bTime);
  });
};

const shell = {
  page: {
    maxWidth: '1160px',
    margin: '0 auto',
    display: 'grid',
    gap: '14px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    backdropFilter: 'none'
  },
  hero: {
    background: 'var(--color-primary)',
    border: '1px solid rgba(159, 23, 77, 0.22)',
    borderRadius: '22px',
    padding: '18px',
    boxShadow: 'var(--shadow-soft)'
  },
  title: { margin: 0, color: '#ffffff', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em' },
  subtitle: { margin: '6px 0 0 0', color: 'rgba(255,255,255,0.92)', fontSize: '14px', lineHeight: 1.7, fontWeight: 600 },
  panel: {
    border: '1px solid rgba(159, 23, 77, 0.16)',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.84)',
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'blur(8px)',
    padding: '14px'
  },
  panelTitle: { margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  panelSub: { margin: '4px 0 0 0', color: '#475569', fontSize: '12px', fontWeight: 600 },
  completionCard: { border: '1px solid rgba(159, 23, 77, 0.2)', borderRadius: '14px', background: '#fff', padding: '12px', display: 'grid', gap: '10px' },
  completionActions: { display: 'flex', justifyContent: 'flex-end' },
  completionDownloadBtn: {
    border: '1px solid rgba(159, 23, 77, 0.34)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '8px',
    minHeight: '32px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  completionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  completionLabel: { margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  completionValue: { margin: '2px 0 0 0', fontSize: '13px', color: '#0f172a', fontWeight: 700 },
  completionMediaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  completionMediaImg: { width: '100%', height: '140px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.22)' },
  customerTableWrap: { marginTop: '12px', border: '1px solid rgba(159, 23, 77, 0.18)', borderRadius: '12px', background: '#fff', overflowX: 'auto' },
  customerTable: { width: '100%', borderCollapse: 'collapse', minWidth: '100%' },
  customerTh: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', background: '#f8fafc' },
  customerTd: { padding: '9px 10px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#334155', fontWeight: 600, verticalAlign: 'top' },
  customerName: { margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a' },
  viewBtn: { border: '1px solid #D1D5DB', background: '#fff', color: '#0f172a', borderRadius: '8px', minHeight: '28px', padding: '0 8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' },
  expandedCell: { padding: '10px', background: '#FDF2F8', borderBottom: '1px solid var(--color-border)' },
  jobsTableWrap: { overflowX: 'auto' },
  jobsTable: { width: '100%', borderCollapse: 'collapse', minWidth: '100%' },
  jobsTh: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', background: '#f8fafc' },
  jobsTd: { padding: '9px 10px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#334155', fontWeight: 600 },
  startSmallBtn: {
    border: '1px solid rgba(159, 23, 77, 0.34)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '8px',
    minHeight: '30px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    textTransform: 'uppercase'
  },
  pager: { marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  pagerText: { margin: 0, fontSize: '12px', color: '#475569', fontWeight: 700 },
  pagerActions: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  pagerBtn: { border: '1px solid #D1D5DB', background: '#fff', color: '#334155', borderRadius: '8px', minHeight: '30px', padding: '0 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  backBtn: {
    border: '1px solid rgba(148,163,184,0.4)',
    background: '#fff',
    color: '#334155',
    borderRadius: '10px',
    minHeight: '38px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  detailsGrid: { marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 12px' },
  field: { display: 'grid', gap: '6px' },
  label: { margin: 0, fontSize: '11px', color: '#334155', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' },
  valueBox: { minHeight: '42px', border: '1px solid rgba(159, 23, 77, 0.2)', borderRadius: '10px', background: 'rgba(252,231,243,0.68)', padding: '10px 12px', color: '#0f172a', fontSize: '13px', fontWeight: 700 },
  bigValueBox: { minHeight: '72px', border: '1px solid rgba(159, 23, 77, 0.2)', borderRadius: '10px', background: 'rgba(252,231,243,0.68)', padding: '10px 12px', color: '#0f172a', fontSize: '13px', fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  statusPill: { display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '999px', border: '1px solid rgba(159, 23, 77, 0.24)', background: 'rgba(252, 231, 243, 0.28)', color: 'var(--color-primary-dark)', padding: '6px 10px', fontSize: '12px', fontWeight: 700 },
  actionBtn: {
    border: '1px solid rgba(159, 23, 77, 0.34)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '10px',
    minHeight: '42px',
    padding: '0 14px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  fileInput: { width: '100%', minHeight: '42px', border: '1px solid rgba(159, 23, 77, 0.22)', borderRadius: '10px', background: '#fff', padding: '8px', fontSize: '12px' },
  photoWrap: { display: 'grid', gap: '8px' },
  photoPreview: { width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.22)' },
  signatureWrap: { border: '1px solid rgba(159, 23, 77, 0.24)', borderRadius: '10px', background: '#fff', overflowX: 'auto', padding: '8px' },
  completeBtn: {
    width: '100%',
    border: '1px solid rgba(159, 23, 77, 0.34)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '12px',
    minHeight: '46px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  emptyText: { margin: '8px 0 0 0', color: '#64748b', fontSize: '13px' }
};

export default function TechnicianPortal() {
  const [jobs, setJobs] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [customerPage, setCustomerPage] = useState(1);
  const [expandedCustomerKey, setExpandedCustomerKey] = useState('');
  const [completionCard, setCompletionCard] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [punchInTime, setPunchInTime] = useState(null);
  const [beforeUrl, setBeforeUrl] = useState('');
  const [afterUrl, setAfterUrl] = useState('');
  const [isPunchingIn, setIsPunchingIn] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingBefore, setIsUploadingBefore] = useState(false);
  const [isUploadingAfter, setIsUploadingAfter] = useState(false);
  const sigCanvas = useRef({});

  const loadPortalData = useCallback(async () => {
    try {
      const [jobsRes, schedulesRes, invoicesRes, customersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/jobs`),
        axios.get(`${API_BASE_URL}/api/service-schedules`),
        axios.get(`${API_BASE_URL}/api/invoices`),
        axios.get(`${API_BASE_URL}/api/customers`)
      ]);

      const nextSchedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];
      setJobs(buildVisibleJobs(jobsRes.data, nextSchedules, invoicesRes.data, customersRes.data));
    } catch (error) {
      console.error('Fetch failed', error);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refreshKeys = new Set(['customer_sync_tick', 'invoice_sync_tick', 'contract_sync_tick', 'jobs_sync_tick']);
    const safeRefresh = async () => {
      if (!active) return;
      await loadPortalData();
    };

    safeRefresh();

    const intervalId = window.setInterval(safeRefresh, 15000);
    const onFocus = () => { safeRefresh(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') safeRefresh();
    };
    const onStorage = (event) => {
      if (event.key && refreshKeys.has(event.key)) safeRefresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [loadPortalData]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const customerWiseJobs = useMemo(() => {
    const groups = new Map();
    jobs.forEach((job) => {
      const customerKey = String(job.customerId || job.customerName || '').trim().toLowerCase();
      const address = formatAddress(job) || 'Address not available';
      const key = `${customerKey}::${address.toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          customerName: job.customerName || 'Customer',
          mobileNumber: job.mobileNumber || '-',
          city: job.city || '-',
          state: job.state || '-',
          address,
          jobs: [],
          technicians: new Set()
        });
      }
      const group = groups.get(key);
      group.jobs.push(job);
      if (job.technicianName) group.technicians.add(job.technicianName);
      if ((!group.mobileNumber || group.mobileNumber === '-') && job.mobileNumber) group.mobileNumber = job.mobileNumber;
      if ((!group.city || group.city === '-') && job.city) group.city = job.city;
      if ((!group.state || group.state === '-') && job.state) group.state = job.state;
    });

    const sortedGroups = Array.from(groups.values())
      .map((group) => ({
        ...group,
        jobs: [...group.jobs].sort((a, b) => {
          const aStamp = `${a.scheduledDate || ''}T${a.scheduledTime || '00:00'}`;
          const bStamp = `${b.scheduledDate || ''}T${b.scheduledTime || '00:00'}`;
          return aStamp.localeCompare(bStamp);
        }),
        techniciansText: Array.from(group.technicians).slice(0, 2).join(', ') || '-'
      }))
      .sort((a, b) => String(a.customerName || '').localeCompare(String(b.customerName || ''), 'en', { sensitivity: 'base' }));

    return sortedGroups;
  }, [jobs]);

  const customersPerPage = 10;
  const totalCustomerPages = Math.max(1, Math.ceil(customerWiseJobs.length / customersPerPage));

  useEffect(() => {
    setCustomerPage((prev) => Math.min(prev, totalCustomerPages));
  }, [totalCustomerPages]);
  useEffect(() => {
    setExpandedCustomerKey('');
  }, [customerPage]);

  const paginatedCustomerWiseJobs = useMemo(() => {
    const start = (customerPage - 1) * customersPerPage;
    return customerWiseJobs.slice(start, start + customersPerPage);
  }, [customerPage, customerWiseJobs]);
  const isMobile = viewportWidth <= 900;
  const pageStyle = isMobile ? { ...shell.page, maxWidth: '100%', padding: '12px 10px' } : shell.page;
  const titleStyle = isMobile ? { ...shell.title, fontSize: '24px' } : shell.title;
  const completionGridStyle = isMobile ? { ...shell.completionGrid, gridTemplateColumns: '1fr' } : shell.completionGrid;
  const completionMediaGridStyle = isMobile ? { ...shell.completionMediaGrid, gridTemplateColumns: '1fr' } : shell.completionMediaGrid;
  const customerTableStyle = isMobile ? { ...shell.customerTable, minWidth: '700px' } : shell.customerTable;
  const jobsTableStyle = isMobile ? { ...shell.jobsTable, minWidth: '620px' } : shell.jobsTable;
  const detailsGridStyle = isMobile ? { ...shell.detailsGrid, gridTemplateColumns: '1fr' } : shell.detailsGrid;
  const pagerStyle = isMobile ? { ...shell.pager, flexDirection: 'column', alignItems: 'stretch' } : shell.pager;
  const signatureWidth = isMobile ? Math.max(260, Math.min(360, viewportWidth - 56)) : 520;

  const handleUpload = async (event, setUrl, setUploading) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('image', file);

    try {
      setUploading(true);
      const res = await axios.post(`${API_BASE_URL}/api/upload`, fd, { timeout: 20000 });
      setUrl(res.data.imageUrl);
    } catch (error) {
      console.error('Upload failed', error);
      window.alert(error?.response?.data?.error || error?.message || 'Photo upload failed. Please retry.');
    } finally {
      setUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const openJob = (job) => {
    setActiveJob(job);
    setPunchInTime(job.punchInTime || null);
    setBeforeUrl(job.beforePhoto || '');
    setAfterUrl(job.afterPhoto || '');
    if (sigCanvas.current && typeof sigCanvas.current.clear === 'function') {
      sigCanvas.current.clear();
    }
  };

  const handlePunchIn = async () => {
    if (!activeJob || isPunchingIn || isCompleting) return;
    const time = new Date().toLocaleString();
    setPunchInTime(time);

    try {
      setIsPunchingIn(true);
      await axios.put(`${API_BASE_URL}/api/jobs/${activeJob._id}`, { status: 'In Progress', punchInTime: time }, { timeout: 15000 });
      setJobs((prev) => prev.map((job) => (job._id === activeJob._id ? { ...job, status: 'In Progress', punchInTime: time } : job)));
      setActiveJob((prev) => (prev ? { ...prev, status: 'In Progress', punchInTime: time } : prev));
    } catch (error) {
      console.error('Punch in failed', error);
      window.alert(error?.response?.data?.error || error?.message || 'Unable to punch in. Please retry.');
    } finally {
      setIsPunchingIn(false);
    }
  };

  const handlePunchOut = async () => {
    if (!activeJob || isCompleting) return;
    const signaturePadReady = sigCanvas.current && typeof sigCanvas.current.isEmpty === 'function' && typeof sigCanvas.current.getTrimmedCanvas === 'function';
    const sig = signaturePadReady && !sigCanvas.current.isEmpty()
      ? sigCanvas.current.getTrimmedCanvas().toDataURL('image/jpeg', 0.7)
      : '';
    const resolvedPunchInTime = punchInTime || activeJob.punchInTime || new Date().toLocaleString();
    const completedAt = new Date().toISOString();
    const completionCardNumber = createCompletionCardNumber();
    const payload = {
      status: 'Completed',
      punchInTime: resolvedPunchInTime,
      punchOutTime: new Date(completedAt).toLocaleString(),
      beforePhoto: beforeUrl,
      afterPhoto: afterUrl,
      customerSignature: sig,
      completionCardNumber,
      completionCardGeneratedAt: completedAt
    };
    const fallbackPayload = {
      status: 'Completed',
      punchInTime: resolvedPunchInTime,
      punchOutTime: new Date(completedAt).toLocaleString(),
      completionCardNumber,
      completionCardGeneratedAt: completedAt
    };

    try {
      setIsCompleting(true);
      const completedJobId = activeJob._id;
      try {
        await axios.put(`${API_BASE_URL}/api/jobs/${completedJobId}`, payload, { timeout: 20000 });
      } catch (primaryError) {
        console.error('Primary completion payload failed, retrying minimal payload', primaryError);
        await axios.put(`${API_BASE_URL}/api/jobs/${completedJobId}`, fallbackPayload, { timeout: 15000 });
      }
      setCompletionCard({
        jobId: completedJobId,
        jobNumber: activeJob.jobNumber || '-',
        completionCardNumber,
        completedAt,
        customerName: activeJob.customerName || '-',
        mobileNumber: activeJob.mobileNumber || '-',
        address: formatAddress(activeJob) || '-',
        serviceName: activeJob.serviceName || activeJob.serviceInstructions || '-',
        visit: activeJob.scheduleVisit || '-',
        scheduledDate: activeJob.scheduledDate || '',
        scheduledTime: activeJob.scheduledTime || '',
        technicianName: activeJob.technicianName || '-',
        technicianMobile: activeJob.technicianMobile || '-',
        beforePhoto: beforeUrl,
        afterPhoto: afterUrl,
        customerSignature: sig
      });
      // Immediate UI update: remove completed job without waiting for full data refetch.
      setJobs((prev) => prev.filter((job) => job._id !== completedJobId));
      setActiveJob(null);
      setPunchInTime(null);
      setBeforeUrl('');
      setAfterUrl('');
      if (sigCanvas.current && typeof sigCanvas.current.clear === 'function') {
        sigCanvas.current.clear();
      }
      // Non-blocking background refresh for consistency.
      loadPortalData().catch((error) => {
        console.error('Background refresh after completion failed', error);
      });
    } catch (error) {
      console.error('Punch out failed', error);
      if (error?.response?.status === 413) {
        window.alert('Request payload is too large. Please retry with a shorter signature stroke or refresh and try again.');
      } else {
        window.alert(error?.response?.data?.error || error?.message || 'Failed to complete job. Please try again.');
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCompleteButton = () => {
    if (!activeJob) return;
    handlePunchOut();
  };

  if (!activeJob) {
    return (
      <section style={pageStyle}>
        <div style={shell.hero}>
          <h2 style={titleStyle}>Technician Portal</h2>
          <p style={shell.subtitle}>
            Track upcoming services, start assigned jobs, capture photos, and close work with customer signature in one themed workspace.
          </p>
        </div>
        {completionCard ? (
          <div style={shell.completionCard}>
            <h3 style={shell.panelTitle}><FileCheck2 size={16} /> Job Completion Card</h3>
            <div style={completionGridStyle}>
              <div>
                <p style={shell.completionLabel}>Job Number</p>
                <p style={shell.completionValue}>{completionCard.jobNumber}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Card Number</p>
                <p style={shell.completionValue}>{completionCard.completionCardNumber}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Completed On</p>
                <p style={shell.completionValue}>{new Date(completionCard.completedAt).toLocaleString()}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Customer</p>
                <p style={shell.completionValue}>{completionCard.customerName}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Mobile</p>
                <p style={shell.completionValue}>{completionCard.mobileNumber}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Visit</p>
                <p style={shell.completionValue}>{completionCard.visit}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Scheduled Time</p>
                <p style={shell.completionValue}>{formatDisplayDate(completionCard.scheduledDate)} {formatDisplayTime(completionCard.scheduledTime)}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Technician</p>
                <p style={shell.completionValue}>{completionCard.technicianName}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Technician Mobile</p>
                <p style={shell.completionValue}>{completionCard.technicianMobile}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={shell.completionLabel}>Address</p>
                <p style={shell.completionValue}>{completionCard.address}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={shell.completionLabel}>Service</p>
                <p style={shell.completionValue}>{completionCard.serviceName}</p>
              </div>
            </div>
            <div style={completionMediaGridStyle}>
              <div>
                <p style={shell.completionLabel}>Before Photo</p>
                {completionCard.beforePhoto ? <img src={completionCard.beforePhoto} alt="Before completion" style={shell.completionMediaImg} /> : <p style={shell.completionValue}>-</p>}
              </div>
              <div>
                <p style={shell.completionLabel}>After Photo</p>
                {completionCard.afterPhoto ? <img src={completionCard.afterPhoto} alt="After completion" style={shell.completionMediaImg} /> : <p style={shell.completionValue}>-</p>}
              </div>
              <div>
                <p style={shell.completionLabel}>Customer Signature</p>
                {completionCard.customerSignature ? <img src={completionCard.customerSignature} alt="Customer signature" style={shell.completionMediaImg} /> : <p style={shell.completionValue}>-</p>}
              </div>
            </div>
            <div style={shell.completionActions}>
              <button
                type="button"
                style={shell.completionDownloadBtn}
                onClick={() => window.open(`${API_BASE_URL}/api/jobs/${completionCard.jobId}/pdf`, '_blank')}
              >
                View Job PDF
              </button>
            </div>
          </div>
        ) : null}

        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><ClipboardList size={16} /> Assigned Jobs</h3>
          <p style={shell.panelSub}>Open any job to begin execution workflow.</p>
          {jobs.length === 0 ? (
            <p style={shell.emptyText}>No active assigned jobs right now.</p>
          ) : (
            <div style={shell.customerTableWrap}>
              <table style={customerTableStyle}>
                <thead>
                  <tr>
                    <th style={shell.customerTh}>Customer</th>
                    <th style={shell.customerTh}>Mobile</th>
                    <th style={shell.customerTh}>City/State</th>
                    <th style={shell.customerTh}>Visits</th>
                    <th style={shell.customerTh}>Next Visit</th>
                    <th style={shell.customerTh}>Technician</th>
                    <th style={shell.customerTh}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomerWiseJobs.map((group) => (
                    <React.Fragment key={group.key}>
                      <tr>
                        <td style={shell.customerTd}>
                          <p style={shell.customerName}>{group.customerName}</p>
                        </td>
                        <td style={shell.customerTd}>{group.mobileNumber || '-'}</td>
                        <td style={shell.customerTd}>{[group.city, group.state].filter((value) => value && value !== '-').join(', ') || '-'}</td>
                        <td style={shell.customerTd}>{group.jobs.length}</td>
                        <td style={shell.customerTd}>
                          {group.jobs[0] ? `${formatDisplayDate(group.jobs[0].scheduledDate)} ${formatDisplayTime(group.jobs[0].scheduledTime)}` : '-'}
                        </td>
                        <td style={shell.customerTd}>{group.techniciansText}</td>
                        <td style={shell.customerTd}>
                          <button
                            type="button"
                            style={shell.viewBtn}
                            onClick={() => setExpandedCustomerKey((prev) => (prev === group.key ? '' : group.key))}
                          >
                            {expandedCustomerKey === group.key ? 'Hide Jobs' : 'View Jobs'}
                          </button>
                        </td>
                      </tr>
                      {expandedCustomerKey === group.key ? (
                        <tr>
                          <td colSpan={7} style={shell.expandedCell}>
                            <div style={shell.jobsTableWrap}>
                              <table style={jobsTableStyle}>
                                <thead>
                                  <tr>
                                    <th style={shell.jobsTh}>Visit</th>
                                    <th style={shell.jobsTh}>Date</th>
                                    <th style={shell.jobsTh}>Time</th>
                                    <th style={shell.jobsTh}>Technician</th>
                                    <th style={shell.jobsTh}>Status</th>
                                    <th style={shell.jobsTh}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.jobs.map((job) => (
                                    <tr key={job._id}>
                                      <td style={shell.jobsTd}>{job.scheduleVisit || '-'}</td>
                                      <td style={shell.jobsTd}>{formatDisplayDate(job.scheduledDate)}</td>
                                      <td style={shell.jobsTd}>{formatDisplayTime(job.scheduledTime)}</td>
                                      <td style={shell.jobsTd}>{job.technicianName || '-'}</td>
                                      <td style={shell.jobsTd}>{job.status || '-'}</td>
                                      <td style={shell.jobsTd}>
                                        <button type="button" style={shell.startSmallBtn} onClick={() => openJob(job)}>
                                          {String(job.status || '').trim().toLowerCase() === 'in progress' ? 'Complete Job' : 'Start'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {customerWiseJobs.length > 0 ? (
            <div style={pagerStyle}>
              <p style={shell.pagerText}>
                Showing {(customerPage - 1) * customersPerPage + 1}-{Math.min(customerPage * customersPerPage, customerWiseJobs.length)} of {customerWiseJobs.length} customers
              </p>
              <div style={shell.pagerActions}>
                <button
                  type="button"
                  style={{ ...shell.pagerBtn, opacity: customerPage === 1 ? 0.5 : 1 }}
                  disabled={customerPage === 1}
                  onClick={() => setCustomerPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <p style={shell.pagerText}>Page {customerPage} of {totalCustomerPages}</p>
                <button
                  type="button"
                  style={{ ...shell.pagerBtn, opacity: customerPage === totalCustomerPages ? 0.5 : 1 }}
                  disabled={customerPage === totalCustomerPages}
                  onClick={() => setCustomerPage((prev) => Math.min(totalCustomerPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section style={pageStyle}>
      <div style={shell.panel}>
        <button type="button" style={shell.backBtn} onClick={() => setActiveJob(null)}>
          <ArrowLeft size={14} /> Back to Jobs
        </button>

        <div style={detailsGridStyle}>
          <div style={shell.field}>
            <p style={shell.label}>Customer</p>
            <div style={shell.valueBox}>{activeJob.customerName || '-'}</div>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Mobile</p>
            <div style={shell.valueBox}>{activeJob.mobileNumber || '-'}</div>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Visit Window</p>
            <div style={shell.valueBox}>{formatDisplayDate(activeJob.scheduledDate)} at {formatDisplayTime(activeJob.scheduledTime)}</div>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Assigned Technician</p>
            <div style={shell.valueBox}>{activeJob.technicianName || '-'} {activeJob.technicianMobile ? `(${activeJob.technicianMobile})` : ''}</div>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Address</p>
            <div style={shell.bigValueBox}>{formatAddress(activeJob) || '-'}</div>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Technician Blueprint</p>
            <div style={shell.bigValueBox}>{activeJob.technicianBlueprint || 'No blueprint provided.'}</div>
          </div>
          <div style={shell.field}>
            <p style={shell.label}>Service Instructions</p>
            <div style={shell.bigValueBox}>{activeJob.serviceInstructions || 'No special instructions.'}</div>
          </div>
        </div>
      </div>

      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><UserCog size={16} /> 1. Tracking</h3>
        <p style={shell.panelSub}>Punch in before starting field work.</p>
        {!punchInTime ? (
          <button type="button" style={shell.actionBtn} onClick={handlePunchIn} disabled={isPunchingIn || isCompleting}>
            {isPunchingIn ? 'Saving...' : 'Punch In'}
          </button>
        ) : (
          <div style={shell.statusPill}>Started: {punchInTime}</div>
        )}
      </div>

      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><Camera size={16} /> 2. Before/After Photos</h3>
        <p style={shell.panelSub}>Upload both photos before completing the job.</p>
        <div style={detailsGridStyle}>
          <div style={shell.photoWrap}>
            <p style={shell.label}>Before Photo</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={shell.fileInput}
              onChange={(event) => handleUpload(event, setBeforeUrl, setIsUploadingBefore)}
              disabled={isCompleting}
            />
            {beforeUrl ? <img src={beforeUrl} alt="Before" style={shell.photoPreview} /> : null}
          </div>
          <div style={shell.photoWrap}>
            <p style={shell.label}>After Photo</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={shell.fileInput}
              onChange={(event) => handleUpload(event, setAfterUrl, setIsUploadingAfter)}
              disabled={isCompleting}
            />
            {afterUrl ? <img src={afterUrl} alt="After" style={shell.photoPreview} /> : null}
          </div>
        </div>
      </div>

      <div style={shell.panel}>
        <h3 style={shell.panelTitle}><MapPin size={16} /> 3. Customer Signature</h3>
        <p style={shell.panelSub}>Capture signature before marking this job completed.</p>
        <div style={shell.signatureWrap}>
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{ width: signatureWidth, height: 170, style: { borderRadius: '8px', width: '100%', maxWidth: `${signatureWidth}px` } }}
          />
        </div>
      </div>

      <button
        type="button"
        style={shell.completeBtn}
        onClick={handleCompleteButton}
        disabled={isCompleting}
      >
        {isCompleting ? 'Saving...' : 'Complete Job'}
      </button>
    </section>
  );
}
