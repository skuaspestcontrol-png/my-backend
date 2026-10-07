import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock,
  Crosshair,
  Filter,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCcw,
  Route,
  Search,
  ShieldAlert,
  Timer,
  UserCheck,
  Users,
} from 'lucide-react';
import { formatIndiaDateTime } from '../utils/indiaTime';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const EARTH_RADIUS_KM = 6371;
const LIVE_MINUTES = 10;
const STALE_MINUTES = 60;
const TRACK_TECHNICIANS_CACHE_KEY = 'track_technicians_ops_cache_v1';

const styles = {
  page: { display: 'grid', gap: 12, width: '100%', minWidth: 0 },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: 0 },
  sub: { margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 },
  toolbar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  control: { minHeight: 38, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--input-text)', padding: '0 10px', fontSize: 12, fontWeight: 700, outline: 'none' },
  iconButton: { width: 38, height: 38, borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  stats: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' },
  stat: { border: '1px solid var(--border-soft)', background: 'var(--surface-card)', borderRadius: 8, padding: 10, minHeight: 74, display: 'grid', alignContent: 'space-between' },
  statTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statLabel: { margin: 0, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' },
  statValue: { margin: '6px 0 0', fontSize: 22, color: 'var(--text-primary)', fontWeight: 900, lineHeight: 1 },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(340px, 0.75fr)', gap: 12, alignItems: 'start' },
  panel: { border: '1px solid var(--border-soft)', background: 'var(--surface-card)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-card)' },
  panelHead: { minHeight: 46, padding: '10px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  panelTitle: { margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8 },
  panelBody: { padding: 12, display: 'grid', gap: 10 },
  map: { position: 'relative', minHeight: 465, border: '1px solid var(--border-soft)', borderRadius: 8, overflow: 'hidden', background: 'linear-gradient(135deg, #eef7f3 0%, #f8fafc 42%, #eef2ff 100%)' },
  mapGrid: { position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'linear-gradient(rgba(15,23,42,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,.08) 1px, transparent 1px)', backgroundSize: '44px 44px' },
  marker: { position: 'absolute', transform: 'translate(-50%, -50%)', border: 0, background: 'transparent', cursor: 'pointer', padding: 0 },
  markerDot: { width: 26, height: 26, borderRadius: 999, border: '3px solid #fff', boxShadow: '0 8px 24px rgba(15,23,42,.25)', display: 'grid', placeItems: 'center' },
  markerLabel: { position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', borderRadius: 8, background: 'rgba(15,23,42,.86)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 7px' },
  list: { display: 'grid', gap: 8, maxHeight: 620, overflowY: 'auto', paddingRight: 2 },
  techRow: { border: '1px solid var(--border-soft)', background: 'var(--surface-elevated)', borderRadius: 8, padding: 10, display: 'grid', gap: 8, textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' },
  techRowActive: { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 2px var(--color-primary-soft)' },
  rowTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  name: { margin: 0, fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' },
  meta: { margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 650, lineHeight: 1.45 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 24, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 900, border: '1px solid var(--border-soft)', background: 'var(--surface-card)', color: 'var(--text-primary)' },
  action: { minHeight: 32, borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--surface-card)', color: 'var(--text-primary)', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 900, textDecoration: 'none', cursor: 'pointer' },
  split: { display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr)', gap: 12, alignItems: 'start' },
  field: { display: 'grid', gap: 5 },
  label: { fontSize: 10, fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  routeCanvas: { minHeight: 330, border: '1px solid var(--border-soft)', borderRadius: 8, background: '#f8fafc', overflow: 'hidden' },
  timeline: { display: 'grid', gap: 7, maxHeight: 330, overflowY: 'auto' },
  timelineItem: { border: '1px solid var(--border-soft)', borderRadius: 8, padding: 8, background: 'var(--surface-elevated)' },
  alertRow: { border: '1px solid var(--border-soft)', borderRadius: 8, padding: 9, background: 'var(--surface-elevated)', display: 'grid', gap: 4 },
  empty: { border: '1px dashed var(--border-soft)', borderRadius: 8, padding: 14, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 750, background: 'var(--surface-secondary)' },
};

const toNum = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const validCoords = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const todayInput = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 330);
  return now.toISOString().slice(0, 10);
};

const formatDateTime = (value, fallback = '-') => formatIndiaDateTime(value, {}, fallback);

const formatAge = (value) => {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day ago`;
};

const gpsAgeMinutes = (value) => {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp)) return Infinity;
  return Math.max(0, (Date.now() - timestamp) / 60000);
};

const stateFromPoint = (point) => {
  if (!point) return 'Offline';
  const age = gpsAgeMinutes(point.timestamp);
  if (age <= LIVE_MINUTES) return 'Live';
  if (age <= STALE_MINUTES) return 'Stale';
  return 'Offline';
};

const stateTone = (state) => {
  if (state === 'Live') return { color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' };
  if (state === 'Stale') return { color: '#92400e', background: '#fffbeb', borderColor: '#fde68a' };
  return { color: '#991b1b', background: '#fef2f2', borderColor: '#fecaca' };
};

const normalizePoint = (entry = {}) => {
  const lat = toNum(entry.latitude ?? entry.lat);
  const lng = toNum(entry.longitude ?? entry.lng);
  if (!validCoords(lat, lng)) return null;
  return {
    id: entry.id || `${entry.recordedAt || entry.timestamp || ''}-${lat}-${lng}`,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    accuracy: entry.accuracy == null ? null : Number(entry.accuracy),
    address: entry.address || '',
    timestamp: entry.recordedAt || entry.recorded_at || entry.timestamp || entry.last_seen || '',
    source: String(entry.source || 'live').trim() || 'live',
  };
};

const cleanPoints = (points = []) => {
  const seen = new Set();
  return (Array.isArray(points) ? points : [])
    .map(normalizePoint)
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
    .filter((point) => {
      const key = `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}:${new Date(point.timestamp || 0).getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const routeDistanceKm = (points = []) => cleanPoints(points).slice(1).reduce((sum, point, index, ordered) => {
  const previous = ordered[index];
  const distance = haversineKm(previous.lat, previous.lng, point.lat, point.lng);
  const minutes = Math.max(1, Math.abs(new Date(point.timestamp || 0).getTime() - new Date(previous.timestamp || 0).getTime()) / 60000);
  const speedKmh = distance / (minutes / 60);
  if (distance <= 0.01 || (distance > 5 && speedKmh > 140)) return sum;
  return sum + distance;
}, 0);

const readCache = () => {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(TRACK_TECHNICIANS_CACHE_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeCache = (payload) => {
  try {
    window.sessionStorage.setItem(TRACK_TECHNICIANS_CACHE_KEY, JSON.stringify({ ...payload, cachedAt: Date.now() }));
  } catch {
    // Session cache is optional.
  }
};

const getEmployeeCode = (entry = {}) => String(entry.empCode || entry.emp_code || entry.employeeCode || entry.employee_code || '').trim();
const getEmployeeId = (entry = {}) => String(entry.id || entry._id || entry.employeeId || entry.technicianId || entry.technician_id || '').trim();
const getEmployeeName = (entry = {}) => {
  const fullName = [entry.firstName || entry.first_name, entry.lastName || entry.last_name].filter(Boolean).join(' ').trim();
  return String(entry.full_name || entry.fullName || entry.name || fullName || getEmployeeCode(entry) || 'Technician').trim();
};

const boundsProjector = (points = []) => {
  const valid = points.filter(Boolean);
  if (!valid.length) return () => ({ x: 50, y: 50 });
  const lats = valid.map((point) => point.lat);
  const lngs = valid.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.002, maxLat - minLat);
  const lngSpan = Math.max(0.002, maxLng - minLng);
  return (point) => ({
    x: 8 + ((point.lng - minLng) / lngSpan) * 84,
    y: 92 - ((point.lat - minLat) / latSpan) * 84,
  });
};

const buildTechnicians = (employees = [], liveItems = []) => {
  const byKey = new Map();
  employees.forEach((entry) => {
    const role = String(entry.role || entry.roleName || entry.role_name || '').trim().toLowerCase();
    if (!role.includes('technician')) return;
    const id = getEmployeeId(entry);
    const employeeCode = getEmployeeCode(entry);
    const key = id || employeeCode || getEmployeeName(entry);
    byKey.set(key, { key, id, employeeCode, name: getEmployeeName(entry), mobile: entry.mobile || '', latest: null, routeHistory: [] });
  });

  liveItems.forEach((entry) => {
    const id = getEmployeeId(entry);
    const employeeCode = getEmployeeCode(entry);
    const key = id || employeeCode || getEmployeeName(entry);
    if (!key) return;
    const current = byKey.get(key) || { key, id, employeeCode, name: getEmployeeName(entry), mobile: entry.mobile || '', latest: null, routeHistory: [] };
    current.id = current.id || id;
    current.employeeCode = current.employeeCode || employeeCode;
    current.name = current.name || getEmployeeName(entry);
    current.mobile = current.mobile || entry.mobile || '';
    current.latest = normalizePoint(entry);
    current.routeHistory = cleanPoints(entry.routeHistory || []);
    current.routeSummary = entry.routeSummary || null;
    current.assignedJob = entry.assignedJob || null;
    current.attendance = entry.attendance || null;
    current.geofenceAlert = entry.geofenceAlert || null;
    current.movementStatus = entry.movementStatus || '';
    byKey.set(key, current);
  });

  return Array.from(byKey.values()).map((tech) => {
    const latest = tech.latest || tech.routeHistory[tech.routeHistory.length - 1] || null;
    const routeKm = Number(tech.routeSummary?.distanceKm ?? routeDistanceKm(tech.routeHistory));
    const liveState = stateFromPoint(latest);
    const movementStatus = tech.movementStatus || (routeKm > 0.05 ? 'Travelling' : latest ? 'Idle' : 'Offline');
    return {
      ...tech,
      latest,
      liveState,
      movementStatus,
      routeKm,
      lastSeen: latest?.timestamp || '',
      firstUpdate: tech.routeSummary?.firstUpdate || tech.routeHistory[0]?.timestamp || '',
      pointCount: Number(tech.routeSummary?.pointCount ?? tech.routeHistory.length),
      movementPoints: Number(tech.routeSummary?.movementPoints ?? 0),
    };
  }).sort((a, b) => {
    const order = { Live: 0, Stale: 1, Offline: 2 };
    return (order[a.liveState] - order[b.liveState]) || a.name.localeCompare(b.name);
  });
};

function StatusChip({ state }) {
  return <span style={{ ...styles.chip, ...stateTone(state) }}>{state}</span>;
}

function MiniMap({ technicians, selectedKey, onSelect }) {
  const points = technicians.map((tech) => tech.latest).filter(Boolean);
  const project = boundsProjector(points);

  return (
    <div style={styles.map}>
      <div style={styles.mapGrid} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {technicians.map((tech) => {
          const route = cleanPoints(tech.routeHistory);
          if (route.length < 2) return null;
          return (
            <polyline
              key={`${tech.key}-line`}
              points={route.map((point) => {
                const plotted = project(point);
                return `${plotted.x},${plotted.y}`;
              }).join(' ')}
              fill="none"
              stroke={tech.key === selectedKey ? '#9f174d' : '#64748b'}
              strokeWidth={tech.key === selectedKey ? 0.75 : 0.35}
              opacity={tech.key === selectedKey ? 0.9 : 0.35}
            />
          );
        })}
      </svg>
      {technicians.filter((tech) => tech.latest).map((tech) => {
        const plotted = project(tech.latest);
        const tone = stateTone(tech.liveState);
        return (
          <button
            key={`${tech.key}-marker`}
            type="button"
            title={`Locate ${tech.name}`}
            style={{ ...styles.marker, left: `${plotted.x}%`, top: `${plotted.y}%`, zIndex: tech.key === selectedKey ? 4 : 2 }}
            onClick={() => onSelect(tech.key)}
          >
            <span style={{ ...styles.markerDot, background: tone.color }}>
              <MapPin size={14} color="#fff" />
            </span>
            {(tech.key === selectedKey || technicians.length <= 6) ? <span style={styles.markerLabel}>{tech.name}</span> : null}
          </button>
        );
      })}
      {!points.length ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={styles.empty}>No valid GPS coordinates are available for the selected technicians.</div>
        </div>
      ) : null}
    </div>
  );
}

function RouteMap({ points = [], stops = [] }) {
  const clean = cleanPoints(points);
  const stopPoints = stops
    .filter((stop) => validCoords(Number(stop.latitude), Number(stop.longitude)))
    .map((stop) => ({ ...stop, lat: Number(stop.latitude), lng: Number(stop.longitude) }));
  const project = boundsProjector([...clean, ...stopPoints]);

  return (
    <div style={styles.routeCanvas}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 330, display: 'block' }}>
        <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />
        <path d="M0 22 H100 M0 44 H100 M0 66 H100 M0 88 H100 M20 0 V100 M40 0 V100 M60 0 V100 M80 0 V100" stroke="#e2e8f0" strokeWidth="0.25" />
        {clean.length > 1 ? (
          <polyline points={clean.map((point) => {
            const plotted = project(point);
            return `${plotted.x},${plotted.y}`;
          }).join(' ')} fill="none" stroke="#9f174d" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {clean[0] ? <circle cx={project(clean[0]).x} cy={project(clean[0]).y} r="1.8" fill="#047857" /> : null}
        {clean.length > 1 ? <circle cx={project(clean[clean.length - 1]).x} cy={project(clean[clean.length - 1]).y} r="1.8" fill="#b91c1c" /> : null}
        {stopPoints.map((stop) => {
          const plotted = project(stop);
          return <rect key={stop.id || stop.jobNumber || stop.customerName} x={plotted.x - 1.5} y={plotted.y - 1.5} width="3" height="3" fill="#2563eb" rx="0.8" />;
        })}
      </svg>
    </div>
  );
}

export default function TrackTechnicians() {
  const cached = useMemo(() => readCache(), []);
  const [employees, setEmployees] = useState(cached?.employees || []);
  const [liveItems, setLiveItems] = useState(cached?.liveItems || []);
  const [status, setStatus] = useState(cached?.status || 'Loading technician operations...');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedKey, setSelectedKey] = useState(cached?.selectedKey || '');
  const [routeDate, setRouteDate] = useState(todayInput());
  const [routePoints, setRoutePoints] = useState([]);
  const [routeSummary, setRouteSummary] = useState(null);
  const [jobStops, setJobStops] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const loadRef = useRef(null);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const technicians = useMemo(() => buildTechnicians(employees, liveItems), [employees, liveItems]);

  useEffect(() => {
    if (selectedKey || !technicians[0]) return;
    setSelectedKey(technicians[0].key);
  }, [selectedKey, technicians]);

  const selectedTech = technicians.find((tech) => tech.key === selectedKey) || technicians[0] || null;

  const loadLive = async () => {
    if (loadRef.current) return loadRef.current;
    const request = (async () => {
      try {
        const [employeesRes, liveRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/employees`),
          axios.get(`${API_BASE_URL}/api/technicians/live`),
        ]);
        const nextEmployees = Array.isArray(employeesRes.data) ? employeesRes.data : [];
        const nextLive = Array.isArray(liveRes.data?.items) ? liveRes.data.items : Array.isArray(liveRes.data) ? liveRes.data : [];
        setEmployees(nextEmployees);
        setLiveItems(nextLive);
        setStatus(`Updated ${formatDateTime(new Date().toISOString())}`);
        writeCache({ employees: nextEmployees, liveItems: nextLive, selectedKey, status: 'Cached technician operations.' });
      } catch (error) {
        console.error('Failed to load technician tracking data', error);
        setStatus('Unable to load technician tracking data right now.');
      }
    })();
    loadRef.current = request;
    request.finally(() => {
      if (loadRef.current === request) loadRef.current = null;
    });
    return request;
  };

  useEffect(() => {
    loadLive();
    const timer = window.setInterval(loadLive, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedTech?.id && !selectedTech?.employeeCode) {
      setRoutePoints([]);
      setRouteSummary(null);
      setJobStops([]);
      return;
    }
    let mounted = true;
    const loadRoute = async () => {
      setRouteLoading(true);
      try {
        const routeId = selectedTech.id || selectedTech.employeeCode;
        const res = await axios.get(`${API_BASE_URL}/api/technicians/${encodeURIComponent(routeId)}/route-history`, { params: { date: routeDate } });
        if (!mounted) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : [];
        setRoutePoints(cleanPoints(items));
        setRouteSummary(res.data?.summary || null);
        setJobStops(Array.isArray(res.data?.jobStops) ? res.data.jobStops : []);
      } catch (error) {
        console.error('Failed to load route history', error);
        if (mounted) {
          setRoutePoints([]);
          setRouteSummary(null);
          setJobStops([]);
        }
      } finally {
        if (mounted) setRouteLoading(false);
      }
    };
    loadRoute();
    return () => {
      mounted = false;
    };
  }, [selectedTech?.id, selectedTech?.employeeCode, routeDate]);

  const filteredTechnicians = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return technicians.filter((tech) => {
      const matchesFilter = filter === 'all'
        || tech.liveState.toLowerCase() === filter
        || tech.movementStatus.toLowerCase().replace(/\s+/g, '-') === filter;
      if (!matchesFilter) return false;
      if (!needle) return true;
      return [tech.name, tech.employeeCode, tech.mobile, tech.assignedJob?.customerName, tech.assignedJob?.jobNumber, tech.assignedJob?.serviceName]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, search, technicians]);

  const totals = useMemo(() => {
    const live = technicians.filter((tech) => tech.liveState === 'Live').length;
    const stale = technicians.filter((tech) => tech.liveState === 'Stale').length;
    const offline = technicians.filter((tech) => tech.liveState === 'Offline').length;
    const onJob = technicians.filter((tech) => ['Arrived', 'Job Started', 'Completed'].includes(tech.movementStatus)).length;
    const idle = technicians.filter((tech) => tech.movementStatus === 'Idle').length;
    const alerts = technicians.filter((tech) => tech.geofenceAlert && tech.geofenceAlert.status !== 'inside').length;
    const distance = technicians.reduce((sum, tech) => sum + (Number(tech.routeKm) || 0), 0);
    return { total: technicians.length, live, stale, offline, onJob, idle, alerts, distance };
  }, [technicians]);

  const gridStyle = viewportWidth < 1000 ? { ...styles.grid, gridTemplateColumns: '1fr' } : styles.grid;
  const splitStyle = viewportWidth < 950 ? { ...styles.split, gridTemplateColumns: '1fr' } : styles.split;
  const statsStyle = viewportWidth < 1100 ? { ...styles.stats, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : styles.stats;

  const routeDistance = Number(routeSummary?.distanceKm ?? routeDistanceKm(routePoints));
  const routeFirst = routeSummary?.firstUpdate || routePoints[0]?.timestamp || '';
  const routeLast = routeSummary?.lastUpdate || routePoints[routePoints.length - 1]?.timestamp || '';
  const alerts = technicians.map((tech) => tech.geofenceAlert ? { ...tech.geofenceAlert, key: tech.key } : null).filter(Boolean);

  return (
    <section style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Track Technicians</h2>
          <p style={styles.sub}>{status}</p>
        </div>
        <div style={styles.toolbar}>
          <label style={{ ...styles.control, display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 250 }}>
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search technician, job, customer" style={{ border: 0, outline: 0, background: 'transparent', color: 'inherit', fontWeight: 700, width: '100%' }} />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Filter size={15} color="var(--text-secondary)" />
            <select value={filter} onChange={(event) => setFilter(event.target.value)} style={styles.control}>
              <option value="all">All states</option>
              <option value="live">Live</option>
              <option value="stale">Stale</option>
              <option value="offline">Offline</option>
              <option value="travelling">Travelling</option>
              <option value="idle">Idle</option>
              <option value="job-started">Job Started</option>
            </select>
          </label>
          <button type="button" title="Refresh tracking" style={styles.iconButton} onClick={loadLive}>
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      <div style={statsStyle}>
        {[
          ['Total Technicians', totals.total, Users],
          ['Online Now', totals.live, Activity],
          ['On Job', totals.onJob, UserCheck],
          ['Idle', totals.idle, Timer],
          ['Offline', totals.offline, AlertTriangle],
          ['Distance Today', `${totals.distance.toFixed(2)} km`, Route],
          ['Geo-fence Alerts', totals.alerts, ShieldAlert],
        ].map(([label, value, Icon]) => (
          <article key={label} style={styles.stat}>
            <div style={styles.statTop}>
              <p style={styles.statLabel}>{label}</p>
              <Icon size={15} color="var(--text-secondary)" />
            </div>
            <p style={styles.statValue}>{value}</p>
          </article>
        ))}
      </div>

      <div style={gridStyle}>
        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <h3 style={styles.panelTitle}><Navigation size={16} /> Live Operations Map</h3>
            <p style={styles.meta}>{filteredTechnicians.length} shown - {totals.stale} stale GPS</p>
          </div>
          <div style={styles.panelBody}>
            <MiniMap technicians={filteredTechnicians} selectedKey={selectedTech?.key} onSelect={setSelectedKey} />
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <h3 style={styles.panelTitle}><Users size={16} /> Technician List</h3>
            <p style={styles.meta}>GPS age controls Live, Stale and Offline.</p>
          </div>
          <div style={styles.panelBody}>
            <div style={styles.list}>
              {filteredTechnicians.map((tech) => (
                <button key={tech.key} type="button" style={{ ...styles.techRow, ...(selectedTech?.key === tech.key ? styles.techRowActive : {}) }} onClick={() => setSelectedKey(tech.key)}>
                  <div style={styles.rowTop}>
                    <div>
                      <p style={styles.name}>{tech.name}</p>
                      <p style={styles.meta}>{tech.employeeCode || '-'}{tech.mobile ? ` - ${tech.mobile}` : ''}</p>
                    </div>
                    <StatusChip state={tech.liveState} />
                  </div>
                  <div style={styles.chips}>
                    <span style={styles.chip}><Clock size={12} /> {tech.lastSeen ? formatAge(tech.lastSeen) : 'No GPS'}</span>
                    <span style={styles.chip}><Route size={12} /> {tech.routeKm.toFixed(2)} km</span>
                    <span style={styles.chip}><Crosshair size={12} /> {tech.movementStatus}</span>
                  </div>
                  <p style={styles.meta}>
                    {tech.assignedJob?.customerName ? `${tech.assignedJob.customerName} - ${tech.assignedJob.serviceName || 'Service'}` : 'No assigned job context found for today'}
                  </p>
                  <p style={styles.meta}>
                    Last seen: {tech.lastSeen ? formatDateTime(tech.lastSeen) : '-'}{tech.latest?.source ? ` - ${tech.latest.source}` : ''}
                  </p>
                  {tech.latest ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${tech.latest.lat},${tech.latest.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.action}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <LocateFixed size={14} /> Locate
                    </a>
                  ) : null}
                </button>
              ))}
              {!filteredTechnicians.length ? <div style={styles.empty}>No technicians match the current search and filter.</div> : null}
            </div>
          </div>
        </section>
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHead}>
          <h3 style={styles.panelTitle}><Route size={16} /> Route History</h3>
          <div style={styles.toolbar}>
            <label style={styles.field}>
              <span style={styles.label}>Technician</span>
              <select value={selectedTech?.key || ''} onChange={(event) => setSelectedKey(event.target.value)} style={styles.control}>
                {technicians.map((tech) => <option key={tech.key} value={tech.key}>{tech.name}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Date</span>
              <input type="date" value={routeDate} onChange={(event) => setRouteDate(event.target.value)} style={styles.control} />
            </label>
          </div>
        </div>
        <div style={styles.panelBody}>
          <div style={splitStyle}>
            <div style={{ display: 'grid', gap: 8 }}>
              <article style={styles.stat}>
                <p style={styles.statLabel}>Selected Technician</p>
                <p style={{ ...styles.statValue, fontSize: 18 }}>{selectedTech?.name || '-'}</p>
              </article>
              <article style={styles.stat}>
                <p style={styles.statLabel}>Total Travelled</p>
                <p style={{ ...styles.statValue, fontSize: 18 }}>{routeDistance.toFixed(2)} km</p>
              </article>
              <article style={styles.stat}>
                <p style={styles.statLabel}>GPS Points</p>
                <p style={{ ...styles.statValue, fontSize: 18 }}>{routePoints.length}</p>
              </article>
              <article style={styles.stat}>
                <p style={styles.statLabel}>First / Last Update</p>
                <p style={styles.meta}>{routeFirst ? formatDateTime(routeFirst) : '-'}</p>
                <p style={styles.meta}>{routeLast ? formatDateTime(routeLast) : '-'}</p>
              </article>
              <article style={styles.stat}>
                <p style={styles.statLabel}>Job Stops</p>
                <p style={styles.meta}>{jobStops.length ? jobStops.map((stop) => `${stop.customerName || stop.jobNumber || 'Job'}: ${stop.status}`).join(', ') : 'No coordinate-backed job stops found.'}</p>
              </article>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <RouteMap points={routePoints} stops={jobStops} />
              <div style={styles.timeline}>
                {routeLoading ? <div style={styles.empty}>Loading route history...</div> : null}
                {!routeLoading && !routePoints.length ? <div style={styles.empty}>No movement data for this technician/date. Distance is not fabricated from a single or missing GPS point.</div> : null}
                {routePoints.map((point, index) => (
                  <div key={point.id || `${point.timestamp}-${index}`} style={styles.timelineItem}>
                    <p style={styles.name}>{index === 0 ? 'Start' : index === routePoints.length - 1 ? 'Latest' : `Point ${index + 1}`}</p>
                    <p style={styles.meta}>{formatDateTime(point.timestamp)} - {point.source} - {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
                    {point.address ? <p style={styles.meta}>{point.address}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHead}>
          <h3 style={styles.panelTitle}><ShieldAlert size={16} /> Geo-fence Alerts</h3>
          <p style={styles.meta}>Generated only from real technician GPS and coordinate-backed assigned jobs.</p>
        </div>
        <div style={styles.panelBody}>
          {alerts.length ? alerts.map((alert) => (
            <div key={`${alert.key}-${alert.jobId || alert.customerName}`} style={styles.alertRow}>
              <p style={styles.name}>{alert.technicianName || alert.employeeCode || 'Technician'} - {alert.event}</p>
              <p style={styles.meta}>{alert.customerName || 'Assigned job'}{alert.jobNumber ? ` - ${alert.jobNumber}` : ''}</p>
              <p style={styles.meta}><CalendarDays size={12} style={{ verticalAlign: 'middle' }} /> {formatDateTime(alert.eventTime)} - {Number(alert.distanceKm || 0).toFixed(2)} km from job</p>
            </div>
          )) : <div style={styles.empty}>No coordinate-backed geo-fence alerts are available for the current data.</div>}
        </div>
      </section>
    </section>
  );
}
