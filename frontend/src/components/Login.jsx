import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyBrandingTheme, saveBrandingSettings } from '../utils/brandingTheme';

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
    if (role === 'technician') return '/technician-portal';
    return '/dashboard';
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const username = String(credentials.username || '').trim();
    const password = String(credentials.password || '');
    const expectedUsername = String(settings.adminUsername || 'admin').trim() || 'admin';
    const expectedPassword = String(settings.adminPassword || 'admin123');

    if (username === expectedUsername && password === expectedPassword) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.removeItem('portal_user_name');
      localStorage.removeItem('portal_user_role');
      localStorage.removeItem('portal_user_id');
      navigate('/dashboard', { replace: true });
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
      navigate(getEmployeeLandingPath(employee.role), { replace: true });
      return;
    }

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
    <div style={{ minHeight: '100dvh', width: '100%', background: '#EDEFF4', display: 'flex', justifyContent: 'center', padding: isNarrow ? '18px 12px' : '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: '560px', display: 'grid', gap: isNarrow ? '14px' : '18px', alignContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {hasValidLogo ? (
            <img
              src={settings.dashboardImageUrl}
              alt="Company Logo"
              onError={() => setLogoBroken(true)}
              style={{
                width: isNarrow ? '220px' : '320px',
                maxWidth: '92%',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
          ) : (
            <div
              style={{
                width: isNarrow ? '74px' : '88px',
                height: isNarrow ? '74px' : '88px',
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

        <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto', backgroundColor: '#fff', border: '1px solid #D9DEE8', borderRadius: '14px', padding: isNarrow ? '16px 12px' : '20px 24px', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)' }}>
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontSize: '15px', fontWeight: 700 }}>Email</label>
              <input
                type="text"
                name="username"
                onChange={handleChange}
                style={{ width: '100%', padding: '12px 13px', borderRadius: '10px', boxSizing: 'border-box', background: '#E9EEF9', border: '1px solid #CBD5E1' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontSize: '15px', fontWeight: 700 }}>Password</label>
              <input
                type="password"
                name="password"
                onChange={handleChange}
                style={{ width: '100%', padding: '12px 13px', borderRadius: '10px', boxSizing: 'border-box', background: '#E9EEF9', border: '1px solid #CBD5E1' }}
                required
              />
            </div>

            <button
              type="submit"
              style={{
                marginTop: '6px',
                minHeight: '48px',
                background: 'var(--color-primary)',
                color: '#fff',
                border: '1px solid var(--color-primary)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '16px'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotOpen(true);
                setForgotStep('request');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-primary)',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: '2px'
              }}
            >
              Forgot Password?
            </button>
          </form>
        </div>
      </div>
      {forgotOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999, padding: '14px' }}>
          <div style={{ width: '100%', maxWidth: '430px', background: '#fff', borderRadius: '14px', border: '1px solid #D9DEE8', padding: '16px' }}>
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
                <label style={{ color: '#475569', fontWeight: 700 }}>Master Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', boxSizing: 'border-box', background: '#E9EEF9', border: '1px solid #CBD5E1' }}
                />
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
