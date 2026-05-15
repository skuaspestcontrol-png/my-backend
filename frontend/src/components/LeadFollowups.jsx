import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  Filter,
  List,
  RefreshCw,
  Smile,
  X
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const ALL_VALUE = '__all__';

const shell = {
  page: { display: 'grid', gap: '14px', color: 'var(--color-muted)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, color: 'var(--color-text)', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' },
  subtitle: { margin: '2px 0 0', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 700 },
  refreshBtn: { border: '1px solid var(--color-primary-soft)', background: 'var(--color-white)', color: 'var(--color-primary)', borderRadius: '10px', height: '38px', minWidth: '118px', padding: '0 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' },
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
  th: { background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '12px', fontWeight: 800, textAlign: 'left', padding: '11px 14px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  td: { padding: '12px 14px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: '13px', fontWeight: 650 },
  empty: { minHeight: '96px', display: 'grid', placeItems: 'center', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 700 },
  actionBtn: { border: '1px solid var(--color-border)', background: 'var(--color-white)', color: 'var(--color-primary)', borderRadius: '10px', height: '34px', minWidth: '92px', padding: '0 10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }
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

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/leads`);
      setLeads(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load lead follow-ups', error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

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
  const followupMobileColumns = '150px 150px 100px 105px 145px 130px 130px 110px';
  const tableStyle = {
    ...shell.table,
    minWidth: isMobile ? 920 : '100%',
    tableLayout: 'fixed',
    '--mobile-table-columns': followupMobileColumns,
    '--mobile-table-min-width': '920px'
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
    { key: 'upcoming', label: 'All Upcoming', count: counts.upcoming, icon: List }
  ];

  return (
    <div style={shell.page}>
      <div style={shell.header}>
        <div>
          <h1 style={shell.title}>Lead Follow-ups</h1>
          <p style={shell.subtitle}>Track and manage all your lead follow-up activities</p>
        </div>
        {!isMobile ? (
          <button type="button" style={shell.refreshBtn} onClick={loadLeads} disabled={loading}>
            <RefreshCw size={15} />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        ) : null}
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

      <div style={shell.tabs}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              style={{
                ...shell.tab,
                color: active ? '#fff' : 'var(--color-muted)',
                background: active ? 'var(--color-primary)' : 'var(--color-white)',
                borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                boxShadow: active ? 'var(--shadow-sm)' : 'none'
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} />
              {tab.label}
              {tab.count > 0 || ['overdue', 'today'].includes(tab.key) ? <span style={{ ...shell.badge, background: active ? 'rgba(255,255,255,0.22)' : 'var(--color-primary)', color: active ? '#fff' : '#fff' }}>{tab.count}</span> : null}
            </button>
          );
        })}
      </div>

      <div style={shell.tableCard}>
        <div style={shell.tableTitle}>
          Follow-ups
          <span style={shell.badge}>{tabRows.length}</span>
        </div>
        <div style={{ ...shell.tableWrap, overflowX: 'auto' }} className="crm-table-shell">
          <table style={tableStyle} className="crm-compact-table crm-stack-mobile">
            <colgroup>
              <col style={{ width: '150px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '145px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr>
                {['Lead', 'Customer', 'Status', 'Urgency', 'Assigned To', 'Last Follow-up', 'Next Follow-up', 'Actions'].map((head) => (
                  <th key={head} style={shell.th}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabRows.map((lead) => (
                <tr key={lead._id || `${lead.customerName}-${lead.followupDate}`}>
                  <td style={shell.td} data-label="Lead"><span className="crm-cell-wrap">{lead._id || '-'}</span></td>
                  <td style={shell.td} data-label="Customer">
                    <div className="crm-table-primary crm-cell-wrap">{lead.customerName || lead.displayName || '-'}</div>
                    <div className="crm-table-muted">{getLeadMobile(lead) || '-'}</div>
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
          {tabRows.length === 0 ? (
            <div style={shell.empty}>
              <div style={{ textAlign: 'center' }}>
                <Smile size={24} />
                <div style={{ marginTop: '8px' }}>No follow-ups found for this filter</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
