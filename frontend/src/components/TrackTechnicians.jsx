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
const STALE_MINUTES = 30;
const MAX_FUTURE_CLOCK_SKEW_MINUTES = 5;
const TRACK_TECHNICIANS_CACHE_KEY = 'track_technicians_ops_cache_v1';
const TILE_SIZE = 256;
const OSM_TILE_URL = 'https://tile.openstreetmap.org';
const MAX_USABLE_ACCURACY_METERS = 100;
const DEFAULT_ACCURACY_METERS = 25;
const MIN_MOVEMENT_METERS = 30;
const MAX_NOISE_THRESHOLD_METERS = 150;

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
  map: { position: 'relative', minHeight: 500, border: '1px solid var(--border-soft)', borderRadius: 8, overflow: 'hidden', background: '#dbeafe' },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE, userSelect: 'none', pointerEvents: 'none' },
  mapControls: { position: 'absolute', top: 10, left: 10, zIndex: 6, display: 'grid', gap: 4 },
  zoomButton: { width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(15,23,42,.18)', background: '#fff', color: '#0f172a', fontSize: 18, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 14px rgba(15,23,42,.18)' },
  attribution: { position: 'absolute', right: 8, bottom: 6, zIndex: 4, background: 'rgba(255,255,255,.86)', color: '#334155', fontSize: 10, padding: '2px 6px', borderRadius: 4 },
  marker: { position: 'absolute', transform: 'translate(-50%, -50%)', border: 0, background: 'transparent', cursor: 'pointer', padding: 0 },
  markerDot: { width: 26, height: 26, borderRadius: 999, border: '3px solid #fff', boxShadow: '0 8px 24px rgba(15,23,42,.25)', display: 'grid', placeItems: 'center' },
  markerLabel: { position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', borderRadius: 8, background: 'rgba(15,23,42,.86)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 7px' },
  markerPopup: { position: 'absolute', left: '50%', bottom: 36, transform: 'translateX(-50%)', width: 250, border: '1px solid var(--border-soft)', borderRadius: 8, background: 'var(--surface-card)', color: 'var(--text-primary)', boxShadow: '0 16px 36px rgba(15,23,42,.25)', padding: 10, display: 'grid', gap: 5, textAlign: 'left', zIndex: 8 },
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
  routeCanvas: { position: 'relative', minHeight: 330, border: '1px solid var(--border-soft)', borderRadius: 8, background: '#dbeafe', overflow: 'hidden' },
  routeNotice: { position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 5, border: '1px solid var(--border-soft)', borderRadius: 8, padding: 10, background: 'rgba(255,255,255,.92)', color: '#334155', fontSize: 12, fontWeight: 800, boxShadow: '0 8px 24px rgba(15,23,42,.14)' },
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

const normalizeTimestampValue = (value) => {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return `${text.replace(' ', 'T')}Z`;
  const timestamp = new Date(text).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
};

const pointTimestamp = (entry = {}) => normalizeTimestampValue(
  entry.recordedAtIso
  || entry.recorded_at_iso
  || entry.timestampIso
  || entry.timestamp_iso
  || entry.recordedAt
  || entry.recorded_at
  || entry.timestamp
  || entry.lastSeenIso
  || entry.last_seen
);

const formatDateTime = (value, fallback = '-') => {
  const timestamp = normalizeTimestampValue(value);
  return timestamp ? formatIndiaDateTime(timestamp, {}, fallback) : fallback;
};

const formatAge = (value) => {
  const normalized = normalizeTimestampValue(value);
  const timestamp = new Date(normalized || 0).getTime();
  if (!Number.isFinite(timestamp)) return 'Timestamp missing';
  const deltaMinutes = (Date.now() - timestamp) / 60000;
  if (deltaMinutes < -MAX_FUTURE_CLOCK_SKEW_MINUTES) return 'Timestamp invalid';
  const minutes = Math.max(0, Math.round(deltaMinutes));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated ${Math.floor(hours / 24)} day ago`;
};

const gpsAgeMinutes = (value) => {
  const timestamp = new Date(normalizeTimestampValue(value) || 0).getTime();
  if (!Number.isFinite(timestamp)) return Infinity;
  const deltaMinutes = (Date.now() - timestamp) / 60000;
  if (deltaMinutes < -MAX_FUTURE_CLOCK_SKEW_MINUTES) return Infinity;
  return Math.max(0, deltaMinutes);
};

const stateFromPoint = (point) => {
  if (!point) return 'No GPS';
  if (!point.timestamp) return 'No GPS';
  const age = gpsAgeMinutes(point.timestamp);
  if (!Number.isFinite(age)) return 'No GPS';
  if (age <= LIVE_MINUTES) return 'Live';
  if (age <= STALE_MINUTES) return 'Stale';
  return 'Offline';
};

const stateTone = (state) => {
  if (state === 'Live') return { color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' };
  if (state === 'Stale') return { color: '#92400e', background: '#fffbeb', borderColor: '#fde68a' };
  if (state === 'No GPS') return { color: '#475569', background: '#f8fafc', borderColor: '#cbd5e1' };
  return { color: '#991b1b', background: '#fef2f2', borderColor: '#fecaca' };
};

const normalizePoint = (entry = {}) => {
  const lat = toNum(entry.latitude ?? entry.lat);
  const lng = toNum(entry.longitude ?? entry.lng);
  if (!validCoords(lat, lng)) return null;
  const timestamp = pointTimestamp(entry);
  return {
    id: entry.id || `${timestamp || entry.recordedAt || entry.timestamp || ''}-${lat}-${lng}`,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    accuracy: entry.accuracy == null ? null : Number(entry.accuracy),
    address: entry.address || '',
    timestamp,
    rawTimestamp: entry.recordedAt || entry.recorded_at || entry.timestamp || entry.last_seen || '',
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

const accuracyMeters = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const movementFixUsable = (point = {}) => {
  const accuracy = accuracyMeters(point.accuracy);
  return accuracy === null || accuracy <= MAX_USABLE_ACCURACY_METERS;
};

const movementThresholdKm = (previous = {}, point = {}) => {
  const combinedAccuracy = (accuracyMeters(previous.accuracy) ?? DEFAULT_ACCURACY_METERS)
    + (accuracyMeters(point.accuracy) ?? DEFAULT_ACCURACY_METERS);
  return Math.min(MAX_NOISE_THRESHOLD_METERS, Math.max(MIN_MOVEMENT_METERS, combinedAccuracy)) / 1000;
};

const isUnrealisticRouteJump = (previous = {}, point = {}) => {
  const distance = haversineKm(previous.lat, previous.lng, point.lat, point.lng);
  const previousMs = new Date(previous.timestamp || 0).getTime();
  const pointMs = new Date(point.timestamp || 0).getTime();
  if (!Number.isFinite(previousMs) || !Number.isFinite(pointMs) || pointMs <= previousMs) return false;
  const hours = (pointMs - previousMs) / 3600000;
  return distance > 5 && hours > 0 && (distance / hours) > 180;
};

const routeMovementSummary = (points = []) => {
  const ordered = cleanPoints(points);
  let anchor = null;
  let distanceKm = 0;
  let movementPoints = 0;
  const movementSegments = [];
  ordered.forEach((point) => {
    if (!movementFixUsable(point)) return;
    if (!anchor) {
      anchor = point;
      return;
    }
    const distance = haversineKm(anchor.lat, anchor.lng, point.lat, point.lng);
    if (isUnrealisticRouteJump(anchor, point)) {
      anchor = point;
      return;
    }
    if (distance <= movementThresholdKm(anchor, point)) {
      if ((point.accuracy ?? DEFAULT_ACCURACY_METERS) <= (anchor.accuracy ?? DEFAULT_ACCURACY_METERS)) {
        anchor = point;
      }
      return;
    }
    distanceKm += distance;
    movementPoints += 1;
    movementSegments.push({
      from: anchor.timestamp,
      to: point.timestamp,
      distanceKm: Number(distance.toFixed(3)),
      points: [anchor, point],
    });
    anchor = point;
  });
  return {
    distanceKm: Number(distanceKm.toFixed(3)),
    movementPoints,
    movementSegments,
  };
};

const findPointByTimestamp = (points = [], timestamp) => {
  const normalized = normalizeTimestampValue(timestamp);
  if (!normalized) return null;
  return points.find((point) => normalizeTimestampValue(point.timestamp) === normalized) || null;
};

const routeMovementSegments = (points = [], summary = null) => {
  const clean = cleanPoints(points);
  const backendSegments = Array.isArray(summary?.movementSegments) ? summary.movementSegments : [];
  const validatedSegments = backendSegments
    .map((segment) => {
      const from = findPointByTimestamp(clean, segment?.from);
      const to = findPointByTimestamp(clean, segment?.to);
      const distanceKm = Number(segment?.distanceKm);
      if (!from || !to || !Number.isFinite(distanceKm) || distanceKm <= 0) return null;
      return { from, to, distanceKm };
    })
    .filter(Boolean);
  if (validatedSegments.length) return validatedSegments;
  return routeMovementSummary(clean).movementSegments || [];
};

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

const lonToWorldX = (lng, zoom) => ((lng + 180) / 360) * TILE_SIZE * (2 ** zoom);
const latToWorldY = (lat, zoom) => {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clampedLat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + (1 / Math.cos(rad))) / Math.PI) / 2) * TILE_SIZE * (2 ** zoom);
};

const chooseZoom = (points = []) => {
  if (points.length <= 1) return 15;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
  if (span < 0.006) return 16;
  if (span < 0.015) return 15;
  if (span < 0.04) return 14;
  if (span < 0.12) return 13;
  if (span < 0.35) return 12;
  return 11;
};

const buildTileMap = (points = [], zoomOffset = 0, cols = 5, rows = 4) => {
  const valid = points.filter(Boolean);
  const center = valid.length
    ? {
      lat: (Math.min(...valid.map((point) => point.lat)) + Math.max(...valid.map((point) => point.lat))) / 2,
      lng: (Math.min(...valid.map((point) => point.lng)) + Math.max(...valid.map((point) => point.lng))) / 2,
    }
    : { lat: 19.076, lng: 72.8777 };
  const zoom = Math.max(3, Math.min(18, chooseZoom(valid) + zoomOffset));
  const centerPx = { x: lonToWorldX(center.lng, zoom), y: latToWorldY(center.lat, zoom) };
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const startTileX = Math.floor((centerPx.x - width / 2) / TILE_SIZE);
  const startTileY = Math.floor((centerPx.y - height / 2) / TILE_SIZE);
  const tileCount = 2 ** zoom;
  const tiles = [];
  for (let y = startTileY; y < startTileY + rows; y += 1) {
    if (y < 0 || y >= tileCount) continue;
    for (let x = startTileX; x < startTileX + cols; x += 1) {
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}`,
        url: `${OSM_TILE_URL}/${zoom}/${wrappedX}/${y}.png`,
        left: (x * TILE_SIZE) - (centerPx.x - width / 2),
        top: (y * TILE_SIZE) - (centerPx.y - height / 2),
      });
    }
  }
  const project = (point) => ({
    x: 50 + ((lonToWorldX(point.lng, zoom) - centerPx.x) / width) * 100,
    y: 50 + ((latToWorldY(point.lat, zoom) - centerPx.y) / height) * 100,
  });
  return { center, zoom, width, height, tiles, project };
};

