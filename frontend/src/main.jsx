import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applyBrandingTheme, loadBrandingSettings } from './utils/brandingTheme'

const cachedBranding = loadBrandingSettings();
if (cachedBranding) {
  applyBrandingTheme(cachedBranding);
}

document.title = 'Skuas Master CRM';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
