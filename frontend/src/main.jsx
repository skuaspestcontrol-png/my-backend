import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applyBrandingTheme, loadBrandingSettings } from './utils/brandingTheme'
import { initFirebaseAppCheck } from './utils/firebaseAppCheck'
import axios from 'axios'
import { buildPortalAuthHeaders, clearPortalUser, getPortalUser } from './utils/portalAuth'

const cachedBranding = loadBrandingSettings();
if (cachedBranding) {
  applyBrandingTheme(cachedBranding);
}

axios.defaults.withCredentials = true;
axios.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  const headers = {
    ...(nextConfig.headers || {}),
    ...buildPortalAuthHeaders(getPortalUser())
  };
  nextConfig.headers = headers;
  return nextConfig;
});
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearPortalUser();
    }
    return Promise.reject(error);
  }
);

document.title = 'Skuas Master CRM';
initFirebaseAppCheck();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
