import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function Login() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [settings, setSettings] = useState({});
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

  return (
    <div style={{ minHeight: '100dvh', width: '100%', background: '#EDEFF4', display: 'flex', justifyContent: 'center', padding: isNarrow ? '18px 12px' : '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: '560px', display: 'grid', gap: isNarrow ? '14px' : '18px', alignContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {settings.dashboardImageUrl ? (
            <img
              src={settings.dashboardImageUrl}
              alt="Company Logo"
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
          </form>
        </div>
      </div>
    </div>
  );
}
