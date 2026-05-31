import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyBrandingTheme, loadBrandingSettings, pickBrandingSettings, saveBrandingSettings } from '../utils/brandingTheme';
import { getPortalUserRole, logoutPortalUser } from '../utils/portalAuth';
import {
  CalendarClock,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileDown,
  Database,
  Gift,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  BarChart3,
  IndianRupee,
  Target,
  LogOut,
  Settings,
  ShoppingCart,
  Smartphone,
  Truck,
  TrendingUp,
  UserCheck,
  Users
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const INACTIVITY_LOGOUT_MS = 5 * 60 * 1000;
const NOTIFICATION_READ_STORAGE_KEY = 'skuas_read_notification_ids';

const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const isDoneLead = (lead) => ['booked', 'converted'].includes(String(lead?.status || lead?.leadStatus || '').trim().toLowerCase());

const getTodayLeadFollowups = (rows = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (Array.isArray(rows) ? rows : [])
    .filter((lead) => {
      const followupDate = toDateOnly(lead?.followupDate);
      return followupDate && followupDate.getTime() === today.getTime() && !isDoneLead(lead);
    })
    .map((lead, index) => ({
      id: String(lead._id || `${lead.customerName || 'lead'}-${lead.mobile || lead.mobileNumber || ''}-${lead.followupDate || ''}-${index}`),
      title: String(lead.customerName || lead.displayName || 'Lead follow-up').trim(),
      subtitle: [
        String(lead.mobile || lead.mobileNumber || '').trim(),
        String(lead.assignedTo || 'Unassigned').trim()
      ].filter(Boolean).join(' • '),
      status: String(lead.status || lead.leadStatus || 'Follow-up').trim()
    }));
};

const getNewLeadNotifications = (rows = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (Array.isArray(rows) ? rows : [])
    .filter((lead) => {
      const leadDate = toDateOnly(lead?.date || lead?.createdAt || lead?.created_at || lead?.leadDate || lead?.lead_date);
      return leadDate && leadDate.getTime() === today.getTime();
    })
    .map((lead, index) => ({
      id: `new-lead-${String(lead._id || lead.id || `${lead.customerName || 'lead'}-${lead.mobile || lead.mobileNumber || ''}-${lead.date || lead.createdAt || ''}-${index}`)}`,
      title: `New Lead: ${String(lead.customerName || lead.displayName || 'Lead').trim()}`,
      subtitle: [
        String(lead.mobile || lead.mobileNumber || '').trim(),
        String(lead.leadSource || lead.source || 'Website').trim()
      ].filter(Boolean).join(' • '),
      status: String(lead.status || lead.leadStatus || 'New').trim() || 'New'
    }));
};

const getTodayServiceScheduleNotifications = (rows = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (Array.isArray(rows) ? rows : [])
    .filter((job) => {
      const scheduledDate = toDateOnly(job?.scheduledDate || job?.scheduled_date || job?.date);
      return scheduledDate && scheduledDate.getTime() === today.getTime();
    })
    .map((job, index) => ({
      id: `service-schedule-${String(job._id || job.id || `${job.customerName || 'job'}-${job.scheduledDate || job.scheduled_date || ''}-${index}`)}`,
      title: `Today Service: ${String(job.customerName || job.customer || 'Scheduled job').trim()}`,
      subtitle: [
        String(job.scheduledTime || job.scheduled_time || '').trim() || '10:00',
        String(job.assignedTo || job.technicianName || job.technician || 'Unassigned').trim()
      ].filter(Boolean).join(' • '),
      status: String(job.status || 'Scheduled').trim() || 'Scheduled'
    }));
};

const buildLeadNotifications = (rows = [], jobs = []) => {
  const newLeads = getNewLeadNotifications(rows).map((item) => ({ ...item, kind: 'new-lead' }));
  const followups = getTodayLeadFollowups(rows).map((item) => ({ ...item, kind: 'follow-up' }));
  const serviceSchedules = getTodayServiceScheduleNotifications(jobs).map((item) => ({ ...item, kind: 'service-schedule' }));
  return [...newLeads, ...serviceSchedules, ...followups];
};

const loadReadNotificationIds = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (_error) {
    return [];
  }
};

