import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Sparkles } from 'lucide-react';

const shell = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    backdropFilter: 'none'
  },
  hero: {
    background: 'var(--color-primary)',
    borderRadius: '22px',
    padding: '28px',
    color: '#ffffff',
    display: 'grid',
    gridTemplateColumns: '1.6fr 1fr',
    gap: '18px',
    boxShadow: 'var(--shadow)',
    border: '1px solid rgba(159, 23, 77, 0.22)'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#FCE7F3',
    marginBottom: '12px'
  },
  title: { margin: 0, fontSize: '30px', lineHeight: 1.1, letterSpacing: '-0.03em' },
  description: { margin: '10px 0 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '14px', lineHeight: 1.7, maxWidth: '680px', fontWeight: 600 },
  heroSide: {
    background: 'rgba(255,255,255,0.58)',
    border: '1px solid rgba(159, 23, 77, 0.24)',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backdropFilter: 'blur(10px)'
  },
  grid: { display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '18px' },
  panel: { background: 'rgba(255,255,255,0.82)', borderRadius: '20px', border: '1px solid rgba(159, 23, 77, 0.16)', padding: '22px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(12px)' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px', marginTop: '18px' },
  stat: { background: 'rgba(255,255,255,0.84)', color: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(159, 23, 77, 0.16)' },
  statLabel: { fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '8px' },
  statValue: { fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'flex-start',
    padding: '14px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(17,17,17,0.08)'
  },
  miniTitle: { margin: 0, fontSize: '12px', fontWeight: 800, color: '#0f172a' },
  miniText: { margin: '4px 0 0 0', fontSize: '13px', lineHeight: 1.6, color: '#64748b' },
  actionList: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' },
  action: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderRadius: '14px',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    textDecoration: 'none',
    fontWeight: 700,
    boxShadow: '0 14px 26px rgba(159, 23, 77, 0.2)'
  }
};

export default function ModuleWorkspace({
  badge = 'Workspace',
  title,
  description,
  stats = [],
  queueTitle = 'Priority Queue',
  queueItems = [],
  actionTitle = 'Next Best Actions',
  actions = [],
  sideTitle = 'Team Note',
  sideText = 'Use this module to move work forward, keep operators aligned, and surface what needs attention next.'
}) {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth <= 991;
  const isLaptop = viewportWidth >= 992 && viewportWidth <= 1199;
  const isSmallMobile = viewportWidth < 420;

  const heroStyle = isMobile
    ? { ...shell.hero, gridTemplateColumns: '1fr', padding: isSmallMobile ? '16px' : '20px 16px' }
    : isTablet || isLaptop
      ? { ...shell.hero, gridTemplateColumns: '1fr', padding: isTablet ? '22px' : '24px' }
      : shell.hero;
  const statsStyle = isMobile
    ? { ...shell.stats, gridTemplateColumns: '1fr' }
    : isTablet
      ? { ...shell.stats, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : shell.stats;
  const gridStyle = viewportWidth >= 1200 ? shell.grid : { ...shell.grid, gridTemplateColumns: '1fr' };
  const titleStyle = isMobile ? { ...shell.title, fontSize: isSmallMobile ? '22px' : '26px' } : shell.title;

  return (
    <div style={shell.page}>
      <section className="hero-section command-center" style={heroStyle}>
        <div>
          <div style={shell.badge}>
            <Sparkles size={14} />
            {badge}
          </div>
          <h1 style={{ ...titleStyle, color: '#ffffff' }}>{title}</h1>
          <p style={shell.description}>{description}</p>

          <div style={statsStyle}>
            {stats.map((stat) => (
              <div key={stat.label} style={shell.stat}>
                <div style={shell.statLabel}>{stat.label}</div>
                <div style={shell.statValue}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={shell.heroSide}>
          <div>
            <div style={{ ...shell.badge, marginBottom: '10px' }}>
              <Clock3 size={14} />
              Operational Focus
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '10px' }}>{sideTitle}</div>
            <p style={{ margin: 0, color: 'var(--color-primary-deep)', lineHeight: 1.7, fontSize: '14px', fontWeight: 600 }}>{sideText}</p>
          </div>
          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(159, 23, 77, 0.2)', color: 'var(--color-primary-dark)', fontSize: '13px', lineHeight: 1.6, fontWeight: 700 }}>
            Keep this module focused on the handful of actions that unblock the team fastest.
          </div>
        </div>
      </section>

      <section className="content-grid dashboard-section-grid" style={gridStyle}>
        <div style={shell.panel}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{queueTitle}</div>
          <div style={shell.list}>
            {queueItems.map((item) => (
              <div key={item.title} style={shell.listItem}>
                <div>
                  <p style={shell.miniTitle}>{item.title}</p>
                  <p style={shell.miniText}>{item.description}</p>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-dark)', whiteSpace: 'nowrap' }}>
                  {item.meta}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={shell.panel}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{actionTitle}</div>
          <div style={shell.actionList}>
            {actions.map((action) => (
              <Link key={action.label} to={action.href || '/dashboard'} style={shell.action}>
                <span>{action.label}</span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
