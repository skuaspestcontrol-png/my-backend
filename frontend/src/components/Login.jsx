import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyBrandingTheme, saveBrandingSettings } from '../utils/brandingTheme';
import { Eye, EyeOff, ShieldCheck, Wrench } from 'lucide-react';

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
    if (role === 'sales') return '/sales-portal';
    if (role === 'operations') return '/operations-portal';
    if (role === 'technician') return '/operations/assigned-jobs';
    return '/dashboard';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const username = String(credentials.username || '').trim();
    const password = String(credentials.password || '');
    const expectedUsername = String(settings.adminUsername || 'admin').trim() || 'admin';
    const expectedPassword = String(settings.adminPassword || 'admin123');

    if (username === expectedUsername && password === expectedPassword) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.removeItem('portal_user_name');
      localStorage.removeItem('portal_user_role');
      localStorage.removeItem('portal_user_id');
      if (rememberMe) localStorage.setItem('portal_remember_email', username);
      navigate('/dashboard', { replace: true });
      setAuthLoading(false);
      return;
    }

    const employee = employees.find((entry) => {
      const hasPortal = Boolean(entry?.webPortalAccessEnabled || entry?.portalAccess === 'Yes' || entry?.appAccessEnabled);
      const email = String(entry?.email || entry?.emailId || '').trim().toLowerCase();
      const employeePassword = String(entry?.portalPassword || '');
      return hasPortal && email && employeePassword && username.toLowerCase() === email && password === employeePassword;
    });

    if (employee) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('portal_user_name', [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.empCode || 'Employee');
      localStorage.setItem('portal_user_role', String(employee.role || 'Employee'));
      localStorage.setItem('portal_user_id', String(employee._id || ''));
      if (rememberMe) localStorage.setItem('portal_remember_email', username);
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
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters');
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
    <div style={{ minHeight: '100dvh', width: '100%', background: 'linear-gradient(120deg, #f0fdfa 0%, #f8fafc 45%, #eff6ff 100%)', display: 'grid', placeItems: 'center', padding: isNarrow ? '12px' : '24px' }}>
      <div style={{ width: '100%', maxWidth: '1080px', minHeight: isNarrow ? 'auto' : '680px', borderRadius: '22px', border: '1px solid var(--color-border)', background: '#fff', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'grid', gridTemplateColumns: viewportWidth < 980 ? '1fr' : '1.1fr 1fr' }}>
        <section style={{ display: viewportWidth < 980 ? 'none' : 'grid', alignContent: 'space-between', padding: '34px 30px', background: 'radial-gradient(circle at 20% 10%, rgba(34,197,94,0.18), transparent 40%), radial-gradient(circle at 86% 16%, rgba(37,99,235,0.2), transparent 45%), linear-gradient(145deg, #0f766e 0%, #115e59 65%, #0f172a 100%)', color: '#ECFEFF' }}>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)', display: 'grid', placeItems: 'center' }}>
              <ShieldCheck size={26} />
            </div>
            <h1 style={{ margin: 0, fontSize: '36px', lineHeight: 1.15, fontWeight: 800 }}>Manage your pest control business with confidence.</h1>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, color: 'rgba(236,254,255,0.88)' }}>
              Track leads, contracts, services, renewals, vendor bills, and team operations from one clean command center.
            </p>
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,0.28)', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', padding: '14px' }}>
            <p style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 }}>
              <Wrench size={16} /> Secure Admin Access
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'rgba(236,254,255,0.86)' }}>Protected portal login for admin and role-based employee accounts.</p>
          </div>
        </section>

        <section style={{ padding: isNarrow ? '20px 14px' : '34px 36px', display: 'grid', alignContent: 'center', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: viewportWidth < 980 ? 'center' : 'flex-start' }}>
          {hasValidLogo ? (
            <img
              src={settings.dashboardImageUrl}
              alt="Company Logo"
              onError={() => setLogoBroken(true)}
              style={{
                width: isNarrow ? '200px' : '250px',
                maxWidth: '92%',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
          ) : (
            <div
              style={{
                width: isNarrow ? '72px' : '86px',
                height: isNarrow ? '72px' : '86px',
                backgroundColor: 'var(--color-primary)',
                borderRadius: '18px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: isNarrow ? '20px' : '24px'
              }}
            >
              SPC
            </div>
          )}
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: isNarrow ? '30px' : '34px', color: '#0f172a', fontWeight: 800 }}>Welcome Back</h2>
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: '14px', fontWeight: 500 }}>Login to manage your pest control business</p>
          </div>

          <div style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #D9DEE8', borderRadius: '14px', padding: isNarrow ? '14px 12px' : '18px 18px', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)' }}>
            <form onSubmit={handleLogin} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontSize: '13px', fontWeight: 700 }}>Email / Username</label>
              <input
                type="text"
                name="username"
                onChange={handleChange}
                value={credentials.username}
                style={{ width: '100%', padding: '12px 13px', borderRadius: '10px', boxSizing: 'border-box', background: '#F8FAFC', border: '1px solid #CBD5E1' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontSize: '13px', fontWeight: 700 }}>Password</label>
              <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                onChange={handleChange}
                value={credentials.password}
                style={{ width: '100%', padding: '12px 42px 12px 13px', borderRadius: '10px', boxSizing: 'border-box', background: '#F8FAFC', border: '1px solid #CBD5E1' }}
                required
              />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '13px', fontWeight: 600 }}>
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
                color: '#fff',
                border: '1px solid var(--color-primary)',
                borderRadius: '10px',
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

          <div style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '12px', padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Demo Login</p>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#475569' }}>Email: admin@example.com</p>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>Password: ••••••••</p>
          </div>
        </section>
      </div>
      {forgotOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999, padding: '14px' }}>
          <div style={{ width: '100%', maxWidth: '430px', background: '#fff', borderRadius: '14px', border: '1px solid #D9DEE8', padding: '16px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#1E293B' }}>Reset Password</h3>
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
                <p style={{ margin: 0, color: '#475569', fontWeight: 700, fontSize: '14px' }}>
                  Reset OTP will be sent to the registered master email.
                </p>
                <button
                  type="button"
                  onClick={requestResetOtp}
                  disabled={forgotLoading}
                  style={{ minHeight: '44px', background: 'var(--color-primary)', color: '#fff', border: '1px solid var(--color-primary)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {forgotLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                <label style={{ color: '#475569', fontWeight: 700 }}>OTP</label>
                <input
                  type="text"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: '#E9EEF9', border: '1px solid #CBD5E1' }}
                />
                <label style={{ color: '#475569', fontWeight: 700 }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: '#E9EEF9', border: '1px solid #CBD5E1' }}
                />
                <label style={{ color: '#475569', fontWeight: 700 }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: '#E9EEF9', border: '1px solid #CBD5E1' }}
                />
                <button
                  type="button"
                  onClick={submitResetPassword}
                  disabled={forgotLoading}
                  style={{ minHeight: '44px', background: 'var(--color-primary)', color: '#fff', border: '1px solid var(--color-primary)', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
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
