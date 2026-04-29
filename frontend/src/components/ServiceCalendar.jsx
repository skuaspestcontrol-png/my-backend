import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText, RefreshCw, UserRound } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const shell = {
  page: { display: 'grid', gap: '16px' },
  card: { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(148,163,184,0.22)', borderRadius: '16px', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' },
  head: { padding: '16px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' },
  titleWrap: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
  title: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' },
  subtitle: { margin: '6px 0 0 0', fontSize: '13px', color: '#64748b' },
  controls: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  controlBtn: { border: '1px solid #D1D5DB', background: '#fff', color: '#334155', borderRadius: '10px', height: '36px', minWidth: '36px', padding: '0 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 },
  monthText: { minWidth: '170px', textAlign: 'center', fontWeight: 700, color: '#0f172a' },
  body: { padding: '14px 16px 16px', display: 'grid', gap: '14px' },
  weekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' },
  weekCell: { textAlign: 'center', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' },
  dayBtn: { border: '1px solid var(--color-border)', borderRadius: '10px', background: '#fff', minHeight: '88px', padding: '8px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' },
  dayBtnMuted: { opacity: 0.45, background: '#f8fafc' },
  dayBtnSelected: { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 2px rgba(159,23,77,0.2)' },
  dayNumber: { fontSize: '12px', fontWeight: 700, color: '#0f172a' },
  dayBadge: { alignSelf: 'flex-start', fontSize: '10px', fontWeight: 800, color: 'var(--color-primary-dark)', background: 'var(--color-primary-soft)', borderRadius: '999px', padding: '2px 7px' },
  selectedCard: { border: '1px solid var(--color-border)', borderRadius: '12px', background: '#fff', overflow: 'hidden' },
  selectedHead: { padding: '10px 12px', borderBottom: '1px solid #eef2f7', fontSize: '12px', color: '#334155', fontWeight: 800, textTransform: 'uppercase' },
  selectedBody: { padding: '10px 12px', display: 'grid', gap: '10px' },
  eventCard: { border: '1px solid var(--color-primary-soft)', borderRadius: '10px', padding: '10px', background: '#FDF2F8', display: 'grid', gap: '6px' },
  eventLine: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155' },
  eventMeta: { fontSize: '11px', color: '#64748b' },
  empty: { padding: '12px', borderRadius: '8px', border: '1px dashed #D1D5DB', color: '#64748b', fontSize: '13px' },
  error: { color: '#b91c1c', fontWeight: 700, fontSize: '12px' }
};

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const monthLabel = (date) =>
  date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });

const displayDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return value || '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const normalizeTime = (value, fallback = '10:00') => {
  const raw = String(value || '').trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
};

export default function ServiceCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()));

  const loadSchedules = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_BASE_URL}/api/service-schedules`);
      setEvents(Array.isArray(response.data) ? response.data : []);
    } catch (loadError) {
      console.error('Failed to load service schedules', loadError);
      setError('Could not load service schedules right now.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/service-schedules`);
        if (!mounted) return;
        setError('');
        setEvents(Array.isArray(response.data) ? response.data : []);
      } catch (loadError) {
        console.error('Failed to load service schedules', loadError);
        if (!mounted) return;
        setError('Could not load service schedules right now.');
        setEvents([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const eventsByDate = useMemo(() => {
    const grouped = {};
    events.forEach((event, index) => {
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
  }, [events]);

  const monthCells = useMemo(() => {
    const monthStart = new Date(currentMonth);
    monthStart.setDate(1);
    const offset = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - offset);

    return Array.from({ length: 42 }, (_, index) => {
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

  return (
    <section style={shell.page}>
      <div style={shell.card}>
        <div style={shell.head}>
          <div>
            <div style={shell.titleWrap}>
              <CalendarDays size={20} color="var(--color-primary-dark)" />
              <h1 style={shell.title}>Service Calendar</h1>
            </div>
            <p style={shell.subtitle}>
              Calendar view of scheduled services synced from invoice service plans.
            </p>
          </div>
          <div style={shell.controls}>
            <button
              type="button"
              style={shell.controlBtn}
              onClick={() =>
                setCurrentMonth((prev) => {
                  const next = new Date(prev);
                  next.setMonth(next.getMonth() - 1);
                  return next;
                })
              }
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div style={shell.monthText}>{monthLabel(currentMonth)}</div>
            <button
              type="button"
              style={shell.controlBtn}
              onClick={() =>
                setCurrentMonth((prev) => {
                  const next = new Date(prev);
                  next.setMonth(next.getMonth() + 1);
                  return next;
                })
              }
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
            <button type="button" style={shell.controlBtn} onClick={loadSchedules}>
              <RefreshCw size={14} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={shell.body}>
          {error ? <div style={shell.error}>{error}</div> : null}

          <div style={shell.weekRow}>
            {weekDays.map((day) => (
              <div key={day} style={shell.weekCell}>{day}</div>
            ))}
          </div>

          <div style={shell.grid}>
            {monthCells.map((cell) => {
              const isSelected = selectedDate === cell.dateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  style={{
                    ...shell.dayBtn,
                    ...(cell.inCurrentMonth ? null : shell.dayBtnMuted),
                    ...(isSelected ? shell.dayBtnSelected : null)
                  }}
                  onClick={() => setSelectedDate(cell.dateKey)}
                >
                  <span style={shell.dayNumber}>{cell.date.getDate()}</span>
                  {cell.events.length > 0 ? (
                    <span style={shell.dayBadge}>{cell.events.length} service{cell.events.length > 1 ? 's' : ''}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div style={shell.selectedCard}>
            <div style={shell.selectedHead}>Services on {displayDate(selectedDate)}</div>
            <div style={shell.selectedBody}>
              {selectedDayEvents.length === 0 ? (
                <div style={shell.empty}>No services scheduled for this date.</div>
              ) : (
                selectedDayEvents.map((event) => (
                  <div key={event._id} style={shell.eventCard}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                      {event.itemName || 'Service Item'}
                    </div>
                    <div style={shell.eventLine}>
                      <Clock3 size={13} /> {event.serviceTime}
                    </div>
                    <div style={shell.eventLine}>
                      <UserRound size={13} /> {event.customerName || 'Customer not linked'}
                    </div>
                    <div style={shell.eventLine}>
                      <FileText size={13} /> {event.invoiceNumber || 'Invoice not set'}
                    </div>
                    <div style={shell.eventMeta}>
                      {event.itemDescription || 'No item description'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
