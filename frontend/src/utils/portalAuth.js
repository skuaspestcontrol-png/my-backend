import axios from 'axios';

let portalUserSnapshot = null;

const normalizePortalUser = (user = null) => {
  if (!user || typeof user !== 'object') return null;
  const id = String(user.id || user.employeeId || user.userId || user.sub || '').trim();
  const employeeId = String(user.employeeId || id || '').trim();
  const employeeCode = String(user.employeeCode || '').trim();
  const role = String(user.role || 'Employee').trim() || 'Employee';
  const name = String(user.name || user.userName || user.employeeName || 'User').trim() || 'User';
  const type = String(user.type || 'employee').trim() || 'employee';
  return { id, employeeId, employeeCode, role, name, type };
};

export const setPortalUser = (user) => {
  portalUserSnapshot = normalizePortalUser(user);
  return portalUserSnapshot;
};

export const clearPortalUser = () => {
  portalUserSnapshot = null;
};

export const getPortalUser = () => portalUserSnapshot;

export const getPortalUserRole = () => String(portalUserSnapshot?.role || '').trim();

export const getPortalUserName = () => String(portalUserSnapshot?.name || '').trim();

export const getPortalUserId = () => String(portalUserSnapshot?.employeeId || portalUserSnapshot?.id || '').trim();

export const buildPortalAuthHeaders = (user = portalUserSnapshot) => {
  void user;
  return {};
};

export const fetchPortalUser = async (apiBaseUrl = '') => {
  const baseUrl = String(apiBaseUrl || '').trim();
  const url = `${baseUrl}/api/auth/me`;
  const response = await axios.get(url, { withCredentials: true });
  return setPortalUser(response?.data?.user || null);
};

export const logoutPortalUser = async (apiBaseUrl = '') => {
  const baseUrl = String(apiBaseUrl || '').trim();
  await axios.post(`${baseUrl}/api/auth/logout`, {}, { withCredentials: true });
  clearPortalUser();
};