const markerOffsets = (items = []) => {
  const groups = new Map();
  items.forEach((item) => {
    const key = `${item.point.lat.toFixed(5)}:${item.point.lng.toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item.key);
  });
  const offsets = new Map();
  groups.forEach((keys) => {
    if (keys.length === 1) {
      offsets.set(keys[0], { x: 0, y: 0 });
      return;
    }
    keys.forEach((key, index) => {
      const angle = ((Math.PI * 2) / keys.length) * index;
      offsets.set(key, { x: Math.round(Math.cos(angle) * 18), y: Math.round(Math.sin(angle) * 18) });
    });
  });
  return offsets;
};

const formatDuration = (start, end) => {
  const startMs = new Date(normalizeTimestampValue(start) || 0).getTime();
  const endMs = new Date(normalizeTimestampValue(end) || 0).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return '-';
  const minutes = Math.round((endMs - startMs) / 60000);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
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
    const fallbackRouteSummary = routeMovementSummary(tech.routeHistory);
    const routeKm = Number(tech.routeSummary?.distanceKm ?? fallbackRouteSummary.distanceKm);
    const liveState = stateFromPoint(latest);
    const movementStatus = tech.movementStatus || (routeKm > 0.05 ? 'Travelling' : latest ? 'Idle' : 'Offline');
    const lastUpdateLabel = latest?.timestamp ? formatAge(latest.timestamp) : 'GPS timestamp missing';
    return {
      ...tech,
      latest,
      liveState,
      movementStatus,
      routeKm,
      lastSeen: latest?.timestamp || '',
      lastUpdateLabel,
      firstUpdate: tech.routeSummary?.firstUpdate || tech.routeHistory[0]?.timestamp || '',
      pointCount: Number(tech.routeSummary?.pointCount ?? tech.routeHistory.length),
      movementPoints: Number(tech.routeSummary?.movementPoints ?? fallbackRouteSummary.movementPoints),
    };
  }).sort((a, b) => {
    const order = { Live: 0, Stale: 1, Offline: 2, 'No GPS': 3 };
    return (order[a.liveState] - order[b.liveState]) || a.name.localeCompare(b.name);
  });
};

function StatusChip({ state }) {
  return <span style={{ ...styles.chip, ...stateTone(state) }}>{state}</span>;
}

function MiniMap({ technicians, selectedKey, onSelect }) {
  const points = technicians.map((tech) => tech.latest).filter(Boolean);
  const [zoomOffset, setZoomOffset] = useState(0);
  const map = useMemo(() => buildTileMap(points, zoomOffset, 5, 4), [points, zoomOffset]);
  const markerItems = technicians.filter((tech) => tech.latest).map((tech) => ({ key: tech.key, tech, point: tech.latest }));
  const offsets = markerOffsets(markerItems);

  return (
    <div style={styles.map}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: map.width, height: map.height, transform: 'translate(-50%, -50%)' }}>
        {map.tiles.map((tile) => (
          <img key={tile.key} src={tile.url} alt="" style={{ ...styles.tile, left: tile.left, top: tile.top }} loading="lazy" draggable="false" />
        ))}
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
        {technicians.map((tech) => {
          const segments = routeMovementSegments(tech.routeHistory, tech.routeSummary);
          if (!segments.length) return null;
          return (
            segments.map((segment, index) => (
              <line
                key={`${tech.key}-line-${index}`}
                x1={map.project(segment.from).x}
                y1={map.project(segment.from).y}
                x2={map.project(segment.to).x}
                y2={map.project(segment.to).y}
                stroke={tech.key === selectedKey ? '#9f174d' : '#64748b'}
                strokeWidth={tech.key === selectedKey ? 0.75 : 0.35}
                opacity={tech.key === selectedKey ? 0.9 : 0.35}
                strokeLinecap="round"
              />
            ))
          );
        })}
      </svg>
      <div style={styles.mapControls}>
        <button type="button" style={styles.zoomButton} onClick={() => setZoomOffset((value) => Math.min(value + 1, 3))} title="Zoom in">+</button>
        <button type="button" style={styles.zoomButton} onClick={() => setZoomOffset((value) => Math.max(value - 1, -3))} title="Zoom out">-</button>
      </div>
      {markerItems.map(({ tech }) => {
        const plotted = map.project(tech.latest);
        const tone = stateTone(tech.liveState);
        const offset = offsets.get(tech.key) || { x: 0, y: 0 };
        const selected = tech.key === selectedKey;
        return (
          <button
            key={`${tech.key}-marker`}
            type="button"
            title={`${tech.name} - ${tech.liveState} - ${tech.lastSeen ? formatDateTime(tech.lastSeen) : 'Timestamp missing'}`}
            style={{ ...styles.marker, left: `calc(${plotted.x}% + ${offset.x}px)`, top: `calc(${plotted.y}% + ${offset.y}px)`, zIndex: selected ? 7 : 5 }}
            onClick={() => onSelect(tech.key)}
          >
            <span style={{ ...styles.markerDot, background: tone.color }}>
              <MapPin size={14} color="#fff" />
            </span>
            {(selected || technicians.length <= 6) ? <span style={styles.markerLabel}>{tech.name}</span> : null}
            {selected ? (
              <span style={styles.markerPopup}>
                <strong>{tech.name}</strong>
                <span style={styles.meta}>{tech.employeeCode || '-'}</span>
                <span style={{ ...styles.chip, ...stateTone(tech.liveState), width: 'fit-content' }}>{tech.liveState}</span>
                <span style={styles.meta}>{tech.lastUpdateLabel}</span>
                <span style={styles.meta}>{tech.movementStatus} - {tech.routeKm.toFixed(2)} km today</span>
                <span style={styles.meta}>{tech.assignedJob?.customerName || 'No assigned job context'}</span>
                {tech.latest ? (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${tech.latest.lat},${tech.latest.lng}`} target="_blank" rel="noreferrer" style={styles.action} onClick={(event) => event.stopPropagation()}>
                    <LocateFixed size={13} /> Open
                  </a>
                ) : null}
              </span>
            ) : null}
          </button>
        );
      })}
      <div style={styles.attribution}>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>OpenStreetMap</a>
      </div>
      {!points.length ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={styles.empty}>No valid GPS coordinates are available for the selected technicians.</div>
        </div>
      ) : null}
    </div>
  );
}

