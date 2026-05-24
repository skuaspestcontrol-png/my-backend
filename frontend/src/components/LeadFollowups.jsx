import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useColumnResize from './table/useColumnResize';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  List,
  Smile,
  X
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const ALL_VALUE = '__all__';
const FOLLOWUP_PAGE_SIZE = 20;
const FOLLOWUP_COLUMN_WIDTHS_KEY = 'lead_followups_column_widths';

const defaultColumnWidths = {
  lead: 72,
  customer: 150,
  status: 100,
  urgency: 105,
  assignedTo: 145,
  lastFollowup: 130,
  nextFollowup: 130,
  actions: 110
};

const followupColumns = [
  { key: 'lead', label: 'Lead' },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'urgency', label: 'Urgency' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'lastFollowup', label: 'Last Follow-up' },
  { key: 'nextFollowup', label: 'Next Follow-up' },
  { key: 'actions', label: 'Actions' }
];

const shell = {
  page: { display: 'grid', gap: '14px', color: 'var(--color-muted)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, color: 'var(--color-text)', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' },
  subtitle: { margin: '2px 0 0', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 700 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' },
  statCard: { minHeight: '76px', background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' },
  statIcon: { width: '42px', height: '42px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue: { margin: 0, color: 'var(--color-text)', fontSize: '24px', lineHeight: 1, fontWeight: 800 },
  statLabel: { margin: '6px 0 0', color: 'var(--color-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' },
  filters: { background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(136px, 1fr)) 150px 48px', gap: '12px', alignItems: 'end' },
  label: { display: 'block', marginBottom: '6px', color: 'var(--color-muted)', fontSize: '12px', fontWeight: 800 },
  input: { width: '100%', height: '42px', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-white)', color: 'var(--color-text)', padding: '0 12px', fontSize: '13px', fontWeight: 700, outline: 'none', boxSizing: 'border-box' },
  applyBtn: { height: '42px', minWidth: '150px', border: 'none', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' },
  clearBtn: { height: '42px', minWidth: '48px', border: '1px solid var(--color-primary-soft)', borderRadius: '10px', background: 'var(--color-white)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  tabs: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  tab: { border: '1px solid transparent', borderRadius: '999px', background: 'var(--color-white)', color: 'var(--color-muted)', height: '38px', padding: '0 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' },
  badge: { minWidth: '20px', height: '20px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px', background: 'var(--color-primary)', color: '#fff', fontSize: '11px', fontWeight: 800 },
  tableCard: { background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' },
  tableTitle: { padding: '12px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', minWidth: '980px', borderCollapse: 'collapse' },
  th: { background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '12px', fontWeight: 800, textAlign: 'left', padding: '11px 14px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.03em', position: 'relative', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  leadTh: { paddingLeft: '8px', paddingRight: '8px' },
  sortBtn: { width: '100%', minWidth: 0, border: 'none', background: 'transparent', color: 'inherit', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer' },
  sortLabel: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sortIcon: { flexShrink: 0, opacity: 0.72 },
  td: { padding: '12px 14px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: '13px', fontWeight: 650 },
  leadTd: { paddingLeft: '8px', paddingRight: '8px' },
  empty: { minHeight: '96px', display: 'grid', placeItems: 'center', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 700 },
  actionBtn: { border: '1px solid var(--color-border)', background: 'var(--color-white)', color: 'var(--color-primary)', borderRadius: '10px', height: '34px', minWidth: '92px', padding: '0 10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' },
  pagination: { padding: '10px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', background: 'var(--color-white)' },
  paginationInfo: { color: 'var(--color-muted)', fontSize: '12px', fontWeight: 700 },
  paginationActions: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  paginationBtn: { width: '34px', minWidth: '34px', minHeight: '32px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-white)', color: 'var(--color-primary)', padding: 0, fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  paginationBtnDisabled: { opacity: 0.48, cursor: 'not-allowed' }
};

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};
const formatDate = (value) => {
  const date = toDateOnly(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const getLeadMobile = (lead) => String(lead.mobile || lead.mobileNumber || '').trim();
const getAssignedTo = (lead) => String(lead.assignedTo || '').trim() || 'Unassigned';
const compareValues = (left, right) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
};
const getSortValue = (lead, key) => {
  if (key === 'lead') return lead._id || '';
  if (key === 'customer') return lead.customerName || lead.displayName || '';
  if (key === 'status') return lead.status || lead.leadStatus || '';
  if (key === 'urgency') return ['Overdue', 'Today', 'High', 'This Week', 'Upcoming'].indexOf(lead.urgency);
  if (key === 'assignedTo') return lead.assignedToDisplay || '';
  if (key === 'lastFollowup') return toDateOnly(lead.lastFollowupDate || lead.lastFollowUpDate)?.getTime();
  if (key === 'nextFollowup') return toDateOnly(lead.followupDate)?.getTime();
  return lead._id || '';
};
const getUrgency = (lead, today) => {
  const date = toDateOnly(lead.followupDate);
  if (!date) return 'Upcoming';
  if (date < today) return 'Overdue';
  if (date.getTime() === today.getTime()) return 'Today';
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff <= 2) return 'High';
  if (diff <= 7) return 'This Week';
  return 'Upcoming';
};
const isDoneLead = (lead) => ['booked', 'converted'].includes(normalizeStatus(lead.status || lead.leadStatus));

export default function LeadFollowups() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overdue');
  const [draftFilters, setDraftFilters] = useState({ fromDate: '', toDate: '', assignedTo: ALL_VALUE, urgency: ALL_VALUE });
  const [filters, setFilters] = useState(draftFilters);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'nextFollowup', direction: 'asc' });
  const {
    getColumnWidth,
    startResize: startColumnResize,
    resetColumns: resetFollowupColumns
  } = useColumnResize({
    storageKey: FOLLOWUP_COLUMN_WIDTHS_KEY,
    columns: followupColumns.map((column) => column.key),
    defaultColumnWidths,
    columnBounds: {
      lead: { min: 64, max: 120 },
      customer: { min: 140, max: 280 },
      status: { min: 90, max: 150 },
      urgency: { min: 90, max: 150 },
      assignedTo: { min: 120, max: 240 },
      lastFollowup: { min: 120, max: 200 },
      nextFollowup: { min: 120, max: 200 },
      actions: { min: 100, max: 150 }
    },
    minWidth: 80,
    enabled: viewportWidth > 768
  });

  const loadLeads = async (options = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/leads`);
      setLeads(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load lead follow-ups', error);
      setLeads([]);
    } finally {
      if (!options.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  useAutoRefresh(() => loadLeads({ silent: true }));

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const today = useMemo(() => {
    const next = new Date();
    next.setHours(0, 0, 0, 0);
    return next;
  }, []);

  const weekEnd = useMemo(() => {
    const next = new Date(today);
    next.setDate(next.getDate() + 6);
    return next;
  }, [today]);

  const followups = useMemo(() => leads
    .filter((lead) => lead.followupDate || isDoneLead(lead))
    .map((lead) => ({
      ...lead,
      followupDateValue: toDateOnly(lead.followupDate),
      urgency: getUrgency(lead, today),
      assignedToDisplay: getAssignedTo(lead),
      done: isDoneLead(lead)
    })), [leads, today]);

  const assignedOptions = useMemo(() => {
    const values = new Set(['Unassigned']);
    followups.forEach((lead) => values.add(lead.assignedToDisplay));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [followups]);

  const tabRows = useMemo(() => {
    const from = toDateOnly(filters.fromDate);
    const to = toDateOnly(filters.toDate);
    return followups.filter((lead) => {
      if (filters.assignedTo !== ALL_VALUE && lead.assignedToDisplay !== filters.assignedTo) return false;
      if (filters.urgency !== ALL_VALUE && lead.urgency !== filters.urgency) return false;
      if (from && (!lead.followupDateValue || lead.followupDateValue < from)) return false;
      if (to && (!lead.followupDateValue || lead.followupDateValue > to)) return false;
      if (activeTab === 'overdue') return lead.followupDateValue && lead.followupDateValue < today && !lead.done;
      if (activeTab === 'today') return lead.followupDateValue && lead.followupDateValue.getTime() === today.getTime() && !lead.done;
      if (activeTab === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return lead.followupDateValue && lead.followupDateValue.getTime() === tomorrow.getTime() && !lead.done;
      }
      if (activeTab === 'week') return lead.followupDateValue && lead.followupDateValue >= today && lead.followupDateValue <= weekEnd && !lead.done;
      if (activeTab === 'upcoming') return lead.followupDateValue && lead.followupDateValue >= today && !lead.done;
      return true;
    });
  }, [activeTab, filters, followups, today, weekEnd]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return tabRows;
    const direction = sortConfig.direction === 'desc' ? -1 : 1;
    return [...tabRows].sort((left, right) => {
      const result = compareValues(getSortValue(left, sortConfig.key), getSortValue(right, sortConfig.key));
      return result * direction;
    });
  }, [sortConfig, tabRows]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / FOLLOWUP_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * FOLLOWUP_PAGE_SIZE;
    return sortedRows.slice(start, start + FOLLOWUP_PAGE_SIZE);
  }, [safePage, sortedRows]);
  const firstRecord = sortedRows.length ? ((safePage - 1) * FOLLOWUP_PAGE_SIZE) + 1 : 0;
  const lastRecord = Math.min(safePage * FOLLOWUP_PAGE_SIZE, sortedRows.length);

  useEffect(() => {
    setPage(1);
  }, [activeTab, filters, sortConfig]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const counts = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      overdue: followups.filter((lead) => lead.followupDateValue && lead.followupDateValue < today && !lead.done).length,
      today: followups.filter((lead) => lead.followupDateValue && lead.followupDateValue.getTime() === today.getTime() && !lead.done).length,
      tomorrow: followups.filter((lead) => lead.followupDateValue && lead.followupDateValue.getTime() === tomorrow.getTime() && !lead.done).length,
      week: followups.filter((lead) => lead.followupDateValue && lead.followupDateValue >= today && lead.followupDateValue <= weekEnd && !lead.done).length,
      upcoming: followups.filter((lead) => lead.followupDateValue && lead.followupDateValue >= today && !lead.done).length,
      doneWeek: followups.filter((lead) => lead.done && lead.followupDateValue && lead.followupDateValue >= today && lead.followupDateValue <= weekEnd).length
    };
  }, [followups, today, weekEnd]);

  const isMobile = viewportWidth < 768;
  const statGridStyle = isMobile ? { ...shell.statGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' } : viewportWidth < 1100 ? { ...shell.statGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : shell.statGrid;
  const statCardStyle = isMobile
    ? { ...shell.statCard, minHeight: '118px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', padding: '12px' }
    : shell.statCard;
  const statIconStyle = isMobile ? { ...shell.statIcon, width: '38px', height: '38px', borderRadius: '11px' } : shell.statIcon;
  const statValueStyle = isMobile ? { ...shell.statValue, fontSize: '22px' } : shell.statValue;
  const statLabelStyle = isMobile ? { ...shell.statLabel, margin: '5px 0 0', fontSize: '10px', lineHeight: 1.2 } : shell.statLabel;
  const filterStyle = isMobile
    ? { ...shell.filters, gridTemplateColumns: '1fr', padding: '14px', gap: '10px' }
    : viewportWidth < 1200
      ? { ...shell.filters, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', padding: '14px 16px' }
      : shell.filters;
  const tabsStyle = isMobile
    ? { ...shell.tabs, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', alignItems: 'stretch' }
    : shell.tabs;
  const tabStyle = isMobile
    ? { ...shell.tab, width: '100%', height: '34px', padding: '0 8px', gap: '5px', fontSize: '11px', minWidth: 0 }
    : shell.tab;
  const tabBadgeStyle = isMobile
    ? { ...shell.badge, minWidth: '18px', height: '18px', padding: '0 6px', fontSize: '10px', flexShrink: 0 }
    : shell.badge;
  const updateSort = (columnKey) => {
    setSortConfig((current) => ({
      key: columnKey,
      direction: current.key === columnKey && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={13} style={shell.sortIcon} aria-hidden="true" />;
    if (sortConfig.direction === 'asc') return <ArrowUp size={13} style={shell.sortIcon} aria-hidden="true" />;
    return <ArrowDown size={13} style={shell.sortIcon} aria-hidden="true" />;
  };
  const renderResizableHeader = (column) => {
    const isSorted = sortConfig.key === column.key;
    const sortDirectionLabel = sortConfig.direction === 'asc' ? 'ascending' : 'descending';
    return (
      <th key={column.key} style={{ ...shell.th, ...(column.key === 'lead' ? shell.leadTh : {}), width: `${getColumnWidth(column.key)}px`, minWidth: `${getColumnWidth(column.key)}px` }} aria-sort={isSorted ? sortDirectionLabel : 'none'}>
        <button type="button" style={shell.sortBtn} onClick={() => updateSort(column.key)} title={`Sort by ${column.label}`}>
          <span style={shell.sortLabel}>{column.label}</span>
          {renderSortIcon(column.key)}
        </button>
      </th>
    );
  };
  const followupMobileColumns = followupColumns.map((column) => `${getColumnWidth(column.key)}px`).join(' ');
  const tableMinWidth = followupColumns.reduce((sum, column) => sum + getColumnWidth(column.key), 0);
  const tableStyle = {
    ...shell.table,
    minWidth: isMobile ? Math.max(920, tableMinWidth) : Math.max(980, tableMinWidth),
    tableLayout: 'fixed',
    '--mobile-table-columns': followupMobileColumns,
    '--mobile-table-min-width': `${Math.max(920, tableMinWidth)}px`
  };

  const stats = [
    { label: 'Overdue', value: counts.overdue, icon: AlertTriangle, color: '#dc2626', bg: '#fee2e2' },
    { label: 'Today', value: counts.today, icon: CalendarDays, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
    { label: 'This Week', value: counts.week, icon: CalendarClock, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
    { label: 'Done This Week', value: counts.doneWeek, icon: CheckCheck, color: '#15803d', bg: '#dcfce7' }
  ];

  const tabs = [
    { key: 'overdue', label: 'Overdue', count: counts.overdue, icon: AlertTriangle },
    { key: 'today', label: 'Today', count: counts.today, icon: CalendarDays },
    { key: 'tomorrow', label: 'Tomorrow', count: counts.tomorrow, icon: CalendarCheck },
    { key: 'week', label: 'This Week', count: counts.week, icon: CalendarClock },
    { key: 'upcoming', label: 'All Upcoming', mobileLabel: 'Upcoming', count: counts.upcoming, icon: List }
  ];

  return (
    <div style={shell.page}>
      <div style={shell.header}>
        <div>
          <h1 style={shell.title}>Lead Follow-ups</h1>
          <p style={shell.subtitle}>Track and manage all your lead follow-up activities</p>
        </div>
      </div>

      <div style={statGridStyle}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={statCardStyle}>
              <span style={{ ...statIconStyle, color: stat.color, background: stat.bg }}>
                <Icon size={24} />
              </span>
              <span>
                <p style={statValueStyle}>{stat.value}</p>
                <p style={statLabelStyle}>{stat.label}</p>
              </span>
            </div>
          );
        })}
      </div>

      {!isMobile ? (
        <div style={filterStyle}>
          <div>
            <label style={shell.label}>From Date</label>
            <input type="date" style={shell.input} value={draftFilters.fromDate} onChange={(event) => setDraftFilters((prev) => ({ ...prev, fromDate: event.target.value }))} />
          </div>
          <div>
            <label style={shell.label}>To Date</label>
            <input type="date" style={shell.input} value={draftFilters.toDate} onChange={(event) => setDraftFilters((prev) => ({ ...prev, toDate: event.target.value }))} />
          </div>
          <div>
            <label style={shell.label}>Assigned To</label>
            <select style={shell.input} value={draftFilters.assignedTo} onChange={(event) => setDraftFilters((prev) => ({ ...prev, assignedTo: event.target.value }))}>
              <option value={ALL_VALUE}>All</option>
              {assignedOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <label style={shell.label}>Urgency</label>
            <select style={shell.input} value={draftFilters.urgency} onChange={(event) => setDraftFilters((prev) => ({ ...prev, urgency: event.target.value }))}>
              <option value={ALL_VALUE}>All</option>
              {['Overdue', 'Today', 'High', 'This Week', 'Upcoming'].map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <button type="button" style={shell.applyBtn} onClick={() => setFilters(draftFilters)}>
            <Filter size={15} />
            Apply
          </button>
          <button
            type="button"
            style={shell.clearBtn}
            onClick={() => {
              const empty = { fromDate: '', toDate: '', assignedTo: ALL_VALUE, urgency: ALL_VALUE };
              setDraftFilters(empty);
              setFilters(empty);
            }}
            title="Clear filters"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}

      <div style={tabsStyle}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              style={{
                ...tabStyle,
                color: active ? '#fff' : 'var(--color-muted)',
                background: active ? 'var(--color-primary)' : 'var(--color-white)',
                borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                boxShadow: active ? 'var(--shadow-sm)' : 'none'
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={isMobile ? 14 : 15} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isMobile ? tab.mobileLabel || tab.label : tab.label}
              </span>
              {tab.count > 0 || ['overdue', 'today'].includes(tab.key) ? <span style={{ ...tabBadgeStyle, background: active ? 'rgba(255,255,255,0.22)' : 'var(--color-primary)', color: active ? '#fff' : '#fff' }}>{tab.count}</span> : null}
            </button>
          );
        })}
      </div>

      <div style={shell.tableCard}>
        <div style={shell.tableTitle}>
          Follow-ups
          <span style={shell.badge}>{tabRows.length}</span>
          <button
            type="button"
            style={{
              marginLeft: 'auto',
              border: '1px solid var(--color-border)',
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary-dark)',
              borderRadius: '8px',
              minHeight: '28px',
              padding: '0 10px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
            onClick={resetFollowupColumns}
          >
            Reset Columns
          </button>
        </div>
        <div style={{ ...shell.tableWrap, overflowX: 'auto' }} className="crm-table-shell">
          <table style={tableStyle} className="crm-compact-table crm-stack-mobile lead-followups-table">
            <colgroup>
              {followupColumns.map((column) => (
                <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {followupColumns.map(renderResizableHeader)}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((lead) => (
                <tr key={lead._id || `${lead.customerName}-${lead.followupDate}`}>
                  <td style={{ ...shell.td, ...shell.leadTd }} data-label="Lead"><span className="crm-cell-wrap">{lead._id || '-'}</span></td>
                  <td style={shell.td} className="lead-followups-customer-cell" data-label="Customer">
                    <div className="lead-followups-customer-stack">
                      <span className="crm-table-primary crm-cell-wrap">{lead.customerName || lead.displayName || '-'}</span>
                      <span className="crm-table-muted">{getLeadMobile(lead) || '-'}</span>
                    </div>
                  </td>
                  <td style={shell.td} data-label="Status">{lead.status || lead.leadStatus || '-'}</td>
                  <td style={shell.td} data-label="Urgency">{lead.urgency}</td>
                  <td style={shell.td} data-label="Assigned To">{lead.assignedToDisplay}</td>
                  <td style={shell.td} data-label="Last Follow-up">{formatDate(lead.lastFollowupDate || lead.lastFollowUpDate)}</td>
                  <td style={shell.td} data-label="Next Follow-up">{formatDate(lead.followupDate)}</td>
                  <td style={shell.td} data-label="Actions">
                    <button
                      type="button"
                      style={shell.actionBtn}
                      onClick={() => navigate('/leads', { state: { openLogFollowupLeadId: lead._id } })}
                    >
                      Open Lead
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginatedRows.length === 0 ? (
            <div style={shell.empty}>
              <div style={{ textAlign: 'center' }}>
                <Smile size={24} />
                <div style={{ marginTop: '8px' }}>No follow-ups found for this filter</div>
              </div>
            </div>
          ) : null}
        </div>
        <div style={shell.pagination}>
          <div style={shell.paginationActions}>
            <button
              type="button"
              style={{ ...shell.paginationBtn, ...(safePage <= 1 ? shell.paginationBtnDisabled : {}) }}
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              style={{ ...shell.paginationBtn, ...(safePage >= totalPages ? shell.paginationBtnDisabled : {}) }}
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
