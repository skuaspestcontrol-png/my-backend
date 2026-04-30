import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Route, ShieldAlert, ShieldCheck, Users } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const EARTH_RADIUS_KM = 6371;
const GEOFENCE_RADIUS_KM = 0.2;

const shell = {
  page: { display: 'grid', gap: '14px', background: 'transparent', border: 'none', borderRadius: 0, padding: 0 },
  hero: { border: '1px solid rgba(159, 23, 77, 0.2)', background: 'var(--color-primary)', borderRadius: '18px', padding: '16px', color: '#fff' },
  title: { margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em' },
  sub: { margin: '6px 0 0 0', fontSize: '13px', opacity: 0.92, fontWeight: 600 },
  stats: { display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
  stat: { border: '1px solid var(--color-border)', background: '#fff', borderRadius: '14px', padding: '12px' },
  statLabel: { margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { margin: '6px 0 0 0', fontSize: '24px', color: '#111827', fontWeight: 800 },
  grid: { display: 'grid', gap: '12px', gridTemplateColumns: '1.2fr 0.8fr' },
  panel: { border: '1px solid var(--color-border)', background: '#fff', borderRadius: '16px', overflow: 'hidden' },
  panelHead: { padding: '12px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '15px', color: '#111827', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' },
  panelBody: { padding: '12px', display: 'grid', gap: '10px' },
  mapFrame: { width: '100%', minHeight: '340px', border: '1px solid #e2e8f0', borderRadius: '12px' },
  note: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600, lineHeight: 1.5 },
  techCard: { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', background: '#fff' },
  techName: { margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: 800 },
  meta: { margin: '4px 0 0 0', fontSize: '12px', color: '#475569', fontWeight: 600 },
  pillRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
  pill: { display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '999px', padding: '4px 10px', fontSize: '11px', fontWeight: 800, border: '1px solid #cbd5e1', color: '#334155', background: '#f8fafc' },
  routeList: { display: 'grid', gap: '6px', marginTop: '8px' },
  routeItem: { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px', fontSize: '12px', color: '#334155', background: '#fff' }
};

const toNum = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const validCoords = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const formatDateTime = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function TrackTechnicians() {
  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [status, setStatus] = useState('Loading technician tracking data...');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [jobsRes, employeesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/jobs`),
          axios.get(`${API_BASE_URL}/api/employees`)
        ]);
        if (!mounted) return;
        setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
        setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
        setStatus('Live technician tracking view.');
      } catch (error) {
        if (!mounted) return;
        console.error('Failed to load technician tracking data', error);
        setStatus('Unable to load technician tracking data right now.');
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const technicians = useMemo(() => {
    const technicianNameSet = new Set();
    employees.forEach((entry) => {
      const role = String(entry.role || '').trim().toLowerCase();
      if (!role.includes('technician')) return;
      const fullName = [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim();
      const name = fullName || String(entry.empCode || '').trim();
      if (name) technicianNameSet.add(name);
    });

    const byTech = new Map();
    jobs.forEach((job) => {
      const name = String(job.technicianName || '').trim();
      if (!name) return;
      technicianNameSet.add(name);
      const lat = toNum(job.latitude);
      const lng = toNum(job.longitude);
      const hasCoord = validCoords(lat, lng);
      const ts = new Date(job.updatedAt || job.createdAt || job.date || 0).getTime();
      if (!byTech.has(name)) byTech.set(name, []);
      byTech.get(name).push({
        jobId: job._id || '',
        customerName: job.customerName || '-',
        status: String(job.status || '').toUpperCase() || '-',
        lat,
        lng,
        hasCoord,
        timestamp: Number.isFinite(ts) ? ts : 0
      });
    });

    return Array.from(technicianNameSet).map((name) => {
      const points = (byTech.get(name) || []).sort((a, b) => a.timestamp - b.timestamp);
      const validPoints = points.filter((point) => point.hasCoord);
      const latest = validPoints[validPoints.length - 1] || null;
      const previous = validPoints.length > 1 ? validPoints[validPoints.length - 2] : null;
      const latestJob = points[points.length - 1] || null;
      const routeDistance = validPoints.slice(1).reduce((sum, point, index) => {
        const prev = validPoints[index];
        return sum + haversineKm(prev.lat, prev.lng, point.lat, point.lng);
      }, 0);
      const geofenceDistance = latest && previous
        ? haversineKm(previous.lat, previous.lng, latest.lat, latest.lng)
        : 0;
      const geofenceState = !latest
        ? 'No GPS'
        : geofenceDistance <= GEOFENCE_RADIUS_KM
          ? 'At Site'
          : 'Moving / Left Site';

      return {
        name,
        totalJobs: points.length,
        latest,
        latestJob,
        routeDistance,
        routeHistory: validPoints.slice(-5).reverse(),
        geofenceState,
        geofenceDistance
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, jobs]);

  const withLiveCoords = technicians.filter((tech) => tech.latest);
  const totalRouteKm = withLiveCoords.reduce((sum, tech) => sum + tech.routeDistance, 0);
  const center = withLiveCoords[0]?.latest || { lat: 28.6139, lng: 77.2090 };

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${center.lng - 0.03},${center.lat - 0.02},${center.lng + 0.03},${center.lat + 0.02}`)}&layer=mapnik&marker=${encodeURIComponent(`${center.lat},${center.lng}`)}`;

  const isMobile = viewportWidth < 768;
  const statsStyle = isMobile ? { ...shell.stats, gridTemplateColumns: '1fr' } : shell.stats;
  const gridStyle = isMobile ? { ...shell.grid, gridTemplateColumns: '1fr' } : shell.grid;

  return (
    <section style={shell.page}>
      <div style={shell.hero}>
        <h2 style={shell.title}>Track Technicians</h2>
        <p style={shell.sub}>{status}</p>
      </div>

      <div style={statsStyle}>
        <article style={shell.stat}>
          <p style={shell.statLabel}>All Technicians</p>
          <p style={shell.statValue}><Users size={18} style={{ verticalAlign: 'middle' }} /> {technicians.length}</p>
        </article>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Live GPS Available</p>
          <p style={shell.statValue}><MapPin size={18} style={{ verticalAlign: 'middle' }} /> {withLiveCoords.length}</p>
        </article>
        <article style={shell.stat}>
          <p style={shell.statLabel}>Route Travel Today</p>
          <p style={shell.statValue}><Route size={18} style={{ verticalAlign: 'middle' }} /> {totalRouteKm.toFixed(2)} km</p>
        </article>
      </div>

      <div style={gridStyle}>
        <section style={shell.panel}>
          <h3 style={shell.panelHead}><Navigation size={16} /> Map View of Technicians</h3>
          <div style={shell.panelBody}>
            <iframe title="Technician map" src={mapUrl} style={shell.mapFrame} />
            <p style={shell.note}>
              Current map centers on latest available technician GPS point. For every technician, use the location links below to open live pin directly.
            </p>
          </div>
        </section>

        <section style={shell.panel}>
          <h3 style={shell.panelHead}><ShieldAlert size={16} /> Geo-fence Alerts</h3>
          <div style={shell.panelBody}>
            {technicians.map((tech) => (
              <article key={tech.name} style={shell.techCard}>
                <p style={shell.techName}>{tech.name}</p>
                <p style={shell.meta}>{tech.totalJobs} assigned job(s)</p>
                <div style={shell.pillRow}>
                  <span style={shell.pill}>
                    {tech.geofenceState === 'At Site' ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                    {tech.geofenceState}
                  </span>
                  <span style={shell.pill}>{tech.latest ? `Δ ${tech.geofenceDistance.toFixed(2)} km` : 'No movement data'}</span>
                </div>
                {tech.latest ? (
                  <p style={shell.meta}>
                    Last update: {formatDateTime(tech.latest.timestamp)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>

      <section style={shell.panel}>
        <h3 style={shell.panelHead}><Route size={16} /> Route History and Live Technician List</h3>
        <div style={shell.panelBody}>
          {technicians.map((tech) => (
            <article key={`${tech.name}-route`} style={shell.techCard}>
              <p style={shell.techName}>{tech.name}</p>
              <p style={shell.meta}>
                Current: {tech.latest ? `${tech.latest.lat.toFixed(6)}, ${tech.latest.lng.toFixed(6)}` : 'No GPS yet'}
                {tech.latest ? ` • ${tech.latest.status}` : ''}
              </p>
              {tech.latest ? (
                <a
                  href={`https://www.google.com/maps?q=${tech.latest.lat},${tech.latest.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...shell.meta, color: 'var(--color-primary-dark)', fontWeight: 800, textDecoration: 'none' }}
                >
                  Open live location on map
                </a>
              ) : null}
              <div style={shell.routeList}>
                {tech.routeHistory.length === 0 ? (
                  <div style={shell.routeItem}>No route history captured yet.</div>
                ) : tech.routeHistory.map((point, idx) => (
                  <div key={`${tech.name}-point-${idx}`} style={shell.routeItem}>
                    {formatDateTime(point.timestamp)} • {point.customerName} • {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
