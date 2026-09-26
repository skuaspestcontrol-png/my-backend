import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyBrandingTheme, loadBrandingSettings, pickBrandingSettings, saveBrandingSettings } from '../utils/brandingTheme';
import { Eye, EyeOff } from 'lucide-react';
import { setPortalUser } from '../utils/portalAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const LOGIN_SETTINGS_CACHE_KEY = 'login_public_settings_cache_v1';
const OPEN_SERVICE_CALENDAR_ONCE_KEY = 'open_service_calendar_once_v1';

const readLoginSettingsCache = () => {
  try {
    const raw = window.sessionStorage.getItem(LOGIN_SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const writeLoginSettingsCache = (settings) => {
  try {
    window.sessionStorage.setItem(LOGIN_SETTINGS_CACHE_KEY, JSON.stringify({
      settings: settings || {},
      updatedAt: Date.now()
    }));
  } catch (_error) {
    // Ignore sessionStorage issues.
  }
};

const resolveLoginProfilePictureUrl = (settings = {}) => String(
  settings.dashboardImageUrl
  || settings.profilePictureUrl
  || settings.profilePicture
  || settings.gstCompanyLogoUrl
  || settings.companyLogoUrl
  || ''
).trim();

export default function Login() {
  const masterResetEmail = 'skuaspestcontrol@gmail.com';
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotEmail, setForgotEmail] = useState(masterResetEmail);
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [settings, setSettings] = useState(() => loadBrandingSettings() || {});
  const [logoBroken, setLogoBroken] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();
  const [cachedLoginSettings] = useState(() => readLoginSettingsCache());

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const cached = loadBrandingSettings() || {};
        const cachedPublic = cachedLoginSettings?.settings || {};
        const settingsRes = await axios.get(`${API_BASE_URL}/api/public/settings`);
        const profilePictureUrl = resolveLoginProfilePictureUrl({
          ...cached,
          ...cachedPublic,
          ...settingsRes.data
        });
        const nextSettings = {
          ...cached,
          ...cachedPublic,
          ...settingsRes.data,
          ...pickBrandingSettings({ ...cached, ...cachedPublic, ...settingsRes.data }),
          dashboardImageUrl: profilePictureUrl,
          companyName: String(settingsRes.data?.companyName || cachedPublic.companyName || cached.companyName || '').trim(),
          brandingAppearance: String(settingsRes.data?.brandingAppearance || cachedPublic.brandingAppearance || cached.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
          brandingAccentColor: String(settingsRes.data?.brandingAccentColor || cachedPublic.brandingAccentColor || cached.brandingAccentColor || '#EF4444').trim() || '#EF4444'
        };
        setSettings(nextSettings);
        setLogoBroken(false);
        applyBrandingTheme(nextSettings || {});
        saveBrandingSettings(nextSettings || {});
        writeLoginSettingsCache(nextSettings);
      } catch (error) {
        console.error('Could not load settings', error);
      }
    };
    if (cachedLoginSettings?.settings) {
      const cached = loadBrandingSettings() || {};
      const profilePictureUrl = resolveLoginProfilePictureUrl({
        ...cached,
        ...cachedLoginSettings.settings
      });
      const nextSettings = {
        ...cached,
        ...cachedLoginSettings.settings,
        dashboardImageUrl: profilePictureUrl,
        companyName: String(cachedLoginSettings.settings?.companyName || cached.companyName || '').trim(),
        brandingAppearance: String(cachedLoginSettings.settings?.brandingAppearance || cached.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
        brandingAccentColor: String(cachedLoginSettings.settings?.brandingAccentColor || cached.brandingAccentColor || '#EF4444').trim() || '#EF4444'
      };
      setSettings(nextSettings);
      applyBrandingTheme(nextSettings || {});
      setLogoBroken(false);
    }
    fetchSettings();
  }, [cachedLoginSettings]);

  useEffect(() => {
    const syncBranding = () => {
      const cached = loadBrandingSettings();
      if (!cached) return;
      const profilePictureUrl = resolveLoginProfilePictureUrl({
        ...cached,
        ...settings
      });
      setSettings((prev) => ({
        ...prev,
        ...cached,
        dashboardImageUrl: profilePictureUrl || String(cached.dashboardImageUrl || prev.dashboardImageUrl || '').trim(),
        companyName: String(cached.companyName || prev.companyName || '').trim(),
        brandingAppearance: String(cached.brandingAppearance || prev.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
        brandingAccentColor: String(cached.brandingAccentColor || prev.brandingAccentColor || '#EF4444').trim() || '#EF4444'
      }));
      setLogoBroken(false);
    };

    window.addEventListener('branding-sync', syncBranding);
    window.addEventListener('storage', syncBranding);
    window.addEventListener('focus', syncBranding);
    window.addEventListener('pageshow', syncBranding);
    syncBranding();

    return () => {
      window.removeEventListener('branding-sync', syncBranding);
      window.removeEventListener('storage', syncBranding);
      window.removeEventListener('focus', syncBranding);
      window.removeEventListener('pageshow', syncBranding);
    };
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isNarrow = viewportWidth <= 480;
  const isMobile = viewportWidth <= 640;
  const isStacked = viewportWidth < 900;
  const isTablet = viewportWidth >= 641 && viewportWidth < 1100;
  const hasValidLogo = Boolean(settings.dashboardImageUrl) && !logoBroken;
  const panelBg = 'linear-gradient(135deg, #160f33 0%, #120d2a 100%)';
  const textPrimary = '#ffffff';
  const textSecondary = 'rgba(255, 255, 255, 0.82)';
  const textMuted = 'rgba(255, 255, 255, 0.64)';
  const fieldBg = 'rgba(255, 255, 255, 0.08)';
  const fieldBorder = 'rgba(255, 255, 255, 0.16)';
  const pagePadding = isMobile ? 'clamp(10px, 3vw, 16px)' : isTablet ? '24px' : '28px';
  const cardMaxWidth = isStacked ? (isMobile ? '430px' : '520px') : '760px';
  const cardRadius = isMobile ? '14px' : '16px';
  const cardMinHeight = isStacked ? 'auto' : '390px';
  const logoWidth = isMobile ? 'clamp(112px, 42vw, 152px)' : isStacked ? '190px' : '220px';
  const logoMaxHeight = isMobile ? '118px' : isStacked ? '160px' : '210px';
  const logoPanelPadding = isMobile ? '14px 14px 0' : isStacked ? '20px 22px 0' : '24px 20px';
  const formPanelPadding = isMobile ? '12px 14px 16px' : isStacked ? '22px 28px 28px' : '28px 30px';
  const formMaxWidth = isStacked ? '100%' : '340px';
  const loginInputStyle = isNarrow
    ? {
        width: '100%',
        minHeight: '46px',
        padding: '12px 13px',
        borderRadius: '8px',
        boxSizing: 'border-box',
        background: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        color: '#ffffff',
        WebkitTextFillColor: '#ffffff',
        caretColor: '#ffffff',
        outline: 'none',
        fontSize: '16px',
        lineHeight: 1.25
      }
    : {
        width: '100%',
        minHeight: '46px',
        padding: '12px 13px',
        borderRadius: '8px',
        boxSizing: 'border-box',
        background: fieldBg,
        border: `1px solid ${fieldBorder}`,
        color: '#ffffff',
        WebkitTextFillColor: '#ffffff',
        caretColor: '#ffffff',
        outline: 'none',
        fontSize: isMobile ? '16px' : '14px',
        lineHeight: 1.25
      };
  const calendarModalBodyStyle = {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: isNarrow ? '12px' : '16px',
    background: '#f8fafc'
  };

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const getEmployeeLandingPath = (roleValue) => {
    const role = String(roleValue || '').trim().toLowerCase();
    if (role.includes('sales')) return '/sales-portal';
    if (role.includes('operations')) return '/operations-portal';
    if (role.includes('technician')) return '/operations/assigned-jobs';
    return '/dashboard';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (authLoading) return;
    setLoginError('');
    setAuthLoading(true);
    const username = String(credentials.username || '').trim();
    const password = String(credentials.password || '').trim();
    if (!username || !password) {
      setAuthLoading(false);
      setLoginError('Username and password are required.');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username,
        password
      });
      const user = response?.data?.user || null;
      if (!user) {
        throw new Error('Login succeeded without user context');
      }
      setPortalUser(user);
      if (rememberMe) {
        sessionStorage.setItem('portal_remember_username', username);
      } else {
        sessionStorage.removeItem('portal_remember_username');
      }
      sessionStorage.setItem(OPEN_SERVICE_CALENDAR_ONCE_KEY, '1');
      navigate(getEmployeeLandingPath(user.role), {
        replace: true,
        state: { openServiceCalendar: true }
      });
      setAuthLoading(false);
    } catch (error) {
      setAuthLoading(false);
      const status = error?.response?.status;
      const serverMessage = String(error?.response?.data?.error || '').trim();
      const message = status === 401
        ? 'Invalid credentials'
        : (serverMessage || (error?.request ? 'Unable to connect. Please try again.' : 'Unable to login right now.'));
      setLoginError(message);
    }
  };

  const requestResetOtp = async () => {
    const email = String(forgotEmail || '').trim().toLowerCase();
    if (email !== masterResetEmail) {
      alert(`Use master email only: ${masterResetEmail}`);
      return;
    }
    try {
      setForgotLoading(true);
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
      setForgotStep('reset');
      alert(`OTP sent to ${masterResetEmail}`);
    } catch (error) {
      alert(error?.response?.data?.error || 'Could not send OTP');
    } finally {
      setForgotLoading(false);
    }
  };

  const submitResetPassword = async () => {
    if (newPassword.length < 10) {
      alert('New password must be at least 10 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    try {
      setForgotLoading(true);
      await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email: masterResetEmail,
        otp: forgotOtp,
        newPassword
      });
      alert('Password reset successful. Please login with new password.');
      setForgotOpen(false);
      setForgotStep('request');
      setForgotOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      alert(error?.response?.data?.error || 'Could not reset password');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ padding: pagePadding, alignItems: isMobile ? 'start' : 'center' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: cardMaxWidth, borderRadius: cardRadius, border: '1px solid rgba(255, 255, 255, 0.08)', background: panelBg, boxShadow: '0 14px 34px rgba(15, 23, 42, 0.22)', overflow: 'hidden' }}>
        <section style={{ display: 'grid', gridTemplateColumns: isStacked ? '1fr' : 'minmax(0, 0.9fr) minmax(320px, 1fr)', minHeight: cardMinHeight }}>
          <div style={{ display: 'grid', placeItems: 'center', padding: logoPanelPadding }}>
            {hasValidLogo ? (
              <img
                src={settings.dashboardImageUrl}
                alt="Company Logo"
                onError={() => setLogoBroken(true)}
                style={{
                  width: logoWidth,
                  maxWidth: '95%',
                  maxHeight: logoMaxHeight,
                  height: 'auto',
                  objectFit: 'contain',
                  background: 'transparent'
                }}
              />
            ) : (
              <div
                style={{
                  width: isNarrow ? '72px' : '92px',
                  height: isNarrow ? '72px' : '92px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '18px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: isNarrow ? '20px' : '26px'
                }}
              >
                SPC
              </div>
            )}
          </div>

          <div style={{ padding: formPanelPadding, display: 'grid', alignContent: isStacked ? 'start' : 'center', justifyItems: 'stretch', gap: isMobile ? '10px' : '14px', minWidth: 0 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: isMobile ? 'clamp(22px, 7vw, 24px)' : isStacked ? '28px' : '32px', color: textPrimary, fontWeight: 800, lineHeight: 1.08 }}>Welcome</h2>
            </div>

            <div style={{ width: '100%', maxWidth: formMaxWidth, padding: 0, justifySelf: 'stretch' }}>
            <form onSubmit={handleLogin} style={{ display: 'grid', gap: isMobile ? '12px' : '14px' }}>
            <div>
              <label htmlFor="login-username" style={{ display: 'block', marginBottom: '8px', color: textSecondary, fontSize: '13px', fontWeight: 700 }}>Login Mobile Number / Username</label>
              <input
                id="login-username"
                type="text"
                name="username"
                onChange={handleChange}
                value={credentials.username}
                className="login-credential-input"
                style={loginInputStyle}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                aria-invalid={Boolean(loginError)}
                aria-describedby={loginError ? 'login-error' : undefined}
                required
              />
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: textMuted, fontWeight: 600 }}>For employees, use your 10-digit mobile number.</p>
            </div>

            <div>
              <label htmlFor="login-password" style={{ display: 'block', marginBottom: '8px', color: textSecondary, fontSize: '13px', fontWeight: 700 }}>Password</label>
              <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                onChange={handleChange}
                value={credentials.password}
                className="login-credential-input"
                style={{ ...loginInputStyle, padding: '12px 48px 12px 13px' }}
                autoComplete="current-password"
                aria-invalid={Boolean(loginError)}
                aria-describedby={loginError ? 'login-error' : undefined}
                required
              />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: textSecondary, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {loginError ? (
              <div id="login-error" role="alert" style={{ color: '#fecaca', background: 'rgba(220, 38, 38, 0.14)', border: '1px solid rgba(248, 113, 113, 0.28)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                {loginError}
              </div>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', columnGap: '12px', rowGap: '8px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: textSecondary, fontSize: '13px', fontWeight: 600, minHeight: '32px' }}>
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} style={{ accentColor: '#8b5cf6' }} />
                Remember me
              </label>
              <button
                className="login-link-button"
                type="button"
                onClick={() => {
                  setForgotOpen(true);
                  setForgotStep('request');
                }}
                style={{ background: 'transparent', border: 'none', color: '#c7d2fe', fontWeight: 700, cursor: 'pointer', textAlign: 'center', marginTop: '2px' }}
              >
                Forgot password?
              </button>
            </div>

            <button
              className="login-submit-button"
              type="submit"
              disabled={authLoading}
              style={{
                marginTop: isMobile ? '4px' : '6px',
                minHeight: '48px',
                background: 'linear-gradient(135deg, #2f176d 0%, #6d5be3 100%)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '16px',
                opacity: authLoading ? 0.75 : 1
              }}
            >
              {authLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
            </div>
          </div>
        </section>
      </div>
      {forgotOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999, padding: '14px' }}>
          <div style={{ width: '100%', maxWidth: '430px', background: panelBg, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#ffffff' }}>Reset Password</h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '22px', cursor: 'pointer', lineHeight: 1, color: '#ffffff' }}
              >
                ×
              </button>
            </div>
            {forgotStep === 'request' ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                <p style={{ margin: 0, color: textSecondary, fontWeight: 700, fontSize: '14px' }}>
                  Reset OTP will be sent to the registered master email.
                </p>
                <button
                  type="button"
                  onClick={requestResetOtp}
                  disabled={forgotLoading}
                  style={{ minHeight: '44px', background: 'linear-gradient(135deg, #2f176d 0%, #6d5be3 100%)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {forgotLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                <label style={{ color: textSecondary, fontWeight: 700 }}>OTP</label>
                <input
                  type="text"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: fieldBg, border: `1px solid ${fieldBorder}`, color: '#ffffff' }}
                />
                <label style={{ color: textSecondary, fontWeight: 700 }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: fieldBg, border: `1px solid ${fieldBorder}`, color: '#ffffff' }}
                />
                <label style={{ color: textSecondary, fontWeight: 700 }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: fieldBg, border: `1px solid ${fieldBorder}`, color: '#ffffff' }}
                />
                <button
                  type="button"
                  onClick={submitResetPassword}
                  disabled={forgotLoading}
                  style={{ minHeight: '44px', background: 'linear-gradient(135deg, #2f176d 0%, #6d5be3 100%)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
