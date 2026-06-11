import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import trimCanvas from 'trim-canvas';
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  PenLine,
  Plus,
  Trash2,
  Upload,
  UserCog
} from 'lucide-react';
import PdfPreviewModal from './PdfPreviewModal';
import { useLocation, useParams } from 'react-router-dom';
import { triggerDashboardRefresh } from '../utils/dashboardRefresh';
import { getPortalUserName } from '../utils/portalAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const TECHNICIAN_PORTAL_CACHE_KEY = 'skuasmaster-technician-portal-cache-v1';

const readTechnicianPortalCache = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(TECHNICIAN_PORTAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      technicians: Array.isArray(parsed.technicians) ? parsed.technicians : [],
      updatedAt: Number(parsed.updatedAt || 0) || 0
    };
  } catch (_error) {
    return null;
  }
};

const writeTechnicianPortalCache = (snapshot = {}) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(TECHNICIAN_PORTAL_CACHE_KEY, JSON.stringify({
      jobs: Array.isArray(snapshot.jobs) ? snapshot.jobs : [],
      technicians: Array.isArray(snapshot.technicians) ? snapshot.technicians : [],
      updatedAt: Date.now()
    }));
  } catch (_error) {
    // Ignore storage failures so the portal still works in private mode or low-quota browsers.
  }
};

const parseDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDisplayDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return value || '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDisplayTime = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '--:--';

  const twentyFourHour = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = twentyFourHour[2];
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${suffix}`;
  }

  const twelveHour = raw.match(/^(\d{1,2})(?::([0-5]\d))?\s*([ap]m)$/i);
  if (twelveHour) {
    const hours = Number(twelveHour[1]);
    const minutes = (twelveHour[2] || '00').padStart(2, '0');
    const suffix = twelveHour[3].toUpperCase();
    if (!Number.isFinite(hours) || hours < 1 || hours > 12) return raw;
    return `${hours}:${minutes} ${suffix}`;
  }

  return raw;
};

const createCompletionCardNumber = () => `JC-${Date.now().toString().slice(-8)}`;

const DEFAULT_CHECKLIST_ITEMS = [
  'Customer issue confirmed',
  'Site inspected',
  'Treatment completed',
  'Safety explained to customer',
  'Before / during / after photos uploaded',
  'Customer signature taken'
];
const PEST_INFESTATION_LEVEL_OPTIONS = ['Low', 'Medium', 'High', 'Severe'];

const createDraftId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const createDefaultChemical = (label = '') => ({
  id: createDraftId('chem'),
  chemicalName: label,
  quantityUsed: '',
  dilutionRatio: '',
  targetPest: '',
  areaTreated: '',
  safetyFollowed: false
});

const createDefaultChecklistItems = () =>
  DEFAULT_CHECKLIST_ITEMS.map((label) => ({
    id: createDraftId('check'),
    label,
    done: false
  }));

const normalizePhotoArray = (value, fallbackSingle = '') => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  const single = String(value || fallbackSingle || '').trim();
  return single ? [single] : [];
};

const normalizeChemicals = (value) => {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows
    .map((row, index) => ({
      id: String(row?.id || '').trim() || createDraftId(`chem-${index}`),
      chemicalName: String(row?.chemicalName || row?.name || '').trim(),
      quantityUsed: String(row?.quantityUsed || row?.quantity || '').trim(),
      dilutionRatio: String(row?.dilutionRatio || row?.ratio || '').trim(),
      targetPest: String(row?.targetPest || row?.pest || '').trim(),
      areaTreated: String(row?.areaTreated || row?.area || '').trim(),
      safetyFollowed: Boolean(row?.safetyFollowed ?? row?.safety ?? false)
    }))
    .filter((row, index, self) => {
      const hasContent = Object.values(row).some((entry) => {
        if (typeof entry === 'boolean') return entry;
        return String(entry || '').trim() !== '';
      });
      return hasContent || index === 0;
    });
  return normalized.length > 0 ? normalized.slice(0, 12) : [createDefaultChemical()];
};

const normalizeChecklist = (value) => {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.map((row, index) => ({
    id: String(row?.id || '').trim() || createDraftId(`check-${index}`),
    label: String(row?.label || DEFAULT_CHECKLIST_ITEMS[index] || `Checklist ${index + 1}`).trim(),
    done: Boolean(row?.done || row?.checked || false)
  }));
  if (normalized.length > 0) {
    return normalized;
  }
  return createDefaultChecklistItems();
};

const buildWizardDraft = (job = {}) => ({
  beforePhotos: normalizePhotoArray(job.beforePhotos, job.beforePhoto),
  afterPhotos: normalizePhotoArray(job.afterPhotos, job.afterPhoto),
  chemicalsUsed: normalizeChemicals(job.chemicalsUsed),
  checklistItems: normalizeChecklist(job.checklistItems),
  infestationLevel: String(job.infestationLevel || job.infestation_level || '').trim(),
  customerRepresentativeName: String(
    job.customerRepresentativeName
    || job.customer_representative_name
    || job.contactPersonName
    || job.contact_person_name
    || job.customerContactPersonName
    || job.customerContactPerson
    || ''
  ).trim(),
  customerRepresentativeMobile: String(
    job.customerRepresentativeMobile
    || job.customer_representative_mobile
    || job.contactPersonMobile
    || job.contact_person_mobile
    || job.customerContactPersonMobile
    || job.customerPhone
    || job.mobileNumber
    || job.mobile
    || ''
  ).trim(),
  customerSignature: String(job.customerSignature || job.customer_signature || '').trim(),
  technicianSignature: String(job.technicianSignature || job.technician_signature || '').trim(),
  reviewRemarks: String(job.reviewRemarks || job.remarks || '').trim()
});

const wizardSteps = [
  { key: 'photos', label: 'Photos', icon: Camera, countLabel: '1' },
  { key: 'chemicals', label: 'Chemicals', icon: FlaskConical, countLabel: '2' },
  { key: 'checklist', label: 'Checklist', icon: ClipboardList, countLabel: '3' },
  { key: 'signature', label: 'Signature', icon: PenLine, countLabel: '4' },
  { key: 'review', label: 'Review', icon: FileCheck2, countLabel: '5' }
];

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
  return !['deleted', 'cancelled', 'canceled', 'archived', 'closed'].includes(status);
};

const isCompletedJob = (job) => String(job?.status || '').trim().toLowerCase() === 'completed';
const isInProgressJob = (job) => String(job?.status || '').trim().toLowerCase() === 'in progress';

const getTechnicianNames = (job = {}) => {
  const explicitAssignments = Array.isArray(job?.technicianAssignments) ? job.technicianAssignments : [];
  const names = explicitAssignments
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  if (names.length > 0) return Array.from(new Set(names));

  const fallback = String(job?.technicianName || '').trim();
  if (!fallback) return [];
  return Array.from(new Set(
    fallback
      .split(',')
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  ));
};

const getTechnicianIds = (job = {}) => {
  const explicitIds = Array.isArray(job?.technicianIds) ? job.technicianIds : [];
  const ids = explicitIds
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  if (ids.length > 0) return Array.from(new Set(ids));

  const fallback = String(job?.technicianId || '').trim();
  if (!fallback) return [];
  return [fallback];
};

const getJobPriority = (job = {}) => {
  const status = String(job?.status || '').trim().toLowerCase();
  if (status === 'completed') return 3;
  if (status === 'in progress') return 2;
  if (status === 'scheduled') return 1;
  return 0;
};

const getJobSortStamp = (job = {}) => {
  const stamp = String(job?.updatedAt || job?.sourceUpdatedAt || job?.serviceEndTime || job?.serviceStartTime || job?.createdAt || '').trim();
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
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
    // Do not hide active jobs if linked datasets are briefly out-of-sync after deploy.
    // This prevents "Assigned Jobs" from appearing empty/flashing when contracts/customers
    // are still syncing.

    const technicianNames = getTechnicianNames(job);
    const technicianIds = getTechnicianIds(job);
    const hasTechnician = Boolean(technicianNames.length > 0 || technicianIds.length > 0);
    if (!hasTechnician) return;

    const dedupeKey = scheduleKey || String(job?._id || '').trim();
    if (!dedupeKey) return;

    const existing = latestByKey.get(dedupeKey);
    const existingTechnicianNames = getTechnicianNames(existing || {});
    const existingTechnicianIds = getTechnicianIds(existing || {});
    const mergedTechnicianNames = Array.from(new Set([...(existingTechnicianNames || []), ...technicianNames]));
    const mergedTechnicianIds = Array.from(new Set([...(existingTechnicianIds || []), ...technicianIds]));
    const nextRow = {
      ...(existing || {}),
      ...(getJobPriority(job) > getJobPriority(existing || {}) || (getJobPriority(job) === getJobPriority(existing || {}) && getJobSortStamp(job) >= getJobSortStamp(existing || {})) ? job : {}),
      technicianAssignments: mergedTechnicianNames,
      technicianIds: mergedTechnicianIds,
      technicianName: mergedTechnicianNames.join(', '),
      technicianId: mergedTechnicianIds[0] || String((existing || job)?.technicianId || '').trim() || ''
    };
    if (!existing) {
      latestByKey.set(dedupeKey, nextRow);
      return;
    }
    latestByKey.set(dedupeKey, nextRow);
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

const SignaturePadBox = forwardRef(function SignaturePadBox(
  {
    penColor = '#000000',
    strokeWidth = 2.25,
    height = '100%',
    maxWidth = '100%'
  },
  ref
) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const pointerIdRef = useRef(null);
  const hasInkRef = useRef(false);
  const dprRef = useRef(1);
  const strokeCleanupRef = useRef(null);

  const syncDebugState = useCallback(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    window.__skuasSignatureDebug = {
      isDrawing: drawingRef.current,
      activePointerId: pointerIdRef.current
    };
  }, []);

  const getResolvedHeight = useCallback(() => (typeof height === 'number' ? `${height}px` : String(height || '100%')), [height]);

  const stopStroke = useCallback((event) => {
    const canvas = canvasRef.current;
    const activePointerId = pointerIdRef.current;
    if (typeof strokeCleanupRef.current === 'function') {
      const cleanup = strokeCleanupRef.current;
      strokeCleanupRef.current = null;
      cleanup();
    } else {
      drawingRef.current = false;
      pointerIdRef.current = null;
    }
    if (!canvas) return;
    if (activePointerId !== null && canvas.hasPointerCapture?.(activePointerId)) {
      try {
        canvas.releasePointerCapture(activePointerId);
      } catch (_error) {
        // Ignore release issues if the browser already cleared capture.
      }
    }
    syncDebugState();
    if (event?.preventDefault) event.preventDefault();
  }, [syncDebugState]);

  const getPoint = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }, []);

  const configureContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = penColor;
    context.lineWidth = strokeWidth;
    return context;
  }, [penColor, strokeWidth]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const nextDpr = Math.max(window.devicePixelRatio || 1, 1);
    const nextWidth = Math.max(1, Math.round(rect.width * nextDpr));
    const nextHeight = Math.max(1, Math.round(rect.height * nextDpr));
    if (canvas.width === nextWidth && canvas.height === nextHeight && dprRef.current === nextDpr) {
      return;
    }

    const snapshot = hasInkRef.current ? canvas.toDataURL('image/png') : '';
    dprRef.current = nextDpr;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const context = configureContext();
    if (!context) return;
    context.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    if (snapshot) {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, rect.width, rect.height);
        context.drawImage(image, 0, 0, rect.width, rect.height);
      };
      image.src = snapshot;
    }
  }, [configureContext]);

  const handlePointerDown = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    resizeCanvas();

    const context = configureContext();
    const point = getPoint(event);
    if (!context || !point) return;

    drawingRef.current = true;
    pointerIdRef.current = event.pointerId;
    hasInkRef.current = true;
    syncDebugState();

    if (typeof strokeCleanupRef.current === 'function') {
      strokeCleanupRef.current();
    }
    const cleanupStrokeListeners = (cleanupEvent) => {
      window.removeEventListener('pointerup', cleanupStrokeListeners, true);
      window.removeEventListener('pointercancel', cleanupStrokeListeners, true);
      window.removeEventListener('blur', cleanupStrokeListeners, true);
      document.removeEventListener('visibilitychange', cleanupStrokeListeners, true);
      strokeCleanupRef.current = null;
      stopStroke(cleanupEvent);
    };
    strokeCleanupRef.current = cleanupStrokeListeners;
    window.addEventListener('pointerup', cleanupStrokeListeners, true);
    window.addEventListener('pointercancel', cleanupStrokeListeners, true);
    window.addEventListener('blur', cleanupStrokeListeners, true);
    document.addEventListener('visibilitychange', cleanupStrokeListeners, true);

    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore capture failures on browsers that do not support it fully.
      }
    }

    context.beginPath();
    context.moveTo(point.x, point.y);
  }, [configureContext, getPoint, resizeCanvas, stopStroke, syncDebugState]);

  const handlePointerMove = useCallback((event) => {
    if (!drawingRef.current || pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    const context = configureContext();
    const point = getPoint(event);
    if (!canvas || !context || !point) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  }, [configureContext, getPoint]);

  useEffect(() => {
    resizeCanvas();
    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (typeof strokeCleanupRef.current === 'function') {
        const cleanup = strokeCleanupRef.current;
        strokeCleanupRef.current = null;
        cleanup();
      }
    };
  }, [resizeCanvas]);

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      context.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
      context.clearRect(0, 0, canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);
      hasInkRef.current = false;
      drawingRef.current = false;
      pointerIdRef.current = null;
      syncDebugState();
      if (typeof strokeCleanupRef.current === 'function') {
        const cleanup = strokeCleanupRef.current;
        strokeCleanupRef.current = null;
        cleanup();
      }
    },
    isEmpty() {
      return !hasInkRef.current;
    },
    getTrimmedCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return document.createElement('canvas');
      const clone = document.createElement('canvas');
      clone.width = canvas.width;
      clone.height = canvas.height;
      const context = clone.getContext('2d');
      if (context) {
        context.drawImage(canvas, 0, 0);
      }
      return trimCanvas(clone);
    },
    fromDataURL(dataURL) {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context || !dataURL) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          resizeCanvas();
          const width = canvas.clientWidth || canvas.width / dprRef.current;
          const height = canvas.clientHeight || canvas.height / dprRef.current;
          context.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
          context.clearRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          hasInkRef.current = true;
          resolve();
        };
        image.onerror = reject;
        image.src = dataURL;
      });
    },
    toDataURL(type = 'image/png', quality) {
      const canvas = canvasRef.current;
      return canvas ? canvas.toDataURL(type, quality) : '';
    }
  }), [resizeCanvas, syncDebugState]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth,
        height: getResolvedHeight(),
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#fff',
        pointerEvents: 'auto',
        boxSizing: 'border-box',
        zIndex: 0
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopStroke}
        onPointerCancel={stopStroke}
        onLostPointerCapture={stopStroke}
        onPointerLeave={(event) => {
          if (drawingRef.current && pointerIdRef.current === event.pointerId) {
            stopStroke(event);
          }
        }}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: 'crosshair',
          pointerEvents: 'auto',
          background: '#fff'
        }}
      />
    </div>
  );
});

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
  signatureInfoGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' },
  signatureMetaField: { display: 'grid', gap: '6px' },
  signatureMetaInput: { width: '100%', minHeight: '38px', border: '1px solid #d1d5db', borderRadius: '10px', padding: '0 10px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box', background: '#fff', fontWeight: 600 },
  customerTableWrap: { marginTop: '12px', border: '1px solid rgba(159, 23, 77, 0.18)', borderRadius: '12px', background: '#fff', overflowX: 'auto' },
  customerTable: { width: '100%', borderCollapse: 'collapse', minWidth: '100%' },
  customerTh: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', background: '#f8fafc' },
  customerTd: { padding: '9px 10px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#334155', fontWeight: 600, verticalAlign: 'top' },
  customerName: { margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a' },
  viewBtn: { border: '1px solid #D1D5DB', background: '#fff', color: '#0f172a', borderRadius: '8px', minHeight: '28px', padding: '0 8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' },
  mobileAssignedCard: { border: '1px solid rgba(159, 23, 77, 0.16)', borderRadius: '14px', background: '#fff', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' },
  mobileAssignedCardHeader: { padding: '12px 12px 10px', borderBottom: '1px solid rgba(226,232,240,0.9)', display: 'grid', gap: '6px' },
  mobileAssignedCardTitle: { margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' },
  mobileAssignedCardMeta: { display: 'grid', gap: '2px', fontSize: '12px', color: '#475569', fontWeight: 600, lineHeight: 1.35 },
  mobileAssignedCardBody: { padding: '10px 12px 12px', display: 'grid', gap: '10px' },
  mobileAssignedFieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  mobileAssignedField: { border: '1px solid rgba(226,232,240,0.9)', borderRadius: '10px', background: '#f8fafc', padding: '8px 10px', display: 'grid', gap: '2px' },
  mobileAssignedLabel: { fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.25 },
  mobileAssignedValue: { fontSize: '12px', fontWeight: 700, color: '#0f172a', lineHeight: 1.35, wordBreak: 'break-word' },
  mobileAssignedExpandBtn: { border: '1px solid #D1D5DB', background: '#fff', color: '#0f172a', borderRadius: '10px', minHeight: '32px', padding: '0 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' },
  mobileJobList: { display: 'grid', gap: '8px' },
  mobileJobCard: { border: '1px solid rgba(226,232,240,0.95)', borderRadius: '12px', background: '#fff', padding: '10px', display: 'grid', gap: '8px' },
  mobileJobTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  mobileJobTitle: { margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a' },
  mobileJobStatus: { fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' },
  mobileJobActions: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  expandedCell: { padding: '10px', background: '#fff', borderBottom: '1px solid var(--color-border)' },
  jobsTableWrap: { overflowX: 'auto', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '12px', background: '#fff' },
  jobsTable: { width: '100%', borderCollapse: 'collapse', minWidth: '100%' },
  jobsTh: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', background: '#f8fafc' },
  jobsTd: { padding: '9px 10px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#334155', fontWeight: 600 },
  actionCell: { width: '300px' },
  actionRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap'
  },
  pdfBtn: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1e3a8a',
    borderRadius: '8px',
    minHeight: '30px',
    minWidth: '74px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center'
  },
  startSmallBtn: {
    border: '1px solid rgba(159, 23, 77, 0.34)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '8px',
    minHeight: '30px',
    padding: '0 12px',
    minWidth: '150px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  editBtn: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    borderRadius: '8px',
    minHeight: '30px',
    minWidth: '80px',
    padding: '0 12px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center'
  },
  removeBtn: {
    border: '1px solid #fecaca',
    background: '#fff5f5',
    color: '#b91c1c',
    borderRadius: '8px',
    minHeight: '30px',
    minWidth: '96px',
    padding: '0 12px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center'
  },
  pager: { marginTop: '10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  pagerText: { margin: 0, fontSize: '12px', color: '#475569', fontWeight: 700 },
  pagerActions: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  pagerBtn: { border: '1px solid #D1D5DB', background: '#fff', color: '#334155', borderRadius: '8px', width: '34px', minWidth: '34px', minHeight: '32px', height: '32px', padding: 0, fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
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
  valueBox: { minHeight: '42px', border: '1px solid var(--color-border)', borderRadius: '10px', background: '#F8FAFC', padding: '10px 12px', color: '#0f172a', fontSize: '13px', fontWeight: 700 },
  bigValueBox: { minHeight: '72px', border: '1px solid var(--color-border)', borderRadius: '10px', background: '#F8FAFC', padding: '10px 12px', color: '#0f172a', fontSize: '13px', fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
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
  costAddBtn: {
    border: '1px solid rgba(159, 23, 77, 0.28)',
    background: '#fff',
    color: 'var(--color-primary-dark)',
    borderRadius: '10px',
    minHeight: '38px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  costModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.56)', zIndex: 6500, display: 'grid', placeItems: 'center', padding: '16px' },
  costModalCard: { width: 'min(100%, 560px)', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '16px', border: '1px solid rgba(148,163,184,0.2)', boxShadow: '0 24px 60px rgba(15,23,42,0.18)', overflow: 'hidden' },
  costModalHead: { padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' },
  costModalTitle: { margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' },
  costModalBody: { padding: '12px 14px', display: 'grid', gap: '10px' },
  costModalGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' },
  costModalField: { display: 'grid', gap: '5px' },
  costModalLabel: { margin: 0, fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  costModalInput: { width: '100%', minHeight: '38px', border: '1px solid #d1d5db', borderRadius: '10px', padding: '0 10px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box', background: '#fff' },
  costModalTextarea: { width: '100%', minHeight: '72px', border: '1px solid #d1d5db', borderRadius: '10px', padding: '10px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box', resize: 'vertical', background: '#fff' },
  costModalHint: { margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.5, background: '#fff', border: '1px solid rgba(148,163,184,0.16)', borderRadius: '10px', padding: '8px 10px' },
  costModalPreview: { border: '1px solid rgba(148,163,184,0.18)', borderRadius: '10px', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', padding: '10px 12px', fontSize: '12px', color: '#334155', fontWeight: 700 },
  costModalFooter: { padding: '12px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fff' },
  fileInput: { width: '100%', minHeight: '42px', border: '1px solid rgba(159, 23, 77, 0.22)', borderRadius: '10px', background: '#fff', padding: '8px', fontSize: '12px' },
  photoWrap: { display: 'grid', gap: '8px' },
  photoPreview: { width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(159, 23, 77, 0.22)' },
  signatureWrap: {
    position: 'relative',
    width: '100%',
    height: '170px',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    borderRadius: '10px',
    background: '#fff',
    overflow: 'hidden',
    padding: '8px',
    boxSizing: 'border-box',
    zIndex: 0
  },
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
  workflowTabs: { position: 'relative', zIndex: 50, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' },
  workflowTab: {
    border: '1px solid rgba(159, 23, 77, 0.18)',
    borderRadius: '12px',
    background: '#fff',
    color: '#64748b',
    minHeight: '76px',
    padding: '10px 8px',
    display: 'grid',
    gap: '6px',
    justifyItems: 'center',
    alignContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(15,23,42,0.05)',
    position: 'relative',
    zIndex: 51
  },
  workflowTabActive: {
    background: 'var(--color-primary)',
    borderColor: 'rgba(159, 23, 77, 0.45)',
    color: '#fff',
    boxShadow: '0 10px 24px rgba(159, 23, 77, 0.18)'
  },
  workflowTabIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  workflowTabLabel: { margin: 0, fontSize: '11px', fontWeight: 800, textAlign: 'center', lineHeight: 1.2 },
  workflowCard: {
    position: 'relative',
    isolation: 'isolate',
    border: '1px solid rgba(159, 23, 77, 0.18)',
    borderRadius: '16px',
    background: '#fff',
    padding: '14px',
    display: 'grid',
    gap: '12px'
  },
  workflowHeader: { display: 'grid', gap: '4px' },
  workflowTitle: { margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' },
  workflowSub: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600, lineHeight: 1.5 },
  stepGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' },
  sectionCard: { border: '1px solid rgba(159, 23, 77, 0.14)', borderRadius: '14px', background: '#fff', padding: '12px', display: 'grid', gap: '10px' },
  sectionTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
  sectionTitle: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  sectionSub: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600, lineHeight: 1.4 },
  photoButton: {
    border: '1px dashed rgba(159, 23, 77, 0.42)',
    background: 'rgba(252,231,243,0.42)',
    color: 'var(--color-primary-dark)',
    borderRadius: '12px',
    minHeight: '56px',
    padding: '10px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%'
  },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' },
  photoTile: {
    position: 'relative',
    border: '1px solid rgba(159, 23, 77, 0.16)',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#fff'
  },
  photoTileImg: { width: '100%', height: '110px', objectFit: 'cover', display: 'block' },
  photoTileRemove: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '26px',
    height: '26px',
    borderRadius: '999px',
    border: '1px solid rgba(159, 23, 77, 0.22)',
    background: 'rgba(255,255,255,0.92)',
    color: '#b91c1c',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  textInput: {
    width: '100%',
    minHeight: '42px',
    border: '1px solid rgba(159, 23, 77, 0.18)',
    borderRadius: '10px',
    background: '#fff',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#0f172a',
    boxSizing: 'border-box'
  },
  textArea: {
    width: '100%',
    minHeight: '84px',
    border: '1px solid rgba(159, 23, 77, 0.18)',
    borderRadius: '10px',
    background: '#fff',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#0f172a',
    boxSizing: 'border-box',
    resize: 'vertical'
  },
  checkboxList: { display: 'grid', gap: '8px' },
  checkboxItem: {
    border: '1px solid rgba(159, 23, 77, 0.14)',
    borderRadius: '10px',
    background: '#fff',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  checkbox: { width: '18px', height: '18px', accentColor: 'var(--color-primary)' },
  chemicalCard: { border: '1px solid rgba(159, 23, 77, 0.14)', borderRadius: '12px', background: '#fff', padding: '12px', display: 'grid', gap: '10px' },
  chemicalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
  chemicalTitle: { margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a' },
  chemicalRemoveBtn: {
    border: '1px solid #fecaca',
    background: '#fff5f5',
    color: '#b91c1c',
    borderRadius: '8px',
    minHeight: '28px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  chemicalGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  addChemicalBtn: {
    width: '100%',
    border: '1px solid rgba(159, 23, 77, 0.2)',
    background: '#FDF2F8',
    color: 'var(--color-primary-dark)',
    borderRadius: '12px',
    minHeight: '42px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  reviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  reviewStat: { border: '1px solid rgba(159, 23, 77, 0.14)', borderRadius: '12px', background: 'rgba(252,231,243,0.6)', padding: '10px 12px', display: 'grid', gap: '4px' },
  reviewStatLabel: { margin: 0, fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  reviewStatValue: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' },
  reviewNote: { borderRadius: '12px', background: '#FEF3C7', color: '#B45309', padding: '10px 12px', fontSize: '12px', fontWeight: 700, lineHeight: 1.5 },
  wizardFooter: {
    position: 'relative',
    zIndex: 60,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '2px'
  },
  wizardBackBtn: {
    border: '1px solid rgba(148,163,184,0.4)',
    background: '#fff',
    color: '#334155',
    borderRadius: '12px',
    minHeight: '46px',
    padding: '0 14px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    position: 'relative',
    zIndex: 61
  },
  wizardNextBtn: {
    border: '1px solid rgba(159, 23, 77, 0.34)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '12px',
    minHeight: '46px',
    padding: '0 14px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    position: 'relative',
    zIndex: 61
  },
  emptyText: { margin: '8px 0 0 0', color: '#64748b', fontSize: '13px' }
};

export default function TechnicianPortal() {
  const location = useLocation();
  const params = useParams();
  const lastJobsSyncTickRef = useRef('');
  const cachedPortalState = useMemo(() => readTechnicianPortalCache(), []);
  const [jobs, setJobs] = useState(() => Array.isArray(cachedPortalState?.jobs) ? cachedPortalState.jobs : []);
  const [technicians, setTechnicians] = useState(() => Array.isArray(cachedPortalState?.technicians) ? cachedPortalState.technicians : []);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [customerPage, setCustomerPage] = useState(1);
  const [expandedCustomerKey, setExpandedCustomerKey] = useState('');
  const [completionCard, setCompletionCard] = useState(null);
  const [pdfPreview, setPdfPreview] = useState({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', shareContext: null });
  const [activeJob, setActiveJob] = useState(null);
  const [wizardStep, setWizardStep] = useState('photos');
  const [jobWizard, setJobWizard] = useState(() => buildWizardDraft({}));
  const [punchInTime, setPunchInTime] = useState(null);
  const [isPunchingIn, setIsPunchingIn] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isSavingWizard, setIsSavingWizard] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [showCostModal, setShowCostModal] = useState(false);
  const [costModalSaving, setCostModalSaving] = useState(false);
  const [costModalError, setCostModalError] = useState('');
  const [costDraft, setCostDraft] = useState({
    itemType: 'other',
    description: '',
    quantity: '1',
    unit: 'visit',
    unitCost: '',
    notes: '',
    stockItemId: ''
  });
  const customerSigCanvas = useRef({});
  const technicianSigCanvas = useRef({});
  const workflowTabButtonRefs = useRef([]);
  const wizardBackButtonRef = useRef(null);
  const wizardNextButtonRef = useRef(null);
  const signatureClearButtonRef = useRef(null);
  const orphanCleanupNoticeTimerRef = useRef(null);
  const portalDataLoadingRef = useRef(false);
  const beforePhotoInputRef = useRef(null);
  const afterPhotoInputRef = useRef(null);

  const loadPortalData = useCallback(async () => {
    if (portalDataLoadingRef.current) return;
    portalDataLoadingRef.current = true;
    try {
      const stamp = Date.now();
      const supportRequestsPromise = Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/invoices`, { params: { _t: stamp }, headers: { 'Cache-Control': 'no-cache' }, timeout: 15000 }),
        axios.get(`${API_BASE_URL}/api/customers`, { params: { _t: stamp }, headers: { 'Cache-Control': 'no-cache' }, timeout: 15000 })
      ]);
      const criticalRequests = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/jobs`, { params: { _t: stamp, includeInactive: true }, headers: { 'Cache-Control': 'no-cache' }, timeout: 15000 }),
        axios.get(`${API_BASE_URL}/api/service-schedules`, { params: { _t: stamp }, headers: { 'Cache-Control': 'no-cache' }, timeout: 15000 }),
        axios.get(`${API_BASE_URL}/api/employees`, { params: { _t: stamp }, headers: { 'Cache-Control': 'no-cache' }, timeout: 15000 })
      ]);
      const supportRequests = await supportRequestsPromise;

      const jobsRes = criticalRequests[0];
      const schedulesRes = criticalRequests[1];
      const employeesRes = criticalRequests[2];
      const invoicesRes = supportRequests[0];
      const customersRes = supportRequests[1];

      const jobsData = jobsRes.status === 'fulfilled' ? jobsRes.value?.data : [];
      const schedulesData = schedulesRes.status === 'fulfilled' ? schedulesRes.value?.data : [];
      const employeesData = employeesRes.status === 'fulfilled' ? employeesRes.value?.data : [];
      const invoicesData = invoicesRes.status === 'fulfilled' ? invoicesRes.value?.data : [];
      const customersData = customersRes.status === 'fulfilled' ? customersRes.value?.data : [];
      const cleanedCount = Number(jobsRes.status === 'fulfilled' ? jobsRes.value?.headers?.['x-orphan-jobs-cleaned'] : 0) || 0;

      const nextSchedules = Array.isArray(schedulesData) ? schedulesData : [];
      const criticalVisibleJobs = buildVisibleJobs(jobsData, nextSchedules);
      const nextTechnicians = (Array.isArray(employeesData) ? employeesData : [])
        .filter((employee) => String(employee?.role || '').trim().toLowerCase() === 'technician');

      setJobs(criticalVisibleJobs);
      setTechnicians(nextTechnicians);
      writeTechnicianPortalCache({ jobs: criticalVisibleJobs, technicians: nextTechnicians });

      const refinedVisibleJobs = buildVisibleJobs(jobsData, nextSchedules, invoicesData, customersData);
      setJobs(refinedVisibleJobs);
      writeTechnicianPortalCache({ jobs: refinedVisibleJobs, technicians: nextTechnicians });

      if (cleanedCount > 0) {
        const message = `Cleaned ${cleanedCount} orphaned assigned job${cleanedCount === 1 ? '' : 's'}.`;
        setActionStatus(message);
        if (orphanCleanupNoticeTimerRef.current) {
          window.clearTimeout(orphanCleanupNoticeTimerRef.current);
        }
        orphanCleanupNoticeTimerRef.current = window.setTimeout(() => {
          setActionStatus((current) => (current === message ? '' : current));
        }, 4000);
      }
    } catch (error) {
      console.error('Fetch failed', error);
    } finally {
      portalDataLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refreshKeys = new Set(['customer_sync_tick', 'invoice_sync_tick', 'contract_sync_tick', 'jobs_sync_tick']);
    const safeRefresh = async () => {
      if (!active || portalDataLoadingRef.current) return;
      await loadPortalData();
    };

    safeRefresh();

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
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [loadPortalData]);

  useEffect(() => () => {
    if (orphanCleanupNoticeTimerRef.current) {
      window.clearTimeout(orphanCleanupNoticeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const routeTick = String(location.state?.jobsSyncTick || '').trim();
    if (routeTick && routeTick !== lastJobsSyncTickRef.current) {
      lastJobsSyncTickRef.current = routeTick;
      loadPortalData().catch((error) => {
        console.error('Assigned jobs refresh after route change failed', error);
      });
      return;
    }

    const storedTick = String(localStorage.getItem('jobs_sync_tick') || '').trim();
    if (storedTick && storedTick !== lastJobsSyncTickRef.current) {
      lastJobsSyncTickRef.current = storedTick;
      loadPortalData().catch((error) => {
        console.error('Assigned jobs refresh after sync tick failed', error);
      });
    }
  }, [location.key, location.state?.jobsSyncTick, loadPortalData]);

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
      getTechnicianNames(job).forEach((name) => group.technicians.add(name));
      if (!getTechnicianNames(job).length && job.technicianName) group.technicians.add(job.technicianName);
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
  const completionGridStyle = isMobile ? { ...shell.completionGrid, gridTemplateColumns: '1fr' } : shell.completionGrid;
  const completionMediaGridStyle = isMobile ? { ...shell.completionMediaGrid, gridTemplateColumns: '1fr' } : shell.completionMediaGrid;
  const customerTableStyle = isMobile
    ? { ...shell.customerTable, width: '100%', minWidth: 0, tableLayout: 'fixed' }
    : shell.customerTable;
  const jobsTableStyle = isMobile ? { ...shell.jobsTable, width: '100%', minWidth: '680px', tableLayout: 'fixed' } : shell.jobsTable;
  const customerTableWrapStyle = isMobile
    ? {
      ...shell.customerTableWrap,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      overflowX: 'auto',
      overflowY: 'hidden',
      WebkitOverflowScrolling: 'touch',
      overscrollBehaviorX: 'contain',
      touchAction: 'pan-x'
    }
    : shell.customerTableWrap;
  const jobsTableWrapStyle = isMobile
    ? {
      ...shell.jobsTableWrap,
      overflowX: 'auto',
      overflowY: 'hidden',
      WebkitOverflowScrolling: 'touch',
      overscrollBehaviorX: 'contain',
      touchAction: 'pan-x'
    }
    : shell.jobsTableWrap;
  const mobileActionRowStyle = isMobile
    ? {
      ...shell.actionRow,
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '6px',
      width: '100%'
    }
    : shell.actionRow;
  const mobileActionButtonStyle = isMobile
    ? {
      minWidth: 0,
      width: '100%',
      paddingLeft: '8px',
      paddingRight: '8px',
      fontSize: '10px'
    }
    : null;
  const detailsGridStyle = isMobile ? { ...shell.detailsGrid, gridTemplateColumns: '1fr' } : shell.detailsGrid;
  const signatureGridStyle = isMobile
    ? { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }
    : { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' };
  const pagerStyle = isMobile ? { ...shell.pager, flexDirection: 'column', alignItems: 'stretch' } : shell.pager;
  const signatureWidth = isMobile ? Math.max(260, Math.min(360, viewportWidth - 56)) : 520;
  const routeJobId = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get('jobId') || String(params?.jobId || '').trim() || '';
    } catch (_error) {
      return String(params?.jobId || '').trim() || '';
    }
  }, [location.search, params?.jobId]);

  useEffect(() => {
    if (!routeJobId || activeJob || pdfPreview.open) return;
    const match = jobs.find((job) => {
      const jobId = String(job?._id || job?.id || '').trim();
      return jobId === String(routeJobId).trim();
    });
    if (match) {
      openJob(match);
    }
  }, [activeJob, jobs, routeJobId, pdfPreview.open]);

  useLayoutEffect(() => {
    if (wizardStep !== 'signature') return;
    const customerSignature = String(jobWizard?.customerSignature || '').trim();
    const technicianSignature = String(jobWizard?.technicianSignature || '').trim();

    let cancelled = false;
    let frameOne = 0;
    let frameTwo = 0;

    const restoreSignatures = () => {
      if (cancelled) return;
      if (customerSigCanvas.current && typeof customerSigCanvas.current.fromDataURL === 'function') {
        customerSigCanvas.current.clear();
        if (customerSignature) customerSigCanvas.current.fromDataURL(customerSignature);
      }
      if (technicianSigCanvas.current && typeof technicianSigCanvas.current.fromDataURL === 'function') {
        technicianSigCanvas.current.clear();
        if (technicianSignature) technicianSigCanvas.current.fromDataURL(technicianSignature);
      }
    };

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(restoreSignatures);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, [jobWizard?.customerSignature, jobWizard?.technicianSignature, wizardStep]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const logHitTargets = () => {
      const logPoint = (label, node) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);
        console.log(label, document.elementFromPoint(x, y));
      };
      logPoint('element at next button', wizardNextButtonRef.current);
      logPoint('element at back button', wizardBackButtonRef.current);
      logPoint('element at clear button', signatureClearButtonRef.current);
      console.log('technician portal signature debug', {
        isSavingWizard,
        wizardStep,
        activeJobId: activeJob?._id || '',
        isDrawing: Boolean(window.__skuasSignatureDebug?.isDrawing),
        activePointerId: window.__skuasSignatureDebug?.activePointerId ?? null
      });
    };

    const frame = window.requestAnimationFrame(logHitTargets);
    return () => window.cancelAnimationFrame(frame);
  }, [activeJob?._id, isSavingWizard, wizardStep, jobWizard?.customerSignature, jobWizard?.technicianSignature]);

  const syncLocalJob = useCallback((nextJob) => {
    if (!nextJob?._id) return;
    setJobs((prev) => prev.map((job) => (String(job._id) === String(nextJob._id) ? { ...job, ...nextJob } : job)));
    setActiveJob((prev) => (prev && String(prev._id) === String(nextJob._id) ? { ...prev, ...nextJob } : prev));
  }, []);

  const normalizeDraftForSave = useCallback((draft = jobWizard) => {
    const nextDraft = buildWizardDraft({
      beforePhotos: draft.beforePhotos,
      afterPhotos: draft.afterPhotos,
      chemicalsUsed: draft.chemicalsUsed,
      checklistItems: draft.checklistItems,
      infestationLevel: draft.infestationLevel,
      customerRepresentativeName: draft.customerRepresentativeName,
      customerRepresentativeMobile: draft.customerRepresentativeMobile,
      customerSignature: draft.customerSignature,
      technicianSignature: draft.technicianSignature,
      reviewRemarks: draft.reviewRemarks
    });
    return {
      ...nextDraft,
      beforePhoto: nextDraft.beforePhotos[0] || '',
      afterPhoto: nextDraft.afterPhotos[0] || '',
      infestationLevel: nextDraft.infestationLevel || '',
      customerRepresentativeName: nextDraft.customerRepresentativeName || '',
      customerRepresentativeMobile: nextDraft.customerRepresentativeMobile || '',
      customerSignature: nextDraft.customerSignature || '',
      technicianSignature: nextDraft.technicianSignature || '',
      remarks: nextDraft.reviewRemarks || ''
    };
  }, [jobWizard]);

  const captureSignatureDraft = useCallback((draft = jobWizard) => {
    const customerSignaturePadReady = customerSigCanvas.current && typeof customerSigCanvas.current.isEmpty === 'function' && typeof customerSigCanvas.current.getTrimmedCanvas === 'function';
    const technicianSignaturePadReady = technicianSigCanvas.current && typeof technicianSigCanvas.current.isEmpty === 'function' && typeof technicianSigCanvas.current.getTrimmedCanvas === 'function';
    const nextCustomerSignature = customerSignaturePadReady && !customerSigCanvas.current.isEmpty()
      ? customerSigCanvas.current.getTrimmedCanvas().toDataURL('image/jpeg', 0.7)
      : String(draft?.customerSignature || '').trim();
    const nextTechnicianSignature = technicianSignaturePadReady && !technicianSigCanvas.current.isEmpty()
      ? technicianSigCanvas.current.getTrimmedCanvas().toDataURL('image/jpeg', 0.7)
      : String(draft?.technicianSignature || '').trim();
    return normalizeDraftForSave({
      ...draft,
      customerSignature: nextCustomerSignature,
      technicianSignature: nextTechnicianSignature
    });
  }, [jobWizard, normalizeDraftForSave]);

  const persistWizardDraft = useCallback(async (draft = jobWizard) => {
    if (!activeJob?._id || isSavingWizard) return null;
    const savePayload = normalizeDraftForSave(draft);
    try {
      setIsSavingWizard(true);
      const response = await axios.put(`${API_BASE_URL}/api/jobs/${activeJob._id}`, savePayload, { timeout: 30000 });
      const savedJob = response?.data || { ...activeJob, ...savePayload };
      syncLocalJob(savedJob);
      triggerDashboardRefresh();
      return savedJob;
    } catch (error) {
      console.error('Failed to save technician wizard draft', error);
      window.alert(error?.response?.data?.error || error?.message || 'Unable to save job progress.');
      throw error;
    } finally {
      setIsSavingWizard(false);
    }
  }, [activeJob, isSavingWizard, normalizeDraftForSave, syncLocalJob, jobWizard]);

  const persistWizardDraftInBackground = useCallback(async (draft = jobWizard) => {
    if (!activeJob?._id) return null;
    const savePayload = normalizeDraftForSave(draft);
    try {
      const response = await axios.put(`${API_BASE_URL}/api/jobs/${activeJob._id}`, savePayload, { timeout: 30000 });
      const savedJob = response?.data || { ...activeJob, ...savePayload };
      syncLocalJob(savedJob);
      triggerDashboardRefresh();
      return savedJob;
    } catch (error) {
      console.error('Failed to save technician wizard draft in background', error);
      const message = error?.response?.data?.error || error?.message || 'Unable to save job progress.';
      setActionStatus(`Save failed: ${message}`);
      return null;
    }
  }, [activeJob, normalizeDraftForSave, syncLocalJob]);

  const openJob = (job) => {
    if (isCompletedJob(job)) {
      setActiveJob(null);
      setPunchInTime(null);
      openJobPdfPreview(job);
      return;
    }
    setActiveJob(job);
    setPunchInTime(job.punchInTime || null);
    setWizardStep('photos');
    setJobWizard(buildWizardDraft(job));
    if (customerSigCanvas.current && typeof customerSigCanvas.current.clear === 'function') {
      customerSigCanvas.current.clear();
    }
    if (technicianSigCanvas.current && typeof technicianSigCanvas.current.clear === 'function') {
      technicianSigCanvas.current.clear();
    }
  };

  const openJobPdfPreview = (job) => {
    if (!job?._id) return;
    const jobNumber = String(job.jobNumber || job.job_no || job.jobNo || job.scheduleVisit || job.visit || job._id || 'Job').trim();
    const pdfUrl = `${API_BASE_URL}/api/service-visits/${job._id}/job-card-pdf`;
    setPdfPreview({
      open: true,
      title: `Job Card - ${jobNumber}`,
      pdfUrl,
      downloadFileName: `${jobNumber.replace(/[^\w.-]+/g, '_')}.pdf`,
      publicShareUrl: pdfUrl,
      shareContext: {
        jobNumber,
        customerName: String(job.customerName || '-').trim() || '-',
        customerEmail: String(job.customerEmail || job.emailId || job.email || job.customer_email || '').trim(),
        customerPhone: String(job.mobileNumber || job.mobile || job.whatsappNumber || '').trim(),
        serviceType: String(job.serviceName || job.serviceInstructions || '').trim(),
        address: String(formatAddress(job) || '').trim(),
        jobDate: String(job.scheduledDate || '').trim(),
        jobTime: String(job.scheduledTime || '').trim(),
        technicianName: String(job.technicianName || '').trim(),
        pdfUrl
      }
    });
  };

  const shareJobCardByEmail = async () => {
    const context = pdfPreview.shareContext || {};
    const defaultEmail = String(context.customerEmail || '').trim();
    const recipientEmail = String(window.prompt('Enter recipient email', defaultEmail) || '').trim();
    if (!recipientEmail) return;

    const jobNumber = String(context.jobNumber || pdfPreview.title.replace(/^Job Card -\s*/i, '') || 'Job').trim();
    const customerName = String(context.customerName || 'Customer').trim() || 'Customer';
    const shareUrl = String(pdfPreview.publicShareUrl || pdfPreview.pdfUrl || '').trim();
    const subject = `Job Card - ${jobNumber} from SKUAS Pest Control`;
    const body = `
      <div style="font-family:Arial,sans-serif;color:#111827;font-size:14px;line-height:1.5">
        <p>Dear ${customerName},</p>
        <p>Please find attached your service job card for <strong>${jobNumber}</strong>.</p>
        <p>
          ${context.serviceType ? `<strong>Service:</strong> ${context.serviceType}<br/>` : ''}
          ${context.jobDate ? `<strong>Date:</strong> ${context.jobDate}<br/>` : ''}
          ${context.jobTime ? `<strong>Time:</strong> ${context.jobTime}<br/>` : ''}
          ${context.address ? `<strong>Address:</strong> ${context.address}<br/>` : ''}
        </p>
        ${shareUrl ? `<p>PDF link: <a href="${shareUrl}" target="_blank" rel="noreferrer">${shareUrl}</a></p>` : ''}
        <p>Regards,<br/>SKUAS Pest Control</p>
      </div>
    `;

    try {
      await axios.post(`${API_BASE_URL}/api/email/send`, {
        moduleType: 'job',
        moduleName: 'Job Card',
        templateType: 'custom_email',
        recipientEmail,
        recipientName: customerName,
        recipientType: 'Customer',
        sentByUser: getPortalUserName() || 'User',
        subject,
        body,
        attachmentUrl: shareUrl,
        attachmentName: `${jobNumber.replace(/[^\w.-]+/g, '_') || 'job-card'}.pdf`,
        contextData: {
          customer_name: customerName,
          customer_email: recipientEmail,
          customer_phone: context.customerPhone || '',
          service_type: context.serviceType || 'Service Job Card',
          address: context.address || '',
          job_date: context.jobDate || '',
          job_time: context.jobTime || '',
          company_name: 'SKUAS Pest Control'
        }
      });
      window.alert('Job card email sent successfully.');
    } catch (error) {
      console.error('Failed to send job card email', error);
      window.alert(error?.response?.data?.error || 'Could not send job card email.');
    }
  };

  const handlePunchIn = async () => {
    if (!activeJob || isPunchingIn || isCompleting) return;
    setActionStatus('');
    const time = new Date().toLocaleString();
    const serviceStartTime = new Date().toISOString();
    setPunchInTime(time);

    try {
      setIsPunchingIn(true);
      await axios.put(`${API_BASE_URL}/api/jobs/${activeJob._id}`, { status: 'In Progress', punchInTime: time, serviceStartTime }, { timeout: 15000 });
      setJobs((prev) => prev.map((job) => (job._id === activeJob._id ? { ...job, status: 'In Progress', punchInTime: time, serviceStartTime } : job)));
      setActiveJob((prev) => (prev ? { ...prev, status: 'In Progress', punchInTime: time, serviceStartTime } : prev));
      triggerDashboardRefresh();
    } catch (error) {
      console.error('Punch in failed', error);
      window.alert(error?.response?.data?.error || error?.message || 'Unable to punch in. Please retry.');
    } finally {
      setIsPunchingIn(false);
    }
  };

  const handlePunchOut = async () => {
    if (!activeJob || isCompleting) return;
    setActionStatus('');
    const normalizedDraft = captureSignatureDraft(jobWizard);
    setJobWizard(normalizedDraft);
    if (!normalizedDraft.infestationLevel) {
      window.alert('Pest infestation level is required before completing the job.');
      return;
    }
    const customerSig = String(normalizedDraft.customerSignature || '').trim();
    const technicianSig = String(normalizedDraft.technicianSignature || '').trim();
    if (!customerSig) {
      window.alert('Customer signature is required before completing the job.');
      return;
    }
    if (!technicianSig) {
      window.alert('Technician signature is required before completing the job.');
      return;
    }
    const resolvedPunchInTime = punchInTime || activeJob.punchInTime || new Date().toLocaleString();
    const completedAt = new Date().toISOString();
    const completionCardNumber = createCompletionCardNumber();
    const statusPayload = {
      status: 'Completed',
      punchInTime: resolvedPunchInTime,
      punchOutTime: new Date(completedAt).toLocaleString(),
      serviceStartTime: activeJob.serviceStartTime || activeJob.service_start_time || new Date().toISOString(),
      serviceEndTime: completedAt,
      completionCardNumber,
      completionCardGeneratedAt: completedAt
    };
    try {
      setIsCompleting(true);
      await persistWizardDraft(normalizedDraft);
      const completedJobId = activeJob._id;
      const completePayload = new FormData();
      Object.entries(statusPayload).forEach(([key, value]) => completePayload.append(key, value || ''));
      completePayload.append('beforePhoto', normalizedDraft.beforePhotos[0] || activeJob.beforePhoto || '');
      completePayload.append('afterPhoto', normalizedDraft.afterPhotos[0] || activeJob.afterPhoto || '');
      completePayload.append('beforePhotos', JSON.stringify(normalizedDraft.beforePhotos || []));
      completePayload.append('afterPhotos', JSON.stringify(normalizedDraft.afterPhotos || []));
      completePayload.append('chemicalsUsed', JSON.stringify(normalizedDraft.chemicalsUsed || []));
      completePayload.append('checklistItems', JSON.stringify(normalizedDraft.checklistItems || []));
      completePayload.append('infestationLevel', normalizedDraft.infestationLevel || '');
      completePayload.append('customerRepresentativeName', normalizedDraft.customerRepresentativeName || '');
      completePayload.append('customerRepresentativeMobile', normalizedDraft.customerRepresentativeMobile || '');
      completePayload.append('reviewRemarks', normalizedDraft.reviewRemarks || '');
      completePayload.append('remarks', normalizedDraft.reviewRemarks || '');
      completePayload.append('customerSignature', customerSig || '');
      completePayload.append('technicianSignature', technicianSig || '');
      try {
        const signatureBlob = await fetch(customerSig).then((response) => response.blob());
        completePayload.append('customerSignatureFile', signatureBlob, 'customer-signature.jpg');
      } catch (_error) {
        // Keep the data URL fallback if blob conversion fails.
      }
      try {
        const technicianSignatureBlob = await fetch(technicianSig).then((response) => response.blob());
        completePayload.append('technicianSignatureFile', technicianSignatureBlob, 'technician-signature.jpg');
      } catch (_error) {
        // Keep the data URL fallback if blob conversion fails.
      }
      await axios.post(`${API_BASE_URL}/api/jobs/${completedJobId}/complete`, completePayload, { timeout: 30000 });
      setCompletionCard({
        jobId: completedJobId,
        jobNumber: activeJob.jobNumber || '-',
        completionCardNumber,
        completedAt,
        customerName: activeJob.customerName || '-',
        mobileNumber: activeJob.mobileNumber || '-',
        customerRepresentativeName: normalizedDraft.customerRepresentativeName || activeJob.customerRepresentativeName || activeJob.contactPersonName || '-',
        customerRepresentativeMobile: normalizedDraft.customerRepresentativeMobile || activeJob.customerRepresentativeMobile || activeJob.contactPersonMobile || '-',
        address: formatAddress(activeJob) || '-',
        serviceName: activeJob.serviceName || activeJob.serviceInstructions || '-',
        visit: activeJob.scheduleVisit || '-',
        scheduledDate: activeJob.scheduledDate || '',
        scheduledTime: activeJob.scheduledTime || '',
        technicianName: activeJob.technicianName || '-',
        technicianMobile: activeJob.technicianMobile || '-',
        beforePhoto: normalizedDraft.beforePhotos[0] || activeJob.beforePhoto || '',
        afterPhoto: normalizedDraft.afterPhotos[0] || activeJob.afterPhoto || '',
        customerSignature: customerSig,
        technicianSignature: technicianSig
      });
      // Keep the completed row visible so the technician can review the PDF and completion state.
      setJobs((prev) => prev.map((job) => (job._id === completedJobId ? { ...job, ...statusPayload } : job)));
      setActiveJob(null);
      setPunchInTime(null);
      if (customerSigCanvas.current && typeof customerSigCanvas.current.clear === 'function') {
        customerSigCanvas.current.clear();
      }
      if (technicianSigCanvas.current && typeof technicianSigCanvas.current.clear === 'function') {
        technicianSigCanvas.current.clear();
      }
      setActionStatus('Job marked as completed successfully.');
      // Non-blocking background refresh for consistency.
      localStorage.setItem('schedule_job_focus_status', 'completed');
      localStorage.setItem('jobs_sync_tick', String(Date.now()));
      loadPortalData().catch((error) => {
        console.error('Background refresh after completion failed', error);
      });
      triggerDashboardRefresh();
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

  const getJobActionLabel = (job) => {
    if (isCompletedJob(job)) return 'Completed';
    if (isInProgressJob(job)) return 'Complete Job';
    return 'Start';
  };

  const isJobActionDisabled = (job) => isSavingAssignment || isCompletedJob(job);

  const handleCompleteButton = () => {
    if (!activeJob) return;
    handlePunchOut();
  };

  const uploadWizardPhoto = async (file) => {
    if (!file) return '';
    const formData = new FormData();
    formData.append('image', file);
    const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000
    });
    return String(response?.data?.imageUrl || response?.data?.url || '').trim();
  };

  const handleWizardStepChange = async (nextStep) => {
    if (!nextStep || nextStep === wizardStep) return;
    const nextDraft = captureSignatureDraft(jobWizard);
    setJobWizard(nextDraft);
    if (wizardStep === 'signature') {
      void persistWizardDraftInBackground(nextDraft);
    } else {
      await persistWizardDraft(nextDraft);
    }
    setWizardStep(nextStep);
  };

  const updateWizardDraft = (updater) => {
    setJobWizard((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return normalizeDraftForSave(next);
    });
  };

  const handleAddChemicalRow = () => {
    updateWizardDraft((prev) => ({
      ...prev,
      chemicalsUsed: [...normalizeChemicals(prev.chemicalsUsed), createDefaultChemical()]
    }));
  };

  const handleRemoveChemicalRow = (index) => {
    updateWizardDraft((prev) => {
      const nextRows = normalizeChemicals(prev.chemicalsUsed).filter((_, rowIndex) => rowIndex !== index);
      return {
        ...prev,
        chemicalsUsed: nextRows.length > 0 ? nextRows : [createDefaultChemical()]
      };
    });
  };

  const handleChemicalChange = (index, field, value) => {
    updateWizardDraft((prev) => {
      const nextRows = normalizeChemicals(prev.chemicalsUsed).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      );
      return { ...prev, chemicalsUsed: nextRows };
    });
  };

  const handleChecklistToggle = (index) => {
    updateWizardDraft((prev) => {
      const nextRows = normalizeChecklist(prev.checklistItems).map((row, rowIndex) =>
        rowIndex === index ? { ...row, done: !row.done } : row
      );
      return { ...prev, checklistItems: nextRows };
    });
  };

  const handleReviewRemarksChange = (value) => {
    updateWizardDraft((prev) => ({ ...prev, reviewRemarks: value }));
  };

  const handleInfestationLevelChange = (value) => {
    updateWizardDraft((prev) => ({ ...prev, infestationLevel: value }));
  };

  const openAddCostModal = () => {
    if (!activeJob?._id) return;
    setCostModalError('');
    setCostDraft({
      itemType: 'other',
      description: '',
      quantity: '1',
      unit: 'visit',
      unitCost: '',
      notes: '',
      stockItemId: ''
    });
    setShowCostModal(true);
  };

  const closeAddCostModal = () => {
    if (costModalSaving) return;
    setShowCostModal(false);
    setCostModalError('');
  };

  const handleCostDraftChange = (field, value) => {
    setCostDraft((prev) => ({ ...prev, [field]: value }));
  };

  const submitCostDraft = async () => {
    if (!activeJob?._id || costModalSaving) return;
    const quantity = Math.max(0, Number(costDraft.quantity) || 0);
    const unitCost = Math.max(0, Number(costDraft.unitCost) || 0);
    const totalCost = Number((quantity * unitCost).toFixed(2));
    if (!String(costDraft.description || '').trim()) {
      setCostModalError('Description is required.');
      return;
    }
    try {
      setCostModalSaving(true);
      setCostModalError('');
      await axios.post(`${API_BASE_URL}/api/service-visits/${activeJob._id}/job-cost-items`, {
        itemType: costDraft.itemType,
        description: costDraft.description,
        quantity,
        unit: costDraft.unit,
        unitCost,
        totalCost,
        source: 'manual',
        notes: costDraft.notes,
        stockItemId: costDraft.stockItemId
      }, { timeout: 30000 });
      setActionStatus('Cost item saved successfully.');
      setShowCostModal(false);
      setCostDraft({
        itemType: 'other',
        description: '',
        quantity: '1',
        unit: 'visit',
        unitCost: '',
        notes: '',
        stockItemId: ''
      });
      await loadPortalData();
    } catch (error) {
      console.error('Failed to save job cost item', error);
      setCostModalError(error?.response?.data?.error || error?.message || 'Unable to save cost item.');
    } finally {
      setCostModalSaving(false);
    }
  };

  const handlePhotoSelection = async (kind, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0 || !activeJob?._id) return;
    const key = kind === 'before' ? 'beforePhotos' : 'afterPhotos';
    const maxItems = 6;
    const currentList = normalizePhotoArray(jobWizard[key]);
    const remainingSlots = Math.max(0, maxItems - currentList.length);
    if (remainingSlots <= 0) {
      window.alert(`You can add up to ${maxItems} ${kind} service photos.`);
      return;
    }
    const selectedFiles = files.slice(0, remainingSlots);

    try {
      const uploadedUrls = [];
      for (const file of selectedFiles) {
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadWizardPhoto(file);
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length === 0) return;
      const nextDraft = normalizeDraftForSave({
        ...jobWizard,
        [key]: [...currentList, ...uploadedUrls]
      });
      setJobWizard(nextDraft);
      await persistWizardDraft(nextDraft);
    } catch (error) {
      console.error('Photo upload failed', error);
      window.alert(error?.response?.data?.error || error?.message || 'Unable to upload photo.');
    }
  };

  const handleRemovePhoto = async (kind, index) => {
    const key = kind === 'before' ? 'beforePhotos' : 'afterPhotos';
    const currentList = normalizePhotoArray(jobWizard[key]);
    const nextList = currentList.filter((_, listIndex) => listIndex !== index);
    const nextDraft = normalizeDraftForSave({
      ...jobWizard,
      [key]: nextList
    });
    setJobWizard(nextDraft);
    await persistWizardDraft(nextDraft);
  };

  const handleReassignJob = async (job) => {
    if (!job || isSavingAssignment) return;
    const options = technicians
      .map((tech) => ({
        id: String(tech?._id || '').trim(),
        name: [tech?.firstName, tech?.lastName].filter(Boolean).join(' ').trim() || tech?.empCode || 'Technician',
        empCode: String(tech?.empCode || '').trim(),
        mobile: String(tech?.mobile || '').trim()
      }))
      .filter((entry) => entry.id);
    if (options.length === 0) {
      window.alert('No technician found in Employee Master.');
      return;
    }
    const promptText = options
      .map((entry, idx) => `${idx + 1}. ${entry.name}${entry.empCode ? ` (${entry.empCode})` : ''}${entry.mobile ? ` - ${entry.mobile}` : ''}`)
      .join('\n');
    const selected = window.prompt(`Enter technician number to reassign:\n\n${promptText}`);
    if (!selected) return;
    const index = Number(selected) - 1;
    const chosen = options[index];
    if (!chosen) {
      window.alert('Invalid technician selection.');
      return;
    }
    try {
      setIsSavingAssignment(true);
      await axios.put(`${API_BASE_URL}/api/jobs/${job._id}`, {
        technicianId: chosen.id,
        technicianName: chosen.name,
        technicianEmpCode: chosen.empCode || '',
        technicianMobile: chosen.mobile || '',
        technicianAssignments: [chosen.name],
        technicianIds: [chosen.id],
        technicianEmpCodes: chosen.empCode ? [chosen.empCode] : [],
        technicianMobiles: chosen.mobile ? [chosen.mobile] : [],
        status: 'Scheduled'
      });
      await loadPortalData();
      triggerDashboardRefresh();
      setActionStatus(`Reassigned ${job.serviceName || 'service'} to ${chosen.name}.`);
    } catch (error) {
      console.error('Reassign failed', error);
      window.alert(error?.response?.data?.error || error?.message || 'Failed to reassign job.');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleRemoveAssignment = async (job) => {
    if (!job || isSavingAssignment) return;
    const okay = window.confirm(`Remove assignment for ${job.serviceName || 'this service'} ${job.scheduleVisit || ''}?`);
    if (!okay) return;
    try {
      setIsSavingAssignment(true);
      await axios.put(`${API_BASE_URL}/api/jobs/${job._id}`, {
        technicianId: '',
        technicianName: '',
        technicianEmpCode: '',
        technicianMobile: '',
        technicianAssignments: [],
        technicianIds: [],
        technicianEmpCodes: [],
        technicianMobiles: [],
        status: 'Unassigned'
      });
      await loadPortalData();
      triggerDashboardRefresh();
      setActionStatus('Assignment removed. Service is now available again in Assign Services.');
    } catch (error) {
      console.error('Remove assignment failed', error);
      window.alert(error?.response?.data?.error || error?.message || 'Failed to remove assignment.');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const wizardDraftView = useMemo(() => normalizeDraftForSave(jobWizard), [jobWizard, normalizeDraftForSave]);
  const wizardChecklistDoneCount = wizardDraftView.checklistItems.filter((item) => item.done).length;
  const wizardChecklistTotal = wizardDraftView.checklistItems.length;
  const wizardStepIndex = Math.max(0, wizardSteps.findIndex((step) => step.key === wizardStep));
  const wizardLastStepIndex = wizardSteps.length - 1;

  const handleWizardBack = async () => {
    if (wizardStep === 'photos') {
      const nextDraft = captureSignatureDraft(jobWizard);
      setJobWizard(nextDraft);
      await persistWizardDraft(nextDraft);
      setActiveJob(null);
      return;
    }
    const nextIndex = Math.max(0, wizardStepIndex - 1);
    const nextDraft = captureSignatureDraft(jobWizard);
    setJobWizard(nextDraft);
    if (wizardStep === 'signature') {
      void persistWizardDraftInBackground(nextDraft);
    } else {
      await persistWizardDraft(nextDraft);
    }
    setWizardStep(wizardSteps[nextIndex]?.key || 'photos');
  };

  const handleWizardNext = async () => {
    if (wizardStepIndex >= wizardLastStepIndex) {
      await handlePunchOut();
      return;
    }
    const nextIndex = Math.min(wizardLastStepIndex, wizardStepIndex + 1);
    const nextDraft = captureSignatureDraft(jobWizard);
    setJobWizard(nextDraft);
    if (wizardStep === 'signature') {
      void persistWizardDraftInBackground(nextDraft);
    } else {
      await persistWizardDraft(nextDraft);
    }
    setWizardStep(wizardSteps[nextIndex]?.key || 'photos');
  };

  const renderWizardStepContent = () => {
    switch (wizardStep) {
      case 'photos':
        return (
          <div style={shell.stepGrid}>
            <div style={shell.sectionCard}>
              <div style={shell.sectionTitleRow}>
                <div>
                  <p style={shell.sectionTitle}><Camera size={16} /> Before Service ({wizardDraftView.beforePhotos.length}/6)</p>
                  <p style={shell.sectionSub}>Capture pre-service evidence before treatment starts.</p>
                </div>
              </div>
              <div style={shell.photoGrid}>
                {wizardDraftView.beforePhotos.map((photo, index) => (
                  <div key={`before-${index}`} style={shell.photoTile}>
                    <img src={photo} alt={`Before service ${index + 1}`} style={shell.photoTileImg} />
                    <button type="button" style={shell.photoTileRemove} onClick={() => handleRemovePhoto('before', index)} aria-label={`Remove before photo ${index + 1}`}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {wizardDraftView.beforePhotos.length < 6 ? (
                  <button type="button" style={shell.photoButton} onClick={() => beforePhotoInputRef.current?.click()}>
                    <Upload size={14} /> Add Photo
                  </button>
                ) : null}
              </div>
              <input
                ref={beforePhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(event) => handlePhotoSelection('before', event)}
              />
            </div>

            <div style={shell.sectionCard}>
              <div style={shell.sectionTitleRow}>
                <div>
                  <p style={shell.sectionTitle}><Camera size={16} /> After Service ({wizardDraftView.afterPhotos.length}/6)</p>
                  <p style={shell.sectionSub}>Capture the finished work area after treatment.</p>
                </div>
              </div>
              <div style={shell.photoGrid}>
                {wizardDraftView.afterPhotos.map((photo, index) => (
                  <div key={`after-${index}`} style={shell.photoTile}>
                    <img src={photo} alt={`After service ${index + 1}`} style={shell.photoTileImg} />
                    <button type="button" style={shell.photoTileRemove} onClick={() => handleRemovePhoto('after', index)} aria-label={`Remove after photo ${index + 1}`}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {wizardDraftView.afterPhotos.length < 6 ? (
                  <button type="button" style={shell.photoButton} onClick={() => afterPhotoInputRef.current?.click()}>
                    <Upload size={14} /> Add Photo
                  </button>
                ) : null}
              </div>
              <input
                ref={afterPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(event) => handlePhotoSelection('after', event)}
              />
            </div>
          </div>
        );
      case 'chemicals':
        return (
          <div style={{ display: 'grid', gap: '12px' }}>
            {wizardDraftView.chemicalsUsed.map((chemical, index) => (
              <div key={chemical.id || index} style={shell.chemicalCard}>
                <div style={shell.chemicalHeader}>
                  <p style={shell.chemicalTitle}>Chemical #{index + 1}</p>
                  {wizardDraftView.chemicalsUsed.length > 1 ? (
                    <button type="button" style={shell.chemicalRemoveBtn} onClick={() => handleRemoveChemicalRow(index)}>
                      <Trash2 size={12} /> Remove
                    </button>
                  ) : null}
                </div>
                <div style={shell.chemicalGrid}>
                  <div style={shell.field}>
                    <p style={shell.label}>Chemical Name</p>
                    <input
                      type="text"
                      value={chemical.chemicalName}
                      onChange={(event) => handleChemicalChange(index, 'chemicalName', event.target.value)}
                      placeholder="e.g. Cypermethrin 10% EC"
                      style={shell.textInput}
                    />
                  </div>
                  <div style={shell.field}>
                    <p style={shell.label}>Quantity Used</p>
                    <input
                      type="text"
                      value={chemical.quantityUsed}
                      onChange={(event) => handleChemicalChange(index, 'quantityUsed', event.target.value)}
                      placeholder="e.g. 250 ml"
                      style={shell.textInput}
                    />
                  </div>
                  <div style={shell.field}>
                    <p style={shell.label}>Dilution Ratio</p>
                    <input
                      type="text"
                      value={chemical.dilutionRatio}
                      onChange={(event) => handleChemicalChange(index, 'dilutionRatio', event.target.value)}
                      placeholder="e.g. 1:50"
                      style={shell.textInput}
                    />
                  </div>
                  <div style={shell.field}>
                    <p style={shell.label}>Target Pest</p>
                    <input
                      type="text"
                      value={chemical.targetPest}
                      onChange={(event) => handleChemicalChange(index, 'targetPest', event.target.value)}
                      placeholder="e.g. Cockroach"
                      style={shell.textInput}
                    />
                  </div>
                  <div style={{ ...shell.field, gridColumn: '1 / -1' }}>
                    <p style={shell.label}>Area Treated</p>
                    <input
                      type="text"
                      value={chemical.areaTreated}
                      onChange={(event) => handleChemicalChange(index, 'areaTreated', event.target.value)}
                      placeholder="e.g. Kitchen + utility room"
                      style={shell.textInput}
                    />
                  </div>
                </div>
                <label style={shell.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={Boolean(chemical.safetyFollowed)}
                    onChange={(event) => handleChemicalChange(index, 'safetyFollowed', event.target.checked)}
                    style={shell.checkbox}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Safety instructions followed</span>
                </label>
              </div>
            ))}
            <button type="button" style={shell.addChemicalBtn} onClick={handleAddChemicalRow}>
              <Plus size={14} /> Add another chemical
            </button>
          </div>
        );
      case 'checklist':
        return (
          <div style={shell.sectionCard}>
            <div style={shell.sectionTitleRow}>
              <div>
                <p style={shell.sectionTitle}><ClipboardList size={16} /> Checklist ({wizardChecklistDoneCount}/{wizardChecklistTotal})</p>
                <p style={shell.sectionSub}>Confirm job completion points before submitting.</p>
              </div>
            </div>
            <div style={{ ...shell.field, marginBottom: '12px' }}>
              <p style={shell.label}>Pest Infestation Level</p>
              <select
                style={shell.textInput}
                value={wizardDraftView.infestationLevel}
                onChange={(event) => handleInfestationLevelChange(event.target.value)}
                required
              >
                <option value="">Select level</option>
                {PEST_INFESTATION_LEVEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div style={shell.checkboxList}>
              {wizardDraftView.checklistItems.map((item, index) => (
                <label key={item.id || index} style={shell.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.done)}
                    onChange={() => handleChecklistToggle(index)}
                    style={shell.checkbox}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'signature':
        return (
          <div style={shell.sectionCard}>
            <div style={shell.sectionTitleRow}>
              <div>
                <p style={shell.sectionTitle}><PenLine size={16} /> Signature</p>
                <p style={shell.sectionSub}>Capture both customer and technician sign-off before completing the job.</p>
              </div>
              <button
                type="button"
                ref={signatureClearButtonRef}
                style={{ ...shell.viewBtn, position: 'relative', zIndex: 70 }}
                onClick={() => {
                  if (customerSigCanvas.current && typeof customerSigCanvas.current.clear === 'function') {
                    customerSigCanvas.current.clear();
                  }
                  if (technicianSigCanvas.current && typeof technicianSigCanvas.current.clear === 'function') {
                    technicianSigCanvas.current.clear();
                  }
                  updateWizardDraft((prev) => ({
                    ...prev,
                    customerSignature: '',
                    technicianSignature: ''
                  }));
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ ...shell.signatureInfoGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
              <div style={shell.signatureMetaField}>
                <p style={shell.label}>Customer Representative</p>
                <input
                  type="text"
                  value={String(jobWizard.customerRepresentativeName || '')}
                  onChange={(event) => updateWizardDraft({
                    customerRepresentativeName: event.target.value
                  })}
                  placeholder="Enter representative name"
                  style={shell.signatureMetaInput}
                />
              </div>
              <div style={shell.signatureMetaField}>
                <p style={shell.label}>Representative Mobile</p>
                <input
                  type="text"
                  inputMode="tel"
                  value={String(jobWizard.customerRepresentativeMobile || '')}
                  onChange={(event) => updateWizardDraft({
                    customerRepresentativeMobile: event.target.value
                  })}
                  placeholder="Enter mobile number"
                  style={shell.signatureMetaInput}
                />
              </div>
            </div>
            <div style={{ ...signatureGridStyle, position: 'relative', zIndex: 1 }}>
              <div>
                <p style={shell.label}>Technician Signature</p>
                <div style={{ ...shell.signatureWrap, maxWidth: '100%' }}>
                  <SignaturePadBox
                    ref={technicianSigCanvas}
                    penColor="black"
                    maxWidth={`${signatureWidth}px`}
                  />
                </div>
              </div>
              <div>
                <p style={shell.label}>Customer Signature</p>
                <div style={{ ...shell.signatureWrap, maxWidth: '100%' }}>
                  <SignaturePadBox
                    ref={customerSigCanvas}
                    penColor="black"
                    maxWidth={`${signatureWidth}px`}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 'review':
        return (
          <div style={shell.sectionCard}>
            <div style={shell.sectionTitleRow}>
              <div>
                <p style={shell.sectionTitle}><FileCheck2 size={16} /> Review</p>
                <p style={shell.sectionSub}>Please confirm site issue, completion, photos and signature before submitting.</p>
              </div>
            </div>
            <div style={shell.reviewGrid}>
              <div style={shell.reviewStat}>
                <p style={shell.reviewStatLabel}>Photos</p>
                <p style={shell.reviewStatValue}>
                  {wizardDraftView.beforePhotos.length} before • {wizardDraftView.afterPhotos.length} after
                </p>
              </div>
              <div style={shell.reviewStat}>
                <p style={shell.reviewStatLabel}>Chemicals Logged</p>
                <p style={shell.reviewStatValue}>{wizardDraftView.chemicalsUsed.length} entries</p>
              </div>
              <div style={shell.reviewStat}>
                <p style={shell.reviewStatLabel}>Checklist</p>
                <p style={shell.reviewStatValue}>{wizardChecklistDoneCount} of {wizardChecklistTotal} done</p>
              </div>
              <div style={shell.reviewStat}>
                <p style={shell.reviewStatLabel}>Pest Infestation Level</p>
                <p style={shell.reviewStatValue}>{wizardDraftView.infestationLevel || 'Missing'}</p>
              </div>
              <div style={shell.reviewStat}>
                <p style={shell.reviewStatLabel}>Customer Signature</p>
                <p style={shell.reviewStatValue}>
                  {wizardDraftView.customerSignature ? 'Captured' : 'Missing'}
                </p>
              </div>
              <div style={shell.reviewStat}>
                <p style={shell.reviewStatLabel}>Technician Signature</p>
                <p style={shell.reviewStatValue}>
                  {wizardDraftView.technicianSignature ? 'Captured' : 'Missing'}
                </p>
              </div>
            </div>
            <div style={shell.reviewNote}>
              Confirm that the service details are correct, then complete the job so the CRM can sync the activity back to the portal.
            </div>
            <div style={shell.field}>
              <p style={shell.label}>Remarks</p>
              <textarea
                style={shell.textArea}
                value={wizardDraftView.reviewRemarks}
                onChange={(event) => handleReviewRemarksChange(event.target.value)}
                placeholder="Enter service remarks..."
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!activeJob) {
    return (
      <section style={pageStyle}>
        <div style={shell.hero}>
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
                <p style={shell.completionLabel}>Customer Representative</p>
                <p style={shell.completionValue}>{completionCard.customerRepresentativeName || '-'}</p>
              </div>
              <div>
                <p style={shell.completionLabel}>Representative Mobile</p>
                <p style={shell.completionValue}>{completionCard.customerRepresentativeMobile || '-'}</p>
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
              <div>
                <p style={shell.completionLabel}>Technician Signature</p>
                {completionCard.technicianSignature ? <img src={completionCard.technicianSignature} alt="Technician signature" style={shell.completionMediaImg} /> : <p style={shell.completionValue}>-</p>}
              </div>
            </div>
            <div style={shell.completionActions}>
              <button
                type="button"
                style={shell.completionDownloadBtn}
                onClick={() => openJobPdfPreview({ ...completionCard, _id: completionCard.jobId })}
              >
                View Job PDF
              </button>
            </div>
          </div>
        ) : null}

        <div style={shell.panel}>
          <h3 style={shell.panelTitle}><FileCheck2 size={16} /> Assigned Jobs</h3>
          <p style={shell.panelSub}>Open any job to begin execution workflow.</p>
          {jobs.length === 0 ? (
            <p style={shell.emptyText}>No active assigned jobs right now.</p>
          ) : (
            isMobile ? (
              <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
                {paginatedCustomerWiseJobs.map((group) => {
                  const firstJob = group.jobs[0] || null;
                  const isExpanded = expandedCustomerKey === group.key;
                  return (
                    <div key={group.key} style={shell.mobileAssignedCard}>
                      <div style={shell.mobileAssignedCardHeader}>
                        <p style={shell.mobileAssignedCardTitle}>{group.customerName}</p>
                        <div style={shell.mobileAssignedCardMeta}>
                          <span>{group.mobileNumber || '-'}</span>
                          <span>{[group.city, group.state].filter((value) => value && value !== '-').join(', ') || '-'}</span>
                        </div>
                      </div>
                      <div style={shell.mobileAssignedCardBody}>
                        <div style={shell.mobileAssignedFieldGrid}>
                          <div style={shell.mobileAssignedField}>
                            <span style={shell.mobileAssignedLabel}>Visits</span>
                            <span style={shell.mobileAssignedValue}>{group.jobs.length}</span>
                          </div>
                          <div style={shell.mobileAssignedField}>
                            <span style={shell.mobileAssignedLabel}>Next Visit</span>
                            <span style={shell.mobileAssignedValue}>{firstJob ? `${formatDisplayDate(firstJob.scheduledDate)} ${formatDisplayTime(firstJob.scheduledTime)}` : '-'}</span>
                          </div>
                          <div style={shell.mobileAssignedField}>
                            <span style={shell.mobileAssignedLabel}>Technician</span>
                            <span style={shell.mobileAssignedValue}>{group.techniciansText}</span>
                          </div>
                          <div style={shell.mobileAssignedField}>
                            <span style={shell.mobileAssignedLabel}>Jobs</span>
                            <span style={shell.mobileAssignedValue}>{group.jobs.length ? 'Open list below' : '-'}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          style={shell.mobileAssignedExpandBtn}
                          onClick={() => setExpandedCustomerKey((prev) => (prev === group.key ? '' : group.key))}
                        >
                          {isExpanded ? 'Hide Jobs' : 'View Jobs'}
                        </button>
                        {isExpanded ? (
                          <div style={shell.mobileJobList}>
                            {group.jobs.map((job) => (
                              <div key={job._id} style={shell.mobileJobCard}>
                                <div style={shell.mobileJobTitleRow}>
                                  <p style={shell.mobileJobTitle}>{job.scheduleVisit || 'Job'}</p>
                                  <span style={shell.mobileJobStatus}>{job.status || '-'}</span>
                                </div>
                                <div style={shell.mobileAssignedFieldGrid}>
                                  <div style={shell.mobileAssignedField}>
                                    <span style={shell.mobileAssignedLabel}>Date</span>
                                    <span style={shell.mobileAssignedValue}>{formatDisplayDate(job.scheduledDate)}</span>
                                  </div>
                                  <div style={shell.mobileAssignedField}>
                                    <span style={shell.mobileAssignedLabel}>Time</span>
                                    <span style={shell.mobileAssignedValue}>{formatDisplayTime(job.scheduledTime)}</span>
                                  </div>
                                  <div style={shell.mobileAssignedField}>
                                    <span style={shell.mobileAssignedLabel}>Technician</span>
                                    <span style={shell.mobileAssignedValue}>{job.technicianName || '-'}</span>
                                  </div>
                                  <div style={shell.mobileAssignedField}>
                                    <span style={shell.mobileAssignedLabel}>Action</span>
                                    <span style={shell.mobileAssignedValue}>Ready</span>
                                  </div>
                                </div>
                                <div style={shell.mobileJobActions}>
                                  <button type="button" style={shell.startSmallBtn} onClick={() => openJob(job)} disabled={isJobActionDisabled(job)}>
                                    {getJobActionLabel(job)}
                                  </button>
                                  <button type="button" style={shell.editBtn} onClick={() => handleReassignJob(job)} disabled={isSavingAssignment}>
                                    Reassign
                                  </button>
                                  <button type="button" style={shell.removeBtn} onClick={() => handleRemoveAssignment(job)} disabled={isSavingAssignment}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={customerTableWrapStyle}>
                <table style={customerTableStyle} className="technician-assigned-jobs-table">
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
                              style={isMobile ? { ...shell.viewBtn, minWidth: '72px', width: 'auto', padding: '0 8px', fontSize: '10px', whiteSpace: 'nowrap' } : shell.viewBtn}
                              onClick={() => setExpandedCustomerKey((prev) => (prev === group.key ? '' : group.key))}
                            >
                              {expandedCustomerKey === group.key ? 'Hide Jobs' : 'View Jobs'}
                            </button>
                          </td>
                        </tr>
                        {expandedCustomerKey === group.key ? (
                          <tr>
                            <td colSpan={7} style={shell.expandedCell}>
                              <div style={jobsTableWrapStyle}>
                                <table style={jobsTableStyle} className="technician-job-details-table">
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
                                        <td style={{ ...shell.jobsTd, ...shell.actionCell }}>
                                          <div style={mobileActionRowStyle}>
                                            <button type="button" style={mobileActionButtonStyle ? { ...shell.startSmallBtn, ...mobileActionButtonStyle } : shell.startSmallBtn} onClick={() => openJob(job)} disabled={isJobActionDisabled(job)}>
                                              {getJobActionLabel(job)}
                                            </button>
                                            <button type="button" style={mobileActionButtonStyle ? { ...shell.editBtn, ...mobileActionButtonStyle } : shell.editBtn} onClick={() => handleReassignJob(job)} disabled={isSavingAssignment}>
                                              Reassign
                                            </button>
                                            <button type="button" style={mobileActionButtonStyle ? { ...shell.removeBtn, ...mobileActionButtonStyle } : shell.removeBtn} onClick={() => handleRemoveAssignment(job)} disabled={isSavingAssignment}>
                                              Delete
                                            </button>
                                          </div>
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
            )
          )}
          {customerWiseJobs.length > 0 ? (
            <div style={pagerStyle}>
              <div style={shell.pagerActions}>
                <button
                  type="button"
                  style={{ ...shell.pagerBtn, opacity: customerPage === 1 ? 0.5 : 1 }}
                  disabled={customerPage === 1}
                  onClick={() => setCustomerPage((prev) => Math.max(1, prev - 1))}
                  aria-label="Previous page"
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  style={{ ...shell.pagerBtn, opacity: customerPage === totalCustomerPages ? 0.5 : 1 }}
                  disabled={customerPage === totalCustomerPages}
                  onClick={() => setCustomerPage((prev) => Math.min(totalCustomerPages, prev + 1))}
                  aria-label="Next page"
                  title="Next page"
                >
                  <ChevronRight size={16} />
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" style={shell.backBtn} onClick={() => setActiveJob(null)}>
            <ArrowLeft size={14} /> Back to Jobs
          </button>
          <button type="button" style={shell.costAddBtn} onClick={openAddCostModal}>
            <Plus size={14} /> Add Cost
          </button>
        </div>

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

      <div style={shell.workflowCard}>
        <div style={shell.workflowHeader}>
          <h3 style={shell.workflowTitle}><FileCheck2 size={16} /> Technician Workflow</h3>
          <p style={shell.workflowSub}>Step {wizardStepIndex + 1} of {wizardSteps.length}. Save each section to keep the technician task synced with the CRM.</p>
        </div>

        <div style={shell.workflowTabs}>
          {wizardSteps.map((step) => {
            const StepIcon = step.icon;
            const isActiveStep = step.key === wizardStep;
            return (
              <button
                key={step.key}
                ref={(node) => { workflowTabButtonRefs.current[step.key] = node; }}
                type="button"
                style={{ ...shell.workflowTab, ...(isActiveStep ? shell.workflowTabActive : {}) }}
                onClick={() => handleWizardStepChange(step.key)}
                disabled={isCompleting}
              >
                <span style={shell.workflowTabIcon}><StepIcon size={18} /></span>
                <p style={shell.workflowTabLabel}>{step.label}</p>
              </button>
            );
          })}
        </div>

        {renderWizardStepContent()}

        <div style={shell.wizardFooter}>
          <button
            type="button"
            ref={wizardBackButtonRef}
            style={shell.wizardBackBtn}
            onClick={handleWizardBack}
            disabled={isCompleting}
          >
            Back
          </button>
          <button
            type="button"
            ref={wizardNextButtonRef}
            style={shell.wizardNextBtn}
            onClick={handleWizardNext}
            disabled={isCompleting}
          >
            {wizardStep === 'review' ? (isCompleting ? 'Saving...' : 'Complete Service') : 'Next'}
          </button>
        </div>
      </div>

      {actionStatus ? (
        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: actionStatus.toLowerCase().includes('failed') ? '#b91c1c' : '#166534', fontWeight: 700 }}>
          {actionStatus}
        </p>
      ) : null}

      {showCostModal ? (
        <div style={shell.costModalOverlay} onClick={closeAddCostModal}>
          <div style={shell.costModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={shell.costModalHead}>
              <h3 style={shell.costModalTitle}>Add Cost</h3>
              <button type="button" style={shell.backBtn} onClick={closeAddCostModal}>Close</button>
            </div>
            <div style={shell.costModalBody}>
              <div style={shell.costModalGrid}>
                <div style={shell.costModalField}>
                  <p style={shell.costModalLabel}>Type</p>
                  <select
                    style={shell.costModalInput}
                    value={costDraft.itemType}
                    onChange={(event) => handleCostDraftChange('itemType', event.target.value)}
                  >
                    <option value="chemical">Chemical</option>
                    <option value="manpower">Manpower</option>
                    <option value="conveyance">Conveyance</option>
                    <option value="material">Material</option>
                    <option value="complaint">Complaint / Revisit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div style={shell.costModalField}>
                  <p style={shell.costModalLabel}>Quantity</p>
                  <input
                    style={shell.costModalInput}
                    type="number"
                    step="0.01"
                    min="0"
                    value={costDraft.quantity}
                    onChange={(event) => handleCostDraftChange('quantity', event.target.value)}
                  />
                </div>
                <div style={shell.costModalField}>
                  <p style={shell.costModalLabel}>Unit</p>
                  <input
                    style={shell.costModalInput}
                    value={costDraft.unit}
                    onChange={(event) => handleCostDraftChange('unit', event.target.value)}
                  />
                </div>
                <div style={shell.costModalField}>
                  <p style={shell.costModalLabel}>Unit Cost</p>
                  <input
                    style={shell.costModalInput}
                    type="number"
                    step="0.01"
                    min="0"
                    value={costDraft.unitCost}
                    onChange={(event) => handleCostDraftChange('unitCost', event.target.value)}
                  />
                </div>
              </div>
              <div style={shell.costModalField}>
                <p style={shell.costModalLabel}>Description</p>
                <input
                  style={shell.costModalInput}
                  value={costDraft.description}
                  onChange={(event) => handleCostDraftChange('description', event.target.value)}
                  placeholder="Example: Gel baiting, chemical purchase, revisit charge"
                />
              </div>
              <div style={shell.costModalField}>
                <p style={shell.costModalLabel}>Notes</p>
                <textarea
                  style={shell.costModalTextarea}
                  value={costDraft.notes}
                  onChange={(event) => handleCostDraftChange('notes', event.target.value)}
                  placeholder="Optional notes"
                />
              </div>
              <div style={shell.costModalField}>
                <p style={shell.costModalLabel}>Optional stock item id</p>
                <input
                  style={shell.costModalInput}
                  value={costDraft.stockItemId}
                  onChange={(event) => handleCostDraftChange('stockItemId', event.target.value)}
                  placeholder="Matches stock item if you want to link it"
                />
                <p style={shell.costModalHint}>Manual amounts are allowed. If you have a stock item id, we will keep it linked for reporting.</p>
              </div>
              <div style={shell.costModalPreview}>
                Total cost preview: {`₹${Number(((Number(costDraft.quantity) || 0) * (Number(costDraft.unitCost) || 0)).toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              {costModalError ? <p style={{ margin: 0, color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>{costModalError}</p> : null}
            </div>
            <div style={shell.costModalFooter}>
              <button type="button" style={shell.backBtn} onClick={closeAddCostModal} disabled={costModalSaving}>Cancel</button>
              <button type="button" style={shell.actionBtn} onClick={submitCostDraft} disabled={costModalSaving}>
                {costModalSaving ? 'Saving...' : 'Save Cost'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        pdfUrl={pdfPreview.pdfUrl}
        downloadFileName={pdfPreview.downloadFileName}
        onClose={() => setPdfPreview({ open: false, title: '', pdfUrl: '', downloadFileName: '', publicShareUrl: '', shareContext: null })}
        onShareEmail={shareJobCardByEmail}
        publicShareUrl={pdfPreview.publicShareUrl}
      />
    </section>
  );
}
