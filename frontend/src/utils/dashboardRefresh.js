const DASHBOARD_REFRESH_KEY = 'dashboard_refresh_at';

export const triggerDashboardRefresh = () => {
  const stamp = String(Date.now());
  try {
    window.localStorage.setItem(DASHBOARD_REFRESH_KEY, stamp);
  } catch (_error) {}
  try {
    window.dispatchEvent(new CustomEvent('dashboard:refresh', { detail: { stamp } }));
  } catch (_error) {}
};

export const subscribeDashboardRefresh = (handler) => {
  const onCustomRefresh = () => handler();
  const onStorageRefresh = (event) => {
    if (event.key === DASHBOARD_REFRESH_KEY) handler();
  };

  window.addEventListener('dashboard:refresh', onCustomRefresh);
  window.addEventListener('storage', onStorageRefresh);

  return () => {
    window.removeEventListener('dashboard:refresh', onCustomRefresh);
    window.removeEventListener('storage', onStorageRefresh);
  };
};
