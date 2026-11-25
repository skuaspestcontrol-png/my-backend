import { formatPortalTime, formatPortalDate } from '../utils/portalDateTime';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, Layers, Plus, RefreshCw, Search } from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { getPortalUserId, getPortalUserRole } from '../utils/portalAuth';
import './ServiceCalendar.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value) => {
  // Invoice schedules contain date-only values. Keep their day in the local calendar.
  const date = new Date(`${value}T00:00:00`);
  return formatDateInput(date) === value ? date : null;
};

const monthLabel = (date) =>
  date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });

const displayDate = (value) => formatPortalDate(value, value || '-');

const normalizeTime = (value, fallback = '10:00') => {
  const raw = String(value || '').trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const isCompletedStatus = (value) => {
  const status = normalizeText(value);
  return status === 'completed' || status === 'done' || status === 'closed';
};

const SERVICE_CALENDAR_CACHE_KEY = 'service_calendar_cache_v1';

const readServiceCalendarCache = (owner) => {
  try {
    if (!owner || typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(SERVICE_CALENDAR_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.owner === owner && Array.isArray(parsed.events) ? parsed.events : null;
  } catch {
    return null;
  }
};

const writeServiceCalendarCache = (owner, events) => {
  try {
    if (!owner || typeof window === 'undefined') return;
    window.sessionStorage.setItem(SERVICE_CALENDAR_CACHE_KEY, JSON.stringify({ owner, events }));
  } catch {
    // Cache is a best-effort performance hint.
  }
};

const MAX_DAY_ENTRIES = 3;

function collectOptions(events, field) {
  const options = new Map();
  for (const event of events) {
    const label = String(event?.[field] || '').trim();
    const value = normalizeText(label);
    if (value && !options.has(value)) options.set(value, label);
  }
  return [...options].sort(([, left], [, right]) => left.localeCompare(right));
}

function getStatusTone(value) {
  if (isCompletedStatus(value)) return 'completed';
  const status = normalizeText(value).replace(/[_-]+/g, ' ');
  if (status === 'pending' || status === 'in progress') return 'pending';
  if (status === 'scheduled' || status === 'upcoming') return 'upcoming';
  if (status === 'overdue') return 'overdue';
  return 'other';
}

function CalendarFilter({ label, options, value, onChange }) {
  const currentLabel = options.find(([key]) => key === value)?.[1];
  return (
    <select
      className="sc-select"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{label} (All)</option>
      {value && !currentLabel ? <option value={value}>{label}: {value}</option> : null}
      {options.map(([key, name]) => <option key={key} value={key}>{label}: {name}</option>)}
    </select>
  );
}

function ServiceCard({ event }) {
  const tone = getStatusTone(event.status);
  const title = [event.customerName, event.itemName].filter(Boolean).join(' · ') || 'Service';
  return (
    <details className="sc-service" data-tone={tone}>
      <summary className="sc-service-summary">
        <span className="sc-service-top">
          <strong>{title}</strong>
          <ChevronDown size={17} aria-hidden="true" />
        </span>
        <span className="sc-service-meta">
          <span><Clock3 size={14} aria-hidden="true" /> {formatPortalTime(event.serviceTime)}</span>
          {event.serviceNumber > 0 ? <span>Service #{event.serviceNumber}</span> : null}
        </span>
        {event.status ? <span className="sc-status">{event.status}</span> : null}
      </summary>
      <div className="sc-service-details">
        {event.invoiceNumber ? <div><FileText size={15} aria-hidden="true" /> {event.invoiceNumber}</div> : null}
        <p>{event.itemDescription || 'No item description'}</p>
      </div>
    </details>
  );
}

export default function ServiceCalendar() {
  const role = normalizeText(getPortalUserRole());
  const userId = getPortalUserId();
  const cacheOwner = userId ? JSON.stringify([userId, role]) : '';
  const [cachedEvents] = useState(() => readServiceCalendarCache(cacheOwner));
  const [events, setEvents] = useState(() => cachedEvents || []);
  const hasCachedEvents = Boolean(cachedEvents);
  const [hasLoaded, setHasLoaded] = useState(hasCachedEvents);
  const [loading, setLoading] = useState(!hasCachedEvents);
  const [error, setError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()));
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [search, setSearch] = useState('');
  const loadRequestRef = useRef(null);
  const dailyHeadingId = useId();

  const loadSchedules = async (options = {}) => {
    const activeRequest = loadRequestRef.current;
    if (!options.silent) {
      setLoading(true);
      setError('');
    }
    if (activeRequest) {
      if (!options.silent) activeRequest.showFeedback = true;
      return activeRequest.promise;
    }
    const request = { showFeedback: !options.silent };
    loadRequestRef.current = request;
    request.promise = (async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/service-schedules`);
        const nextEvents = Array.isArray(response.data) ? response.data : [];
        setEvents(nextEvents);
        setHasLoaded(true);
        setError('');
        writeServiceCalendarCache(cacheOwner, nextEvents);
      } catch (loadError) {
        console.error('Failed to load service schedules', loadError);
        const accessDenied = [401, 403].includes(loadError?.response?.status);
        if (accessDenied) {
          setEvents([]);
          setHasLoaded(false);
          writeServiceCalendarCache(cacheOwner, null);
        }
        if (accessDenied || request.showFeedback) {
          setError('Could not load service schedules right now.');
        }
      } finally {
        if (request.showFeedback) setLoading(false);
        loadRequestRef.current = null;
      }
    })();
    return request.promise;
  };

  useEffect(() => {
    loadSchedules({ silent: hasCachedEvents });
  }, [hasCachedEvents]);

  useAutoRefresh(() => loadSchedules({ silent: true }));

  const filterOptions = useMemo(() => ({
    statuses: collectOptions(events, 'status'),
    services: collectOptions(events, 'itemName')
  }), [events]);

  const eventsByDate = useMemo(() => {
    const query = normalizeText(search);
    const grouped = {};
    events.forEach((event, index) => {
      const serviceName = normalizeText(event?.itemName);
      if (statusFilter && normalizeText(event?.status) !== statusFilter) return;
      if (serviceFilter && serviceName !== serviceFilter) return;
      if (query && !serviceName.includes(query) && !normalizeText(event?.customerName).includes(query)) return;

      const date = String(event?.serviceDate || '').slice(0, 10);
      const parsedDate = parseDateOnly(date);
      if (!parsedDate) return;
      const key = formatDateInput(parsedDate);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        ...event,
        _id: event?._id || `${event?.invoiceId || 'invoice'}-${key}-${index}`,
        serviceTime: normalizeTime(event?.serviceTime, '10:00')
      });
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key] = grouped[key].sort((a, b) => {
        const aStamp = `${a.serviceDate}T${a.serviceTime}`;
        const bStamp = `${b.serviceDate}T${b.serviceTime}`;
        if (aStamp === bStamp) {
          return String(a.customerName || '').localeCompare(String(b.customerName || ''));
        }
        return aStamp.localeCompare(bStamp);
      });
    });

    return grouped;
  }, [events, statusFilter, serviceFilter, search]);

  const monthCells = useMemo(() => {
    const monthStart = new Date(currentMonth);
    monthStart.setDate(1);
    const offset = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - offset);

    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dateKey = formatDateInput(date);
      return {
        date,
        dateKey,
        inCurrentMonth: date.getMonth() === currentMonth.getMonth(),
        events: eventsByDate[dateKey] || []
      };
    });
  }, [currentMonth, eventsByDate]);

  const selectedDayEvents = useMemo(() => eventsByDate[selectedDate] || [], [eventsByDate, selectedDate]);
  const today = useMemo(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    return current;
  }, []);
  const summary = useMemo(() => {
    const completed = events.filter((event) => isCompletedStatus(event?.status)).length;
    const upcoming = events.filter((event) => {
      const serviceDate = parseDateOnly(String(event?.serviceDate || '').slice(0, 10));
      return serviceDate && serviceDate.getTime() > today.getTime() && !isCompletedStatus(event?.status);
    }).length;
    const pending = events.filter((event) => {
      if (isCompletedStatus(event?.status)) return false;
      const serviceDate = parseDateOnly(String(event?.serviceDate || '').slice(0, 10));
      if (!serviceDate) return true;
      return serviceDate.getTime() <= today.getTime();
    }).length;

    return {
      completed,
      pending,
      upcoming,
      total: events.length
    };
  }, [events, today]);
  const todayKey = formatDateInput(today);
  const hasFilters = Boolean(statusFilter || serviceFilter || search);
  // Assign Services uses the existing authenticated route and server-side job permissions.
  const canSchedule = role && role !== 'employee' && role !== 'technician';
  const waitingForData = loading && !hasLoaded;

  const shiftMonth = (direction) => {
    setCurrentMonth((previous) => {
      const next = new Date(previous);
      next.setMonth(next.getMonth() + direction);
      return next;
    });
  };

  const resetFilters = () => {
    setStatusFilter('');
    setServiceFilter('');
    setSearch('');
  };

  const summaryItems = [
    { label: 'Completed Services', value: summary.completed, icon: CheckCircle2, tone: 'completed' },
    { label: 'Pending Services', value: summary.pending, icon: Clock3, tone: 'pending' },
    { label: 'Upcoming Services', value: summary.upcoming, icon: CalendarDays, tone: 'upcoming' },
    { label: 'Total Number of Services', value: summary.total, icon: Layers, tone: 'total' }
  ];

  return (
    <section className="service-calendar" aria-label="Service Calendar">
      <div className="sc-page">
        <header className="sc-header">
          <div className="sc-title">
            <span className="sc-title-icon"><CalendarDays size={28} aria-hidden="true" /></span>
            <div>
              <h1>Service Calendar</h1>
              <p>Calendar view of scheduled services synced from invoice service plans.</p>
            </div>
          </div>
          <div className="sc-controls">
            <div className="sc-month-controls">
              <button type="button" className="sc-button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={19} aria-hidden="true" />
              </button>
              <span className="sc-month-label" aria-live="polite">{monthLabel(currentMonth)}</span>
              <button type="button" className="sc-button" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight size={19} aria-hidden="true" />
              </button>
            </div>
            {canSchedule ? (
              <Link className="sc-button sc-schedule" to="/operations/assign-services">
                <Plus size={19} aria-hidden="true" /> Schedule Service
              </Link>
            ) : null}
            <button type="button" className="sc-button" onClick={() => loadSchedules()} disabled={loading}>
              <RefreshCw size={17} aria-hidden="true" /> {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </header>

        <div className="sc-filters" role="group" aria-label="Service calendar filters">
          <CalendarFilter label="Status" options={filterOptions.statuses} value={statusFilter} onChange={setStatusFilter} />
          <CalendarFilter label="Service Type" options={filterOptions.services} value={serviceFilter} onChange={setServiceFilter} />
          <div className="sc-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search by customer or service"
              placeholder="Search by customer or service…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {hasFilters ? <button type="button" className="sc-button sc-reset" onClick={resetFilters}>Reset filters</button> : null}
        </div>

        {error ? <div className="sc-error" role="alert">{error}</div> : null}

        <div className="sc-metrics" role="group" aria-label="Service totals across all dates">
          {summaryItems.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="sc-metric" data-tone={tone}>
              <span className="sc-metric-icon"><Icon size={23} aria-hidden="true" /></span>
              <div>
                <div className="sc-metric-label">{label}</div>
                <div className="sc-metric-value">{hasLoaded ? value.toLocaleString('en-IN') : '—'}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sc-workspace">
          <div className="sc-calendar" role="group" aria-label={monthLabel(currentMonth)}>
            <div className="sc-week" aria-hidden="true">
              {weekDays.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="sc-days">
              {monthCells.map((cell) => {
                const isToday = cell.dateKey === todayKey;
                const more = cell.events.length - MAX_DAY_ENTRIES;
                const serviceCount = `${cell.events.length} service${cell.events.length === 1 ? '' : 's'}`;
                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    className="sc-day"
                    data-outside={!cell.inCurrentMonth || undefined}
                    aria-label={`${displayDate(cell.dateKey)}, ${serviceCount}`}
                    aria-current={isToday ? 'date' : undefined}
                    aria-pressed={selectedDate === cell.dateKey}
                    onClick={() => setSelectedDate(cell.dateKey)}
                  >
                    <span className="sc-day-number">{cell.date.getDate()}</span>
                    {cell.events.length > 0 ? (
                      <span className="sc-day-entries" aria-hidden="true">
                        {cell.events.slice(0, MAX_DAY_ENTRIES).map((event) => (
                          <span
                            className="sc-day-entry"
                            data-tone={getStatusTone(event.status)}
                            key={event._id}
                            title={[event.itemName, event.status].filter(Boolean).join(' · ')}
                          >
                            <span>{event.itemName || event.status || 'Service'}</span>
                          </span>
                        ))}
                        {more > 0 ? <span className="sc-more">+{more}<span> more</span></span> : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <section className="sc-daily" aria-labelledby={dailyHeadingId}>
            <h2 id={dailyHeadingId} aria-live="polite">Services on {displayDate(selectedDate)}</h2>
            {waitingForData ? (
              <div className="sc-empty" role="status"><CalendarDays size={29} aria-hidden="true" /> Loading service schedules…</div>
            ) : error && !hasLoaded ? null : selectedDayEvents.length === 0 ? (
              <div className="sc-empty">
                <CalendarDays size={29} aria-hidden="true" />
                {hasFilters ? 'No matching services for this date.' : 'No services scheduled for this date.'}
              </div>
            ) : (
              <div className="sc-daily-list" key={selectedDate}>
                {selectedDayEvents.map((event) => <ServiceCard key={event._id} event={event} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
