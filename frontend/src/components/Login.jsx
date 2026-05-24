import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyBrandingTheme, saveBrandingSettings } from '../utils/brandingTheme';
import { PHONE_VALIDATION_ERROR, normalizeIndianMobileNumber } from '../utils/phone';
import { Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
  const [settings, setSettings] = useState({});
  const [logoBroken, setLogoBroken] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, employeesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/settings`),
          axios.get(`${API_BASE_URL}/api/employees`)
        ]);
        setSettings(settingsRes.data || {});
        setLogoBroken(false);
        applyBrandingTheme(settingsRes.data || {});
        saveBrandingSettings(settingsRes.data || {});
        setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
      } catch (error) {
        console.error('Could not load settings', error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isNarrow = viewportWidth <= 480;
  const hasValidLogo = Boolean(settings.dashboardImageUrl) && !logoBroken;

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
    setAuthLoading(true);
    const username = String(credentials.username || '').trim();
    const loginMobile = normalizeIndianMobileNumber(username);
    const password = String(credentials.password || '').trim();
    const expectedUsername = String(settings.adminUsername || 'admin').trim() || 'admin';
    const expectedPassword = String(settings.adminPassword || 'admin123');

    if (username === expectedUsername && password === expectedPassword) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.removeItem('portal_user_name');
      localStorage.removeItem('portal_user_role');
      localStorage.removeItem('portal_user_id');
      if (rememberMe) localStorage.setItem('portal_remember_username', username);
      navigate('/dashboard', { replace: true });
      setAuthLoading(false);
      return;
    }

    if (loginMobile.length !== 10) {
      setAuthLoading(false);
      alert(PHONE_VALIDATION_ERROR);
      return;
    }

    const employee = employees.find((entry) => {
      const role = String(entry?.role || '').trim().toLowerCase();
      const roleEligible = role.includes('technician') || role.includes('sales');
      const hasPortal = Boolean(
        entry?.webPortalAccessEnabled
        || entry?.portalAccess === 'Yes'
        || entry?.portalAccess === true
        || entry?.appAccessEnabled
        || roleEligible
      );
      const employeeMobile = normalizeIndianMobileNumber(entry?.mobile || '');
      const employeePassword = String(entry?.portalPassword || '').trim();
      return hasPortal && employeeMobile && employeePassword && loginMobile === employeeMobile && password === employeePassword;
    });

    if (employee) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('portal_user_name', [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.empCode || 'Employee');
      localStorage.setItem('portal_user_role', String(employee.role || 'Employee'));
      localStorage.setItem('portal_user_id', String(employee._id || ''));
      if (rememberMe) localStorage.setItem('portal_remember_username', username);
      navigate(getEmployeeLandingPath(employee.role), { replace: true });
      setAuthLoading(false);
      return;
    }

    setAuthLoading(false);
    alert('Invalid credentials');
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
    <div style={{ minHeight: '100dvh', width: '100%', background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--color-primary) 16%, transparent) 0%, transparent 34%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-primary-dark) 12%, transparent) 0%, transparent 28%), linear-gradient(145deg, var(--color-bg) 0%, var(--color-bg-alt) 100%)', display: 'grid', placeItems: 'center', padding: isNarrow ? '8px' : '24px' }}>
      <div style={{ width: '100%', maxWidth: '900px', borderRadius: isNarrow ? '14px' : '16px', border: '1px solid var(--color-panel-border)', background: 'var(--color-surface)', boxShadow: 'var(--color-panel-glow)', overflow: 'hidden' }}>
        <section style={{ display: 'grid', gridTemplateColumns: viewportWidth < 900 ? '1fr' : '1fr 1fr', minHeight: viewportWidth < 900 ? 'auto' : '420px' }}>
          <div style={{ display: 'grid', placeItems: 'center', padding: isNarrow ? '8px 14px 0' : '18px 18px 8px' }}>
            {hasValidLogo ? (
              <img
                src={settings.dashboardImageUrl}
                alt="Company Logo"
                onError={() => setLogoBroken(true)}
                style={{
                  width: isNarrow ? '220px' : '300px',
                  maxWidth: '95%',
                  height: 'auto',
                  objectFit: 'contain',
                  background: 'transparent',
                  mixBlendMode: 'multiply'
                }}
              />
            ) : (
              <div
                style={{
                  width: isNarrow ? '72px' : '92px',
                  height: isNarrow ? '72px' : '92px',
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                  borderRadius: '18px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'var(--color-on-primary)',
                  fontWeight: 800,
                  fontSize: isNarrow ? '20px' : '26px'
                }}
              >
                SPC
              </div>
            )}
          </div>

          <div style={{ padding: isNarrow ? '10px 14px 16px' : '28px 30px 26px', display: 'grid', alignContent: isNarrow ? 'start' : 'center', gap: isNarrow ? '10px' : '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: isNarrow ? '24px' : '34px', color: 'var(--color-primary)', fontWeight: 800, lineHeight: 1.08 }}>Welcome</h2>
            </div>

            <div style={{ width: '100%', padding: 0 }}>
            <form onSubmit={handleLogin} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 700 }}>Login Mobile Number / Username</label>
              <input
                type="text"
                name="username"
                onChange={handleChange}
                value={credentials.username}
                style={{ width: '100%', padding: '12px 13px', borderRadius: '8px', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-panel-border)' }}
                required
              />
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-muted)', fontWeight: 600 }}>For employees, use your 10-digit mobile number.</p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 700 }}>Password</label>
              <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                onChange={handleChange}
                value={credentials.password}
                style={{ width: '100%', padding: '12px 42px 12px 13px', borderRadius: '8px', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-panel-border)' }}
                required
              />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)', fontSize: '13px', fontWeight: 600 }}>
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(true);
                  setForgotStep('request');
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', textAlign: 'center', marginTop: '2px' }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              style={{
                marginTop: '6px',
                minHeight: '48px',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: '1px solid var(--color-primary)',
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
        <div style={{ position: 'fixed', inset: 0, background: 'var(--color-overlay)', display: 'grid', placeItems: 'center', zIndex: 9999, padding: '14px' }}>
          <div style={{ width: '100%', maxWidth: '430px', background: 'var(--color-surface)', borderRadius: '14px', border: '1px solid var(--color-panel-border)', padding: '16px', boxShadow: 'var(--color-panel-glow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Reset Password</h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            {forgotStep === 'request' ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontWeight: 700, fontSize: '14px' }}>
                  Reset OTP will be sent to the registered master email.
                </p>
                <button
                  type="button"
                  onClick={requestResetOtp}
                  disabled={forgotLoading}
                  style={{ minHeight: '44px', background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: '1px solid var(--color-primary)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {forgotLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                <label style={{ color: 'var(--color-muted)', fontWeight: 700 }}>OTP</label>
                <input
                  type="text"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-panel-border)' }}
                />
                <label style={{ color: 'var(--color-muted)', fontWeight: 700 }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-panel-border)' }}
                />
                <label style={{ color: 'var(--color-muted)', fontWeight: 700 }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-panel-border)' }}
                />
                <button
                  type="button"
                  onClick={submitResetPassword}
                  disabled={forgotLoading}
                  style={{ minHeight: '44px', background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: '1px solid var(--color-primary)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
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