function RouteMap({ points = [], stops = [], summary = null }) {
  const clean = cleanPoints(points);
  const segments = routeMovementSegments(clean, summary);
  const stopPoints = stops
    .filter((stop) => validCoords(Number(stop.latitude), Number(stop.longitude)))
    .map((stop) => ({ ...stop, lat: Number(stop.latitude), lng: Number(stop.longitude) }));
  const segmentPoints = segments.flatMap((segment) => [segment.from, segment.to]);
  const map = buildTileMap([...clean, ...segmentPoints, ...stopPoints], 0, 5, 3);
  const hasMeaningfulRoute = segments.length > 0;

  return (
    <div style={styles.routeCanvas}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: map.width, height: map.height, transform: 'translate(-50%, -50%)' }}>
        {map.tiles.map((tile) => (
          <img key={tile.key} src={tile.url} alt="" style={{ ...styles.tile, left: tile.left, top: tile.top }} loading="lazy" draggable="false" />
        ))}
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 2 }}>
        {segments.map((segment, index) => (
          <line
            key={`${segment.from.id || segment.from.timestamp}-${segment.to.id || segment.to.timestamp}-${index}`}
            x1={map.project(segment.from).x}
            y1={map.project(segment.from).y}
            x2={map.project(segment.to).x}
            y2={map.project(segment.to).y}
            stroke="#9f174d"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        ))}
        {clean[0] ? <circle cx={map.project(clean[0]).x} cy={map.project(clean[0]).y} r="1.9" fill="#047857" stroke="#fff" strokeWidth="0.7" /> : null}
        {clean.length > 1 ? <circle cx={map.project(clean[clean.length - 1]).x} cy={map.project(clean[clean.length - 1]).y} r="1.9" fill="#b91c1c" stroke="#fff" strokeWidth="0.7" /> : null}
        {stopPoints.map((stop) => {
          const plotted = map.project(stop);
          return <rect key={stop.id || stop.jobNumber || stop.customerName} x={plotted.x - 1.5} y={plotted.y - 1.5} width="3" height="3" fill="#2563eb" rx="0.8" />;
        })}
      </svg>
      {!hasMeaningfulRoute && clean.length > 0 ? (
        <div style={styles.routeNotice}>
          {clean.length} GPS point{clean.length === 1 ? '' : 's'} recorded for this date, but no validated movement segment was found.
        </div>
      ) : null}
      <div style={styles.attribution}>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>OpenStreetMap</a>
      </div>
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
  const [routeError, setRouteError] = useState('');
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
      setRouteError('');
      return;
    }
    let mounted = true;
    const loadRoute = async () => {
      setRouteLoading(true);
      setRouteError('');
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
          setRouteError('Unable to load route history for this technician/date. Try refreshing again.');
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
    const noGps = technicians.filter((tech) => tech.liveState === 'No GPS').length;
    const onJob = technicians.filter((tech) => ['Arrived', 'Job Started', 'Completed'].includes(tech.movementStatus)).length;
    const idle = technicians.filter((tech) => tech.movementStatus === 'Idle').length;
    const alerts = technicians.filter((tech) => tech.geofenceAlert && tech.geofenceAlert.status !== 'inside').length;
    const distance = technicians.reduce((sum, tech) => sum + (Number(tech.routeKm) || 0), 0);
    return { total: technicians.length, live, stale, offline, noGps, onJob, idle, alerts, distance };
  }, [technicians]);

  const gridStyle = viewportWidth < 1000 ? { ...styles.grid, gridTemplateColumns: '1fr' } : styles.grid;
  const splitStyle = viewportWidth < 950 ? { ...styles.split, gridTemplateColumns: '1fr' } : styles.split;
  const statsStyle = viewportWidth < 1100 ? { ...styles.stats, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : styles.stats;

  const fallbackRouteSummary = useMemo(() => routeMovementSummary(routePoints), [routePoints]);
  const routeDistance = Number(routeSummary?.distanceKm ?? fallbackRouteSummary.distanceKm);
  const routeFirst = routeSummary?.firstUpdate || routePoints[0]?.timestamp || '';
  const routeLast = routeSummary?.lastUpdate || routePoints[routePoints.length - 1]?.timestamp || '';
  const routeDuration = formatDuration(routeFirst, routeLast);
  const routeMovementPoints = Number(routeSummary?.movementPoints ?? fallbackRouteSummary.movementPoints);
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
              <option value="no gps">No GPS</option>
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
            <p style={styles.meta}>{filteredTechnicians.length} shown - {totals.live} live, {totals.stale} stale, {totals.offline} offline, {totals.noGps} no GPS</p>
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
                    <span style={styles.chip} title={tech.lastSeen ? formatDateTime(tech.lastSeen) : 'No usable GPS timestamp'}><Clock size={12} /> {tech.lastUpdateLabel}</span>
                    {tech.routeKm > 0 ? <span style={styles.chip}><Route size={12} /> {tech.routeKm.toFixed(2)} km</span> : null}
                    {tech.movementStatus ? <span style={styles.chip}><Crosshair size={12} /> {tech.movementStatus}</span> : null}
                  </div>
                  <p style={styles.meta}>
                    {tech.assignedJob?.customerName ? `${tech.assignedJob.customerName} - ${tech.assignedJob.serviceName || 'Service'}` : 'No assigned job context found for today'}
                  </p>
                  {tech.attendance?.status || tech.attendance?.checkIn ? (
                    <p style={styles.meta}>Attendance: {tech.attendance.status || 'Marked'}{tech.attendance.checkIn ? ` - In ${tech.attendance.checkIn}` : ''}{tech.attendance.checkOut ? ` - Out ${tech.attendance.checkOut}` : ''}</p>
                  ) : null}
                  <p style={styles.meta} title={tech.lastSeen ? formatDateTime(tech.lastSeen) : 'No timestamp returned by API'}>
                    Last GPS: {tech.lastSeen ? formatDateTime(tech.lastSeen) : 'No timestamp returned'}{tech.lastSeen && tech.latest?.source ? ` - ${tech.latest.source}` : ''}
                  </p>
                  {tech.latest ? (
                    <div style={styles.toolbar}>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${tech.latest.lat},${tech.latest.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.action}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <LocateFixed size={14} /> Locate
                      </a>
                      <span style={styles.action}><Route size={14} /> View Route</span>
                    </div>
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
                <p style={styles.meta}>{routeMovementPoints} movement segment{routeMovementPoints === 1 ? '' : 's'}</p>
              </article>
              <article style={styles.stat}>
                <p style={styles.statLabel}>Duration Tracked</p>
                <p style={{ ...styles.statValue, fontSize: 18 }}>{routeDuration}</p>
              </article>
              <article style={styles.stat}>
                <p style={styles.statLabel}>First / Last Update</p>
                <p style={styles.meta} title={routeFirst || 'No timestamp'}>{routeFirst ? formatDateTime(routeFirst) : 'No first timestamp'}</p>
                <p style={styles.meta} title={routeLast || 'No timestamp'}>{routeLast ? formatDateTime(routeLast) : 'No last timestamp'}</p>
              </article>
              <article style={styles.stat}>
                <p style={styles.statLabel}>Job Stops</p>
                <p style={styles.meta}>{jobStops.length ? jobStops.map((stop) => `${stop.customerName || stop.jobNumber || 'Job'}: ${stop.status}`).join(', ') : 'No coordinate-backed job stops found.'}</p>
              </article>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <RouteMap points={routePoints} stops={jobStops} summary={routeSummary} />
              <div style={styles.timeline}>
                {routeLoading ? <div style={styles.empty}>Loading route history...</div> : null}
                {!routeLoading && routeError ? <div style={styles.empty}>{routeError}</div> : null}
                {!routeLoading && !routeError && !routePoints.length ? <div style={styles.empty}>No movement data for this technician/date. Distance is not fabricated from a single or missing GPS point.</div> : null}
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
