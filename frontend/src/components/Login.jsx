import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyBrandingTheme, loadBrandingSettings, pickBrandingSettings, saveBrandingSettings } from '../utils/brandingTheme';
import { Eye, EyeOff, Bug, Rat, Wind, ScanLine, BrickWall, ArrowRight } from 'lucide-react';
import { setPortalUser } from '../utils/portalAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const LOGIN_SETTINGS_CACHE_KEY = 'login_public_settings_cache_v1';

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

  const hasValidLogo = Boolean(settings.dashboardImageUrl) && !logoBroken;
  const panelBg = 'linear-gradient(135deg, var(--skuas-header) 0%, var(--skuas-header-secondary) 100%)';
  const textSecondary = 'rgba(255, 255, 255, 0.82)';
  const fieldBg = 'rgba(255, 255, 255, 0.08)';
  const fieldBorder = 'rgba(255, 255, 255, 0.16)';

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
      navigate(getEmployeeLandingPath(user.role), {
        replace: true
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
    <main className="login-page">
      <div className="login-card">
        <section className="login-brand-panel" aria-label="SKUAS Pest Control services">
          <div className="login-logo-frame">
            {hasValidLogo ? (
              <img className="login-logo" src={settings.dashboardImageUrl}
                alt="SKUAS Pest Control" onError={() => setLogoBroken(true)} />
            ) : (
              <span className="login-brand-fallback">{settings.companyName || 'SKUAS Pest Control'}</span>
            )}
          </div>
          <div className="login-brand-copy">
            <p className="login-eyebrow">EXPERT CARE. EVERY SPACE.</p>
            <h1>Complete Pest<br className="login-desktop-break" /> Control Solutions</h1>
            <p className="login-brand-subtitle">Homes | Offices | Industries | Pre-Construction</p>
          </div>
          <ul className="login-services" aria-label="Our services">
            {[
              [BrickWall, 'Termite Control'],
              [Bug, 'Cockroach Control'],
              [Rat, 'Rodent Control'],
              [Wind, 'Mosquito Control'],
              [ScanLine, 'Fly Control'],
              [BrickWall, 'Pre-Construction Solutions']
            ].map(([Icon, label]) => (
              <li key={label}><Icon size={25} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span></li>
            ))}
          </ul>
          <svg className="login-skyline" viewBox="0 0 540 120" fill="none" aria-hidden="true" focusable="false">
            <path d="M0 112H540M8 112V74L42 50L76 74V112M23 112V85H59V112M82 112V42H135V112M94 55H104M114 55H124M94 70H104M114 70H124M94 85H104M114 85H124M146 112V65L177 43L208 65V112M160 112V80H194V112M220 112V20H279V112M234 35H245M255 35H266M234 52H245M255 52H266M234 69H245M255 69H266M234 86H245M255 86H266M291 112V55H333V112M301 68H323M301 83H323M345 112V38L374 18L403 38V112M357 52H391M357 70H391M357 88H391M416 112V62H464V112M428 75H452M428 91H452M475 112V81L503 61L531 81V112" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </section>
        <section className="login-form-panel" aria-labelledby="login-heading">
          <div className="login-form-content">
            <header className="login-form-heading">
              <p className="login-eyebrow">SKUAS CRM</p>
              <h2 id="login-heading">Welcome Back</h2>
              <p>Please login to your account</p>
            </header>
            <form onSubmit={handleLogin} className="login-form" aria-busy={authLoading}>
              <div>
                <label htmlFor="login-username">Mobile Number / Username</label>
                <input id="login-username" type="text" name="username"
                  onChange={handleChange} value={credentials.username}
                  className="login-credential-input" autoComplete="username"
                  autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text"
                  aria-invalid={Boolean(loginError)}
                  aria-describedby={loginError ? 'login-username-help login-error' : 'login-username-help'} required />
                <p id="login-username-help" className="login-field-help">For employees, use your 10-digit mobile number.</p>
              </div>
              <div>
                <label htmlFor="login-password">Password</label>
                <div className="login-password-field">
                  <input id="login-password" type={showPassword ? 'text' : 'password'} name="password"
                    onChange={handleChange} value={credentials.password}
                    className="login-credential-input" autoComplete="current-password"
                    aria-invalid={Boolean(loginError)} aria-describedby={loginError ? 'login-error' : undefined} required />
                  <button className="login-password-toggle" type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              {loginError ? <div id="login-error" role="alert" className="login-error">{loginError}</div> : null}
              <div className="login-form-options">
                <label className="login-remember">
                  <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                  Remember me
                </label>
                <button className="login-link-button" type="button" onClick={() => {
                  setForgotOpen(true);
                  setForgotStep('request');
                }}>Forgot password?</button>
              </div>
              <button className="login-submit-button" type="submit" disabled={authLoading}>
                <span>{authLoading ? 'Signing In...' : 'Sign In'}</span><ArrowRight size={19} aria-hidden="true" />
              </button>
            </form>
          </div>
          <footer className="login-footer">© 2026 SKUAS Pest Control. All rights reserved.</footer>
        </section>
      </div>
      {forgotOpen && (
        <div className="login-reset-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999, padding: '14px' }}>
          <div style={{ width: '100%', maxWidth: '430px', background: panelBg, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#ffffff' }}>Reset Password</h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                aria-label="Close password reset"
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
                <label htmlFor="reset-otp" style={{ color: textSecondary, fontWeight: 700 }}>OTP</label>
                <input
                  id="reset-otp" autoComplete="one-time-code" inputMode="numeric"
                  type="text"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: fieldBg, border: `1px solid ${fieldBorder}`, color: '#ffffff' }}
                />
                <label htmlFor="reset-new-password" style={{ color: textSecondary, fontWeight: 700 }}>New Password</label>
                <input
                  id="reset-new-password" autoComplete="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: fieldBg, border: `1px solid ${fieldBorder}`, color: '#ffffff' }}
                />
                <label htmlFor="reset-confirm-password" style={{ color: textSecondary, fontWeight: 700 }}>Confirm Password</label>
                <input
                  id="reset-confirm-password" autoComplete="new-password"
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
    </main>
  );
}
