import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyBrandingTheme, saveBrandingSettings } from '../utils/brandingTheme';
import {
  CalendarClock,
  Bell,
  Briefcase,
  CalendarDays,
  CircleDollarSign,
  ChevronDown,
  ChevronRight,
  Database,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Smartphone,
  Truck,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import SettingsPanel from './Settings';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const SidebarSection = ({ title, children }) => (
  <div style={{ marginTop: '20px' }}>
    <div
      style={{
        padding: '0 20px 8px',
        fontSize: '11px',
        fontWeight: 800,
        color: 'var(--color-muted)',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({});
  const [salesMenuOpen, setSalesMenuOpen] = useState(false);
  const [purchaseMenuOpen, setPurchaseMenuOpen] = useState(false);
  const [fieldOpsMenuOpen, setFieldOpsMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 992);
  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/settings`);
        setSettings(res.data);
        applyBrandingTheme(res.data || {});
        saveBrandingSettings(res.data || {});
      } catch (error) {
        console.error(error);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    applyBrandingTheme(settings || {});
  }, [settings]);

  useEffect(() => {
    if (location.pathname.startsWith('/sales/')) {
      setSalesMenuOpen(true);
    }
    if (location.pathname.startsWith('/purchase/')) {
      setPurchaseMenuOpen(true);
    }
    if (location.pathname.startsWith('/operations/')) {
      setFieldOpsMenuOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth <= 991;
  const isLaptop = viewportWidth >= 992 && viewportWidth <= 1199;
  const isDrawerMode = viewportWidth < 992;
  const sidebarWidthPx = isLaptop ? 240 : 280;
  const sidebarWidth = `${sidebarWidthPx}px`;
  const contentPadding = isMobile ? '14px' : isTablet ? '18px' : isLaptop ? '20px' : '24px';
  const headerPadding = isMobile ? '0 12px' : isTablet ? '0 16px' : '0 20px';
  const topbarHeight = isDrawerMode ? (isMobile ? '58px' : '64px') : '80px';

  useEffect(() => {
    setSidebarOpen(!isDrawerMode);
  }, [isDrawerMode]);

  useEffect(() => {
    if (isDrawerMode) setSidebarOpen(false);
  }, [isDrawerMode, location.pathname]);

  useEffect(() => {
    if (!settingsPopupOpen) return undefined;
    const handleEsc = (event) => {
      if (event.key === 'Escape') setSettingsPopupOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = overflow;
    };
  }, [settingsPopupOpen]);

  const isActive = (path) => location.pathname === path;
  const isPrefixActive = (prefix) => location.pathname.startsWith(prefix);

  const salesGroupActive = isPrefixActive('/sales/');
  const purchaseGroupActive = isPrefixActive('/purchase/');
  const fieldOpsGroupActive = isPrefixActive('/operations/') || isActive('/schedule-job') || isActive('/technician-portal');

  const baseLinkStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: 'calc(100% - 24px)',
    padding: '11px 18px',
    margin: '2px 12px',
    borderRadius: '14px',
    color: active ? 'var(--color-white)' : 'var(--color-text)',
    backgroundColor: active ? 'var(--color-primary)' : 'transparent',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: active ? 800 : 600,
    letterSpacing: '0.01em',
    transition: 'all 0.18s ease',
    border: '1px solid transparent',
    boxShadow: active ? 'var(--shadow-md)' : 'none'
  });

  const linkStyle = (path) => baseLinkStyle(isActive(path));

  const subLinkStyle = (path) => ({
    ...baseLinkStyle(isActive(path)),
    fontSize: '12px',
    padding: '9px 18px 9px 42px',
    width: 'calc(100% - 24px)',
    color: isActive(path) ? 'var(--color-white)' : 'var(--color-muted)'
  });

  const groupToggleStyle = (active) => ({
    ...baseLinkStyle(active),
    border: '1px solid transparent',
    justifyContent: 'space-between',
    cursor: 'pointer',
    background: active ? 'var(--color-primary)' : 'var(--color-white)'
  });

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('portal_user_name');
    localStorage.removeItem('portal_user_role');
    localStorage.removeItem('portal_user_id');
    navigate('/', { replace: true });
  };

  const companyName = settings.companyName || 'SKUAS MASTER';
  const portalUserName = String(localStorage.getItem('portal_user_name') || 'SKUAS').trim() || 'SKUAS';
  const portalUserRole = String(localStorage.getItem('portal_user_role') || 'Admin').trim() || 'Admin';
  const companyInitials = companyName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

  return (
    <div className="app-layout">
      <button
        type="button"
        aria-label="Close sidebar"
        className={`sidebar-overlay${isDrawerMode && sidebarOpen ? ' show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`sidebar${isDrawerMode && sidebarOpen ? ' open' : ''}`}
        style={{
          width: isDrawerMode ? 'min(85vw, 280px)' : sidebarWidth,
          flexBasis: isDrawerMode ? 'min(85vw, 280px)' : sidebarWidth,
          minWidth: isDrawerMode ? 'min(85vw, 280px)' : sidebarWidth,
          background: 'var(--color-white)',
          color: 'var(--color-text)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'hidden',
          overflowX: 'hidden',
          borderRight: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          backdropFilter: 'blur(16px)'
        }}
      >
        <div
          style={{
            minHeight: isDrawerMode ? '110px' : '80px',
            padding: isDrawerMode ? '14px 12px' : '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 2,
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-white)'
          }}
        >
          {settings.dashboardImageUrl ? (
            <div
              style={{
                width: isDrawerMode ? '170px' : '200px',
                height: isDrawerMode ? '68px' : '80px',
                borderRadius: '12px',
                background: 'transparent',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'none',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              <img src={settings.dashboardImageUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div
              style={{
                width: isDrawerMode ? '170px' : '200px',
                height: isDrawerMode ? '68px' : '80px',
                background: 'var(--color-primary)',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontWeight: 800,
                fontSize: isDrawerMode ? '24px' : '28px',
                color: '#fff',
                letterSpacing: '0.08em',
                boxShadow: 'var(--shadow-md)',
                flexShrink: 0
              }}
            >
              {companyInitials || 'SM'}
            </div>
          )}
        </div>

        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 0 30px' }}>
          <Link to="/dashboard" className={isActive('/dashboard') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>

          <SidebarSection title="Sales & Marketing">
            <Link to="/leads" className={isActive('/leads') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/leads')}><Users size={18} /> Leads</Link>

            <button type="button" className={salesGroupActive ? 'sidebar-nav-item active' : 'sidebar-nav-item'} onClick={() => setSalesMenuOpen((prev) => !prev)} style={groupToggleStyle(salesGroupActive)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                <Briefcase size={18} /> Sales
              </span>
              {salesMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            {salesMenuOpen ? (
              <>
                <Link to="/sales/customers" className={isActive('/sales/customers') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/customers')}>Customer</Link>
                <Link to="/sales/contracts" className={isActive('/sales/contracts') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/contracts')}>Contract</Link>
                <Link to="/sales/invoices" className={isActive('/sales/invoices') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/invoices')}>Invoice</Link>
                <Link to="/sales/payment-received" className={isActive('/sales/payment-received') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/payment-received')}>Payment Received</Link>
                <Link to="/sales/renewal" className={isActive('/sales/renewal') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/renewal')}>Renewal</Link>
              </>
            ) : null}

            <button type="button" className={purchaseGroupActive ? 'sidebar-nav-item active' : 'sidebar-nav-item'} onClick={() => setPurchaseMenuOpen((prev) => !prev)} style={groupToggleStyle(purchaseGroupActive)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                <ShoppingCart size={18} /> Purchase
              </span>
              {purchaseMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            {purchaseMenuOpen ? (
              <>
                <Link to="/purchase/vendors" className={isActive('/purchase/vendors') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/vendors')}>Vendors</Link>
                <Link to="/purchase/bills" className={isActive('/purchase/bills') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/bills')}>Bills</Link>
                <Link to="/purchase/payment-received" className={isActive('/purchase/payment-received') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/payment-received')}>Payment Received</Link>
              </>
            ) : null}

          </SidebarSection>

          <SidebarSection title="Operations">
            <button type="button" className={fieldOpsGroupActive ? 'sidebar-nav-item active' : 'sidebar-nav-item'} onClick={() => setFieldOpsMenuOpen((prev) => !prev)} style={groupToggleStyle(fieldOpsGroupActive)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                <Smartphone size={18} /> Field Operations
              </span>
              {fieldOpsMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            {fieldOpsMenuOpen ? (
              <>
                <Link to="/operations/assign-services" className={isActive('/operations/assign-services') || isActive('/schedule-job') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/assign-services')}>Assign Services</Link>
                <Link to="/operations/assigned-jobs" className={isActive('/operations/assigned-jobs') || isActive('/technician-portal') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/assigned-jobs')}>Assigned Jobs</Link>
                <Link to="/operations/track-technicians" className={isActive('/operations/track-technicians') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/track-technicians')}>Track Technicians</Link>
                <Link to="/service-calendar" className={isActive('/service-calendar') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/service-calendar')}>Service Calendar</Link>
              </>
            ) : null}
            <Link to="/complaints" className={isActive('/complaints') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/complaints')}><Bell size={18} /> Complaints</Link>
          </SidebarSection>

          <SidebarSection title="Inventory">
            <Link to="/stock" className={isActive('/stock') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/stock')}><Database size={18} /> Stock Management</Link>
          </SidebarSection>

          <SidebarSection title="HR & Payroll">
            <Link to="/hr-dashboard" className={isActive('/hr-dashboard') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/hr-dashboard')}><LayoutDashboard size={18} /> HR Dashboard</Link>
            <Link to="/employees" className={isActive('/employees') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/employees')}><UserCheck size={18} /> Employee Master</Link>
            <Link to="/attendance" className={isActive('/attendance') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/attendance')}><CalendarClock size={18} /> Attendance</Link>
            <Link to="/payroll" className={isActive('/payroll') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/payroll')}><CircleDollarSign size={18} /> Payroll</Link>
          </SidebarSection>

          <SidebarSection title="Administration">
            <Link to="/items" className={isActive('/items') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/items')}><Package size={18} /> Items</Link>
          </SidebarSection>
        </nav>
      </aside>

      <div
        className="main-wrapper"
        style={{
          width: isDrawerMode ? '100%' : `calc(100% - ${sidebarWidth})`
        }}
      >
        <header
          className="topbar"
          style={{
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isDrawerMode ? 'space-between' : 'flex-end',
            padding: headerPadding,
            height: topbarHeight,
            minHeight: topbarHeight
          }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? 'Hide menu' : 'Show menu'}
            style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              padding: '8px',
              borderRadius: '12px',
              cursor: 'pointer',
              display: isDrawerMode ? 'inline-flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, marginLeft: 'auto' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: isMobile ? 'none' : 'inline' }}>
              {portalUserRole} <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>{portalUserName}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSettingsPopupOpen(true)}
              style={{
                border: '1px solid var(--color-border)',
                background: '#fff',
                color: 'var(--color-primary)',
                width: isMobile ? '46px' : '54px',
                height: isMobile ? '46px' : '54px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
              aria-label="Open settings"
              title="Settings"
            >
              <Settings size={isMobile ? 20 : 24} />
            </button>
            <button
              onClick={handleLogout}
              style={{
                color: '#fff',
                background: 'var(--color-primary)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: '1px solid var(--color-primary)',
                borderRadius: '999px',
                padding: isMobile ? '10px 14px' : '11px 18px',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="main-content" style={{ padding: contentPadding }}>
          <div className="dashboard-container">
            {children}
          </div>
        </main>
      </div>
      {settingsPopupOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          onClick={() => setSettingsPopupOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.48)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '10px' : '20px'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(1280px, 100%)',
              height: isMobile ? 'calc(100dvh - 20px)' : 'min(90dvh, 920px)',
              background: '#ffffff',
              borderRadius: isMobile ? '16px' : '20px',
              border: '1px solid var(--color-border)',
              boxShadow: '0 24px 50px rgba(15, 23, 42, 0.28)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows: '56px minmax(0, 1fr)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 14px 0 18px',
                borderBottom: '1px solid var(--color-border)',
                background: '#f8fafc'
              }}
            >
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', letterSpacing: '0.01em' }}>Settings</h2>
              <button
                type="button"
                onClick={() => setSettingsPopupOpen(false)}
                aria-label="Close settings"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ minHeight: 0, overflow: 'auto', padding: isMobile ? '10px' : '12px' }}>
              <SettingsPanel modalMode />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
