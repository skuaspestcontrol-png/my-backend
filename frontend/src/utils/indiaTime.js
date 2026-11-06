import { PORTAL_TIME_ZONE, formatPortalDate, formatPortalTime, formatPortalDateTime } from './portalDateTime.js';
export const INDIA_TIME_ZONE = PORTAL_TIME_ZONE;
// Retain the existing call signatures for portal consumers.
export const formatIndiaDateTime = (value, _options = {}, fallback = '-') => formatPortalDateTime(value, fallback);
export const formatIndiaDate = (value, _options = {}, fallback = '-') => formatPortalDate(value, fallback);
export const formatIndiaTime = (value, _options = {}, fallback = '-') => formatPortalTime(value, fallback);