const saveReadNotificationIds = (ids) => {
  try {
    localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids.map(String)))));
  } catch (_error) {
    // Ignore localStorage issues.
  }
};

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
  const [salesPerformanceMenuOpen, setSalesPerformanceMenuOpen] = useState(false);
  const [purchaseMenuOpen, setPurchaseMenuOpen] = useState(false);
  const [fieldOpsMenuOpen, setFieldOpsMenuOpen] = useState(false);
  const [stockMenuOpen, setStockMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 992);
  const [sidebarPinnedOpen, setSidebarPinnedOpen] = useState(false);
  const [sidebarHovering, setSidebarHovering] = useState(false);
  const [sidebarFocusWithin, setSidebarFocusWithin] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [leadNotifications, setLeadNotifications] = useState([]);
  const [serviceSchedules, setServiceSchedules] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState(() => loadReadNotificationIds());

  const syncBrandingFromCache = useCallback(() => {
    const cached = loadBrandingSettings();
    if (!cached) return;
    setSettings((prev) => ({
      ...prev,
      ...cached,
      dashboardImageUrl: String(cached.dashboardImageUrl || prev.dashboardImageUrl || '').trim(),
      companyName: String(cached.companyName || prev.companyName || '').trim(),
      brandingAppearance: String(cached.brandingAppearance || prev.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
      brandingAccentColor: String(cached.brandingAccentColor || prev.brandingAccentColor || '#EF4444').trim() || '#EF4444'
    }));
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/settings`);
        const cached = loadBrandingSettings() || {};
        const nextSettings = {
          ...cached,
          ...res.data,
          ...pickBrandingSettings({
            ...cached,
            ...res.data
          }),
          dashboardImageUrl: String(res.data?.dashboardImageUrl || cached.dashboardImageUrl || '').trim(),
          companyName: String(res.data?.companyName || cached.companyName || '').trim(),
          brandingAppearance: String(res.data?.brandingAppearance || cached.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
          brandingAccentColor: String(res.data?.brandingAccentColor || cached.brandingAccentColor || '#EF4444').trim() || '#EF4444'
        };
        setSettings(nextSettings);
        applyBrandingTheme(nextSettings || {});
        saveBrandingSettings(nextSettings || {});
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
    syncBrandingFromCache();

    const handleBrandingSync = () => {
      syncBrandingFromCache();
    };

    window.addEventListener('branding-sync', handleBrandingSync);
    window.addEventListener('storage', handleBrandingSync);
    window.addEventListener('focus', handleBrandingSync);
    window.addEventListener('pageshow', handleBrandingSync);

    return () => {
      window.removeEventListener('branding-sync', handleBrandingSync);
      window.removeEventListener('storage', handleBrandingSync);
      window.removeEventListener('focus', handleBrandingSync);
      window.removeEventListener('pageshow', handleBrandingSync);
    };
  }, [syncBrandingFromCache]);

  useEffect(() => {
    const isLeadsRoute = location.pathname === '/leads' || location.pathname.startsWith('/leads/');
    const isSalesRoute = location.pathname.startsWith('/sales/') || location.pathname.startsWith('/quotations');
    const isSalesPerformanceRoute = location.pathname.startsWith('/sales-performance');
    const isPurchaseRoute = location.pathname.startsWith('/purchase/');
    const isFieldOpsRoute = location.pathname.startsWith('/operations/');
    const isStockRoute = location.pathname.startsWith('/stock');
    setLeadsMenuOpen(isLeadsRoute);
    setSalesMenuOpen(isSalesRoute);
    setSalesPerformanceMenuOpen(isSalesPerformanceRoute);
    setPurchaseMenuOpen(isPurchaseRoute);
    setFieldOpsMenuOpen(isFieldOpsRoute);
    setStockMenuOpen(isStockRoute);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchLeadNotifications = async () => {
      try {
        const [leadRes, jobsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/leads`),
          axios.get(`${API_BASE_URL}/api/jobs`).catch(() => ({ data: [] }))
        ]);
        if (!active) return;
        const jobRows = Array.isArray(jobsRes.data) ? jobsRes.data : [];
        setServiceSchedules(getTodayServiceScheduleNotifications(jobRows));
        setLeadNotifications(buildLeadNotifications(leadRes.data, jobRows));
      } catch (error) {
        console.error('Could not load notifications', error);
      }
    };

    fetchLeadNotifications();
    const interval = window.setInterval(fetchLeadNotifications, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target;
      if (notificationsOpen && target instanceof Element && !target.closest('[data-topbar-notifications="true"]')) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [notificationsOpen]);

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
  const closeDrawerOnMobile = useCallback(() => {
    if (isDrawerMode) {
      setSidebarOpen(false);
    }
  }, [isDrawerMode]);

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
  const salesPerformanceGroupActive = isPrefixActive('/sales-performance');
  const stockGroupActive = isPrefixActive('/stock');

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
    border: 'none',
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

  const groupToggleStyle = (open) => ({
    ...baseLinkStyle(false),
    border: 'none',
    justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
    cursor: 'pointer',
    background: open ? 'var(--color-primary-light)' : 'var(--color-white)',
    color: 'var(--color-text)',
    boxShadow: 'none'
  });

  const sidebarGroupLabelStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const toggleGroupMenu = (setMenuOpen) => {
    if (isSidebarCollapsed) {
      setSidebarPinnedOpen(true);
      setMenuOpen(true);
      return;
    }
    setMenuOpen((prev) => !prev);
  };

  const handleLogout = useCallback(async () => {
    try {
      await logoutPortalUser(API_BASE_URL);
    } catch (_error) {
      // Ignore logout network failures and still clear the UI session.
    }
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

  const companyName = String(settings.companyName || settings.gstCompanyName || 'SKUAS Pest Control Private Limited').trim() || 'SKUAS Pest Control Private Limited';
  const portalUserRole = getPortalUserRole() || 'Admin';
  const unreadNotificationCount = leadNotifications.filter((item) => !readNotificationIds.includes(item.id)).length;
  const toggleNotificationRead = (id) => {
    setReadNotificationIds((prev) => {
      const key = String(id);
      const next = prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key];
      saveReadNotificationIds(next);
      return next;
    });
  };
  const markAllNotificationsRead = () => {
    const next = leadNotifications.map((item) => item.id);
    setReadNotificationIds(next);
    saveReadNotificationIds(next);
  };
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
          <Link
            to="/dashboard"
            className={isActive('/dashboard') ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
            style={linkStyle('/dashboard')}
            title="Dashboard"
            aria-label="Dashboard"
            onClick={closeDrawerOnMobile}
          >
            <LayoutDashboard size={18} /> {!isSidebarCollapsed ? 'Dashboard' : null}
          </Link>

          <SidebarSection title="Sales & Marketing" collapsed={isSidebarCollapsed}>
            <button
              type="button"
              className="sidebar-nav-item"
              onClick={() => toggleGroupMenu(setLeadsMenuOpen)}
              style={groupToggleStyle(leadsMenuOpen)}
              title="Leads"
              aria-label="Leads"
            >
              <span style={sidebarGroupLabelStyle}>
                <Users size={18} /> {!isSidebarCollapsed ? 'Leads' : null}
              </span>
              {!isSidebarCollapsed ? leadsMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && leadsMenuOpen ? (
              <>
                <Link to="/leads" className={isActive('/leads') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkActiveStyle('/leads')} onClick={closeDrawerOnMobile}>Lead Master</Link>
                <Link to="/leads/followup" className={isActive('/leads/followup') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkActiveStyle('/leads/followup')} onClick={closeDrawerOnMobile}>Followup</Link>
              </>
            ) : null}
            <button
              type="button"
              className="sidebar-nav-item"
              onClick={() => toggleGroupMenu(setSalesMenuOpen)}
              style={groupToggleStyle(salesMenuOpen)}
              title="Sales"
              aria-label="Sales"
            >
              <span style={sidebarGroupLabelStyle}>
                <Briefcase size={18} /> {!isSidebarCollapsed ? 'Sales' : null}
              </span>
              {!isSidebarCollapsed ? salesMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && salesMenuOpen ? (
              <>
                <Link to="/sales/customers" className={isActive('/sales/customers') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/customers')} onClick={closeDrawerOnMobile}>Customer</Link>
                <Link to="/sales/contracts" className={isActive('/sales/contracts') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/contracts')} onClick={closeDrawerOnMobile}>Contract</Link>
                <Link to="/sales/invoices" className={isActive('/sales/invoices') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/invoices')} onClick={closeDrawerOnMobile}>Invoice</Link>
                <Link to="/quotations" className={isActive('/quotations') || isActive('/quotations/new') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/quotations', isActive('/quotations') || isActive('/quotations/new'))} onClick={closeDrawerOnMobile}>Quotation</Link>
                <Link to="/sales/payment-received" className={isActive('/sales/payment-received') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/payment-received')} onClick={closeDrawerOnMobile}>Payment Received</Link>
                <Link to="/sales/renewal" className={isActive('/sales/renewal') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales/renewal')} onClick={closeDrawerOnMobile}>Renewal</Link>
              </>
            ) : null}

            <button type="button" className="sidebar-nav-item" onClick={() => toggleGroupMenu(setSalesPerformanceMenuOpen)} style={groupToggleStyle(salesPerformanceMenuOpen)} title="Sales Performance" aria-label="Sales Performance">
              <span style={sidebarGroupLabelStyle}>
                <BarChart3 size={18} /> {!isSidebarCollapsed ? 'Sales Performance' : null}
              </span>
              {!isSidebarCollapsed ? salesPerformanceMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && salesPerformanceMenuOpen ? (
              <>
                <Link to="/sales-performance/dashboard" className={isActive('/sales-performance/dashboard') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales-performance/dashboard')} onClick={closeDrawerOnMobile}>Dashboard</Link>
                <Link to="/sales-performance/targets" className={isActive('/sales-performance/targets') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales-performance/targets')} onClick={closeDrawerOnMobile}>Targets</Link>
                <Link to="/sales-performance/team-performance" className={isActive('/sales-performance/team-performance') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales-performance/team-performance')} onClick={closeDrawerOnMobile}>Team Performance</Link>
                <Link to="/sales-performance/reports" className={isActive('/sales-performance/reports') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/sales-performance/reports')} onClick={closeDrawerOnMobile}>Reports</Link>
              </>
            ) : null}

            <button type="button" className="sidebar-nav-item" onClick={() => toggleGroupMenu(setPurchaseMenuOpen)} style={groupToggleStyle(purchaseMenuOpen)} title="Purchase" aria-label="Purchase">
              <span style={sidebarGroupLabelStyle}>
                <ShoppingCart size={18} /> {!isSidebarCollapsed ? 'Purchase' : null}
              </span>
              {!isSidebarCollapsed ? purchaseMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && purchaseMenuOpen ? (
              <>
                <Link to="/purchase/vendors" className={isActive('/purchase/vendors') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/vendors')} onClick={closeDrawerOnMobile}>Vendors</Link>
                <Link to="/purchase/bills" className={isActive('/purchase/bills') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/bills')} onClick={closeDrawerOnMobile}>Bills</Link>
                <Link to="/purchase/payment-received" className={isActive('/purchase/payment-received') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/purchase/payment-received')} onClick={closeDrawerOnMobile}>Payment Received</Link>
              </>
            ) : null}

          </SidebarSection>

          <SidebarSection title="Operations" collapsed={isSidebarCollapsed}>
            <button type="button" className="sidebar-nav-item" onClick={() => toggleGroupMenu(setFieldOpsMenuOpen)} style={groupToggleStyle(fieldOpsMenuOpen)} title="Field Operations" aria-label="Field Operations">
              <span style={sidebarGroupLabelStyle}>
                <Smartphone size={18} /> {!isSidebarCollapsed ? 'Field Operations' : null}
              </span>
              {!isSidebarCollapsed ? fieldOpsMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && fieldOpsMenuOpen ? (
              <>
                <Link to="/operations/assign-services" className={isActive('/operations/assign-services') || isActive('/schedule-job') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/assign-services')} onClick={closeDrawerOnMobile}>Assign Services</Link>
                <Link to="/operations/assigned-jobs" className={isActive('/operations/assigned-jobs') || isActive('/technician-portal') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/assigned-jobs')} onClick={closeDrawerOnMobile}>Assigned Jobs</Link>
                <Link to="/operations/track-technicians" className={isActive('/operations/track-technicians') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/operations/track-technicians')} onClick={closeDrawerOnMobile}>Track Technicians</Link>
                <Link to="/service-calendar" className={isActive('/service-calendar') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/service-calendar')} onClick={closeDrawerOnMobile}>Service Calendar</Link>
              </>
            ) : null}
            <Link to="/complaints" className={isActive('/complaints') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/complaints')} title="Complaints" aria-label="Complaints" onClick={closeDrawerOnMobile}><Bell size={18} /> {!isSidebarCollapsed ? 'Complaints' : null}</Link>
          </SidebarSection>

          <SidebarSection title="Inventory" collapsed={isSidebarCollapsed}>
            <button type="button" className="sidebar-nav-item" onClick={() => toggleGroupMenu(setStockMenuOpen)} style={groupToggleStyle(stockMenuOpen)} title="Stock Management" aria-label="Stock Management">
              <span style={sidebarGroupLabelStyle}>
                <Database size={18} /> {!isSidebarCollapsed ? 'Stock Management' : null}
              </span>
              {!isSidebarCollapsed ? stockMenuOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
            </button>
            {!isSidebarCollapsed && stockMenuOpen ? (
              <>
                <Link to="/stock/dashboard" className={isActive('/stock/dashboard') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/stock/dashboard')} onClick={closeDrawerOnMobile}>Dashboard</Link>
                <Link to="/stock/items" className={isActive('/stock/items') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/stock/items')} onClick={closeDrawerOnMobile}>Items</Link>
                <Link to="/stock/purchase" className={isActive('/stock/purchase') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/stock/purchase')} onClick={closeDrawerOnMobile}>Stock In / Purchase</Link>
                <Link to="/stock/issue-usage" className={isActive('/stock/issue-usage') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/stock/issue-usage')} onClick={closeDrawerOnMobile}>Issue &amp; Usage</Link>
                <Link to="/stock/reports" className={isActive('/stock/reports') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={subLinkStyle('/stock/reports')} onClick={closeDrawerOnMobile}>Reports</Link>
              </>
            ) : null}
          </SidebarSection>

          <SidebarSection title="HR & Payroll" collapsed={isSidebarCollapsed}>
            <Link to="/hr-dashboard" className={isActive('/hr-dashboard') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/hr-dashboard')} title="HR Dashboard" aria-label="HR Dashboard" onClick={closeDrawerOnMobile}><LayoutDashboard size={18} /> {!isSidebarCollapsed ? 'HR Dashboard' : null}</Link>
            <Link to="/employees" className={isActive('/employees') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/employees')} title="Employee Master" aria-label="Employee Master" onClick={closeDrawerOnMobile}><UserCheck size={18} /> {!isSidebarCollapsed ? 'Employee Master' : null}</Link>
            <Link to="/attendance" className={isActive('/attendance') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/attendance')} title="Attendance" aria-label="Attendance" onClick={closeDrawerOnMobile}><CalendarClock size={18} /> {!isSidebarCollapsed ? 'Attendance' : null}</Link>
            <Link to="/payroll" className={isActive('/payroll') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/payroll')} title="Payroll" aria-label="Payroll" onClick={closeDrawerOnMobile}><IndianRupee size={18} /> {!isSidebarCollapsed ? 'Payroll' : null}</Link>
          </SidebarSection>

          <SidebarSection title="Administration" collapsed={isSidebarCollapsed}>
            <Link to="/items" className={isActive('/items') ? 'sidebar-nav-item active' : 'sidebar-nav-item'} style={linkStyle('/items')} title="Items" aria-label="Items" onClick={closeDrawerOnMobile}><Package size={18} /> {!isSidebarCollapsed ? 'Items' : null}</Link>
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
            <span
              style={{
                fontSize: '13px',
                color: 'var(--color-text)',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                display: isMobile ? 'none' : 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                minWidth: 0
              }}
              title={`${portalUserRole} ${companyName}`}
            >
              <span style={{ fontWeight: 400, flexShrink: 0 }}>{portalUserRole}</span>
              <span style={{ fontWeight: 800 }}>{companyName}</span>
            </span>
            <div style={{ position: 'relative', display: 'inline-flex' }} data-topbar-notifications="true">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
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
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative'
                }}
                aria-label="Open notifications"
                title="Notifications"
              >
                <Bell size={isMobile ? 18 : 20} />
                {unreadNotificationCount > 0 ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-3px',
                      minWidth: '18px',
                      height: '18px',
                      padding: '0 5px',
                      borderRadius: '999px',
                      background: '#dc2626',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #fff'
                    }}
                  >
                    {unreadNotificationCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div
                  style={{
                    position: isMobile ? 'fixed' : 'absolute',
                    top: isMobile ? `calc(${topbarHeight} + 8px)` : 'calc(100% + 10px)',
                    right: isMobile ? '12px' : 0,
                    left: isMobile ? '12px' : 'auto',
                    width: isMobile ? 'auto' : '340px',
                    maxWidth: isMobile ? 'calc(100vw - 24px)' : 'none',
                    maxHeight: isMobile ? `calc(100dvh - ${topbarHeight} - 24px)` : '420px',
                    overflowY: 'auto',
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
                    zIndex: 6000,
                    padding: '10px',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '2px 2px 8px', minWidth: 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--color-text)' }}>Website Notifications</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)' }}>New leads, today service schedule, and follow-up tasks</p>
                    </div>
                    {leadNotifications.length > 0 ? (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Mark all
                      </button>
                    ) : null}
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {leadNotifications.length === 0 ? (
                      <div style={{ padding: '18px 10px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '12px', fontWeight: 700 }}>
                        No new leads, service schedules, or follow-ups due today.
                      </div>
                    ) : (
                      <>
                        {leadNotifications.some((item) => item.kind === 'new-lead') ? (
                          <div style={{ marginTop: '2px', padding: '0 2px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '999px', padding: '4px 8px', background: '#dcfce7', color: '#166534', fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              New Leads
                            </div>
                            <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                              {leadNotifications.filter((item) => item.kind === 'new-lead').map((item) => {
                                const isRead = readNotificationIds.includes(item.id);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => toggleNotificationRead(item.id)}
                                    style={{
                                      border: '1px solid var(--color-border)',
                                      borderRadius: '10px',
                                      background: isRead ? '#fff' : 'var(--color-primary-light)',
                                      padding: '9px 10px',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'grid',
                                      gap: '3px',
                                      minWidth: 0
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                                      <span style={{ fontSize: '12px', fontWeight: isRead ? 600 : 800, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                      <span style={{ flexShrink: 0, padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 800, color: '#166534', background: '#dcfce7' }}>New Lead</span>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: isRead ? 500 : 700, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle || 'Unassigned'}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.status}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {leadNotifications.some((item) => item.kind === 'service-schedule') ? (
                          <div style={{ marginTop: '2px', padding: '0 2px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '999px', padding: '4px 8px', background: '#dbeafe', color: '#1d4ed8', fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              Today Service Schedule
                            </div>
                            <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                              {leadNotifications.filter((item) => item.kind === 'service-schedule').map((item) => {
                                const isRead = readNotificationIds.includes(item.id);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => toggleNotificationRead(item.id)}
                                    style={{
                                      border: '1px solid var(--color-border)',
                                      borderRadius: '10px',
                                      background: isRead ? '#fff' : 'var(--color-primary-light)',
                                      padding: '9px 10px',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'grid',
                                      gap: '3px',
                                      minWidth: 0
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                                      <span style={{ fontSize: '12px', fontWeight: isRead ? 600 : 800, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                      <span style={{ flexShrink: 0, padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 800, color: '#1d4ed8', background: '#dbeafe' }}>Schedule</span>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: isRead ? 500 : 700, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle || 'Unassigned'}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.status}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {leadNotifications.some((item) => item.kind === 'follow-up') ? (
                          <div style={{ marginTop: '2px', padding: '0 2px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '999px', padding: '4px 8px', background: '#dbeafe', color: '#1d4ed8', fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              Follow-ups
                            </div>
                            <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                              {leadNotifications.filter((item) => item.kind === 'follow-up').map((item) => {
                                const isRead = readNotificationIds.includes(item.id);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => toggleNotificationRead(item.id)}
                                    style={{
                                      border: '1px solid var(--color-border)',
                                      borderRadius: '10px',
                                      background: isRead ? '#fff' : 'var(--color-primary-light)',
                                      padding: '9px 10px',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'grid',
                                      gap: '3px',
                                      minWidth: 0
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                                      <span style={{ fontSize: '12px', fontWeight: isRead ? 600 : 800, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                      <span style={{ flexShrink: 0, padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 800, color: '#1d4ed8', background: '#dbeafe' }}>Follow-up</span>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: isRead ? 500 : 700, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle || 'Unassigned'}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.status}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
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
              type="button"
              onClick={handleLogout}
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
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={isMobile ? 18 : 20} />
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
