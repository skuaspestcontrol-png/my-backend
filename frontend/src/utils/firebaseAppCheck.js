import { initializeApp } from 'firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'firebase/app-check';

let firebaseApp = null;
let appCheckInstance = null;
let appCheckInitError = null;

const readEnv = (key) => String(import.meta.env[key] || '').trim();

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET')
};

const appCheckSiteKey = readEnv('VITE_FIREBASE_APPCHECK_SITE_KEY');
const appCheckDebugEnabled = /^(1|true|yes)$/i.test(readEnv('VITE_FIREBASE_APPCHECK_DEBUG'));
const appCheckDebugToken = readEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN');

const isFirebaseConfigReady = () => (
  firebaseConfig.apiKey
  && firebaseConfig.projectId
  && firebaseConfig.appId
);

export const initFirebaseAppCheck = () => {
  if (appCheckInstance || appCheckInitError) return appCheckInstance;
  if (!isFirebaseConfigReady() || !appCheckSiteKey) return null;

  try {
    if (appCheckDebugEnabled) {
      // Dev-only debug mode. Use "true" to auto-generate a token in console.
      // Use a fixed token string if you want to reuse an allowlisted token.
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken || true;
      console.info('[AppCheck] Debug mode enabled.');
    }

    firebaseApp = initializeApp(firebaseConfig);
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true
    });
    console.info('[AppCheck] Initialized successfully.');
    return appCheckInstance;
  } catch (error) {
    appCheckInitError = error;
    console.error('[AppCheck] Initialization failed:', error);
    return null;
  }
};

export const getAppCheckTokenForMaps = async () => {
  const appCheck = appCheckInstance || initFirebaseAppCheck();
  if (!appCheck) return { token: '' };
  try {
    const tokenResult = await getToken(appCheck, false);
    return {
      token: String(tokenResult?.token || ''),
      expireTimeMillis: Number(tokenResult?.expireTimeMillis || 0)
    };
  } catch (error) {
    console.error('[AppCheck] Token fetch failed:', error);
    return { token: '' };
  }
};

export const attachMapsAppCheckTokenProvider = async () => {
  if (!window.google?.maps?.importLibrary) return;
  try {
    await window.google.maps.importLibrary('core');
    const settings = window.google.maps.Settings?.getInstance?.();
    if (!settings) return;
    settings.fetchAppCheckToken = () => getAppCheckTokenForMaps();
    console.info('[Maps] App Check token provider attached.');
  } catch (error) {
    console.error('[Maps] Failed to attach App Check token provider:', error);
  }
};

