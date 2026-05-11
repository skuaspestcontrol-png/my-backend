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
  page: { display: 'grid', gap: '18px', color: '#475569' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
  title: { margin: 0, color: '#334155', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', color: '#7c8797', fontSize: '15px', fontWeight: 700 },
  refreshBtn: { border: '1px solid #a7e0bd', background: '#f8fffb', color: '#75cf96', borderRadius: '6px', minHeight: '40px', padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '18px' },
  statCard: { minHeight: '94px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '18px', padding: '18px 26px', boxShadow: '0 1px 2px rgba(15,23,42,0.03)' },
  statIcon: { width: '56px', height: '56px', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue: { margin: 0, color: '#1f2937', fontSize: '28px', lineHeight: 1, fontWeight: 800 },
  statLabel: { margin: '10px 0 0', color: '#64748b', fontSize: '13px', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' },
  filters: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 26px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr)) 230px 62px', gap: '18px 24px', alignItems: 'end' },
  label: { display: 'block', marginBottom: '10px', color: '#526173', fontSize: '15px', fontWeight: 800 },
  input: { width: '100%', height: '42px', border: '1px solid #d8dee7', borderRadius: '6px', background: '#fff', color: '#334155', padding: '0 12px', fontSize: '14px', fontWeight: 700, outline: 'none', boxSizing: 'border-box' },
  applyBtn: { height: '42px', border: 'none', borderRadius: '6px', background: '#7bd19d', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' },
  clearBtn: { height: '42px', border: '1px solid #a977ff', borderRadius: '6px', background: '#fff', color: '#8b5cf6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  tabs: { display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' },
  tab: { border: 'none', borderRadius: '8px', background: 'transparent', color: '#64748b', padding: '12px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' },
  badge: { minWidth: '22px', height: '22px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px', background: '#7bd19d', color: '#fff', fontSize: '12px', fontWeight: 800 },
  tableCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' },
  tableTitle: { padding: '16px 24px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', minWidth: '980px', borderCollapse: 'collapse' },
  th: { background: '#f8fafc', color: '#111827', fontSize: '14px', fontWeight: 800, textAlign: 'left', padding: '14px 12px', borderBottom: '1px solid #d8dee7' },
  td: { padding: '14px 12px', borderBottom: '1px solid #edf2f7', color: '#334155', fontSize: '13px', fontWeight: 700 },
  empty: { minHeight: '130px', display: 'grid', placeItems: 'center', color: '#8b95a1', fontSize: '15px', fontWeight: 700 },
  actionBtn: { border: '1px solid #d8dee7', background: '#fff', color: '#334155', borderRadius: '6px', minHeight: '32px', padding: '0 10px', fontWeight: 800, cursor: 'pointer' }
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
  const statGridStyle = isMobile ? { ...shell.statGrid, gridTemplateColumns: '1fr' } : viewportWidth < 1100 ? { ...shell.statGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : shell.statGrid;
  const filterStyle = isMobile ? { ...shell.filters, gridTemplateColumns: '1fr', padding: '16px' } : viewportWidth < 1200 ? { ...shell.filters, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : shell.filters;

  const stats = [
    { label: 'Overdue', value: counts.overdue, icon: AlertTriangle, color: '#f15d5d', bg: '#feecec' },
    { label: 'Today', value: counts.today, icon: CalendarDays, color: '#4965dd', bg: '#eef1ff' },
    { label: 'This Week', value: counts.week, icon: CalendarClock, color: '#45abc8', bg: '#edf9fc' },
    { label: 'Done This Week', value: counts.doneWeek, icon: CheckCheck, color: '#18a66f', bg: '#ecfbf2' }
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
        <button type="button" style={shell.refreshBtn} onClick={loadLeads} disabled={loading}>
          <RefreshCw size={15} />
          {loading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div style={statGridStyle}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={shell.statCard}>
              <span style={{ ...shell.statIcon, color: stat.color, background: stat.bg }}>
                <Icon size={24} />
              </span>
              <span>
                <p style={shell.statValue}>{stat.value}</p>
                <p style={shell.statLabel}>{stat.label}</p>
              </span>
            </div>
          );
        })}
      </div>

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
                color: active ? '#fff' : '#64748b',
                background: active ? '#4965dd' : 'transparent'
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} />
              {tab.label}
              {tab.count > 0 || ['overdue', 'today'].includes(tab.key) ? <span style={{ ...shell.badge, background: active && tab.key === 'overdue' ? '#f05252' : '#7bd19d' }}>{tab.count}</span> : null}
            </button>
          );
        })}
      </div>

      <div style={shell.tableCard}>
        <div style={shell.tableTitle}>
          Follow-ups
          <span style={shell.badge}>{tabRows.length}</span>
        </div>
        <div style={shell.tableWrap}>
          <table style={shell.table}>
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
                  <td style={shell.td}>{lead._id || '-'}</td>
                  <td style={shell.td}>
                    <div>{lead.customerName || lead.displayName || '-'}</div>
                    <div style={{ color: '#8b95a1', fontSize: '12px', marginTop: '3px' }}>{getLeadMobile(lead) || '-'}</div>
                  </td>
                  <td style={shell.td}>{lead.status || lead.leadStatus || '-'}</td>
                  <td style={shell.td}>{lead.urgency}</td>
                  <td style={shell.td}>{lead.assignedToDisplay}</td>
                  <td style={shell.td}>{formatDate(lead.lastFollowupDate || lead.lastFollowUpDate)}</td>
                  <td style={shell.td}>{formatDate(lead.followupDate)}</td>
                  <td style={shell.td}>
                    <button type="button" style={shell.actionBtn} onClick={() => navigate('/leads')}>Open Lead</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tabRows.length === 0 ? (
            <div style={shell.empty}>
              <div style={{ textAlign: 'center' }}>
                <Smile size={28} />
                <div style={{ marginTop: '10px' }}>No follow-ups found for this filter</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
