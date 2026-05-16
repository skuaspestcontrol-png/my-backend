import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyBrandingTheme, loadBrandingSettings, saveBrandingSettings } from '../utils/brandingTheme';
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
  Users
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const INACTIVITY_LOGOUT_MS = 5 * 60 * 1000;

const SidebarSection = ({ title, children, collapsed = false }) => (
  <div style={{ marginTop: collapsed ? '10px' : '14px' }}>
    {!collapsed ? (
      <div
        style={{
          padding: '0 18px 6px',
          fontSize: '11px',
          fontWeight: 800,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}
      >
        {title}
      </div>
    ) : null}
    {children}
  </div>
);

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(() => loadBrandingSettings() || {});
  const [leadsMenuOpen, setLeadsMenuOpen] = useState(false);
  const [salesMenuOpen, setSalesMenuOpen] = useState(false);
  const [purchaseMenuOpen, setPurchaseMenuOpen] = useState(false);
  const [fieldOpsMenuOpen, setFieldOpsMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 992);
  const [sidebarPinnedOpen, setSidebarPinnedOpen] = useState(false);
  const [sidebarHovering, setSidebarHovering] = useState(false);
  const [sidebarFocusWithin, setSidebarFocusWithin] = useState(false);

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
    if (location.pathname === '/leads' || location.pathname.startsWith('/leads/')) {
      setLeadsMenuOpen(true);
    }
    if (location.pathname.startsWith('/sales/') || location.pathname.startsWith('/quotations')) {
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
  const sidebarWidthPx = isLaptop ? 224 : 250;
  const compactSidebarWidthPx = 74;
  const isSidebarCollapsed = !isDrawerMode && !sidebarPinnedOpen && !sidebarHovering && !sidebarFocusWithin;
  const effectiveSidebarWidthPx = isSidebarCollapsed ? compactSidebarWidthPx : sidebarWidthPx;
  const sidebarWidth = `${effectiveSidebarWidthPx}px`;
  const contentPadding = isMobile ? '12px' : isTablet ? '16px' : isLaptop ? '18px' : '20px';
  const headerPadding = isMobile ? '0 10px' : isTablet ? '0 14px' : '0 18px';
  const topbarHeight = isDrawerMode ? (isMobile ? '54px' : '58px') : '66px';

  useEffect(() => {
    setSidebarOpen(!isDrawerMode);
  }, [isDrawerMode]);

  useEffect(() => {
    if (isDrawerMode) setSidebarOpen(false);
  }, [isDrawerMode, location.pathname]);

  useEffect(() => {
    if (isDrawerMode) {
      setSidebarPinnedOpen(false);
      setSidebarHovering(false);
      setSidebarFocusWithin(false);
    }
  }, [isDrawerMode]);

  const isActive = (path) => location.pathname === path;
  const isPrefixActive = (prefix) => location.pathname.startsWith(prefix);

  const salesGroupActive = isPrefixActive('/sales/') || isPrefixActive('/quotations');
  const leadsGroupActive = isActive('/leads') || isPrefixActive('/leads/');
  const purchaseGroupActive = isPrefixActive('/purchase/');
  const fieldOpsGroupActive = isPrefixActive('/operations/') || isActive('/schedule-job') || isActive('/technician-portal');

  const baseLinkStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
    gap: isSidebarCollapsed ? 0 : '12px',
    width: isSidebarCollapsed ? '46px' : 'calc(100% - 24px)',
    minHeight: '42px',
    padding: isSidebarCollapsed ? '9px 0' : '9px 14px',
    margin: isSidebarCollapsed ? '4px auto' : '2px 12px',
    borderRadius: '12px',
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

  const subLinkStyle = (path, activeOverride) => {
    const active = typeof activeOverride === 'boolean' ? activeOverride : isActive(path);
    return ({
    ...baseLinkStyle(active),
    fontSize: '12px',
    minHeight: '36px',
    padding: isSidebarCollapsed ? '7px 0' : '7px 14px 7px 38px',
    width: isSidebarCollapsed ? '46px' : 'calc(100% - 24px)',
    color: active ? 'var(--color-white)' : 'var(--color-muted)'
  });
  };

  const subLinkActiveStyle = (path) => ({
    ...subLinkStyle(path),
    color: isActive(path) ? 'var(--color-white)' : 'var(--color-muted)'
  });

  const groupToggleStyle = (active) => ({
    ...baseLinkStyle(active),
    border: '1px solid transparent',
    justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
    cursor: 'pointer',
    background: active ? 'var(--color-primary)' : 'var(--color-white)'
  });

  const toggleGroupMenu = (setMenuOpen) => {
    if (isSidebarCollapsed) {
      setSidebarPinnedOpen(true);
      setMenuOpen(true);
      return;
    }
    setMenuOpen((prev) => !prev);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('portal_user_name');
    localStorage.removeItem('portal_user_role');
    localStorage.removeItem('portal_user_id');
    navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    let logoutTimer;
    const resetLogoutTimer = () => {
      window.clearTimeout(logoutTimer);
      logoutTimer = window.setTimeout(() => {
        handleLogout();
      }, INACTIVITY_LOGOUT_MS);
    };
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    resetLogoutTimer();
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetLogoutTimer, { passive: true });
    });

    return () => {
      window.clearTimeout(logoutTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetLogoutTimer);
      });
    };
  }, [handleLogout]);

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
        onMouseEnter={() => {
          if (!isDrawerMode) setSidebarHovering(true);
        }}
        onMouseLeave={() => {
          if (!isDrawerMode) setSidebarHovering(false);
        }}
        onFocus={() => {
          if (!isDrawerMode) setSidebarFocusWithin(true);
        }}
        onBlur={(event) => {
          if (!isDrawerMode && !event.currentTarget.contains(event.relatedTarget)) {
            setSidebarFocusWithin(false);
          }
        }}
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
          backdropFilter: 'blur(16px)',
          transition: isDrawerMode ? undefined : 'width 0.2s ease, flex-basis 0.2s ease, min-width 0.2s ease'
        }}
      >
        <div
          style={{
            minHeight: isDrawerMode ? '88px' : '66px',
            padding: isDrawerMode ? '10px 12px' : '0 12px',
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
          <Link
            to="/dashboard"
            aria-label="Open dashboard home"
            title="Open dashboard home"
            onClick={(event) => {
              if (location.pathname === '/dashboard') {
                event.preventDefault();
                window.location.reload();
              }
            }}
            style={{ display: 'inline-flex', textDecoration: 'none', cursor: 'pointer' }}
          >
            {settings.dashboardImageUrl ? (
              <div
                style={{
                  width: isSidebarCollapsed ? '42px' : isDrawerMode ? '150px' : '170px',
                  height: isSidebarCollapsed ? '42px' : isDrawerMode ? '58px' : '64px',
                  borderRadius: isSidebarCollapsed ? '10px' : '12px',
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
                  width: isSidebarCollapsed ? '42px' : isDrawerMode ? '150px' : '170px',
                  height: isSidebarCollapsed ? '42px' : isDrawerMode ? '58px' : '64px',
                  background: 'var(--color-primary)',
                  borderRadius: isSidebarCollapsed ? '10px' : '12px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontWeight: 800,
                  fontSize: isSidebarCollapsed ? '15px' : isDrawerMode ? '20px' : '24px',
                  color: '#fff',
                  letterSpacing: '0.08em',
                  boxShadow: 'var(--shadow-md)',
                  flexShrink: 0
                }}
              >
                {companyInitials || 'SM'}
              </div>
            )}
          </Link>
        </div>

        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 0 24px' }}>
          <Link to="/dashboard" className={isActive('/dashboard') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/dashboard')} title="Dashboard" aria-label="Dashboard">
            <LayoutDashboard size={18} /> {!isSidebarCollapsed ? 'Dashboard' : null}
          </Link>

          <SidebarSection title="Sales & Marketing" collapsed={isSidebarCollapsed}>
            <button type="button" className={leadsGroupActive ? 'sidebar-nav-item active' : 'sidebar-nav-item'} onClick={() => toggleGroupMenu(setLeadsMenuOpen)} style={groupToggleStyle(leadsGroupActive)} title="Leads" aria-label="Leads">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                <Users size={18} /> {!isSidebarCollapsed ? 'Leads' : null}
              </span>
              {!isSidebarCollapsed ? leadsMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && leadsMenuOpen ? (
              <>
                <Link to="/leads" className={isActive('/leads') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkActiveStyle('/leads')}>Lead Master</Link>
                <Link to="/leads/followup" className={isActive('/leads/followup') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkActiveStyle('/leads/followup')}>Followup</Link>
              </>
            ) : null}
            <button type="button" className={salesGroupActive ? 'sidebar-nav-item active' : 'sidebar-nav-item'} onClick={() => toggleGroupMenu(setSalesMenuOpen)} style={groupToggleStyle(salesGroupActive)} title="Sales" aria-label="Sales">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                <Briefcase size={18} /> {!isSidebarCollapsed ? 'Sales' : null}
              </span>
              {!isSidebarCollapsed ? salesMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && salesMenuOpen ? (
              <>
                <Link to="/sales/customers" className={isActive('/sales/customers') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/customers')}>Customer</Link>
                <Link to="/sales/contracts" className={isActive('/sales/contracts') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/contracts')}>Contract</Link>
                <Link to="/sales/invoices" className={isActive('/sales/invoices') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/invoices')}>Invoice</Link>
                <Link to="/quotations" className={isActive('/quotations') || isActive('/quotations/new') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/quotations', isActive('/quotations') || isActive('/quotations/new'))}>Quotation</Link>
                <Link to="/sales/payment-received" className={isActive('/sales/payment-received') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/payment-received')}>Payment Received</Link>
                <Link to="/sales/renewal" className={isActive('/sales/renewal') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/renewal')}>Renewal</Link>
              </>
            ) : null}

            <button type="button" className={purchaseGroupActive ? 'sidebar-nav-item active' : 'sidebar-nav-item'} onClick={() => toggleGroupMenu(setPurchaseMenuOpen)} style={groupToggleStyle(purchaseGroupActive)} title="Purchase" aria-label="Purchase">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                <ShoppingCart size={18} /> {!isSidebarCollapsed ? 'Purchase' : null}
              </span>
              {!isSidebarCollapsed ? purchaseMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && purchaseMenuOpen ? (
              <>
                <Link to="/purchase/vendors" className={isActive('/purchase/vendors') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/vendors')}>Vendors</Link>
                <Link to="/purchase/bills" className={isActive('/purchase/bills') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/bills')}>Bills</Link>
                <Link to="/purchase/payment-received" className={isActive('/purchase/payment-received') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/payment-received')}>Payment Received</Link>
              </>
            ) : null}

          </SidebarSection>

          <SidebarSection title="Operations" collapsed={isSidebarCollapsed}>
            <button type="button" className={fieldOpsGroupActive ? 'sidebar-nav-item active' : 'sidebar-nav-item'} onClick={() => toggleGroupMenu(setFieldOpsMenuOpen)} style={groupToggleStyle(fieldOpsGroupActive)} title="Field Operations" aria-label="Field Operations">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                <Smartphone size={18} /> {!isSidebarCollapsed ? 'Field Operations' : null}
              </span>
              {!isSidebarCollapsed ? fieldOpsMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && fieldOpsMenuOpen ? (
              <>
                <Link to="/operations/assign-services" className={isActive('/operations/assign-services') || isActive('/schedule-job') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/assign-services')}>Assign Services</Link>
                <Link to="/operations/assigned-jobs" className={isActive('/operations/assigned-jobs') || isActive('/technician-portal') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/assigned-jobs')}>Assigned Jobs</Link>
                <Link to="/operations/track-technicians" className={isActive('/operations/track-technicians') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/track-technicians')}>Track Technicians</Link>
                <Link to="/service-calendar" className={isActive('/service-calendar') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/service-calendar')}>Service Calendar</Link>
              </>
            ) : null}
            <Link to="/complaints" className={isActive('/complaints') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/complaints')} title="Complaints" aria-label="Complaints"><Bell size={18} /> {!isSidebarCollapsed ? 'Complaints' : null}</Link>
          </SidebarSection>

          <SidebarSection title="Inventory" collapsed={isSidebarCollapsed}>
            <Link to="/stock" className={isActive('/stock') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/stock')} title="Stock Management" aria-label="Stock Management"><Database size={18} /> {!isSidebarCollapsed ? 'Stock Management' : null}</Link>
          </SidebarSection>

          <SidebarSection title="HR & Payroll" collapsed={isSidebarCollapsed}>
            <Link to="/hr-dashboard" className={isActive('/hr-dashboard') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/hr-dashboard')} title="HR Dashboard" aria-label="HR Dashboard"><LayoutDashboard size={18} /> {!isSidebarCollapsed ? 'HR Dashboard' : null}</Link>
            <Link to="/employees" className={isActive('/employees') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/employees')} title="Employee Master" aria-label="Employee Master"><UserCheck size={18} /> {!isSidebarCollapsed ? 'Employee Master' : null}</Link>
            <Link to="/attendance" className={isActive('/attendance') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/attendance')} title="Attendance" aria-label="Attendance"><CalendarClock size={18} /> {!isSidebarCollapsed ? 'Attendance' : null}</Link>
            <Link to="/payroll" className={isActive('/payroll') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/payroll')} title="Payroll" aria-label="Payroll"><CircleDollarSign size={18} /> {!isSidebarCollapsed ? 'Payroll' : null}</Link>
          </SidebarSection>

          <SidebarSection title="Administration" collapsed={isSidebarCollapsed}>
            <Link to="/items" className={isActive('/items') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/items')} title="Items" aria-label="Items"><Package size={18} /> {!isSidebarCollapsed ? 'Items' : null}</Link>
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
            onClick={() => {
              if (isDrawerMode) {
                setSidebarOpen((prev) => !prev);
                return;
              }
              setSidebarPinnedOpen((prev) => !prev);
            }}
            aria-label={isDrawerMode ? sidebarOpen ? 'Hide menu' : 'Show menu' : sidebarPinnedOpen ? 'Auto minimize menu' : 'Keep menu extended'}
            title={isDrawerMode ? sidebarOpen ? 'Hide menu' : 'Show menu' : sidebarPinnedOpen ? 'Auto minimize menu' : 'Keep menu extended'}
            style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              width: isMobile ? '38px' : '40px',
              height: isMobile ? '38px' : '40px',
              padding: 0,
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Menu size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, marginLeft: 'auto' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: 800, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: isMobile ? 'none' : 'inline' }}>
              {portalUserRole} {portalUserName}
            </span>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              style={{
                border: '1px solid var(--color-border)',
                background: '#fff',
                color: 'var(--color-primary)',
                width: isMobile ? '38px' : '42px',
                height: isMobile ? '38px' : '42px',
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
              <Settings size={isMobile ? 18 : 20} />
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
                height: isMobile ? '38px' : '40px',
                minWidth: isMobile ? '92px' : '104px',
                padding: '0 14px',
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
    </div>
  );
}
